/** 2~4개 선택지 중 하나를 고르는 작은 토글 그룹 (설정의 테마 선택 등). */
export interface SegmentedItem<T extends string = string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string = string> {
  items: SegmentedItem<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}

export function SegmentedControl<T extends string = string>({
  items,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          role="radio"
          aria-checked={it.value === value}
          className={`segmented-item${it.value === value ? " active" : ""}`}
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
