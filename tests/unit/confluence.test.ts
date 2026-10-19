import { describe, expect, it } from "vitest";
import { markdownToConfluence } from "../../packages/confluence/convert";

describe("markdown → Confluence (static)", () => {
  it("headings, inline formatting, links and escaping", () => {
    const { storage, html } = markdownToConfluence(
      "# 제목\n\n**굵게**, *기울임*, ~~취소~~, `code`, [링크](https://a.example?x=1&y=2) <b>raw</b> & 3 < 4",
    );
    expect(storage).toBe(
      '<h1>제목</h1>\n<p><strong>굵게</strong>, <em>기울임</em>, <s>취소</s>, <code>code</code>, <a href="https://a.example?x=1&amp;y=2">링크</a> &lt;b&gt;raw&lt;/b&gt; &amp; 3 &lt; 4</p>',
    );
    expect(html).toBe(storage);
  });

  it("nested lists stay nested; task lists become Confluence tasks", () => {
    const { storage, html } = markdownToConfluence(
      "- 검색\n  - Phase 2\n    1. KB 미팅\n- AI Ops\n\n- [x] 완료\n- [ ] 할 일",
    );
    expect(storage).toBe(
      "<ul><li>검색<ul><li>Phase 2<ol><li>KB 미팅</li></ol></li></ul></li><li>AI Ops</li></ul>" +
        "<ac:task-list><ac:task><ac:task-id>1</ac:task-id><ac:task-status>complete</ac:task-status><ac:task-body>완료</ac:task-body></ac:task><ac:task><ac:task-id>2</ac:task-id><ac:task-status>incomplete</ac:task-status><ac:task-body>할 일</ac:task-body></ac:task></ac:task-list>",
    );
    expect(html).toContain(
      '<ul class="task-list"><li><input type="checkbox" disabled checked /> 완료</li>',
    );
  });

  it("code blocks become the code macro (CDATA-safe, known languages only); mermaid is titled", () => {
    const { storage } = markdownToConfluence(
      "```ts\nconst a = x[0]]>1;\n```\n\n```mermaid\ngraph TD\n```\n\n```weird\nz\n```",
    );
    expect(storage).toContain(
      '<ac:structured-macro ac:name="code" ac:schema-version="1"><ac:parameter ac:name="language">typescript</ac:parameter><ac:plain-text-body><![CDATA[const a = x[0]]]]><![CDATA[>1;]]></ac:plain-text-body></ac:structured-macro>',
    );
    expect(storage).toContain(
      '<ac:parameter ac:name="title">Mermaid</ac:parameter><ac:parameter ac:name="language">none</ac:parameter>',
    );
    expect(storage).toContain(
      '<ac:parameter ac:name="language">none</ac:parameter><ac:plain-text-body><![CDATA[z]]>',
    );
  });

  it("tables keep a header row and alignment; empty cells stay valid", () => {
    const { storage } = markdownToConfluence(
      "| 담당 | 기한 |\n| :- | -: |\n| 민수 |  |",
    );
    expect(storage).toBe(
      '<table><tbody><tr><th style="text-align: left;">담당</th><th style="text-align: right;">기한</th></tr><tr><td style="text-align: left;">민수</td><td style="text-align: right;"><br /></td></tr></tbody></table>',
    );
  });

  it("images, quotes, rules, Lotion's table of contents; unsafe links neutralised", () => {
    const { storage, html } = markdownToConfluence(
      "<!-- lotion:table-of-contents -->\n\n> 인용\n\n---\n\n![그림](https://img.example/a.png)\n\n[x](javascript:alert(1))",
    );
    expect(storage).toContain(
      '<ac:structured-macro ac:name="toc" ac:schema-version="1" />',
    );
    expect(storage).toContain("<blockquote><p>인용</p></blockquote>");
    expect(storage).toContain("<hr />");
    expect(storage).toContain(
      '<ac:image ac:alt="그림"><ri:url ri:value="https://img.example/a.png" /></ac:image>',
    );
    expect(storage).toContain('<a href="#">x</a>');
    expect(html).toContain(
      '<img src="https://img.example/a.png" alt="그림" />',
    );
  });
});
