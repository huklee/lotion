import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPAND_TITLE,
  addWrap,
  removeWrap,
  renderWiki,
  updateWrap,
  validWraps,
  type Wrap,
} from "../../packages/confluence/wiki";
import {
  joinBlocks,
  renderInline,
  renderWikiMarkup,
} from "../../packages/confluence/wiki-markup";
import type { Block } from "../../packages/document-schema/index";

const t = (text: string, styles = {}) => ({ type: "text", text, styles });
const blocks: Block[] = [
  { id: "h", type: "heading", props: { level: 2 }, content: [t("세부 내용")] },
  {
    id: "p",
    type: "paragraph",
    content: [t("본문 "), t("굵게", { bold: true })],
  },
  { id: "b1", type: "bulletListItem", content: [t("하나")] },
  {
    id: "b2",
    type: "bulletListItem",
    content: [t("둘")],
    children: [{ id: "n1", type: "numberedListItem", content: [t("둘-하나")] }],
  },
  {
    id: "c1",
    type: "checkListItem",
    props: { checked: true },
    content: [t("완료")],
  },
  {
    id: "c2",
    type: "checkListItem",
    props: { checked: false },
    content: [t("남음")],
  },
];

describe("Lotion blocks → Confluence wiki markup", () => {
  it("writes headings, paragraphs, lists (nested, numbered, to-dos) in wiki markup", () => {
    expect(joinBlocks(blocks)).toBe(
      [
        "h2. 세부 내용",
        "",
        "본문 *굵게*",
        "",
        "* 하나",
        "* 둘",
        "*# 둘-하나",
        "* (/) 완료",
        "* ( ) 남음",
      ].join("\n"),
    );
  });

  it("writes inline formats, using {*} next to a word, and escapes markup characters", () => {
    const md = joinBlocks(
      [
        {
          id: "x",
          type: "paragraph",
          content: [
            t("값"),
            t("강조", { bold: true }),
            t(" "),
            t("기울임", { italic: true }),
            t(" "),
            t("밑줄", { underline: true }),
            t(" "),
            t("취소", { strike: true }),
            t(" "),
            t("빨강", { textColor: "red", backgroundColor: "yellow" }),
            t(" "),
            t("a{b}", { code: true }),
            t(" 1*2 [x] a|b !no! -flag "),
            { type: "link", href: "https://ex.com/a", content: [t("링크")] },
            t(" "),
            {
              type: "mention",
              props: { kind: "page", href: "#/page/p1", label: "다른 페이지" },
            },
          ],
        } as any,
      ],
      { linkBase: "https://lotion.test" },
    );
    expect(md).toBe(
      "값{*}강조{*} _기울임_ +밑줄+ -취소- {color:red}빨강{color} {{a\\{b\\}}} 1\\*2 \\[x\\] a\\|b \\!no\\! \\-flag [링크|https://ex.com/a] [다른 페이지|https://lotion.test/#/page/p1]",
    );
  });

  it("writes code, quotes, callouts, tables and dividers", () => {
    const md = joinBlocks([
      {
        id: "c",
        type: "codeBlock",
        props: { language: "py" },
        content: [t("print('*hi*')\nx = 1")],
      },
      { id: "q", type: "quote", content: [t("인용")] },
      { id: "o", type: "callout", props: { icon: "💡" }, content: [t("참고")] },
      {
        id: "tb",
        type: "table",
        content: {
          type: "tableContent",
          rows: [{ cells: [[t("A")], [t("B")]] }, { cells: [[t("1")], []] }],
        },
      } as any,
      { id: "d", type: "divider" } as any,
    ]);
    expect(md).toBe(
      [
        "{code:language=python}",
        "print('*hi*')",
        "x = 1",
        "{code}",
        "",
        "{quote}",
        "인용",
        "{quote}",
        "",
        "{info}",
        "참고",
        "{info}",
        "",
        "||A||B||",
        "|1| |",
        "",
        "----",
      ].join("\n"),
    );
  });
});

describe("rendering wiki markup", () => {
  it("renders the markup it writes", () => {
    const html = renderWikiMarkup(joinBlocks(blocks));
    expect(html).toContain("<h2>세부 내용</h2>");
    expect(html).toContain("<p>본문 <strong>굵게</strong></p>");
    expect(html).toContain(
      "<ul><li>하나</li><li>둘<ol><li>둘-하나</li></ol></li><li>",
    );
    expect(html).toContain(
      '<span class="cf-icon cf-tick" aria-label="done">✓</span> 완료',
    );
    expect(html).toContain("( ) 남음");
  });

  it("keeps escaped characters as text, never as formatting or HTML", () => {
    expect(renderInline("1\\*2\\* \\[x\\] <b>")).toBe("1*2* [x] &lt;b&gt;");
    expect(
      renderInline("값{*}강조{*} {{a\\{b\\}}} [x|javascript:alert(1)]"),
    ).toBe('값<strong>강조</strong> <code>a{b}</code> <a href="#">x</a>');
  });

  it("renders macros, tables and code", () => {
    const html = renderWikiMarkup(
      "{expand:자세히}\n* a\n{expand}\n\n{warning:title=주의}\n본문\n{warning}\n\n||A||B||\n|1|2|\n\n{code:language=python}\nx < 1\n{code}",
    );
    expect(html).toContain(
      '<div class="cf-expand"><div class="cf-expand-title">자세히</div><div class="cf-macro-body"><ul><li>a</li></ul></div></div>',
    );
    expect(html).toContain(
      '<div class="cf-panel cf-warning"><div class="cf-panel-title">주의</div><div class="cf-macro-body"><p>본문</p></div></div>',
    );
    expect(html).toContain(
      "<table><tbody><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></tbody></table>",
    );
    expect(html).toContain("<pre><code>x &lt; 1</code></pre>");
  });
});

describe("Confluence wiki page with layout", () => {
  it("is the page title plus the page in wiki markup, one unit per top-level block", () => {
    const page = renderWiki("보고서", blocks, []);
    expect(
      page.markup.startsWith(
        "h1. 보고서\n\nh2. 세부 내용\n\n본문 *굵게*\n\n* 하나\n* 둘\n",
      ),
    ).toBe(true);
    expect(
      page.parts.map((p) => (p.type === "unit" ? p.unit.id : "wrap")),
    ).toEqual(blocks.map((b) => b.id));
    expect((page.parts[1] as any).unit.html).toBe(
      "<p>본문 <strong>굵게</strong></p>",
    );
  });

  it("wraps a range in an info panel", () => {
    const wraps = addWrap(blocks, [], "info", "b2", "b1", "w1");
    expect(wraps).toEqual([
      { id: "w1", kind: "info", title: "", blockIds: ["b1", "b2"] },
    ]);
    const page = renderWiki("보고서", blocks, wraps);
    expect(page.markup).toContain(
      "본문 *굵게*\n\n{info}\n* 하나\n* 둘\n*# 둘-하나\n{info}\n\n* (/) 완료",
    );
    expect(page.parts.find((p) => p.type === "wrap")).toMatchObject({
      wrap: { kind: "info" },
      units: [{ id: "b1" }, { id: "b2" }],
    });
  });

  it("an Expand over a heading takes the heading as its title and does not repeat it", () => {
    const wraps = addWrap(blocks, [], "expand", "h", "p", "w1");
    expect(wraps[0].title).toBe("세부 내용");
    const page = renderWiki("보고서", blocks, wraps);
    expect(page.markup).toContain(
      "h1. 보고서\n\n{expand:세부 내용}\n본문 *굵게*\n{expand}",
    );
    expect(page.markup).not.toContain("h2. 세부 내용");
    expect(addWrap(blocks, [], "expand", "p", "p", "w2")[0].title).toBe(
      DEFAULT_EXPAND_TITLE,
    );
  });

  it("changes kind and title, removes wraps, and replaces overlapping ones", () => {
    let wraps: Wrap[] = addWrap(blocks, [], "note", "p", "b1", "w1");
    wraps = updateWrap(wraps, "w1", {
      kind: "warning",
      title: "주의 {곧} | 확인",
    });
    expect(renderWiki("x", blocks, wraps).markup).toContain(
      "{warning:title=주의 곧 확인}\n본문 *굵게*\n\n* 하나\n{warning}",
    );
    wraps = addWrap(blocks, wraps, "tip", "b1", "b2", "w2");
    expect(wraps.map((w) => w.id)).toEqual(["w2"]);
    expect(removeWrap(wraps, "w2")).toEqual([]);
  });

  it("drops saved wraps that no longer fit the page", () => {
    const wraps: Wrap[] = [
      { id: "gone", kind: "info", title: "", blockIds: ["missing"] },
      { id: "gap", kind: "info", title: "", blockIds: ["h", "b1"] },
      { id: "ok", kind: "tip", title: "", blockIds: ["c1", "c2"] },
      { id: "overlap", kind: "note", title: "", blockIds: ["c2"] },
    ];
    expect(validWraps(blocks, wraps).map((w) => w.id)).toEqual(["ok"]);
  });
});
