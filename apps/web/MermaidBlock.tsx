import { useEffect, useState } from "react";
import { mermaidFromClipboard } from "./mermaid-paste";

const renderer = () =>
  import("mermaid").then(({ default: mermaid }) => mermaid);
let configured = false;

export function MermaidBlock({
  code,
  onChange,
}: {
  code: string;
  onChange: (code: string) => void;
}) {
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setPreview("");
    setError("");
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const mermaid = await renderer();
          if (!active) return;
          if (!configured) {
            mermaid.initialize({
              startOnLoad: false,
              securityLevel: "strict",
              theme: "neutral",
              htmlLabels: false,
              maxTextSize: 20000,
              maxEdges: 200,
              suppressErrorRendering: true,
              secure: [
                "securityLevel",
                "startOnLoad",
                "maxTextSize",
                "maxEdges",
                "htmlLabels",
                "suppressErrorRendering",
              ],
            });
            configured = true;
          }
          if (!code.trim())
            throw new Error("Enter Mermaid source to display a diagram.");
          const { svg } = await mermaid.render(
            `diagram-${crypto.randomUUID()}`,
            code,
          );
          if (active)
            setPreview(
              `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
            );
        } catch (cause) {
          if (active)
            setError(
              cause instanceof Error ? cause.message : "Invalid Mermaid syntax",
            );
        }
      })();
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [code]);
  return (
    <section className="lotion-mermaid" contentEditable={false}>
      <strong>Mermaid diagram</strong>
      <textarea
        aria-label="Mermaid source"
        spellCheck={false}
        maxLength={20000}
        value={code}
        onPaste={(event) => {
          const source = mermaidFromClipboard(
            event.clipboardData.getData("text/plain"),
          );
          if (source === null) return;
          event.preventDefault();
          event.stopPropagation();
          onChange(source);
        }}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <pre role="status">{error}</pre>
      ) : preview ? (
        <img src={preview} alt="Mermaid diagram preview" />
      ) : (
        <span role="status">Rendering diagram…</span>
      )}
    </section>
  );
}
