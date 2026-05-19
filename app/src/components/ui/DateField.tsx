import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useOutsideClick } from "./useOutsideClick";

const POPOVER_WIDTH = 240;

interface DateFieldProps {
  /** ISO date `YYYY-MM-DD` or empty string for unset */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function toIso(y: number, m1to12: number, d: number): string {
  return `${y}-${pad2(m1to12)}-${pad2(d)}`;
}

function parseIso(s: string): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

function todayIso(): string {
  const d = new Date();
  return toIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Return 6 weeks × 7 days grid (42 cells) covering the given month. */
function buildMonthGrid(year: number, month1to12: number) {
  const firstOfMonth = new Date(year, month1to12 - 1, 1);
  const startWeekday = firstOfMonth.getDay(); // 0=Sun
  const gridStart = new Date(year, month1to12 - 1, 1 - startWeekday);
  const cells: { y: number; m: number; d: number; outside: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const cur = new Date(gridStart);
    cur.setDate(gridStart.getDate() + i);
    cells.push({
      y: cur.getFullYear(),
      m: cur.getMonth() + 1,
      d: cur.getDate(),
      outside: cur.getMonth() + 1 !== month1to12,
    });
  }
  return cells;
}

export function DateField({
  value,
  onChange,
  placeholder = "마감일 없음",
  ariaLabel,
  disabled,
}: DateFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [popStyle, setPopStyle] = useState<React.CSSProperties>({});
  useOutsideClick(rootRef, open, () => setOpen(false));

  const parsed = parseIso(value);
  const today = useMemo(() => todayIso(), []);
  const [viewYear, setViewYear] = useState(() => (parsed ?? new Date()).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => (parsed ?? new Date()).getMonth() + 1);

  useLayoutEffect(() => {
    if (!open) return;
    function update() {
      const t = triggerRef.current;
      if (!t) return;
      const r = t.getBoundingClientRect();
      const left = Math.max(8, Math.min(window.innerWidth - POPOVER_WIDTH - 8, r.right - POPOVER_WIDTH));
      setPopStyle({ top: r.bottom + 4, left, width: POPOVER_WIDTH });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  function openCalendar() {
    if (disabled) return;
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth() + 1);
    }
    setOpen(true);
  }

  function gotoPrev() {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  }
  function gotoNext() {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }
  function gotoToday() {
    const d = new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
  }
  function pick(y: number, m: number, d: number) {
    onChange(toIso(y, m, d));
    setOpen(false);
  }
  function clear() {
    onChange("");
    setOpen(false);
  }

  const cells = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  return (
    <div ref={rootRef} className="ws-datefield">
      <button
        ref={triggerRef}
        type="button"
        className="ws-datefield-trigger"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={openCalendar}
      >
        <span className={value ? "ws-datefield-value" : "ws-datefield-placeholder"}>
          {value || placeholder}
        </span>
        <span className="ws-datefield-icon" aria-hidden>
          <CalendarIcon />
        </span>
      </button>
      {open && (
        <div className="ws-datepopover" role="dialog" aria-label="날짜 선택" style={popStyle}>
          <div className="ws-datepopover-header">
            <button type="button" className="ws-cal-nav" onClick={gotoPrev} aria-label="이전 달">‹</button>
            <div className="ws-cal-title">{viewYear}년 {viewMonth}월</div>
            <button type="button" className="ws-cal-nav" onClick={gotoNext} aria-label="다음 달">›</button>
          </div>
          <div className="ws-cal-weekdays">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`ws-cal-weekday ${i === 0 ? "sun" : ""} ${i === 6 ? "sat" : ""}`}>{w}</div>
            ))}
          </div>
          <div className="ws-cal-grid">
            {cells.map((c, i) => {
              const iso = toIso(c.y, c.m, c.d);
              const isToday = iso === today;
              const isSelected = iso === value;
              const wd = i % 7;
              const cls = [
                "ws-cal-cell",
                c.outside ? "outside" : "",
                isToday ? "today" : "",
                isSelected ? "selected" : "",
                wd === 0 ? "sun" : "",
                wd === 6 ? "sat" : "",
              ].filter(Boolean).join(" ");
              return (
                <button
                  type="button"
                  key={iso + i}
                  className={cls}
                  aria-label={`${c.y}년 ${c.m}월 ${c.d}일${isSelected ? " (선택됨)" : ""}${isToday ? " (오늘)" : ""}`}
                  aria-pressed={isSelected}
                  onClick={() => pick(c.y, c.m, c.d)}
                >
                  {c.d}
                </button>
              );
            })}
          </div>
          <div className="ws-datepopover-footer">
            <button type="button" className="ws-datepopover-link" onClick={gotoToday}>오늘</button>
            <button type="button" className="ws-datepopover-link danger" onClick={clear}>지우기</button>
          </div>
        </div>
      )}
    </div>
  );
}

const CalendarIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
