import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_WIDTH = 460;
const MIN_WIDTH = 320;
/** 패널을 최대한 넓혀도 목록이 이만큼은 남는다 */
const MIN_REST = 200;
const KEY_STEP = 24;

interface ResizablePanelProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * 부모(`position: relative`) 위에 우측으로 겹쳐 뜨는 상세 패널. 왼쪽 경계선을 드래그해서 폭을 바꾼다.
 * 폭은 이 컴포넌트가 마운트돼 있는 동안만 기억하고, 앱을 다시 켜면 기본값(460px)으로 돌아온다.
 */
export function ResizablePanel({ title, onClose, children }: ResizablePanelProps) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  const clamp = useCallback((value: number) => {
    // 아직 레이아웃이 측정되지 않았으면(0) 상한을 두지 않는다
    const parentWidth = panelRef.current?.parentElement?.clientWidth || Infinity;
    return Math.max(MIN_WIDTH, Math.min(value, parentWidth - MIN_REST));
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const right = panelRef.current?.parentElement?.getBoundingClientRect().right;
    if (right === undefined) return;
    setWidth(clamp(right - e.clientX));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  const onHandleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") setWidth((w) => clamp(w + KEY_STEP));
    else if (e.key === "ArrowRight") setWidth((w) => clamp(w - KEY_STEP));
    else return;
    e.preventDefault();
  };

  // Esc 로 닫기 — 열려 있는 드롭다운/팝오버가 Esc 를 먼저 쓰도록 비켜 준다
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector(".ws-select-popover, .ws-datepopover, .ws-timepopover")) return;
      if (panelRef.current?.contains(document.activeElement)) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <aside
      ref={panelRef}
      className={`resizable-panel${dragging ? " dragging" : ""}`}
      style={{ width }}
      aria-label={title}
    >
      <div
        className="resizable-panel-handle"
        role="separator"
        aria-orientation="vertical"
        aria-label={`${title} 폭 조절`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onHandleKeyDown}
      />
      <div className="resizable-panel-head">
        <span>{title}</span>
        <button type="button" className="icon-btn" aria-label="닫기" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="resizable-panel-body">{children}</div>
    </aside>
  );
}
