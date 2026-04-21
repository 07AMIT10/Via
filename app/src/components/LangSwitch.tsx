type Lang = "python" | "go" | "rust";

interface Props {
  value: Lang;
  onChange: (lang: Lang) => void;
}

export function LangSwitch({ value, onChange }: Props) {
  const langs: Lang[] = ["python", "go", "rust"];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {langs.map((lang) => (
        <button
          key={lang}
          onClick={() => onChange(lang)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid #999",
            background: value === lang ? "#ddd" : "#fff",
            cursor: "pointer",
          }}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
