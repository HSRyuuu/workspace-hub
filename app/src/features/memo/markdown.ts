/**
 * 메모 본문 markdown 유틸. 직렬화·역직렬화는 tiptap-markdown 으로 위임함.
 * 첫 라인 타이틀 추출 + 표시용 title / body preview 헬퍼.
 */

import type { Memo } from "./types";

/** markdown 본문 첫 줄에서 제목으로 쓸 만한 텍스트를 뽑는다 (`#` 기호·공백 제거). */
export function firstLineAsTitle(md: string): string {
  for (const line of (md ?? "").split("\n")) {
    const trimmed = line.replace(/^#+\s*/, "").trim();
    if (trimmed !== "") return trimmed;
  }
  return "";
}

/** 메모 카드/목록·인라인 상세에서 쓰는 표시용 타이틀. title 비어있으면 본문 첫 줄, 그것도 없으면 "(제목 없음)". */
export function memoDisplayTitle(m: Memo): string {
  if (m.title.trim() !== "") return m.title;
  const fromBody = firstLineAsTitle(m.body);
  return fromBody !== "" ? fromBody : "(제목 없음)";
}

/**
 * 메모 본문 미리보기 한 줄. title 컬럼이 비어 있으면 본문의 첫 줄은 제목으로 소비되었으므로
 * 둘째 줄부터, 채워져 있으면 본문 첫 줄부터.
 */
export function memoBodyPreview(m: Memo): string {
  const lines = m.body
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .filter((l) => l !== "");
  const startIdx = m.title.trim() === "" ? 1 : 0;
  return lines[startIdx]?.slice(0, 80) ?? "";
}
