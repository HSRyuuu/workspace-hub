/** 우선순위 dot 의 시각 토큰 — `prio-dot.{low|mid|high}` CSS 클래스와 매칭. todo 도메인이 재사용. */
export type Priority = "low" | "mid" | "high";

interface PriorityDotProps {
  priority: Priority;
  /** 접근성 라벨. 기본 "우선순위: {priority}" */
  ariaLabel?: string;
}

/**
 * 우선순위 표시 — high(rose) / mid(amber) / low(slate) dot.
 * 디자인 시스템 v0.2 — 회색 박스 칩 대신 8px dot.
 */
export function PriorityDot({ priority, ariaLabel }: PriorityDotProps) {
  return (
    <span
      className={`prio-dot ${priority}`}
      role="img"
      aria-label={ariaLabel ?? `우선순위: ${priority}`}
    />
  );
}
