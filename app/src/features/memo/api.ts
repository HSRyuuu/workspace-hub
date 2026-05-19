import { invoke } from "@tauri-apps/api/core";
import type { Project } from "../project/types";
import type {
  Memo,
  MemoFolder,
  MemoListScope,
  NewMemoFolderInput,
  NewMemoInput,
  UpdateMemoPatch,
} from "./types";

export const memoApi = {
  list: (scope: MemoListScope, folderId?: number | null): Promise<Memo[]> =>
    invoke<Memo[]>("memo_list", {
      scope,
      folderId: scope === "folder" ? folderId ?? null : null,
    }),

  get: (id: number): Promise<Memo> => invoke<Memo>("memo_get", { id }),

  add: (input: NewMemoInput): Promise<Memo> =>
    invoke<Memo>("memo_add", { input }),

  update: (id: number, patch: UpdateMemoPatch): Promise<Memo> =>
    invoke<Memo>("memo_update", { id, patch }),

  /** soft-delete (휴지통으로). 메모 객체 반환(deleted_at 채워진 상태). */
  delete: (id: number): Promise<Memo> => invoke<Memo>("memo_delete", { id }),

  restore: (id: number): Promise<Memo> => invoke<Memo>("memo_restore", { id }),

  /** 휴지통 내 단건 영구 삭제. */
  purge: (id: number): Promise<void> => invoke<void>("memo_purge", { id }),

  /** 휴지통 비우기. 삭제된 건수 반환. */
  emptyTrash: (): Promise<{ purged_count: number }> =>
    invoke<{ purged_count: number }>("memo_empty_trash"),

  /** 메모에 매핑된 프로젝트 목록 (sort_order 정렬). */
  listProjects: (memoId: number): Promise<Project[]> =>
    invoke<Project[]>("memo_project_list_projects", { memoId }),

  /** 매핑 추가 — 멱등(이미 있으면 no-op). */
  linkProject: (memoId: number, projectId: number): Promise<void> =>
    invoke<void>("memo_project_link", { memoId, projectId }),

  /** 매핑 제거. */
  unlinkProject: (memoId: number, projectId: number): Promise<void> =>
    invoke<void>("memo_project_unlink", { memoId, projectId }),
};

export const memoFolderApi = {
  list: (): Promise<MemoFolder[]> => invoke<MemoFolder[]>("memo_folder_list"),

  add: (input: NewMemoFolderInput): Promise<MemoFolder> =>
    invoke<MemoFolder>("memo_folder_add", { input }),

  rename: (id: number, name: string): Promise<MemoFolder> =>
    invoke<MemoFolder>("memo_folder_rename", { id, name }),

  /** parent_id null = 루트로 이동. 부모가 실제로 바뀌면 새 부모의 마지막 자식(sort_order = MAX+1)이 된다. */
  move: (id: number, parentId: number | null): Promise<MemoFolder> =>
    invoke<MemoFolder>("memo_folder_move", { id, parentId }),

  /**
   * 같은 부모(`parentId`, null = 루트) 아래 형제 폴더들의 순서를 `orderedIds` 배열 그대로 0..N 으로 재할당한다.
   * `orderedIds` 는 그 부모의 모든 자식 폴더 id 를 빠짐없이 포함해야 한다.
   */
  reorder: (parentId: number | null, orderedIds: number[]): Promise<void> =>
    invoke<void>("memo_folder_reorder", { parentId, orderedIds }),

  delete: (id: number): Promise<void> => invoke<void>("memo_folder_delete", { id }),
};
