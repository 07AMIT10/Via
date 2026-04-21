import { z } from "zod";
import type { Env } from "../env";
import { handleCommand } from "./commands";

const updateSchema = z.object({
  message: z
    .object({
      text: z.string().optional(),
      chat: z.object({ id: z.number() }),
      from: z.object({ id: z.number(), username: z.string().nullable().optional() }),
    })
    .optional(),
});

export async function processTelegramUpdate(env: Env, body: unknown): Promise<Response> {
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return new Response("ok");
  }

  const msg = parsed.data.message;
  if (!msg?.text) {
    return new Response("ok");
  }

  if (msg.text.startsWith("/")) {
    const command = msg.text.trim().split(/\s+/)[0] ?? "/today";
    await handleCommand(env, command, msg.from.id, msg.chat.id, msg.from.username ?? null);
  }

  return new Response("ok");
}

