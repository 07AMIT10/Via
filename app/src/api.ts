const WORKER_BASE =
  import.meta.env.VITE_WORKER_BASE_URL || "http://127.0.0.1:8787";

export interface ProblemPayload {
  id: number;
  day_number: number;
  title: string;
  description: string;
  pattern: string;
  difficulty: string;
  key_insight: string | null;
  why_it_matters: string | null;
  applications_json: string | null;
  variations_json: string | null;
  complexity: string | null;
}

export async function fetchToday(initData: string): Promise<ProblemPayload | null> {
  const res = await fetch(`${WORKER_BASE}/api/today`, {
    headers: {
      Authorization: `tma ${initData}`,
    },
  });
  if (!res.ok) {
    return null;
  }
  return res.json() as Promise<ProblemPayload>;
}

export async function fetchProblemById(
  initData: string,
  problemId: number,
): Promise<ProblemPayload | null> {
  const res = await fetch(`${WORKER_BASE}/api/problem/${problemId}`, {
    headers: {
      Authorization: `tma ${initData}`,
    },
  });
  if (!res.ok) {
    return null;
  }
  return res.json() as Promise<ProblemPayload>;
}

export async function submitCode(
  initData: string,
  payload: {
    problemId: number;
    language: "python" | "go" | "rust";
    code: string;
    mode: "run" | "submit";
  },
): Promise<{ verdict: string; output: string }> {
  const res = await fetch(`${WORKER_BASE}/api/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `tma ${initData}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return { verdict: "error", output: "Submission failed." };
  }
  return res.json() as Promise<{ verdict: string; output: string }>;
}
