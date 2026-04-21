export function ResultPane({
  verdict,
  output,
}: {
  verdict: string;
  output: string;
}) {
  return (
    <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
      <div>
        <b>Verdict:</b> {verdict}
      </div>
      <pre style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{output}</pre>
    </div>
  );
}
