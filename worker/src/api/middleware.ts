import type { Env } from "../env";

export interface TelegramAuthContext {
  telegramId: number;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function hmacSha256Hex(key: ArrayBuffer | Uint8Array | string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    typeof key === "string" ? enc.encode(key) : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseInitData(initData: string): Record<string, string> {
  const params = new URLSearchParams(initData);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    out[k] = v;
  }
  return out;
}

function unauthorized(message = "unauthorized"): Response {
  return new Response(message, { status: 401 });
}

export async function verifyTelegramInitData(
  env: Env,
  request: Request,
): Promise<{ ok: true; context: TelegramAuthContext } | { ok: false; response: Response }> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("tma ")) {
    return { ok: false, response: unauthorized("missing telegram auth") };
  }

  const initData = auth.slice(4).trim();
  if (!initData) {
    return { ok: false, response: unauthorized("empty init data") };
  }

  const parsed = parseInitData(initData);
  const providedHash = parsed.hash;
  if (!providedHash) {
    return { ok: false, response: unauthorized("missing hash") };
  }

  const dataCheckArr = Object.entries(parsed)
    .filter(([key]) => key !== "hash")
    .map(([k, v]) => `${k}=${v}`)
    .sort();
  const dataCheckString = dataCheckArr.join("\n");

  const secretKeyHex = await hmacSha256Hex("WebAppData", env.TELEGRAM_BOT_TOKEN);
  const secretKey = new Uint8Array(secretKeyHex.match(/.{1,2}/g)?.map((h) => parseInt(h, 16)) ?? []);
  const computedHash = await hmacSha256Hex(secretKey, dataCheckString);

  if (!timingSafeEqual(computedHash, providedHash)) {
    return { ok: false, response: unauthorized("invalid hash") };
  }

  const authDate = Number(parsed.auth_date ?? "0");
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || now - authDate > 24 * 60 * 60) {
    return { ok: false, response: unauthorized("stale init data") };
  }

  let telegramId: number | null = null;
  try {
    const user = JSON.parse(parsed.user ?? "{}") as { id?: number };
    if (typeof user.id === "number") {
      telegramId = user.id;
    }
  } catch {
    telegramId = null;
  }

  if (!telegramId) {
    return { ok: false, response: unauthorized("missing user id") };
  }

  return { ok: true, context: { telegramId } };
}
