import { useCallback, useEffect, useMemo, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Button, ColorSwatch, showConfirmToast, showErrorToast } from "../../components/ui";
import {
  CheckIcon,
  FolderIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from "../../components/ui/icons";
import type { Memo } from "../memo/types";
import { memoDisplayTitle } from "../memo/markdown";
import { projectApi } from "./api";
import { ProjectMemosSection } from "./ProjectMemosSection";
import type { Project, ProjectApplication, ProjectDirectory } from "./types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// .app 번들 경로에서 사용자 친화 이름 추출. "/Applications/IntelliJ IDEA.app" → "IntelliJ IDEA".
function appDisplayName(app: ProjectApplication): string {
  if (app.label && app.label.trim()) return app.label;
  const last = app.path.split("/").filter(Boolean).pop() ?? app.path;
  return last.replace(/\.app$/i, "");
}

function dirDisplayName(dir: ProjectDirectory): string {
  if (dir.label && dir.label.trim()) return dir.label;
  return dir.path.split("/").filter(Boolean).pop() ?? dir.path;
}

export default function ProjectPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [directories, setDirectories] = useState<ProjectDirectory[]>([]);
  const [applications, setApplications] = useState<ProjectApplication[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  // "관련 메모" 섹션은 목록 ↔ 인라인 상세 뷰 2가지 모드. id 만 보관해 memos 갱신과
  // 자연스럽게 동기화되도록 한다 (id 가 사라지면 자동으로 목록으로 복귀).
  const [loading, setLoading] = useState(false);

  const [composerOpen, setComposerOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // 뷰/편집 모드 분리. editing=false 면 라벨-값 읽기 전용.
  const [editing, setEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [editingColor, setEditingColor] = useState("");

  const refreshProjects = useCallback(async () => {
    setLoading(true);
    try {
      const list = await projectApi.list();
      setProjects(list);
      if (list.length > 0 && selectedId === null) {
        setSelectedId(list[0].id);
      }
      if (selectedId !== null && !list.find((p) => p.id === selectedId)) {
        setSelectedId(list[0]?.id ?? null);
      }
    } catch (e) {
      showErrorToast(String(e));
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const refreshDirectories = useCallback(async () => {
    if (selectedId === null) {
      setDirectories([]);
      return;
    }
    try {
      const list = await projectApi.dirList(selectedId);
      setDirectories(list);
    } catch (e) {
      showErrorToast(String(e));
    }
  }, [selectedId]);

  const refreshApplications = useCallback(async () => {
    if (selectedId === null) {
      setApplications([]);
      return;
    }
    try {
      const list = await projectApi.appList(selectedId);
      setApplications(list);
    } catch (e) {
      showErrorToast(String(e));
    }
  }, [selectedId]);

  const refreshMemos = useCallback(async () => {
    if (selectedId === null) {
      setMemos([]);
      return;
    }
    try {
      const list = await projectApi.listMemos(selectedId);
      setMemos(list);
    } catch (e) {
      showErrorToast(String(e));
    }
  }, [selectedId]);

  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    void refreshDirectories();
    void refreshApplications();
    void refreshMemos();
    setEditing(false);
    // 메모 상세 열림 상태는 ProjectMemosSection 내부 — selectedId 가 바뀌면 memos 가 교체되며
    // openMemoId 가 찾기 실패해 자동으로 목록 모드로 복귀한다.
  }, [selectedId, refreshDirectories, refreshApplications, refreshMemos]);

  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );

  useEffect(() => {
    setEditingTitle(selected?.title ?? "");
    setEditingDescription(selected?.description ?? "");
    setEditingColor(selected?.color ?? "");
  }, [selected?.id, selected?.title, selected?.description, selected?.color]);

  const handleAddProject = async () => {
    const title = newTitle.trim();
    if (!title) return;
    try {
      const created = await projectApi.add({
        title,
        description: newDescription.trim() || null,
      });
      setNewTitle("");
      setNewDescription("");
      setComposerOpen(false);
      setSelectedId(created.id);
      await refreshProjects();
    } catch (e) {
      showErrorToast(String(e));
    }
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    const title = editingTitle.trim();
    if (!title) {
      showErrorToast("제목은 비울 수 없습니다.");
      return;
    }
    try {
      // color: 빈 문자열 = 기본색으로 복귀 (repo 의 DEFAULT_COLOR fallback 이 처리)
      await projectApi.update(selected.id, {
        title,
        description: editingDescription,
        color: editingColor,
      });
      await refreshProjects();
      setEditing(false);
    } catch (e) {
      showErrorToast(String(e));
    }
  };

  const handleCancelEdit = () => {
    setEditingTitle(selected?.title ?? "");
    setEditingDescription(selected?.description ?? "");
    setEditingColor(selected?.color ?? "");
    setEditing(false);
  };

  const handleDeleteProject = () => {
    if (!selected) return;
    showConfirmToast({
      message: `"${selected.title}" 프로젝트를 삭제할까요? 디렉터리·응용프로그램 목록도 함께 사라집니다.`,
      confirmLabel: "삭제",
      cancelLabel: "취소",
      onConfirm: async () => {
        try {
          await projectApi.delete(selected.id);
          setSelectedId(null);
          await refreshProjects();
        } catch (e) {
          showErrorToast(String(e));
        }
      },
    });
  };

  const handleAddDirectory = async () => {
    if (!selected) return;
    try {
      const picked = await openDialog({ directory: true, multiple: false });
      if (typeof picked !== "string") return;
      await projectApi.dirAdd({ project_id: selected.id, path: picked });
      await refreshDirectories();
    } catch (e) {
      showErrorToast(String(e));
    }
  };

  const handleOpenDirectory = async (path: string) => {
    try {
      await projectApi.openInFinder(path);
    } catch (e) {
      showErrorToast(String(e));
    }
  };

  const handleDeleteDirectory = (dir: ProjectDirectory) => {
    showConfirmToast({
      message: `"${dirDisplayName(dir)}" 디렉터리를 목록에서 제거할까요?`,
      confirmLabel: "제거",
      cancelLabel: "취소",
      onConfirm: async () => {
        try {
          await projectApi.dirDelete(dir.id);
          await refreshDirectories();
        } catch (e) {
          showErrorToast(String(e));
        }
      },
    });
  };

  const handleAddApplication = async () => {
    if (!selected) return;
    try {
      // macOS .app 번들은 디렉터리지만, file dialog 에서 directory=false 로 두면 .app 도 선택 가능.
      const picked = await openDialog({
        directory: false,
        multiple: false,
        filters: [{ name: "Application", extensions: ["app"] }],
        defaultPath: "/Applications",
      });
      if (typeof picked !== "string") return;
      await projectApi.appAdd({ project_id: selected.id, path: picked });
      await refreshApplications();
    } catch (e) {
      showErrorToast(String(e));
    }
  };

  const handleOpenApplication = async (path: string) => {
    try {
      await projectApi.openApplication(path);
    } catch (e) {
      showErrorToast(String(e));
    }
  };

  const handleUnlinkMemo = (memo: Memo) => {
    if (!selected) return;
    showConfirmToast({
      message: `"${memoDisplayTitle(memo)}" 메모 매핑을 해제할까요? 메모 자체는 삭제되지 않습니다.`,
      confirmLabel: "해제",
      cancelLabel: "취소",
      onConfirm: async () => {
        try {
          await projectApi.unlinkMemo(memo.id, selected.id);
          await refreshMemos();
        } catch (e) {
          showErrorToast(String(e));
        }
      },
    });
  };

  const handleDeleteApplication = (app: ProjectApplication) => {
    showConfirmToast({
      message: `"${appDisplayName(app)}" 응용프로그램을 목록에서 제거할까요?`,
      confirmLabel: "제거",
      cancelLabel: "취소",
      onConfirm: async () => {
        try {
          await projectApi.appDelete(app.id);
          await refreshApplications();
        } catch (e) {
          showErrorToast(String(e));
        }
      },
    });
  };

  return (
    <div className="project-page">
      <aside className="project-list">
        <div className="project-list-header">
          <h2>프로젝트</h2>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setComposerOpen((v) => !v)}
            aria-label="새 프로젝트 추가"
            aria-pressed={composerOpen}
          >
            <PlusIcon size={16} />
          </button>
        </div>

        {composerOpen && (
          <div className="project-composer">
            <input
              type="text"
              className="input"
              placeholder="프로젝트 이름"
              value={newTitle}
              autoFocus
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddProject();
                if (e.key === "Escape") setComposerOpen(false);
              }}
            />
            <textarea
              className="input"
              placeholder="설명 (선택)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
            />
            <div className="project-composer-actions">
              <Button variant="ghost" size="sm" onClick={() => setComposerOpen(false)}>
                취소
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddProject}
                disabled={!newTitle.trim()}
              >
                추가
              </Button>
            </div>
          </div>
        )}

        <ul className="project-items">
          {projects.map((p) => (
            <li
              key={p.id}
              className={selectedId === p.id ? "active" : ""}
              onClick={() => setSelectedId(p.id)}
            >
              <span className="project-swatch" style={{ background: p.color }} />
              <span className="project-name">{p.title}</span>
            </li>
          ))}
          {!loading && projects.length === 0 && (
            <li className="project-empty">아직 프로젝트가 없습니다.</li>
          )}
        </ul>
      </aside>

      <section className="project-detail">
        {selected ? (
          <>
            <header className="project-detail-head">
              <h1 className="project-title">{selected.title}</h1>
              <div className="project-detail-actions">
                {editing ? (
                  <>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={handleCancelEdit}
                      aria-label="편집 취소"
                      title="취소"
                    >
                      ✕
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--primary"
                      onClick={handleSaveEdit}
                      aria-label="변경 저장"
                      title="저장"
                    >
                      <CheckIcon size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setEditing(true)}
                      aria-label="프로젝트 편집"
                      title="편집"
                    >
                      <PencilIcon size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={handleDeleteProject}
                      aria-label="프로젝트 삭제"
                      title="삭제"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </>
                )}
              </div>
            </header>

            {/* 프로젝트 정보 — 읽기 전용 / 편집 모드 */}
            <section className="info-section">
              <h2 className="section-label">프로젝트 정보</h2>
              {editing ? (
                <div className="info-card info-card--editing">
                  <div className="info-row">
                    <span className="info-key">이름</span>
                    <input
                      type="text"
                      className="info-input"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      placeholder="프로젝트 이름"
                    />
                  </div>
                  <div className="info-row info-row--multiline">
                    <span className="info-key">설명</span>
                    <textarea
                      className="info-input"
                      value={editingDescription}
                      onChange={(e) => setEditingDescription(e.target.value)}
                      placeholder="설명 (선택)"
                      rows={3}
                    />
                  </div>
                  <div className="info-row">
                    <span className="info-key">색상</span>
                    <ColorSwatch
                      value={editingColor}
                      onChange={setEditingColor}
                      ariaLabel="프로젝트 색상"
                    />
                  </div>
                  <div className="info-row">
                    <span className="info-key">등록일</span>
                    <span className="info-value info-value--readonly">
                      {formatDate(selected.created_at)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="info-card">
                  <div className="info-row">
                    <span className="info-key">이름</span>
                    <span className="info-value">{selected.title}</span>
                  </div>
                  <div className="info-row info-row--multiline">
                    <span className="info-key">설명</span>
                    <span className="info-value info-value--multiline">
                      {selected.description?.trim() || "—"}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">색상</span>
                    <span className="info-value info-value--with-dot">
                      <span
                        className="info-color-dot"
                        style={{ background: selected.color }}
                        aria-hidden
                      />
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-key">등록일</span>
                    <span className="info-value">{formatDate(selected.created_at)}</span>
                  </div>
                </div>
              )}
            </section>

            {/* 응용프로그램 — 정사각형 카드 가로 스크롤 */}
            <section className="apps-section">
              <h2 className="section-label">응용프로그램</h2>
              <div className="apps-grid">
                {applications.map((app) => (
                  <div key={app.id} className="app-card">
                    <button
                      type="button"
                      className="app-card-body"
                      onClick={() => void handleOpenApplication(app.path)}
                      title={app.path}
                    >
                      <span className="app-card-icon" aria-hidden>
                        {appDisplayName(app).charAt(0).toUpperCase()}
                      </span>
                      <span className="app-card-name">{appDisplayName(app)}</span>
                    </button>
                    <button
                      type="button"
                      className="app-card-remove"
                      onClick={() => handleDeleteApplication(app)}
                      aria-label={`${appDisplayName(app)} 제거`}
                      title="제거"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="app-card app-card--add"
                  onClick={handleAddApplication}
                  aria-label="응용프로그램 추가"
                >
                  <span className="app-card-icon app-card-icon--ghost">
                    <PlusIcon size={16} />
                  </span>
                  <span className="app-card-name app-card-name--muted">앱 추가</span>
                </button>
              </div>
            </section>

            {/* 관련 디렉터리 */}
            <section className="dirs-section">
              <div className="section-head">
                <h2 className="section-label">관련 디렉터리</h2>
                <Button variant="ghost" size="sm" onClick={handleAddDirectory}>
                  + 추가
                </Button>
              </div>
              <ul className="dirs-list">
                {directories.map((d) => (
                  <li key={d.id} className="dir-row">
                    <button
                      type="button"
                      className="dir-open"
                      onClick={() => void handleOpenDirectory(d.path)}
                      title="Finder 에서 열기"
                    >
                      <span className="dir-icon" aria-hidden>
                        <FolderIcon size={16} />
                      </span>
                      <span className="dir-text">
                        <span className="dir-label">{dirDisplayName(d)}</span>
                        <span className="dir-path">{d.path}</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() => handleDeleteDirectory(d)}
                      aria-label={`${dirDisplayName(d)} 제거`}
                      title="제거"
                    >
                      <TrashIcon size={16} />
                    </button>
                  </li>
                ))}
                {directories.length === 0 && (
                  <li className="dirs-empty">
                    + 추가 버튼으로 디렉터리를 등록하세요.
                  </li>
                )}
              </ul>
            </section>

            {/* 관련 메모 — 목록 ↔ 인라인 상세 모드는 ProjectMemosSection 내부 state. */}
            <ProjectMemosSection key={selected.id} memos={memos} onUnlink={handleUnlinkMemo} />
          </>
        ) : (
          <div className="empty-state">왼쪽에서 프로젝트를 선택하거나 새로 추가하세요.</div>
        )}
      </section>
    </div>
  );
}
