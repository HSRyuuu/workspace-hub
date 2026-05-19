/**
 * Segmented underline tabs — Apple/Notion Calendar 톤.
 *
 * 디자인 시스템 v0.2 결정 — 회색 박스 segmented pill 대신 밑줄 탭.
 */
export interface TabItem<T extends string = string> {
  value: T;
  label: string;
  /** 오른쪽에 따라붙는 count badge (옵션) */
  badge?: number | string;
}

interface TabsUnderlineProps<T extends string = string> {
  items: TabItem<T>[];
  value: T;
  onChange: (next: T) => void;
  /** aria-label 용도. 기본 "탭" */
  ariaLabel?: string;
}

export function TabsUnderline<T extends string = string>({
  items,
  value,
  onChange,
  ariaLabel = "탭",
}: TabsUnderlineProps<T>) {
  return (
    <div className="tabs-underline" role="tablist" aria-label={ariaLabel}>
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`tab ${active ? "active" : ""}`}
            onClick={() => onChange(it.value)}
          >
            {it.label}
            {it.badge != null && <span className="badge">{it.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
