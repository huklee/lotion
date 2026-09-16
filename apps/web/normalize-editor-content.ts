import type { Block, Content } from "../../packages/document-schema/index";

const supportedCodeLanguages = new Set(["json", "html", "python", "go", "cpp"]);

function inferCodeLanguage(source: string): string {
  if (/^\s*</.test(source)) return "html";
  if (/#include|std::|\bnamespace\s+\w+/.test(source)) return "cpp";
  if (/\bpackage\s+main\b|\bfunc\s+\w+\s*\(/.test(source)) return "go";
  if (/\bdef\s+\w+\s*\(|\bfrom\s+\w+\s+import\b|\bprint\s*\(/.test(source))
    return "python";
  return "json";
}

export function normalizeEditorContent(initial: Content): {
  content: Content;
  changed: boolean;
} {
  let changed = false;
  const normalize = (blocks: Block[]): Block[] =>
    blocks.map((block) => {
      let next = block;
      if (block.type === "codeBlock") {
        const language = String(block.props?.language ?? "").toLowerCase();
        if (!supportedCodeLanguages.has(language)) {
          const source = Array.isArray(block.content)
            ? block.content.map((item) => item.text ?? "").join("")
            : "";
          next = {
            ...block,
            props: {
              ...block.props,
              language: inferCodeLanguage(source),
            },
          };
          changed = true;
        }
      }
      if (next.children?.length) {
        const children = normalize(next.children);
        if (children !== next.children) next = { ...next, children };
      }
      return next;
    });
  return {
    content: { ...initial, blocks: normalize(initial.blocks) },
    changed,
  };
}
