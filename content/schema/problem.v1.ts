import { z } from "zod";

export const approachSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  summary: z.string().min(1),
  intuition: z.string().min(1),
  algorithm_steps: z.array(z.string()).min(1),
  complexity: z.object({
    time: z.object({
      notation: z.string(),
      explanation: z.string().optional(),
      best_case: z.string().optional(),
      worst_case: z.string().optional(),
    }),
    space: z.object({
      notation: z.string(),
      explanation: z.string().optional(),
    }),
  }),
  implementations: z.object({
    python: z.string(),
    go: z.string(),
    rust: z.string(),
  }),
  dry_run: z.unknown().optional(),
  trade_offs: z.unknown().optional(),
  visuals: z.object({ ascii_frames: z.array(z.string()) }).optional(),
});

export const problemContentSchema = z.object({
  schemaVersion: z.literal(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  canonicalApproachId: z.string().min(1),
  license: z.string().min(1),
  source: z.object({ name: z.string(), url: z.string().url() }),
  meta: z.object({
    title: z.string(),
    topic: z.string(),
    pattern: z.string(),
    difficulty: z.enum(["easy", "medium", "hard"]),
    day: z.number().int().positive(),
  }),
  statement: z.object({
    description: z.string(),
    constraints: z.array(z.string()),
    examples: z.array(
      z.object({
        input: z.string(),
        output: z.string(),
        explanation: z.string(),
      }),
    ),
  }),
  learning: z.object({
    keyInsight: z.string(),
    whyItMatters: z.string(),
    lore: z.string().optional(),
    productionFit: z
      .object({ title: z.string(), explanation: z.string() })
      .optional(),
    scaleUp: z
      .object({ scenario: z.string(), solution: z.string() })
      .optional(),
  }),
  applications: z.array(z.string()).min(2),
  hints: z.array(z.string()).min(3),
  approaches: z.array(approachSchema).min(1),
  variations: z.array(
    z.object({ slug: z.string(), title: z.string(), oneLiner: z.string() }),
  ),
  related: z.object({
    samePattern: z.array(z.string()).default([]),
    sameTopic: z.array(z.string()).default([]),
  }),
  conceptualQuiz: z.object({
    question: z.string(),
    options: z.array(z.string()).min(2),
    correctOptionIndex: z.number().int().nonnegative(),
    explanation: z.string(),
  }),
  debuggingChallenge: z.object({
    language: z.enum(["python", "go", "rust"]),
    buggyCode: z.string(),
    bugLocation: z.string(),
    fix: z.string(),
  }),
  testCases: z.record(
    z.enum(["python", "go", "rust"]),
    z.array(z.object({ stdin: z.string(), expected_stdout: z.string() })),
  ),
  solutions: z
    .object({
      python: z.object({ stub: z.string().optional() }).optional(),
      go: z.object({ stub: z.string().optional() }).optional(),
      rust: z.object({ stub: z.string().optional() }).optional(),
    })
    .optional(),
  telegram: z.object({
    digest: z.object({
      maxApplications: z.number().int().default(3),
      maxVariations: z.number().int().default(2),
    }),
    gating: z.object({
      solutionAfter: z.literal("attempted_or_hints>=2"),
    }),
  }),
});

export type ProblemContent = z.infer<typeof problemContentSchema>;
export type ApproachContent = z.infer<typeof approachSchema>;

export function validateProblemContent(data: unknown): ProblemContent {
  const doc = problemContentSchema.parse(data);
  const ids = new Set(doc.approaches.map((a) => a.id));
  if (!ids.has(doc.canonicalApproachId)) {
    throw new Error(
      `canonicalApproachId "${doc.canonicalApproachId}" not in approaches`,
    );
  }
  if (doc.slug.length > 40) {
    throw new Error(`slug too long for Telegram callbacks: ${doc.slug}`);
  }
  if (doc.conceptualQuiz.correctOptionIndex >= doc.conceptualQuiz.options.length) {
    throw new Error(`conceptualQuiz correctOptionIndex out of range for ${doc.slug}`);
  }
  return doc;
}
