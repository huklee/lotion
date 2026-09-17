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

function inlineLabel(content: unknown): string {
  return Array.isArray(content)
    ? content
        .map((item) =>
          item && typeof item === "object"
            ? (item.text ?? inlineLabel(item.content))
            : "",
        )
        .join("")
    : "";
}

function internalPageId(href: string): string | null {
  return /#\/page\/([a-zA-Z0-9_-]{1,100})(?:#|$)/.exec(href)?.[1] ?? null;
}

export function normalizeEditorContent(initial: Content): {
  content: Content;
  changed: boolean;
} {
  let changed = false;
  const normalizeValue = (value: any): any => {
    if (Array.isArray(value)) return value.map(normalizeValue);
    if (!value || typeof value !== "object") return value;
    if (value.type === "link" && typeof value.href === "string") {
      const pageId = internalPageId(value.href);
      const preview = initial.linkPreviews?.[value.href];
      if (pageId || preview) {
        const previousLabel = inlineLabel(value.content);
        const legacyIcon = /^(\S+)\s+/.exec(previousLabel)?.[1];
        changed = true;
        return {
          type: "mention",
          props: {
            kind: pageId ? "page" : "external",
            href: value.href,
            label: pageId
              ? legacyIcon
                ? previousLabel.slice(legacyIcon.length).trimStart()
                : previousLabel
              : (preview?.title ?? previousLabel),
            icon: pageId ? (legacyIcon ?? "📄") : "🌐",
          },
        };
      }
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeValue(item)]),
    );
  };
  const normalize = (blocks: Block[]): Block[] =>
    blocks.map((block) => {
      let next = block;
      if (block.content) {
        const content = normalizeValue(block.content);
        if (content !== block.content) next = { ...next, content };
      }
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
