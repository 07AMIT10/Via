import type { ProblemPayload } from "../api";

export function ProblemPane({ problem }: { problem: ProblemPayload | null }) {
  if (!problem) {
    return <div>Loading today's problem...</div>;
  }

  const applications = JSON.parse(problem.applications_json ?? "[]") as string[];
  const variations = JSON.parse(problem.variations_json ?? "[]") as Array<{
    title: string;
    one_liner: string;
  }>;

  return (
    <div style={{ padding: 12 }}>
      <h2 style={{ marginTop: 0 }}>
        Day {problem.day_number} - {problem.title}
      </h2>
      <p>{problem.description}</p>
      <h4>Key insight</h4>
      <p>{problem.key_insight ?? "No insight available."}</p>
      <h4>Why it matters</h4>
      <p>{problem.why_it_matters ?? "No context available."}</p>
      <h4>Applications</h4>
      <ul>
        {applications.map((app, idx) => (
          <li key={idx}>{app}</li>
        ))}
      </ul>
      <h4>Variations</h4>
      <ul>
        {variations.map((v, idx) => (
          <li key={idx}>
            <b>{v.title}</b> - {v.one_liner}
          </li>
        ))}
      </ul>
      <p>
        <b>Complexity target:</b> {problem.complexity ?? "N/A"}
      </p>
    </div>
  );
}
