interface DigestModel {
  day: number;
  pattern: string;
  difficulty: string;
  title: string;
  description: string;
  keyInsight: string;
  whyItMatters: string;
  applications: string[];
  variations: Array<{ title: string; oneLiner: string }>;
  complexity: string;
}

function esc(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderDigest(model: DigestModel): string {
  const apps = model.applications.slice(0, 3).map((a) => `• ${esc(a)}`).join("\n");
  const vars = model.variations
    .slice(0, 2)
    .map((v) => `• <i>${esc(v.title)}</i> — ${esc(v.oneLiner)}`)
    .join("\n");

  return `<b>Day ${model.day} · ${esc(model.pattern)} · ${esc(model.difficulty)}</b>

<b>${esc(model.title)}</b>
${esc(model.description)}

<b>Key insight</b>
${esc(model.keyInsight)}

<b>Why it matters</b>
${esc(model.whyItMatters)}

<b>Where you'll see this</b>
${apps}

<b>Variations</b>
${vars}

<b>Complexity target</b>
<code>${esc(model.complexity)}</code>`;
}

