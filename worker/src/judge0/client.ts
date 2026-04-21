import type { Env } from "../env";

const LANGUAGE_IDS: Record<"python" | "go" | "rust", number> = {
  python: 71,
  go: 60,
  rust: 73,
};

interface Judge0Result {
  status?: { id?: number; description?: string };
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
}

function statusToVerdict(id: number | undefined): string {
  switch (id) {
    case 3:
      return "accepted";
    case 4:
      return "wrong-answer";
    case 5:
      return "time-limit-exceeded";
    case 6:
      return "compile-error";
    case 11:
      return "runtime-error";
    default:
      return "unknown";
  }
}

export async function runJudge0(
  env: Env,
  payload: {
    language: "python" | "go" | "rust";
    code: string;
    stdin?: string;
    wait?: boolean;
  },
): Promise<{ verdict: string; output: string }> {
  if (!env.JUDGE0_URL || !env.JUDGE0_AUTH_TOKEN) {
    return {
      verdict: "stub",
      output: "Judge0 is not configured in this environment.",
    };
  }

  const base = env.JUDGE0_URL.replace(/\/+$/, "");
  const wait = payload.wait ?? true;
  const createRes = await fetch(
    `${base}/submissions?base64_encoded=false&wait=${wait ? "true" : "false"}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Auth-Token": env.JUDGE0_AUTH_TOKEN,
      },
      body: JSON.stringify({
        source_code: payload.code,
        language_id: LANGUAGE_IDS[payload.language],
        stdin: payload.stdin ?? "",
      }),
    },
  );

  if (!createRes.ok) {
    return {
      verdict: "judge0-error",
      output: `Judge0 submission failed with status ${createRes.status}.`,
    };
  }

  const created = await createRes.json();
  let result: Judge0Result = created;

  if (!wait && created?.token) {
    const token = created.token as string;
    for (let i = 0; i < 10; i += 1) {
      const poll = await fetch(`${base}/submissions/${token}?base64_encoded=false`, {
        headers: {
          "X-Auth-Token": env.JUDGE0_AUTH_TOKEN,
        },
      });
      if (!poll.ok) {
        break;
      }
      result = (await poll.json()) as Judge0Result;
      const statusId = result.status?.id;
      if (statusId && statusId > 2) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  }

  const verdict = statusToVerdict(result.status?.id);
  const output =
    result.stdout ??
    result.stderr ??
    result.compile_output ??
    result.status?.description ??
    "No output";

  return { verdict, output };
}
