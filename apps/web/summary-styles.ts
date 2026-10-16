/** Condensing styles offered for summaries (mirrors the server's STYLE_RULES). */
export type SummaryStyle = "brief" | "actions" | "standard" | "detailed";
export const STYLE_OPTIONS: {
  value: SummaryStyle;
  label: string;
  hint: string;
}[] = [
  {
    value: "brief",
    label: "핵심·결정 (짧게)",
    hint: "핵심 1~3줄 + 결정 사항 + 액션 아이템, 15줄 이내",
  },
  {
    value: "actions",
    label: "결정·액션만",
    hint: "결정 사항과 액션 아이템 목록만",
  },
  { value: "standard", label: "표준 회의록", hint: "Confluence 형식 6개 섹션" },
  {
    value: "detailed",
    label: "상세 회의록",
    hint: "표준 + 주제별 의견·근거·과정",
  },
];
