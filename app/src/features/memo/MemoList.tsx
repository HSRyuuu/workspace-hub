import type { Memo, MemoFolder, MemoListScope } from "./types";
import { memoBodyPreview, memoDisplayTitle } from "./markdown";
import { FolderIcon, PinIcon } from "./icons";
import MemoActions from "./MemoActions";

// HTML5 DnD 명세상 한 번에 하나의 드래그만 활성 — 모듈 스코프로 안전.
let dragGhostEl: HTMLElement | undefined;

interface MemoListProps {
  memos: Memo[];
  /** 헤더에 표시할 라벨 — "모든 메모", "최근 삭제", 또는 폴더명. */
  label: string;
  onSelect: (id: number) => void;
  onCreate: () => void;
  /** 휴지통 모드 — 영구 삭제·복원 액션을 노출. */
  trashMode: boolean;
  onRestore: (id: number) => void;
  onPurge: (id: number) => void;
  onEmptyTrash: () => void;
  /** normal 모드 row 우측 액션 — 핀 토글·삭제. */
  onTogglePin: (id: number, pinned: boolean) => void;
  onDelete: (id: number) => void;
  /** 메모 row 를 드래그 시작했을 때 — MemoPage 가 draggedMemo state 를 set 한다. */
  onMemoDragStart: (memoId: number, currentFolderId: number | null) => void;
  /** dragend (drop 성공/실패 관계 없이). MemoPage 가 draggedMemo 를 null 로 클리어. */
  onMemoDragEnd: () => void;
  /** 폴더 badge 렌더링용. scope==="folder" 일 때는 모든 row 가 같은 폴더라 표시 생략. */
  folders: MemoFolder[];
  scope: MemoListScope;
}

function formatDate(iso: string): string {
  return iso.replace("T", " ").replace(/:\d{2}Z?$/, "").slice(0, 16);
}

function createDragGhost(title: string): HTMLElement {
  const el = document.createElement("div");
  el.textContent = title;
  el.style.cssText = [
    "position:absolute",
    "top:-1000px",
    "left:-1000px",
    "width:220px",
    "min-height:56px",
    "padding:10px 14px",
    "border-radius:10px",
    "background:rgba(255,255,255,0.92)",
    "box-shadow:0 8px 24px rgba(0,0,0,0.18)",
    "font:13px/1.4 system-ui",
    "color:#0f0f0f",
    "white-space:nowrap",
    "overflow:hidden",
    "text-overflow:ellipsis",
    "transform:rotate(-2deg)",
    "pointer-events:none",
  ].join(";");
  document.body.appendChild(el);
  return el;
}

export default function MemoList(props: MemoListProps) {
  return (
    <div className="memo-list-pane">
      <div className="memo-list-header">
        <span className="memo-list-title">
          {props.label} <span className="memo-list-count">({props.memos.length})</span>
        </span>
        {props.trashMode && (
          <button
            type="button"
            className="memo-list-header-btn memo-list-header-btn--danger"
            onClick={props.onEmptyTrash}
            disabled={props.memos.length === 0}
          >
            모두 비우기
          </button>
        )}
      </div>
      <div className="memo-list-scroll">
        {props.memos.length === 0 ? (
          <div className="memo-list-empty">
            <p className="memo-list-empty-msg">
              {props.trashMode ? "휴지통이 비었습니다" : "메모가 없습니다"}
            </p>
            {!props.trashMode && (
              <button
                type="button"
                className="memo-list-empty-cta"
                onClick={props.onCreate}
              >
                + 새 메모 만들기
              </button>
            )}
          </div>
        ) : (
          props.memos.map((m) => (
            <button
              key={m.id}
              type="button"
              className="memo-list-row"
              onClick={() => props.onSelect(m.id)}
              draggable={!props.trashMode}
              onDragStart={(e) => {
                if (props.trashMode) return;
                // dragend 가 누락된 이전 드래그가 남긴 ghost 가 있으면 청소.
                if (dragGhostEl) { dragGhostEl.remove(); dragGhostEl = undefined; }
                e.dataTransfer.setData("application/x-memo-id", String(m.id));
                e.dataTransfer.effectAllowed = "move";
                const ghost = createDragGhost(memoDisplayTitle(m));
                e.dataTransfer.setDragImage(ghost, 20, 20);
                dragGhostEl = ghost;
                props.onMemoDragStart(m.id, m.folder_id);
              }}
              onDragEnd={() => {
                if (dragGhostEl) {
                  dragGhostEl.remove();
                  dragGhostEl = undefined;
                }
                props.onMemoDragEnd();
              }}
            >
              <div className="memo-list-row-content">
                <div className="memo-list-row-top">
                  {m.pinned && !props.trashMode && (
                    <span className="memo-list-pin-star" aria-label="고정됨" title="고정됨">
                      <PinIcon pinned />
                    </span>
                  )}
                  <span className="memo-list-row-title">{memoDisplayTitle(m)}</span>
                </div>
                <div className="memo-list-row-meta">
                  <span className="memo-list-row-date">
                    {formatDate(props.trashMode ? m.deleted_at ?? m.updated_at : m.updated_at)}
                  </span>
                  {props.scope !== "folder" &&
                    m.folder_id !== null &&
                    (() => {
                      const f = props.folders.find((x) => x.id === m.folder_id);
                      if (!f) return null;
                      return (
                        <span className="memo-list-row-folder" title={f.name}>
                          <FolderIcon />
                          <span className="memo-list-row-folder-name">{f.name}</span>
                        </span>
                      );
                    })()}
                  <span className="memo-list-row-preview">{memoBodyPreview(m)}</span>
                </div>
              </div>
              <div
                className={`memo-list-row-actions${
                  props.trashMode ? " memo-list-row-actions--always" : ""
                }`}
              >
                {props.trashMode ? (
                  <>
                    <button
                      type="button"
                      className="memo-list-row-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onRestore(m.id);
                      }}
                    >
                      복원
                    </button>
                    <button
                      type="button"
                      className="memo-list-row-btn memo-list-row-btn--danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onPurge(m.id);
                      }}
                    >
                      영구 삭제
                    </button>
                  </>
                ) : (
                  <MemoActions
                    id={m.id}
                    pinned={m.pinned}
                    onTogglePin={props.onTogglePin}
                    onDelete={props.onDelete}
                    stopPropagation
                  />
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
