/** 캘린더 일정 색상 팔레트. workspace 도입 전까지는 자체 팔레트로 색 구분. */
export const SCHEDULE_PALETTE: { value: string; label: string }[] = [
  { value: "#3F3393", label: "보라" },
  { value: "#2469CF", label: "파랑" },
  { value: "#2F7A3A", label: "초록" },
  { value: "#C46F1A", label: "주황" },
  { value: "#C33B3B", label: "빨강" },
  { value: "#7A4FAB", label: "라벤더" },
  { value: "#0F8F86", label: "민트" },
  { value: "#525252", label: "회색" },
];

interface ColorSwatchProps {
  /** 빈 문자열이면 미지정(default 색) */
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}

export function ColorSwatch({ value, onChange, ariaLabel }: ColorSwatchProps) {
  return (
    <div className="ws-swatch" role="radiogroup" aria-label={ariaLabel ?? "색상"}>
      <button
        type="button"
        className={`ws-swatch-dot none ${value === "" ? "selected" : ""}`}
        role="radio"
        aria-checked={value === ""}
        aria-label="기본 색상"
        onClick={() => onChange("")}
        title="기본"
      >
        ×
      </button>
      {SCHEDULE_PALETTE.map((c) => (
        <button
          key={c.value}
          type="button"
          className={`ws-swatch-dot ${value.toUpperCase() === c.value ? "selected" : ""}`}
          role="radio"
          aria-checked={value.toUpperCase() === c.value}
          aria-label={c.label}
          title={c.label}
          style={{ background: c.value }}
          onClick={() => onChange(c.value)}
        />
      ))}
    </div>
  );
}
