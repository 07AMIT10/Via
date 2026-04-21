import type { ProblemRecord } from "./types";

interface EnrichmentResult {
  key_insight: string;
  applications: string[];
  variations: Array<{ title: string; one_liner: string }>;
  why_it_matters: string;
  canonical_approach: string;
  canonical_solutions: { python: string; go: string; rust: string };
  hints: string[];
  complexity: string;
}

const ENRICHMENT_PROMPT = `You are enriching DSA problems for Telegram-first daily learning.
Return strict JSON with this schema:
{
  "key_insight": "string <= 180 chars",
  "applications": ["string", "string", "string"],
  "variations": [{"title":"string","one_liner":"string"},{"title":"string","one_liner":"string"}],
  "why_it_matters": "string <= 280 chars",
  "canonical_approach": "string, no code, 4-7 sentences",
  "canonical_solutions": {"python":"string","go":"string","rust":"string"},
  "hints": ["string","string","string"],
  "complexity": "string"
}
No markdown fences. JSON only.`;

export async function enrichProblem(
  record: ProblemRecord,
): Promise<ProblemRecord> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return record;
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ENRICHMENT_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            title: record.title,
            description: record.description,
            pattern: record.pattern,
            difficulty: record.difficulty,
            topic: record.topic,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    return record;
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    return record;
  }

  let parsed: EnrichmentResult;
  try {
    parsed = JSON.parse(content) as EnrichmentResult;
  } catch {
    return record;
  }

  return {
    ...record,
    key_insight: parsed.key_insight || record.key_insight,
    applications_json: JSON.stringify(parsed.applications ?? JSON.parse(record.applications_json)),
    variations_json: JSON.stringify(parsed.variations ?? JSON.parse(record.variations_json)),
    why_it_matters: parsed.why_it_matters || record.why_it_matters,
    canonical_approach: parsed.canonical_approach || record.canonical_approach,
    canonical_solutions_json: JSON.stringify(parsed.canonical_solutions ?? JSON.parse(record.canonical_solutions_json)),
    hints_json: JSON.stringify(parsed.hints ?? JSON.parse(record.hints_json)),
    complexity: parsed.complexity || record.complexity,
  };
}
