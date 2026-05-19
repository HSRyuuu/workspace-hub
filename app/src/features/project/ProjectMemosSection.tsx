import { useState } from "react";
import { TrashIcon } from "../../components/ui/icons";
import { MarkdownEditor } from "../../components/ui/MarkdownEditor";
import type { Memo } from "../memo/types";
import { memoBodyPreview, memoDisplayTitle } from "../memo/markdown";

interface ProjectMemosSectionProps {
  memos: Memo[];
  onUnlink: (memo: Memo) => void;
}

/**
 * 프로젝트 상세의 "관련 메모" 섹션. 목록 ↔ 인라인 상세 두 모드.
 * 부모(ProjectPage)는 memos 배열만 넘기고, open/back 상태는 이 컴포넌트가 보유.
 * id 만 보관해 memos 갱신과 자연스럽게 동기화 — id 가 사라지면 자동 목록 복귀.
 */
export function ProjectMemosSection({ memos, onUnlink }: ProjectMemosSectionProps) {
  const [openMemoId, setOpenMemoId] = useState<number | null>(null);
  const openMemo =
    openMemoId !== null ? memos.find((m) => m.id === openMemoId) ?? null : null;

  if (openMemo) {
    return (
      <section className="scratch-section">
        <div className="section-head">
          <button
            type="button"
            className="memo-view-back"
            onClick={() => setOpenMemoId(null)}
          >
            ← 관련 메모
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={() => onUnlink(openMemo)}
            aria-label={`${memoDisplayTitle(openMemo)} 매핑 해제`}
            title="매핑 해제"
          >
            <TrashIcon size={16} />
          </button>
        </div>
        <article className="memo-view">
          <h3 className="memo-view-title">{memoDisplayTitle(openMemo)}</h3>
          {openMemo.body.trim() ? (
            <MarkdownEditor
              resetKey={openMemo.id}
              initialMarkdown={openMemo.body}
              readOnly
            />
          ) : (
            <p className="memo-view-empty">(본문 없음)</p>
          )}
        </article>
      </section>
    );
  }

  return (
    <section className="scratch-section">
      <div className="section-head">
        <h2 className="section-label">
          관련 메모 <span className="section-count">{memos.length}</span>
        </h2>
      </div>
      <ul className="scratch-list">
        {memos.map((m) => {
          const preview = memoBodyPreview(m);
          return (
          <li key={m.id} className="scratch-row">
            <button
              type="button"
              className="scratch-row-open"
              onClick={() => setOpenMemoId(m.id)}
            >
              <div className="scratch-title">{memoDisplayTitle(m)}</div>
              {preview && <div className="scratch-body">{preview}</div>}
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--danger"
              onClick={() => onUnlink(m)}
              aria-label={`${memoDisplayTitle(m)} 매핑 해제`}
              title="매핑 해제"
            >
              <TrashIcon size={16} />
            </button>
          </li>
          );
        })}
        {memos.length === 0 && (
          <li className="dirs-empty">
            매핑된 메모가 없습니다. 메모 상세에서 프로젝트를 선택해 연결하세요.
          </li>
        )}
      </ul>
    </section>
  );
}
