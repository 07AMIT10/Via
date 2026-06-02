const TELEGRAM_HTML_LIMIT = 4000;

export function truncateTelegramHtml(html: string, maxLen = TELEGRAM_HTML_LIMIT): string {
  if (html.length <= maxLen) {
    return html;
  }
  return `${html.slice(0, maxLen - 20)}\n\n<i>…continued</i>`;
}
