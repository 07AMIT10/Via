import type { Env } from "../env";
import { listActiveSubscribers } from "../db/repo";

interface BroadcastMessage {
  chatId: number;
  telegramId: number;
  day: number;
}

export async function runDailyBroadcastCron(env: Env): Promise<void> {
  const subscribers = await listActiveSubscribers(env);
  if (subscribers.length === 0) {
    return;
  }

  const messages: BroadcastMessage[] = subscribers.map((s) => ({
    chatId: s.chat_id,
    telegramId: s.telegram_id,
    day: s.current_day,
  }));

  await env.BROADCAST_QUEUE.sendBatch(messages);
}
