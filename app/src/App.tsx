import { useEffect, useMemo, useState } from "react";
import { fetchToday, submitCode, type ProblemPayload } from "./api";
import { EditorPane } from "./components/EditorPane";
import { LangSwitch } from "./components/LangSwitch";
import { ProblemPane } from "./components/ProblemPane";
import { ResultPane } from "./components/ResultPane";
import { useTelegramWebApp } from "./hooks/useTelegramWebApp";

type Lang = "python" | "go" | "rust";

const STARTERS: Record<Lang, string> = {
  python: "def solve():\n    # write your solution\n    pass\n\nif __name__ == '__main__':\n    solve()\n",
  go: "package main\n\nfunc main() {\n\t// write your solution\n}\n",
  rust: "fn main() {\n    // write your solution\n}\n",
};

export function App() {
  const { initData, isTelegram } = useTelegramWebApp();
  const [problem, setProblem] = useState<ProblemPayload | null>(null);
  const [language, setLanguage] = useState<Lang>("python");
  const [code, setCode] = useState<string>(STARTERS.python);
  const [verdict, setVerdict] = useState("idle");
  const [output, setOutput] = useState("Submit to see results.");

  useEffect(() => {
    void (async () => {
      const data = await fetchToday(initData);
      setProblem(data);
    })();
  }, [initData]);

  useEffect(() => {
    setCode(STARTERS[language]);
  }, [language]);

  const canSubmit = useMemo(() => Boolean(problem), [problem]);

  async function onSubmit() {
    if (!problem) {
      return;
    }
    setVerdict("running");
    const result = await submitCode(initData, {
      problemId: problem.id,
      language,
      code,
    });
    setVerdict(result.verdict);
    setOutput(result.output);
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 12, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ marginTop: 0 }}>DSA Daily Mini App</h1>
      {!isTelegram && (
        <div style={{ marginBottom: 8, color: "#8a6d3b" }}>
          Running outside Telegram. Auth-protected endpoints may fail without initData.
        </div>
      )}
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "minmax(280px, 42%) minmax(320px, 58%)",
        }}
      >
        <div style={{ border: "1px solid #ddd", borderRadius: 8 }}>
          <ProblemPane problem={problem} />
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <LangSwitch value={language} onChange={setLanguage} />
            <button
              onClick={onSubmit}
              disabled={!canSubmit}
              style={{
                border: "1px solid #111",
                borderRadius: 8,
                padding: "8px 12px",
                background: canSubmit ? "#111" : "#777",
                color: "#fff",
                cursor: canSubmit ? "pointer" : "not-allowed",
              }}
            >
              Submit
            </button>
          </div>
          <EditorPane language={language} code={code} onChange={setCode} />
          <ResultPane verdict={verdict} output={output} />
        </div>
      </div>
    </div>
  );
}
