/** Realistic clipboard payloads (HTML + plain text) as the source apps produce them. */
export type PasteCase = {
  id: string;
  title: string;
  source: string;
  html?: string;
  text: string;
  /** what the page looks like before pasting; the cursor goes into `cursor`. */
  before?: { id: string; type: string; text: string; children?: any[] }[];
  cursor?: { id: string; at: "end" | "start" | number };
};

const p = (id: string, text: string, type = "paragraph") => ({
  id,
  type,
  text,
});

export const CASES: PasteCase[] = [
  {
    id: "notion",
    title: "Notion 페이지 일부",
    source:
      "Notion (Chrome) — heading, bold/link, nested bullets, to-do, numbered",
    html: `<meta charset="utf-8"><h2 id="a1">주간 회의</h2><p id="a2">이번 주 <strong>핵심</strong>은 <a href="https://example.com/kb">KB 연동</a>입니다.</p><ul id="a3"><li>검색 Phase 2<ul><li>KB 미팅 완료 (9/22)</li><li>설계 공유 예정 (~9/29)</li></ul></li><li>AI Ops</li></ul><ul class="to-do-list"><li><div class="checkbox checkbox-on"></div><span class="to-do-children-checked">매뉴얼 초안</span></li><li><div class="checkbox checkbox-off"></div><span class="to-do-children-unchecked">공지</span></li></ul><ol type="1"><li>첫째</li><li>둘째</li></ol>`,
    text: "주간 회의\n\n이번 주 핵심은 KB 연동입니다.\n\n- 검색 Phase 2\n    - KB 미팅 완료 (9/22)\n    - 설계 공유 예정 (~9/29)\n- AI Ops\n- [x] 매뉴얼 초안\n- [ ] 공지\n1. 첫째\n2. 둘째",
  },
  {
    id: "gdocs",
    title: "Google Docs",
    source:
      "Google Docs — all-bold wrapper, style-only bold/italic, flat lists with aria-level",
    html: `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1a2b3c"><h2 dir="ltr" style="line-height:1.38;margin-top:18pt;margin-bottom:6pt;"><span style="font-size:16pt;font-family:Arial;color:#000000;font-weight:400;">프로젝트 현황</span></h2><p dir="ltr" style="line-height:1.38;margin-top:0pt;margin-bottom:0pt;"><span style="font-size:11pt;font-family:Arial;color:#000000;font-weight:700;">결론:</span><span style="font-size:11pt;font-family:Arial;color:#000000;font-weight:400;"> 일정은 </span><span style="font-size:11pt;font-family:Arial;color:#000000;font-weight:400;font-style:italic;">유지</span><span style="font-size:11pt;font-family:Arial;color:#000000;font-weight:400;">합니다.</span></p><ul style="margin-top:0;margin-bottom:0;padding-inline-start:48px;"><li dir="ltr" style="list-style-type:disc;font-size:11pt;" aria-level="1"><p dir="ltr" role="presentation"><span style="font-size:11pt;font-weight:400;">백엔드</span></p></li></ul><ul style="margin-top:0;margin-bottom:0;padding-inline-start:48px;"><li dir="ltr" style="list-style-type:circle;font-size:11pt;" aria-level="2"><p dir="ltr" role="presentation"><span style="font-size:11pt;font-weight:400;">API 설계 완료</span></p></li><li dir="ltr" style="list-style-type:circle;font-size:11pt;" aria-level="2"><p dir="ltr" role="presentation"><span style="font-size:11pt;font-weight:400;">부하 테스트 예정</span></p></li></ul><ul style="margin-top:0;margin-bottom:0;padding-inline-start:48px;"><li dir="ltr" style="list-style-type:disc;font-size:11pt;" aria-level="1"><p dir="ltr" role="presentation"><span style="font-size:11pt;font-weight:400;">프런트엔드</span></p></li></ul></b>`,
    text: "프로젝트 현황\n결론: 일정은 유지합니다.\n* 백엔드\n   * API 설계 완료\n   * 부하 테스트 예정\n* 프런트엔드",
  },
  {
    id: "word",
    title: "Microsoft Word",
    source:
      "Word for Mac — MsoNormal paragraphs, mso-list levels, bullet glyph spans",
    html: `<html xmlns:o="urn:schemas-microsoft-com:office:office"><head><style>p.MsoNormal{margin:0}</style></head><body lang=KO><!--StartFragment--><p class=MsoNormal><b>회의 결과</b><o:p></o:p></p><p class=MsoListParagraph style='margin-left:18.0pt;mso-list:l0 level1 lfo1'><span style='font-family:Symbol;mso-list:Ignore'>·<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;</span></span>예산 확정<o:p></o:p></p><p class=MsoListParagraph style='margin-left:54.0pt;mso-list:l0 level2 lfo1'><span style='font-family:"Courier New";mso-list:Ignore'>o<span style='font:7.0pt "Times New Roman"'>&nbsp;</span></span>2027년 계획 포함<o:p></o:p></p><p class=MsoListParagraph style='margin-left:18.0pt;mso-list:l0 level1 lfo1'><span style='font-family:Symbol;mso-list:Ignore'>·<span style='font:7.0pt "Times New Roman"'>&nbsp;</span></span>채용 4건<o:p></o:p></p><!--EndFragment--></body></html>`,
    text: "회의 결과\n·  예산 확정\no 2027년 계획 포함\n·  채용 4건",
  },
  {
    id: "slack",
    title: "Slack 메시지",
    source: "Slack desktop — bold, italic, link, line breaks, bullet list",
    html: `<meta charset="utf-8"><b>배포 안내</b><br>오늘 <i>18시</i>에 배포합니다. 상세: <a href="https://example.com/release">릴리스 노트</a><br><ul><li>검색 개선</li><li>버그 수정 3건</li></ul>`,
    text: "*배포 안내*\n오늘 _18시_에 배포합니다. 상세: https://example.com/release\n• 검색 개선\n• 버그 수정 3건",
  },
  {
    id: "chatgpt",
    title: "ChatGPT / Claude 답변",
    source:
      "AI chat web — headings, bold, nested lists with <p>, code block, table",
    html: `<h3>요약</h3><p>핵심은 <strong>캐시 적중률</strong>입니다.</p><ul><li><p>원인</p><ul><li><p>TTL이 짧음</p></li></ul></li><li><p>해결: <code>ttl=600</code></p></li></ul><pre><code class="language-bash">npm run build
npm test</code></pre><table><thead><tr><th>항목</th><th>값</th></tr></thead><tbody><tr><td>적중률</td><td>92%</td></tr></tbody></table>`,
    text: "### 요약\n\n핵심은 **캐시 적중률**입니다.\n\n- 원인\n  - TTL이 짧음\n- 해결: `ttl=600`\n\n```bash\nnpm run build\nnpm test\n```\n\n| 항목 | 값 |\n| - | - |\n| 적중률 | 92% |",
  },
  {
    id: "web",
    title: "웹 문서",
    source: "Web article — styled divs/spans with colours, inline code, quote",
    html: `<div class="article"><h2 style="color:#123456;font-family:Georgia">설치</h2><div><p style="color:rgb(80,80,80)">먼저 <code>lotion</code>을 설치하고 <a href="https://example.com/docs" style="color:red">문서</a>를 확인하세요.</p><blockquote><p>주의: Node 24 이상</p></blockquote><ul><li style="color:blue">macOS</li><li>Linux</li></ul></div></div>`,
    text: "설치\n먼저 lotion을 설치하고 문서를 확인하세요.\n주의: Node 24 이상\nmacOS\nLinux",
  },
  {
    id: "memo",
    title: "메모장 텍스트 (들여쓰기)",
    source:
      "Plain text from a notes app — Korean memo, 2-space indents, mixed markers",
    text: "검색\n  Phase 2\n    KB 미팅 완료 (9/22)\n    설계 반영 후 공유 예정 (~9/29)\n  Phase 1 QA\n    - whitelist 논의 완료\n    - 기타 이슈 트래킹 중\nAI Ops\n  매뉴얼 작성 (~9/28)",
  },
  {
    id: "markdown",
    title: "Markdown 파일",
    source: "Text from a .md file — headings, bold, lists, code fence",
    text: "# 릴리스 0.40\n\n**변경 사항**\n\n- 세션 로그인\n  - 90일 유지\n- [x] 테스트 완료\n\n```ts\nconst ok = true;\n```",
  },
  {
    id: "vscode",
    title: "VS Code 코드",
    source: "VS Code — monospace coloured HTML + indented plain text",
    html: `<meta charset="utf-8"><div style="color: #d4d4d4;background-color: #1e1e1e;font-family: Menlo, Monaco, 'Courier New', monospace;font-size: 12px;line-height: 18px;white-space: pre;"><div><span style="color: #569cd6;">function</span><span style="color: #dcdcaa;"> greet</span>() {</div><div>  <span style="color: #c586c0;">return</span> <span style="color: #ce9178;">"hi"</span>;</div><div>}</div></div>`,
    text: 'function greet() {\n  return "hi";\n}',
    before: [{ id: "code", type: "codeBlock", text: "// paste:" }],
    cursor: { id: "code", at: "end" },
  },
  {
    id: "sheets",
    title: "Google Sheets / Excel 표",
    source: "Spreadsheet cells — HTML table + TSV text",
    html: `<meta charset="utf-8"><google-sheets-html-origin><table xmlns="http://www.w3.org/1999/xhtml" cellspacing="0" cellpadding="0" dir="ltr" border="1"><colgroup><col width="100"><col width="100"></colgroup><tbody><tr style="height:21px;"><td style="font-weight:bold;">담당</td><td style="font-weight:bold;">기한</td></tr><tr style="height:21px;"><td>민수</td><td>10/20</td></tr><tr style="height:21px;"><td>지영</td><td>10/22</td></tr></tbody></table>`,
    text: "담당\t기한\n민수\t10/20\n지영\t10/22",
  },
  {
    id: "inline",
    title: "한 줄 (굵게·링크) — 문장 중간에",
    source: "One line from a web page, pasted in the middle of existing text",
    html: `<span>자세한 내용은 <b>위키</b>의 <a href="https://example.com/wiki">설계 문서</a></span>`,
    text: "자세한 내용은 위키의 설계 문서",
    before: [p("line", "앞 문장 | 뒤 문장")],
    cursor: { id: "line", at: 5 },
  },
  {
    id: "middle",
    title: "여러 줄 — 문장 중간에",
    source: "Several plain lines pasted in the middle of a line",
    text: "첫째 줄\n둘째 줄\n  들여쓴 줄",
    before: [p("line", "앞부분|뒷부분")],
    cursor: { id: "line", at: 3 },
  },
  {
    id: "into-list",
    title: "목록 안에 여러 줄",
    source: "Plain lines pasted at the end of a bullet item",
    text: "우유\n계란\n빵",
    before: [p("item", "장보기", "bulletListItem")],
    cursor: { id: "item", at: "end" },
  },
];
