import { z } from "zod";
import type { Env } from "../env";
import { handleCommand } from "./commands";
import { handleCallback } from "./callbacks";

const updateSchema = z.object({
  message: z
    .object({
      text: z.string().optional(),
      chat: z.object({ id: z.number() }),
      from: z.object({ id: z.number(), username: z.string().nullable().optional() }),
    })
    .optional(),
  callback_query: z
    .object({
      id: z.string(),
      data: z.string().optional(),
      from: z.object({ id: z.number() }),
      message: z
        .object({
          chat: z.object({ id: z.number() }),
        })
        .optional(),
    })
    .optional(),
});

function normalizeCommand(input: string): string {
  const token = input.trim().split(/\s+/)[0] ?? "";
  if (!token.startsWith("/")) {
    return token;
  }
  const base = token.split("@")[0] ?? token;
  return base.toLowerCase();
}

export async function processTelegramUpdate(env: Env, body: unknown): Promise<Response> {
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("ok");
  }

  const msg = parsed.data.message;
  if (msg?.text?.startsWith("/")) {
    const command = normalizeCommand(msg.text);
    await handleCommand(env, command, msg.text, msg.from.id, msg.chat.id, msg.from.username ?? null);
    return new Response("ok");
  }

  const cb = parsed.data.callback_query;
  if (cb?.data && cb.message?.chat.id) {
    await handleCallback(env, cb.id, cb.message.chat.id, cb.from.id, cb.data);
  }

  return new Response("ok");
}

