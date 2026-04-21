import Editor from "@monaco-editor/react";

type Lang = "python" | "go" | "rust";

interface Props {
  language: Lang;
  code: string;
  onChange: (next: string) => void;
}

export function EditorPane({ language, code, onChange }: Props) {
  return (
    <div style={{ height: "60vh", border: "1px solid #ddd", borderRadius: 8, overflow: "hidden" }}>
      <Editor
        height="100%"
        language={language}
        value={code}
        onChange={(v) => onChange(v ?? "")}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          automaticLayout: true,
        }}
      />
    </div>
  );
}
