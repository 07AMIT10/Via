import type { Env } from "../env";
import { getProblemById, getProblemBySlug, type ProblemRow } from "./repo";

export async function resolveProblem(
  env: Env,
  ref: { problemId?: number | null; slug?: string | null },
): Promise<ProblemRow | null> {
  if (ref.slug) {
    const bySlug = await getProblemBySlug(env, ref.slug);
    if (bySlug) {
      return bySlug;
    }
  }
  if (ref.problemId != null && !Number.isNaN(ref.problemId)) {
    return getProblemById(env, ref.problemId);
  }
  return null;
}

export function parseProblemRef(
  key: string,
): { problemId: number | null; slug: string | null } {
  const asNum = Number(key);
  if (!Number.isNaN(asNum) && String(asNum) === key) {
    return { problemId: asNum, slug: null };
  }
  return { problemId: null, slug: key };
}
