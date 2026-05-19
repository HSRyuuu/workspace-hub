import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronIcon } from "./icons";
import { useOutsideClick } from "./useOutsideClick";

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  leading?: ReactNode;
}

interface SelectProps<T extends string | number> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  disabled?: boolean;
  width?: number | string;
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
  width,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    Math.max(0, options.findIndex((o) => o.value === value)),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useOutsideClick(rootRef, open, () => setOpen(false));

  const current = options.find((o) => o.value === value);

  // 열릴 때 active 항목을 현재 선택 위치로 재설정
  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      if (idx >= 0) setActiveIndex(idx);
    }
  }, [open, options, value]);

  // 활성 항목이 보이도록 스크롤
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const el = list.children.item(activeIndex) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  const commit = (idx: number) => {
    const opt = options[idx];
    if (!opt) return;
    onChange(opt.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(activeIndex);
        break;
    }
  };

  return (
    <div ref={rootRef} className="ws-select" style={{ width }}>
      <button
        type="button"
        className="ws-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
      >
        <span className="ws-select-content">
          {current?.leading}
          <span className="ws-select-value">{current?.label ?? ""}</span>
        </span>
        <span className="ws-select-caret" aria-hidden>
          <ChevronIcon rotation={open ? -90 : 90} />
        </span>
      </button>
      {open && (
        <ul className="ws-select-popover" role="listbox" ref={listRef}>
          {options.map((opt, idx) => {
            const selected = opt.value === value;
            const active = idx === activeIndex;
            return (
              <li
                key={String(opt.value)}
                className={`ws-select-option ${selected ? "selected" : ""} ${active ? "active" : ""}`}
                role="option"
                aria-selected={selected}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => commit(idx)}
              >
                <span className="ws-select-content">
                  {opt.leading}
                  <span className="ws-select-option-label">{opt.label}</span>
                </span>
                {selected && <span className="ws-select-check" aria-hidden>✓</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
