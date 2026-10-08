import {
  BlockNoteSchema,
  createCodeBlockSpec,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { useEffect, useState } from "react";
import { MermaidBlock } from "./MermaidBlock";
import { mentionInline } from "./MentionInline";
import { DatabaseBlock } from "./DatabaseBlock";
import { headingsIn } from "./document-outline";
import { smoothScrollToElement } from "./scroll-to";
import {
  DEFAULT_DATABASE_COLUMNS_JSON,
  DEFAULT_DATABASE_ROWS_JSON,
} from "../../packages/database/model";

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
              const element = document.querySelector<HTMLElement>(
                `.bn-block-outer[data-id="${CSS.escape(heading.id)}"]`,
              );
              if (element) void smoothScrollToElement(element, "center");
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
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mention: mentionInline,
  },
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
    database: createReactBlockSpec(
      {
        type: "database",
        content: "none",
        propSchema: {
          columns: { default: DEFAULT_DATABASE_COLUMNS_JSON },
          rows: { default: DEFAULT_DATABASE_ROWS_JSON },
        },
      },
      {
        render: ({ block, editor }) => (
          <DatabaseBlock block={block} editor={editor} />
        ),
      },
    )(),
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
