/** files_folder_* command 가 돌려주는 폴더 히스토리 1건. */
export interface ExplorerFolder {
  id: number;
  path: string;
  is_favorite: boolean;
  last_opened_at: string;
}

/** 파일 트리 노드 — children 은 lazy 로딩이므로 별도 캐시로 관리한다. */
export interface TreeNode {
  path: string;
  name: string;
  isDir: boolean;
}

export interface OpenTab {
  path: string;
  name: string;
  binary: boolean;
}

/** "트리에서 보기" 요청 — 같은 경로 재요청도 구분하려고 nonce 를 함께 보낸다. */
export interface RevealRequest {
  path: string;
  nonce: number;
}

/** FileTree 가 CRUD 후 FilesPage 에 알리는 변경 — 열린 탭 정리에 사용. */
export type TreeMutation =
  | { type: "delete"; path: string; isDir: boolean }
  | { type: "rename"; path: string; newPath: string; isDir: boolean }
  | { type: "create" };
