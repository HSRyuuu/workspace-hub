import { useRef, useState } from "react";
import { useOutsideClick } from "../../components/ui/useOutsideClick";

interface MonthPickerProps {
  year: number;
  month: number;
  onSelect: (year: number, month: number) => void;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** 툴바의 "2026년 10월" 을 누르면 열리는 연·월 선택 팝업. 연도는 ‹ › 로 넘기고 월은 한 번 눌러 이동한다. */
export function MonthPicker({ year, month, onSelect }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const rootRef = useRef<HTMLDivElement>(null);
  useOutsideClick(rootRef, open, () => setOpen(false));

  const today = new Date();
  const thisYear = today.getFullYear();
  const thisMonth = today.getMonth() + 1;

  const toggle = () => {
    // 열 때마다 현재 보고 있는 해에서 시작
    if (!open) setPickerYear(year);
    setOpen(!open);
  };

  return (
    <div className="cal-month-picker" ref={rootRef}>
      <button
        type="button"
        className="cal-cursor cal-cursor-btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        {year}년 {month}월
        <span className="cal-cursor-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="cal-month-popover" role="dialog" aria-label="연·월 선택">
          <div className="cal-month-popover-head">
            <button
              type="button"
              className="icon-btn"
              aria-label="이전 해"
              onClick={() => setPickerYear((y) => y - 1)}
            >
              ‹
            </button>
            <span className="cal-month-popover-year">{pickerYear}년</span>
            <button
              type="button"
              className="icon-btn"
              aria-label="다음 해"
              onClick={() => setPickerYear((y) => y + 1)}
            >
              ›
            </button>
          </div>
          <div className="cal-month-grid">
            {MONTHS.map((m) => {
              const selected = pickerYear === year && m === month;
              const isToday = pickerYear === thisYear && m === thisMonth;
              return (
                <button
                  key={m}
                  type="button"
                  className={`cal-month-cell${selected ? " selected" : ""}${isToday ? " today" : ""}`}
                  aria-pressed={selected}
                  onClick={() => {
                    onSelect(pickerYear, m);
                    setOpen(false);
                  }}
                >
                  {m}월
                </button>
              );
            })}
          </div>
          <div className="cal-month-popover-foot">
            <button
              type="button"
              className="btn btn--sm btn-ghost"
              onClick={() => {
                onSelect(thisYear, thisMonth);
                setOpen(false);
              }}
            >
              이번 달
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
