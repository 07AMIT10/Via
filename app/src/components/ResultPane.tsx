export function ResultPane({
  verdict,
  output,
  mode,
  statusId,
  judgeSource,
}: {
  verdict: string;
  output: string;
  mode: "run" | "submit";
  statusId: number | null;
  judgeSource: "judge0" | "stub";
}) {
  const verdictColor =
    verdict === "accepted-stub"
      ? "#0b7a0b"
      : verdict === "run-ok"
        ? "#0b4f8a"
        : verdict === "error"
          ? "#a40000"
          : "#444";

  const verdictLabelMap: Record<string, string> = {
    accepted: "Accepted",
    "accepted-stub": "Accepted (Stub)",
    "run-ok": "Run OK",
    "wrong-answer": "Wrong Answer",
    "time-limit-exceeded": "Time Limit Exceeded",
    "compile-error": "Compile Error",
    "runtime-error": "Runtime Error",
    "internal-error": "Internal Error",
    "exec-format-error": "Execution Format Error",
    "judge0-auth-error": "Judge0 Auth Error",
    "judge0-error": "Judge0 Error",
    stub: "Stub Result",
    error: "Error",
  };
  const verdictLabel = verdictLabelMap[verdict] ?? verdict;

  return (
    <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div>
          <b>Mode:</b> {mode}
        </div>
        <div style={{ color: verdictColor }}>
          <b>Verdict:</b> {verdictLabel}
        </div>
      </div>
      <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>
        source: {judgeSource} {statusId !== null ? `| status_id: ${statusId}` : ""}
      </div>
      <pre style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{output}</pre>
    </div>
  );
}
