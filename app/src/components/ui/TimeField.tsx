import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useOutsideClick } from "./useOutsideClick";

const POPOVER_WIDTH = 160;

interface TimeFieldProps {
  /** `HH:MM` (24h). 빈 문자열이면 미지정. */
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
  /** 분 step (기본 5). 1이면 모든 분. */
  minuteStep?: number;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function parseHM(s: string): [number, number] | null {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return [h, min];
}

export function TimeField({
  value,
  onChange,
  ariaLabel,
  disabled,
  minuteStep = 5,
}: TimeFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [popStyle, setPopStyle] = useState<React.CSSProperties>({});
  useOutsideClick(rootRef, open, () => setOpen(false));

  const parsed = parseHM(value);
  const [hour, setHour] = useState<number>(parsed ? parsed[0] : 9);
  const [minute, setMinute] = useState<number>(parsed ? parsed[1] : 0);

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

  useEffect(() => {
    if (parsed) {
      setHour(parsed[0]);
      setMinute(parsed[1]);
    }
  }, [value]);

  const hourListRef = useRef<HTMLUListElement>(null);
  const minuteListRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = hourListRef.current?.children.item(hour) as HTMLElement | null;
    h?.scrollIntoView({ block: "nearest" });
    const minIdx = Math.floor(minute / minuteStep);
    const m = minuteListRef.current?.children.item(minIdx) as HTMLElement | null;
    m?.scrollIntoView({ block: "nearest" });
  }, [open, hour, minute, minuteStep]);

  const minutes = useMemo(() => {
    const arr: number[] = [];
    for (let m = 0; m < 60; m += minuteStep) arr.push(m);
    return arr;
  }, [minuteStep]);
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  function commit(h: number, m: number) {
    onChange(`${pad2(h)}:${pad2(m)}`);
    setHour(h);
    setMinute(m);
  }

  return (
    <div ref={rootRef} className="ws-timefield">
      <button
        ref={triggerRef}
        type="button"
        className="ws-timefield-trigger"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={value ? "ws-timefield-value" : "ws-timefield-placeholder"}>
          {value || "--:--"}
        </span>
        <span className="ws-timefield-icon" aria-hidden>
          <ClockIcon />
        </span>
      </button>
      {open && (
        <div className="ws-timepopover" role="dialog" aria-label="시간 선택" style={popStyle}>
          <div className="ws-timepopover-head" aria-live="polite">
            <span>{pad2(hour)}</span>
            <span className="sep">:</span>
            <span>{pad2(minute)}</span>
          </div>
          <div className="ws-timepopover-collabels" aria-hidden>
            <div className="ws-timepopover-collabel">시</div>
            <div className="ws-timepopover-collabel">분</div>
          </div>
          <div className="ws-timepopover-cols">
            <ul ref={hourListRef} className="ws-timepopover-col" aria-label="시">
              {hours.map((h) => (
                <li
                  key={h}
                  className={`ws-timepopover-item ${h === hour ? "selected" : ""}`}
                  onClick={() => commit(h, minute)}
                >
                  {pad2(h)}
                </li>
              ))}
            </ul>
            <ul ref={minuteListRef} className="ws-timepopover-col" aria-label="분">
              {minutes.map((m) => (
                <li
                  key={m}
                  className={`ws-timepopover-item ${m === minute ? "selected" : ""}`}
                  onClick={() => commit(hour, m)}
                >
                  {pad2(m)}
                </li>
              ))}
            </ul>
          </div>
          <div className="ws-timepopover-footer">
            <button
              type="button"
              className="ws-datepopover-link"
              onClick={() => {
                commit(hour, minute);
                setOpen(false);
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const ClockIcon = () => (
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
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
);
