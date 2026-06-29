import { invoke } from "@tauri-apps/api/core";
import type { ExplorerFolder } from "./types";

export const filesFolderApi = {
  /** 히스토리+즐겨찾기 전체 — 최근 연 순. */
  list: (): Promise<ExplorerFolder[]> =>
    invoke<ExplorerFolder[]>("files_folder_list"),

  /** 폴더를 열 때 호출 — upsert + 비즐겨찾기 20개 초과분 prune. */
  touch: (path: string): Promise<ExplorerFolder> =>
    invoke<ExplorerFolder>("files_folder_touch", { path }),

  setFavorite: (id: number, favorite: boolean): Promise<ExplorerFolder> =>
    invoke<ExplorerFolder>("files_folder_set_favorite", { id, favorite }),

  remove: (id: number): Promise<void> =>
    invoke<void>("files_folder_remove", { id }),
};

export const filesShellApi = {
  /** Finder 에서 해당 파일/폴더를 선택한 채 띄운다(`open -R`). */
  revealInFinder: (path: string): Promise<void> =>
    invoke<void>("reveal_in_finder", { path }),
};
