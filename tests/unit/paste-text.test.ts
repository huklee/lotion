import { describe, expect, it } from "vitest";
import { textToBlocks } from "../../apps/web/paste/text-blocks";

/** "type text" lines, two spaces per level. */
function outline(blocks: any[], depth = 0): string[] {
  return blocks.flatMap((b) => [
    `${"  ".repeat(depth)}${b.type}${b.props?.checked ? "[x]" : ""}${b.props?.level ? `(${b.props.level})` : ""}: ${(b.content ?? []).map((c: any) => (c.type === "link" ? `[${c.content.map((x: any) => x.text).join("")}](${c.href})` : c.styles?.bold ? `**${c.text}**` : c.text)).join("")}`,
    ...outline(b.children ?? [], depth + 1),
  ]);
}

describe("paste v2: plain text", () => {
  it("keeps every line as its own block and turns indentation into nesting", () => {
    expect(
      outline(
        textToBlocks(
          "검색 Phase 2\n  KB 미팅 완료 (9/22)\n  설계 공유 예정\n    파이프라인 초안 포함\nAI Ops\n  매뉴얼 작성",
        ),
      ),
    ).toEqual([
      "paragraph: 검색 Phase 2",
      "  paragraph: KB 미팅 완료 (9/22)",
      "  paragraph: 설계 공유 예정",
      "    paragraph: 파이프라인 초안 포함",
      "paragraph: AI Ops",
      "  paragraph: 매뉴얼 작성",
    ]);
  });

  it("recognises list markers, tasks, headings, quotes with tabs or 4-space indents", () => {
    expect(
      outline(
        textToBlocks(
          "## 회의\n- 안건\n\t- 세부\n\t\t1. 첫째\n• 불릿 문자\n- [x] 완료\n- [ ] 할 일\n> 인용",
        ),
      ),
    ).toEqual([
      "heading(2): 회의",
      "bulletListItem: 안건",
      "  bulletListItem: 세부",
      "    numberedListItem: 첫째",
      "bulletListItem: 불릿 문자",
      "checkListItem[x]: 완료",
      "checkListItem: 할 일",
      "quote: 인용",
    ]);
  });

  it("applies inline Markdown only where present and keeps plain asterisks", () => {
    expect(
      outline(
        textToBlocks("**굵게** 그리고 [링크](https://a.example)\n2*3 = 6"),
      ),
    ).toEqual([
      "paragraph: **굵게** 그리고 [링크](https://a.example)",
      "paragraph: 2*3 = 6",
    ]);
  });

  it("over-indented lines nest one level; blank lines keep one gap between groups", () => {
    expect(
      outline(textToBlocks("A\n        deep\nB\n\n\n\nC\n  c1\n\n  c2")),
    ).toEqual([
      "paragraph: A",
      "  paragraph: deep",
      "paragraph: B",
      "paragraph: ",
      "paragraph: C",
      "  paragraph: c1",
      "  paragraph: c2",
    ]);
  });

  it("code fences and Markdown tables become code and table blocks", () => {
    const blocks = textToBlocks(
      "intro\n```ts\nconst a = 1;\n  indented();\n```\n| a | b |\n| - | - |\n| 1 | 2 |",
    );
    expect(blocks.map((b) => b.type)).toEqual([
      "paragraph",
      "codeBlock",
      "table",
    ]);
    expect((blocks[1].content as any)[0].text).toBe(
      "const a = 1;\n  indented();",
    );
  });
});
