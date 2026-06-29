import { useCallback, useEffect, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { showErrorToast } from "../../components/ui/Toast";
import { filesFolderApi } from "./api";
import { FileExplorerLayout } from "./FileExplorerLayout";
import { fileOps } from "./fs";
import { extractPastedFilePath, isMarkdown } from "./helpers";
import type { ExplorerFolder, OpenTab, RevealRequest, TreeMutation, TreeNode } from "./types";

const SAVE_DEBOUNCE_MS = 400;

export default function FilesPage() {
  const [folders, setFolders] = useState<ExplorerFolder[]>([]);
  const [current, setCurrent] = useState<ExplorerFolder | null>(null);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [dirtyPaths, setDirtyPaths] = useState<Set<string>>(new Set());
  /** 탭 "트리에서 보기" 요청 — nonce 로 같은 경로 재요청도 트리거. */
  const [revealRequest, setRevealRequest] = useState<RevealRequest | null>(null);
  /** path → 최신 내용. 에디터 onChange 가 갱신하는 단일 진실(렌더와 무관하므로 ref). */
  const contentRef = useRef<Map<string, string>>(new Map());
  const saveTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── 저장 ──────────────────────────────────────────────────────────────────
  const saveNow = useCallback(async (path: string) => {
    const timer = saveTimerRef.current.get(path);
    if (timer) {
      clearTimeout(timer);
      saveTimerRef.current.delete(path);
    }
    const content = contentRef.current.get(path);
    if (content === undefined) return;
    try {
      await fileOps.write(path, content);
      setDirtyPaths((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    } catch (e) {
      showErrorToast(`저장에 실패했습니다: ${e}`, () => void saveNow(path));
    }
  }, []);

  const scheduleSave = useCallback(
    (path: string, content: string) => {
      contentRef.current.set(path, content);
      setDirtyPaths((prev) => (prev.has(path) ? prev : new Set(prev).add(path)));
      const existing = saveTimerRef.current.get(path);
      if (existing) clearTimeout(existing);
      saveTimerRef.current.set(
        path,
        setTimeout(() => void saveNow(path), SAVE_DEBOUNCE_MS),
      );
    },
    [saveNow],
  );

  const flushAll = useCallback(() => {
    // NOTE: beforeunload 는 fire-and-forget — 마지막 <400ms 타이핑은 하드 종료 시
    // 유실 가능. 완전 보장은 Rust 측 ExitRequested 이벤트 핸들러에서만 가능.
    for (const path of [...saveTimerRef.current.keys()]) void saveNow(path);
  }, [saveNow]);

  useEffect(() => {
    window.addEventListener("beforeunload", flushAll);
    return () => {
      window.removeEventListener("beforeunload", flushAll);
      flushAll();
    };
  }, [flushAll]);

  // ── 폴더 ──────────────────────────────────────────────────────────────────
  const refreshFolders = useCallback(async () => {
    try {
      setFolders(await filesFolderApi.list());
    } catch (e) {
      showErrorToast(`폴더 목록을 불러오지 못했습니다: ${e}`);
    }
  }, []);

  const openFolder = useCallback(
    async (path: string) => {
      flushAll();
      try {
        const folder = await filesFolderApi.touch(path);
        setCurrent(folder);
        setTabs([]);
        setActivePath(null);
        setDirtyPaths(new Set());
        for (const [, timer] of saveTimerRef.current) clearTimeout(timer);
        saveTimerRef.current.clear();
        contentRef.current.clear();
        await refreshFolders();
        return true;
      } catch (e) {
        showErrorToast(`폴더를 열지 못했습니다: ${e}`);
        return false;
      }
    },
    [flushAll, refreshFolders],
  );

  // 세션 복원 — 마지막 연 폴더 1건
  useEffect(() => {
    void (async () => {
      try {
        const list = await filesFolderApi.list();
        setFolders(list);
        if (list.length > 0) setCurrent(list[0]);
      } catch (e) {
        showErrorToast(`폴더 목록을 불러오지 못했습니다: ${e}`);
      }
    })();
  }, []);

  const pickNewFolder = useCallback(async () => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked === "string") await openFolder(picked);
  }, [openFolder]);

  const toggleFavorite = useCallback(
    async (f: ExplorerFolder) => {
      try {
        const updated = await filesFolderApi.setFavorite(f.id, !f.is_favorite);
        if (current?.id === updated.id) setCurrent(updated);
        await refreshFolders();
      } catch (e) {
        showErrorToast(`즐겨찾기 변경에 실패했습니다: ${e}`);
      }
    },
    [current, refreshFolders],
  );

  // ── 탭 ────────────────────────────────────────────────────────────────────
  const openFile = useCallback(
    async (node: TreeNode) => {
      if (activePath) await saveNow(activePath);
      const existing = tabs.find((tab) => tab.path === node.path);
      let binary = existing?.binary ?? false;
      if (!existing) {
        try {
          const content = await fileOps.read(node.path);
          contentRef.current.set(node.path, content);
        } catch {
          binary = true;
        }
        setTabs((prev) => [...prev, { path: node.path, name: node.name, binary }]);
      }
      setActivePath(node.path);
      setMode(!binary && isMarkdown(node.name) ? "preview" : "edit");
    },
    [activePath, saveNow, tabs],
  );

  const selectTab = useCallback(
    async (path: string) => {
      if (activePath && activePath !== path) await saveNow(activePath);
      const next = tabs.find((tab) => tab.path === path);
      setActivePath(path);
      setMode(next && !next.binary && isMarkdown(next.name) ? "preview" : "edit");
    },
    [activePath, saveNow, tabs],
  );

  const closeTab = useCallback(
    async (path: string) => {
      await saveNow(path);
      contentRef.current.delete(path);
      setTabs((prev) => {
        const next = prev.filter((t) => t.path !== path);
        if (activePath === path) setActivePath(next.length > 0 ? next[next.length - 1].path : null);
        return next;
      });
    },
    [activePath, saveNow],
  );

  // 여러 탭을 한 번에 닫기 — 다른 탭/오른쪽 탭/모두 닫기
  const closeTabs = useCallback(
    async (paths: string[]) => {
      const closeSet = new Set(paths);
      for (const p of paths) {
        await saveNow(p);
        contentRef.current.delete(p);
      }
      setTabs((prev) => {
        const next = prev.filter((t) => !closeSet.has(t.path));
        if (activePath && closeSet.has(activePath)) {
          setActivePath(next.length > 0 ? next[next.length - 1].path : null);
        }
        return next;
      });
    },
    [activePath, saveNow],
  );

  const revealInTree = useCallback((path: string) => {
    setRevealRequest((prev) => ({ path, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  const openPastedFile = useCallback(
    async (rawPath: string) => {
      const path = extractPastedFilePath(rawPath);
      const slash = path.lastIndexOf("/");
      if (slash <= 0 || slash === path.length - 1) {
        showErrorToast("열 파일 경로를 확인해주세요.");
        return false;
      }

      const folderPath = path.slice(0, slash);
      const name = path.slice(slash + 1);
      flushAll();
      try {
        const folder = await filesFolderApi.touch(folderPath);
        let binary = false;

        for (const [, timer] of saveTimerRef.current) clearTimeout(timer);
        saveTimerRef.current.clear();
        contentRef.current.clear();

        try {
          const content = await fileOps.read(path);
          contentRef.current.set(path, content);
        } catch {
          binary = true;
        }

        setCurrent(folder);
        setTabs([{ path, name, binary }]);
        setActivePath(path);
        setMode(!binary && isMarkdown(name) ? "preview" : "edit");
        setDirtyPaths(new Set());
        await refreshFolders();
        revealInTree(path);
        return true;
      } catch (e) {
        showErrorToast(`파일을 열지 못했습니다: ${e}`);
        return false;
      }
    },
    [flushAll, refreshFolders, revealInTree],
  );

  // 트리 CRUD 가 열린 탭에 미치는 영향 정리
  const handleMutation = useCallback(
    (m: TreeMutation) => {
      if (m.type === "create") return;
      const affects = (tabPath: string) =>
        m.isDir ? tabPath === m.path || tabPath.startsWith(`${m.path}/`) : tabPath === m.path;
      if (m.type === "delete") {
        setTabs((prev) => {
          const next = prev.filter((t) => !affects(t.path));
          if (activePath && affects(activePath)) {
            setActivePath(next.length > 0 ? next[next.length - 1].path : null);
          }
          return next;
        });
        for (const key of [...contentRef.current.keys()]) {
          if (affects(key)) contentRef.current.delete(key);
        }
        // delete: 영향받는 경로의 pending 타이머 정리 (이미 삭제된 파일에 쓰기 방지)
        for (const key of [...saveTimerRef.current.keys()]) {
          if (affects(key)) {
            clearTimeout(saveTimerRef.current.get(key)!);
            saveTimerRef.current.delete(key);
          }
        }
      } else {
        // rename — 탭 path/name 치환
        const remap = (p: string) =>
          m.isDir ? (p === m.path ? m.newPath : m.newPath + p.slice(m.path.length)) : m.newPath;
        setTabs((prev) =>
          prev.map((t) =>
            affects(t.path)
              ? { ...t, path: remap(t.path), name: remap(t.path).split("/").pop() ?? t.name }
              : t,
          ),
        );
        if (activePath && affects(activePath)) setActivePath(remap(activePath));
        for (const key of [...contentRef.current.keys()]) {
          if (affects(key)) {
            const v = contentRef.current.get(key)!;
            contentRef.current.delete(key);
            contentRef.current.set(remap(key), v);
          }
        }
        // rename: pending 타이머를 취소하고 새 path로 즉시 flush (옛 path로 saveNow하면 contentRef miss)
        for (const key of [...saveTimerRef.current.keys()]) {
          if (affects(key)) {
            clearTimeout(saveTimerRef.current.get(key)!);
            saveTimerRef.current.delete(key);
            void saveNow(remap(key));
          }
        }
      }
    },
    [activePath, saveNow],
  );

  // ── 렌더 ──────────────────────────────────────────────────────────────────
  const activeTab = tabs.find((t) => t.path === activePath) ?? null;
  const showPreviewToggle = activeTab !== null && !activeTab.binary && isMarkdown(activeTab.name);

  return (
    <FileExplorerLayout
      current={current}
      folders={folders}
      tabs={tabs}
      activeTab={activeTab}
      activePath={activePath}
      revealRequest={revealRequest}
      dirtyPaths={dirtyPaths}
      mode={mode}
      showPreviewToggle={showPreviewToggle}
      contentForActiveTab={activeTab ? contentRef.current.get(activeTab.path) ?? "" : ""}
      onPickNewFolder={() => void pickNewFolder()}
      onOpenPastedFile={openPastedFile}
      onOpenFolder={(path) => void openFolder(path)}
      onToggleFavorite={(folder) => void toggleFavorite(folder)}
      onOpenFile={(node) => void openFile(node)}
      onTreeMutation={handleMutation}
      onSelectTab={(path) => void selectTab(path)}
      onCloseTab={(path) => void closeTab(path)}
      onCloseTabs={(paths) => void closeTabs(paths)}
      onRevealInTree={revealInTree}
      onModeChange={setMode}
      onContentChange={(content) => activeTab && scheduleSave(activeTab.path, content)}
    />
  );
}
