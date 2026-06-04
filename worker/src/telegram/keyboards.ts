export function navKeyboardRow(): Array<{ text: string; callback_data: string }> {
  return [
    { text: "◀ Prev", callback_data: "bp" },
    { text: "Next ▶", callback_data: "bn" },
  ];
}

export function navMenuRow(): Array<{ text: string; callback_data: string }> {
  return [
    { text: "Browse all", callback_data: "bb" },
    { text: "Today", callback_data: "bt" },
  ];
}

export function digestKeyboardWithNav(
  problemId: number,
  slug: string | null,
  pagesUrl: string,
  rich: boolean,
): Record<string, unknown> {
  const base = digestKeyboard(problemId, slug, pagesUrl, rich);
  const rows = [...(base.inline_keyboard as Array<Array<{ text: string; callback_data: string }>>)];
  rows.push(navKeyboardRow());
  rows.push(navMenuRow());
  return { inline_keyboard: rows };
}

export function browseListKeyboard(
  items: Array<{ slug: string; day_number: number; title: string }>,
): Record<string, unknown> {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < items.length; i += 2) {
    const pair = items.slice(i, i + 2).map((item) => ({
      text: `Day ${item.day_number}: ${truncateTitle(item.title, 18)}`,
      callback_data: `pv:${item.slug}`,
    }));
    rows.push(pair);
  }
  rows.push(navMenuRow());
  return { inline_keyboard: rows };
}

function truncateTitle(title: string, max: number): string {
  if (title.length <= max) {
    return title;
  }
  return `${title.slice(0, max - 1)}…`;
}

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
