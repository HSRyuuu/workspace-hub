export interface MemoFolder {
  id: number;
  parent_id: number | null;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Memo {
  id: number;
  folder_id: number | null;
  title: string;
  body: string;
  pinned: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewMemoInput {
  title?: string;
  body?: string;
  folder_id?: number | null;
}

/**
 * - `folder_id` undefined = 변경 없음, number = 그 폴더로, null = 루트로
 * - 다른 필드 undefined = 변경 없음
 */
export interface UpdateMemoPatch {
  title?: string;
  body?: string;
  folder_id?: number | null;
  pinned?: boolean;
}

export interface NewMemoFolderInput {
  name: string;
  parent_id?: number | null;
}

export type MemoListScope = "active" | "folder" | "trash";
