import { useEffect, useMemo, useRef, useState } from "react";
import { showErrorToast } from "../../components/ui/Toast";
import { scheduleApi } from "../calendar/api";
import { addDays, todayIso } from "../calendar/dateUtils";
import { memoApi } from "../memo/api";
import { todoApi } from "../todo/api";
import { SEARCH_KIND_LABEL, searchAll, type SearchHit, type SearchSource } from "./search";

export interface PaletteNavItem {
  id: string;
  label: string;
  shortcut: string;
}

interface CommandPaletteProps {
  navItems: PaletteNavItem[];
  onClose(): void;
  onNavigate(id: string): void;
  onOpenHit(hit: SearchHit): void;
}

const EMPTY_SOURCE: SearchSource = { todos: [], memos: [], schedules: [] };

type Row =
  | { type: "nav"; key: string; label: string; meta: string; item: PaletteNavItem }
  | { type: "hit"; key: string; label: string; meta: string; group: string; hit: SearchHit };

/** ⌘K 통합 검색 — TODO·메모·일정을 한 번에 찾고, 입력이 비어 있으면 화면 이동 목록을 보여준다. */
export function CommandPalette({ navItems, onClose, onNavigate, onOpenHit }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SearchSource>(EMPTY_SOURCE);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const today = todayIso();
    Promise.all([
      todoApi.list("all"),
      memoApi.list("active"),
      scheduleApi.listRange(addDays(today, -60), addDays(today, 180)),
    ])
      .then(([todos, memos, schedules]) => setSource({ todos, memos, schedules }))
      .catch((e: unknown) => showErrorToast(String(e)));
  }, []);

  const rows = useMemo<Row[]>(() => {
    if (!query.trim()) {
      return navItems.map((item) => ({
        type: "nav",
        key: `nav-${item.id}`,
        label: item.label,
        meta: item.shortcut,
        item,
      }));
    }
    return searchAll(query, source).map((hit) => ({
      type: "hit",
      key: `${hit.kind}-${hit.id}`,
      label: hit.title,
      meta: hit.meta,
      group: SEARCH_KIND_LABEL[hit.kind],
      hit,
    }));
  }, [query, source, navItems]);

  const activeIndex = Math.min(active, Math.max(rows.length - 1, 0));

  const choose = (row: Row) => {
    onClose();
    if (row.type === "nav") onNavigate(row.item.id);
    else onOpenHit(row.hit);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(rows.length === 0 ? 0 : (activeIndex + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(rows.length === 0 ? 0 : (activeIndex - 1 + rows.length) % rows.length);
    } else if (e.key === "Enter" && rows[activeIndex]) {
      e.preventDefault();
      choose(rows[activeIndex]);
    }
  };

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="통합 검색"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="palette-input-row">
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="TODO · 메모 · 일정 검색, 또는 화면 이동"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={
              rows[activeIndex] ? `palette-${rows[activeIndex].key}` : undefined
            }
            aria-label="검색어"
          />
          <kbd className="palette-kbd">esc</kbd>
        </div>

        <div className="palette-list" id="palette-list" role="listbox">
          {rows.length === 0 && <div className="palette-empty">일치하는 항목이 없어요.</div>}
          {rows.map((row, i) => {
            const group = row.type === "hit" ? row.group : "이동";
            const showGroup =
              i === 0 ||
              (rows[i - 1].type === "hit" ? (rows[i - 1] as { group: string }).group : "이동") !==
                group;
            return (
              <div key={row.key}>
                {showGroup && <div className="palette-group">{group}</div>}
                <div
                  id={`palette-${row.key}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  className={`palette-item${i === activeIndex ? " active" : ""}`}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(row)}
                >
                  <span className="palette-item-label">{row.label}</span>
                  <span className="palette-item-meta">{row.meta}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="palette-foot">
          <span>
            <kbd className="palette-kbd">↑</kbd> <kbd className="palette-kbd">↓</kbd> 이동
          </span>
          <span>
            <kbd className="palette-kbd">⏎</kbd> 열기
          </span>
          <span className="palette-foot-end">로컬 데이터만 검색해요</span>
        </div>
      </div>
    </div>
  );
}
