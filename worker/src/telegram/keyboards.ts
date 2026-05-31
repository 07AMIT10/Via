export function digestKeyboard(
  problemId: number,
  slug: string | null,
  pagesUrl: string,
  rich: boolean,
): Record<string, unknown> {
  const key = slug ?? String(problemId);
  if (!rich) {
    return {
      inline_keyboard: [
        [{ text: "Solve now", web_app: { url: `${pagesUrl}?problem=${problemId}` } }],
        [
          { text: "Hint 1", callback_data: `h:${key}:1` },
          { text: "Mark read", callback_data: `r:${key}` },
        ],
        [
          { text: "Show approach", callback_data: `a:${key}` },
          { text: "Skip today", callback_data: `k:${key}` },
        ],
        [
          { text: "Mark attempted", callback_data: `m:${key}` },
          { text: "Show solution", callback_data: `s:${key}` },
        ],
      ],
    };
  }

  return {
    inline_keyboard: [
      [{ text: "Solve now", web_app: { url: `${pagesUrl}?problem=${problemId}` } }],
      [
        { text: "Hint 1", callback_data: `h:${key}:1` },
        { text: "Mark read", callback_data: `r:${key}` },
      ],
      [
        { text: "Approach 1", callback_data: `ap:${key}:0` },
        { text: "Quiz", callback_data: `q:${key}` },
      ],
      [
        { text: "Debug", callback_data: `db:${key}` },
        { text: "Lore", callback_data: `lo:${key}` },
      ],
      [
        { text: "Mark attempted", callback_data: `m:${key}` },
        { text: "Show solution", callback_data: `s:${key}` },
        { text: "Skip", callback_data: `k:${key}` },
      ],
    ],
  };
}

export function approachKeyboard(
  slug: string,
  index: number,
  hasNext: boolean,
): Record<string, unknown> {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  if (hasNext) {
    rows.push([
      { text: "Next approach", callback_data: `ap:${slug}:${index + 1}` },
      { text: "Dry run", callback_data: `dr:${slug}:${index}` },
    ]);
  } else {
    rows.push([{ text: "Dry run", callback_data: `dr:${slug}:${index}` }]);
  }
  return { inline_keyboard: rows };
}

export function quizKeyboard(slug: string, optionCount: number): Record<string, unknown> {
  const row = Array.from({ length: optionCount }, (_, i) => ({
    text: String(i + 1),
    callback_data: `qa:${slug}:${i}`,
  }));
  return { inline_keyboard: [row] };
}

export function debugFixKeyboard(slug: string): Record<string, unknown> {
  return {
    inline_keyboard: [[{ text: "Show fix", callback_data: `df:${slug}` }]],
  };
}
