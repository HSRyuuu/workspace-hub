import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { showConfirmToast } from "../../components/ui/ConfirmToast";
import { showErrorToast } from "../../components/ui/Toast";
import { MarkdownEditor } from "../../components/ui/MarkdownEditor";
import { memoApi, memoFolderApi } from "./api";
import FolderTree from "./FolderTree";
import MemoActions from "./MemoActions";
import MemoList from "./MemoList";
import { MemoProjectChips } from "./MemoProjectChips";
import { firstLineAsTitle } from "./markdown";
import type { Memo, MemoFolder, MemoListScope } from "./types";
import { useSaveIndicator } from "./useSaveIndicator";

const DEBOUNCE_MS = 500;

function clearTimer(ref: MutableRefObject<number | null>) {
  if (ref.current !== null) {
    window.clearTimeout(ref.current);
    ref.current = null;
  }
}

export default function MemoPage() {
  const [folders, setFolders] = useState<MemoFolder[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [trashCount, setTrashCount] = useState(0);
  const [scope, setScope] = useState<MemoListScope>("active");
  const [folderId, setFolderId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draggedMemo, setDraggedMemo] = useState<{
    id: number;
    folderId: number | null;
  } | null>(null);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const draftMemoIdRef = useRef<number | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  // draftTitle / draftBody 를 ref 로도 들고 있어 effect 와 callback 의 deps 에서
  // 빼고 typing 마다 일어나는 closure 재생성·effect 재실행을 회피.
  const draftTitleRef = useRef("");
  const draftBodyRef = useRef("");
  draftTitleRef.current = draftTitle;
  draftBodyRef.current = draftBody;
  const saveIndicator = useSaveIndicator();

  const refreshFolders = useCallback(async () => {
    try {
      setFolders(await memoFolderApi.list());
    } catch (e) {
      showErrorToast(String(e));
    }
  }, []);

  const refreshTrashCount = useCallback(async () => {
    try {
      const trash = await memoApi.list("trash");
      setTrashCount(trash.length);
    } catch (e) {
      showErrorToast(String(e));
    }
  }, []);

  const refreshMemos = useCallback(async () => {
    try {
      const list = await memoApi.list(scope, folderId);
      setMemos(list);
      setSelectedId((cur) => {
        if (cur === null) return null;
        return list.some((m) => m.id === cur) ? cur : null;
      });
    } catch (e) {
      showErrorToast(String(e));
    }
  }, [scope, folderId]);

  useEffect(() => {
    refreshFolders();
    refreshTrashCount();
  }, [refreshFolders, refreshTrashCount]);

  useEffect(() => {
    refreshMemos();
  }, [refreshMemos]);

  // pending debounce 저장이 있으면 즉시 flush. selectedId 가 null 로 가기 직전
  // 모든 진입점에서 호출 — timer fire 전에 같은 메모를 다시 열 때 옛 m.body 가
  // draftBody 로 들어가서 입력이 사라지는 회귀 방지.
  const flushPendingSave = useCallback(async () => {
    if (saveTimerRef.current === null) return;
    if (draftMemoIdRef.current === null) return;
    clearTimer(saveTimerRef);
    const id = draftMemoIdRef.current;
    try {
      await memoApi.update(id, {
        title: draftTitleRef.current,
        body: draftBodyRef.current,
      });
      saveIndicator.markSaved();
      await refreshMemos();
    } catch (e) {
      showErrorToast(String(e));
    }
  }, [refreshMemos, saveIndicator]);

  // 선택된 메모 변경 → draft 동기화. 다른 메모로 전환되는 분기에서는 pending 저장
  // 이 있으면 flushPendingSave 로 위임 (이전 인라인 flush 중복 제거).
  useEffect(() => {
    if (selectedId === null) {
      setDraftTitle("");
      setDraftBody("");
      draftMemoIdRef.current = null;
      saveIndicator.reset();
      return;
    }
    const m = memos.find((x) => x.id === selectedId);
    if (!m) return;
    if (draftMemoIdRef.current === m.id) return;
    flushPendingSave();
    draftMemoIdRef.current = m.id;
    saveIndicator.reset();
    setDraftTitle(m.title);
    setDraftBody(m.body);
  }, [selectedId, memos, flushPendingSave, saveIndicator]);

  const scheduleSave = useCallback(
    (targetId: number, title: string, body: string) => {
      clearTimer(saveTimerRef);
      saveIndicator.markSaving();
      saveTimerRef.current = window.setTimeout(async () => {
        saveTimerRef.current = null;
        try {
          await memoApi.update(targetId, { title, body });
          saveIndicator.markSaved();
          await refreshMemos();
        } catch (e) {
          showErrorToast(String(e));
        }
      }, DEBOUNCE_MS);
    },
    [refreshMemos, saveIndicator],
  );

  const handleTitleChange = useCallback(
    (next: string) => {
      setDraftTitle(next);
      if (selectedId === null) return;
      scheduleSave(selectedId, next, draftBodyRef.current);
    },
    [selectedId, scheduleSave],
  );

  const handleBodyChange = useCallback(
    (md: string) => {
      setDraftBody(md);
      if (selectedId === null) return;
      scheduleSave(selectedId, draftTitleRef.current, md);
    },
    [selectedId, scheduleSave],
  );

  // 현재 메모를 떠나기 직전 처리. 제목·본문이 모두 빈 텍스트면 메모를 아예 제거
  // (delete → purge). 그렇지 않으면 flushPendingSave. macOS Notes 의 자동 정리.
  // setSelectedId(null) 도 안에서 처리 → 모든 caller 는 단순 호출만으로 충분하고
  // double-fire 가 차단됨.
  const dismissCurrentMemo = useCallback(async () => {
    if (selectedId === null) return;
    const id = selectedId;
    setSelectedId(null);
    if (draftTitleRef.current.trim() === "" && draftBodyRef.current.trim() === "") {
      clearTimer(saveTimerRef);
      try {
        await memoApi.delete(id);
        await memoApi.purge(id);
        await Promise.all([refreshMemos(), refreshTrashCount()]);
      } catch (e) {
        showErrorToast(String(e));
      }
      return;
    }
    await flushPendingSave();
  }, [selectedId, flushPendingSave, refreshMemos, refreshTrashCount]);

  const handleSelect = useCallback(
    async (next: MemoListScope, fid: number | null) => {
      // await 없이 setScope/setFolderId 가 즉시 fire 하면 refreshMemos 가 flush 전의 DB 를 읽어
      // 같은 메모로 돌아왔을 때 옛 body 가 draftBody 를 덮어쓴다.
      await dismissCurrentMemo();
      setScope(next);
      setFolderId(fid);
    },
    [dismissCurrentMemo],
  );

  const handleCreateMemo = useCallback(async () => {
    try {
      await flushPendingSave();
      const targetFolder = scope === "folder" ? folderId : null;
      const created = await memoApi.add({ folder_id: targetFolder, title: "", body: "" });
      if (scope === "trash") {
        setScope("active");
        setFolderId(null);
      }
      await refreshMemos();
      setSelectedId(created.id);
    } catch (e) {
      showErrorToast(String(e));
    }
  }, [scope, folderId, refreshMemos, flushPendingSave]);

  const handleAddFolder = useCallback(
    async (parentId: number | null, name: string) => {
      const trimmed = name.trim();
      if (trimmed === "") return;
      try {
        await memoFolderApi.add({ name: trimmed, parent_id: parentId });
        await refreshFolders();
      } catch (e) {
        showErrorToast(String(e));
      }
    },
    [refreshFolders],
  );

  const handleRenameFolder = useCallback(
    async (id: number, name: string) => {
      try {
        await memoFolderApi.rename(id, name);
        await refreshFolders();
      } catch (e) {
        showErrorToast(String(e));
      }
    },
    [refreshFolders],
  );

  const handleDeleteFolder = useCallback(
    (id: number, name: string) => {
      showConfirmToast({
        message: `폴더 '${name}'를 삭제할까요? 하위 폴더는 함께 삭제되고 포함된 메모는 휴지통으로 이동합니다.`,
        confirmLabel: "삭제",
        cancelLabel: "취소",
        onConfirm: async () => {
          try {
            await memoFolderApi.delete(id);
            await Promise.all([refreshFolders(), refreshMemos(), refreshTrashCount()]);
          } catch (e) {
            showErrorToast(String(e));
          }
        },
      });
    },
    [refreshFolders, refreshMemos, refreshTrashCount],
  );

  const handleDeleteMemo = useCallback(
    (id: number) => {
      showConfirmToast({
        message: "이 메모를 휴지통으로 이동할까요?",
        confirmLabel: "휴지통으로",
        cancelLabel: "취소",
        onConfirm: async () => {
          try {
            await memoApi.delete(id);
            if (selectedId === id) setSelectedId(null);
            await Promise.all([refreshMemos(), refreshTrashCount()]);
          } catch (e) {
            showErrorToast(String(e));
          }
        },
      });
    },
    [selectedId, refreshMemos, refreshTrashCount],
  );

  const handleRestore = useCallback(
    async (id: number) => {
      try {
        await memoApi.restore(id);
        await Promise.all([refreshMemos(), refreshTrashCount()]);
      } catch (e) {
        showErrorToast(String(e));
      }
    },
    [refreshMemos, refreshTrashCount],
  );

  const handlePurge = useCallback(
    (id: number) => {
      showConfirmToast({
        message: "이 메모를 영구 삭제할까요?",
        confirmLabel: "영구 삭제",
        cancelLabel: "취소",
        onConfirm: async () => {
          try {
            await memoApi.purge(id);
            await Promise.all([refreshMemos(), refreshTrashCount()]);
          } catch (e) {
            showErrorToast(String(e));
          }
        },
      });
    },
    [refreshMemos, refreshTrashCount],
  );

  const handleEmptyTrash = useCallback(() => {
    if (memos.length === 0) return;
    showConfirmToast({
      message: `휴지통의 메모 ${memos.length}개를 모두 영구 삭제할까요?`,
      confirmLabel: "모두 삭제",
      cancelLabel: "취소",
      onConfirm: async () => {
        try {
          await memoApi.emptyTrash();
          await Promise.all([refreshMemos(), refreshTrashCount()]);
        } catch (e) {
          showErrorToast(String(e));
        }
      },
    });
  }, [memos.length, refreshMemos, refreshTrashCount]);

  const handleTogglePin = useCallback(
    async (id: number, pinned: boolean) => {
      try {
        await memoApi.update(id, { pinned });
        await refreshMemos();
      } catch (e) {
        showErrorToast(String(e));
      }
    },
    [refreshMemos],
  );

  const handleDropMemoToFolder = useCallback(
    async (memoId: number, targetFolderId: number) => {
      try {
        // 같은 메모를 편집 중이면 debounce 저장을 먼저 flush — folder_id 변경 update 가 timer fire
        // 와 충돌하면 옛 body 가 새 update 를 덮어쓸 수 있다.
        if (selectedId === memoId) {
          await flushPendingSave();
        }
        await memoApi.update(memoId, { folder_id: targetFolderId });
        await refreshMemos();
      } catch (e) {
        showErrorToast(String(e));
      }
    },
    [selectedId, flushPendingSave, refreshMemos],
  );

  const handleReorderFolders = useCallback(
    async (parentId: number | null, orderedIds: number[]) => {
      try {
        await memoFolderApi.reorder(parentId, orderedIds);
        await refreshFolders();
      } catch (e) {
        showErrorToast(String(e));
      }
    },
    [refreshFolders],
  );

  const handleMoveFolderTo = useCallback(
    async (id: number, parentId: number | null) => {
      try {
        await memoFolderApi.move(id, parentId);
        await refreshFolders();
      } catch (e) {
        showErrorToast(String(e));
      }
    },
    [refreshFolders],
  );

  const selectedMemo = useMemo(
    () => (selectedId !== null ? memos.find((m) => m.id === selectedId) ?? null : null),
    [memos, selectedId],
  );

  const currentLabel = useMemo(() => {
    if (scope === "active") return "모든 메모";
    if (scope === "trash") return "최근 삭제";
    const f = folders.find((x) => x.id === folderId);
    return f?.name ?? "폴더";
  }, [scope, folderId, folders]);

  // unmount 시 pending debounce 저장을 fire-and-forget 으로 발사한 뒤 timer 정리. App.tsx 가
  // 섹션 전환으로 MemoPage 를 직접 unmount 시키기 때문에, 단순 cancel 만 하면 마지막 0.5s 의
  // 입력이 사라진다. React cleanup 은 async await 을 지원하지 않으므로 invoke 만 kick.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null && draftMemoIdRef.current !== null) {
        const id = draftMemoIdRef.current;
        const title = draftTitleRef.current;
        const body = draftBodyRef.current;
        void memoApi.update(id, { title, body });
      }
      clearTimer(saveTimerRef);
    };
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        void dismissCurrentMemo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flushPendingSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, dismissCurrentMemo, flushPendingSave]);

  return (
    <div className="memo-shell">
      <FolderTree
        folders={folders}
        selectedScope={scope}
        selectedFolderId={folderId}
        onSelect={handleSelect}
        onAddFolder={handleAddFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        trashCount={trashCount}
        onCreateMemo={handleCreateMemo}
        createMemoDisabled={selectedId !== null}
        draggedMemo={draggedMemo}
        onDropMemoToFolder={handleDropMemoToFolder}
        onReorderFolders={handleReorderFolders}
        onMoveFolderTo={handleMoveFolderTo}
      />
      <div className="memo-main-pane">
        {selectedMemo === null ? (
          <MemoList
            memos={memos}
            label={currentLabel}
            onSelect={setSelectedId}
            onCreate={handleCreateMemo}
            trashMode={scope === "trash"}
            onRestore={handleRestore}
            onPurge={handlePurge}
            onEmptyTrash={handleEmptyTrash}
            onTogglePin={handleTogglePin}
            onDelete={handleDeleteMemo}
            onMemoDragStart={(id, fid) => setDraggedMemo({ id, folderId: fid })}
            onMemoDragEnd={() => setDraggedMemo(null)}
            folders={folders}
            scope={scope}
          />
        ) : (
          <div className="memo-editor-pane">
            <div className="memo-editor-header">
              <button
                type="button"
                className="memo-back-btn"
                onClick={dismissCurrentMemo}
                aria-label="목록으로"
              >
                ← {currentLabel}
              </button>
              {scope !== "trash" && (
                <div className="memo-editor-meta-bar">
                  <MemoActions
                    id={selectedMemo.id}
                    pinned={selectedMemo.pinned}
                    onTogglePin={handleTogglePin}
                    onDelete={handleDeleteMemo}
                  />
                </div>
              )}
            </div>
            {scope === "trash" ? (
              <div className="memo-editor-readonly">
                <h2>{selectedMemo.title || firstLineAsTitle(selectedMemo.body) || "(제목 없음)"}</h2>
                <pre className="memo-readonly-body">{selectedMemo.body}</pre>
                <p className="memo-readonly-note">
                  휴지통의 메모는 읽기 전용입니다. 복원 후 편집할 수 있습니다.
                </p>
              </div>
            ) : (
              <>
                <input
                  className="memo-title-input"
                  value={draftTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="제목 입력"
                  aria-label="제목"
                />
                <MemoProjectChips memoId={selectedMemo.id} />
                <MarkdownEditor
                  resetKey={selectedMemo.id}
                  initialMarkdown={selectedMemo.body}
                  onChange={handleBodyChange}
                  saveIndicator={saveIndicator.label}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
