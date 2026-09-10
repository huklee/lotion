import {
  BlockNoteSchema,
  createCodeBlockSpec,
  defaultBlockSpecs,
} from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useEffect, useState } from "react";
import { MermaidBlock } from "./MermaidBlock";

type Heading = { id: string; level: number; title: string };

function inlineText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      if ("text" in item && typeof item.text === "string") return item.text;
      if ("content" in item) return inlineText(item.content);
      return "";
    })
    .join("");
}

function headingsIn(blocks: readonly any[]): Heading[] {
  return blocks.flatMap((block) => [
    ...(block.type === "heading"
      ? [
          {
            id: block.id,
            level: Number(block.props?.level) || 1,
            title: inlineText(block.content).trim() || "Untitled heading",
          },
        ]
      : []),
    ...headingsIn(block.children ?? []),
  ]);
}

function TableOfContents({ editor }: { editor: any }) {
  const [, render] = useState(0);
  useEffect(
    () => editor.onChange(() => render((value) => value + 1)),
    [editor],
  );
  const headings = headingsIn(editor.document);
  return (
    <nav
      className="lotion-toc"
      aria-label="Table of contents"
      contentEditable={false}
    >
      <div className="lotion-toc-title">Table of contents</div>
      {headings.length ? (
        headings.map((heading) => (
          <button
            key={heading.id}
            type="button"
            style={{ paddingLeft: `${10 + (heading.level - 1) * 16}px` }}
            onClick={() => {
              document
                .querySelector<HTMLElement>(
                  `.bn-block-outer[data-id="${heading.id}"]`,
                )
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
              editor.setTextCursorPosition(heading.id, "start");
            }}
          >
            {heading.title}
          </button>
        ))
      ) : (
        <span className="lotion-toc-empty">
          Add headings to populate this table.
        </span>
      )}
    </nav>
  );
}

const tableOfContents = createReactBlockSpec(
  {
    type: "tableOfContents",
    propSchema: {},
    content: "none",
  },
  {
    render: ({ editor }) => <TableOfContents editor={editor} />,
  },
)();

const callout = createReactBlockSpec(
  {
    type: "callout",
    propSchema: {
      icon: { default: "💡" },
    },
    content: "inline",
  },
  {
    render: ({ block, contentRef }) => (
      <aside className="lotion-callout">
        <span className="lotion-callout-icon" aria-hidden="true">
          {block.props.icon}
        </span>
        <div className="lotion-callout-content" ref={contentRef} />
      </aside>
    ),
  },
)();

export const editorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createCodeBlockSpec({
      defaultLanguage: "json",
      supportedLanguages: {
        json: { name: "JSON" },
        html: { name: "HTML" },
        python: { name: "Python", aliases: ["py"] },
        go: { name: "Go", aliases: ["golang"] },
        cpp: { name: "C++", aliases: ["c++"] },
      },
    }),
    tableOfContents,
    callout,
    mermaid: createReactBlockSpec(
      {
        type: "mermaid",
        content: "none",
        propSchema: { code: { default: "graph TD\n  A[Start] --> B[Finish]" } },
      },
      {
        render: ({ block, editor }) => (
          <MermaidBlock
            code={block.props.code}
            onChange={(code) => editor.updateBlock(block, { props: { code } })}
          />
        ),
      },
    )(),
  },
});
