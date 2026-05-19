import type { ButtonHTMLAttributes } from "react";
import type { Priority } from "./PriorityDot";

interface PriorityToggleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  priority: Priority;
  active: boolean;
  label: string;
}

/**
 * 우선순위 필터 토글 — TodoFilters의 다중 선택 칩.
 * 디자인 시스템 v0.2 — dot + 텍스트, active 시 보더 강조.
 */
export function PriorityToggle({
  priority,
  active,
  label,
  className = "",
  ...rest
}: PriorityToggleProps) {
  return (
    <button
      type="button"
      className={`prio-toggle ${priority} ${active ? "active" : ""} ${className}`.trim()}
      aria-pressed={active}
      {...rest}
    >
      <span className="dot" />
      {label}
    </button>
  );
}
