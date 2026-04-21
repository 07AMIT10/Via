export function ResultPane({
  verdict,
  output,
  mode,
}: {
  verdict: string;
  output: string;
  mode: "run" | "submit";
}) {
  const verdictColor =
    verdict === "accepted-stub"
      ? "#0b7a0b"
      : verdict === "run-ok"
        ? "#0b4f8a"
        : verdict === "error"
          ? "#a40000"
          : "#444";

  return (
    <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div>
          <b>Mode:</b> {mode}
        </div>
        <div style={{ color: verdictColor }}>
          <b>Verdict:</b> {verdict}
        </div>
      </div>
      <pre style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{output}</pre>
    </div>
  );
}
