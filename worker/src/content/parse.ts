import { validateProblemContent, type ProblemContent } from "dsa-bot-content-schema";

export function parseProblemContent(raw: string | null | undefined): ProblemContent | null {
  if (!raw) {
    return null;
  }
  try {
    return validateProblemContent(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function canonicalApproach(doc: ProblemContent) {
  const approach = doc.approaches.find((a) => a.id === doc.canonicalApproachId);
  if (!approach) {
    throw new Error(`canonical approach missing: ${doc.canonicalApproachId}`);
  }
  return approach;
}
