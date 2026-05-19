import { useEffect, useState } from "react";
import { showErrorToast } from "../../components/ui/Toast";
import { projectApi } from "../project/api";
import type { Project } from "../project/types";
import { memoApi } from "./api";

interface Props {
  memoId: number;
  /** 매핑이 끝난 직후 호출 — 부모(ProjectPage 등)가 같은 화면에서 리스트를 갱신할 때 사용. */
  onChange?: () => void;
}

/**
 * 메모 ↔ 프로젝트 N:N 매핑 편집 UI.
 * - 매핑된 프로젝트는 dot chip 으로 표시, 각 chip 의 ✕ 로 해제
 * - 매핑 안 된 프로젝트는 native `<select>` placeholder 항목으로 노출, 선택 시 즉시 추가
 */
export function MemoProjectChips({ memoId, onChange }: Props) {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [linked, setLinked] = useState<Project[]>([]);
  // link/unlink 후 effect 를 재실행시키기 위한 trigger. memoId 변경 시 외에도 mutation
  // 직후 재 fetch 가 필요한데, refresh 별도 경로를 두면 cancellation 가드가 둘로 갈라져
  // race 가 생긴다 — counter 증가로 effect 만이 fetch 진입점이 되도록 일원화.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [all, mapped] = await Promise.all([
          projectApi.list(),
          memoApi.listProjects(memoId),
        ]);
        if (cancelled) return;
        setAllProjects(all);
        setLinked(mapped);
      } catch (e) {
        if (cancelled) return;
        showErrorToast(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memoId, reloadKey]);

  const linkedIds = new Set(linked.map((p) => p.id));
  const available = allProjects.filter((p) => !linkedIds.has(p.id));

  const handleLink = async (projectId: number) => {
    try {
      await memoApi.linkProject(memoId, projectId);
      setReloadKey((k) => k + 1);
      onChange?.();
    } catch (e) {
      showErrorToast(String(e));
    }
  };

  const handleUnlink = async (projectId: number) => {
    try {
      await memoApi.unlinkProject(memoId, projectId);
      setReloadKey((k) => k + 1);
      onChange?.();
    } catch (e) {
      showErrorToast(String(e));
    }
  };

  return (
    <div className="memo-project-chips" aria-label="프로젝트 매핑">
      <span className="memo-project-chips-label">프로젝트</span>
      {linked.map((p) => (
        <span key={p.id} className="memo-project-chip" title={p.title}>
          <span className="memo-project-chip-dot" style={{ background: p.color }} />
          <span className="memo-project-chip-name">{p.title}</span>
          <button
            type="button"
            className="memo-project-chip-remove"
            onClick={() => void handleUnlink(p.id)}
            aria-label={`${p.title} 매핑 해제`}
            title="해제"
          >
            ✕
          </button>
        </span>
      ))}
      {available.length > 0 && (
        <select
          className="memo-project-add"
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) void handleLink(Number(v));
          }}
          aria-label="프로젝트 추가"
        >
          <option value="">＋ 프로젝트 추가</option>
          {available.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
