import { invoke } from "@tauri-apps/api/core";
import type { Memo } from "../memo/types";
import type {
  NewProjectApplicationInput,
  NewProjectDirectoryInput,
  NewProjectInput,
  Project,
  ProjectApplication,
  ProjectDirectory,
  UpdateProjectApplicationPatch,
  UpdateProjectDirectoryPatch,
  UpdateProjectPatch,
} from "./types";

export const projectApi = {
  list: (): Promise<Project[]> => invoke<Project[]>("project_list"),
  get: (id: number): Promise<Project> => invoke<Project>("project_get", { id }),
  add: (input: NewProjectInput): Promise<Project> =>
    invoke<Project>("project_add", { input }),
  update: (id: number, patch: UpdateProjectPatch): Promise<Project> =>
    invoke<Project>("project_update", { id, patch }),
  delete: (id: number): Promise<void> => invoke<void>("project_delete", { id }),

  dirList: (projectId: number): Promise<ProjectDirectory[]> =>
    invoke<ProjectDirectory[]>("project_dir_list", { projectId }),
  dirAdd: (input: NewProjectDirectoryInput): Promise<ProjectDirectory> =>
    invoke<ProjectDirectory>("project_dir_add", { input }),
  dirUpdate: (
    id: number,
    patch: UpdateProjectDirectoryPatch,
  ): Promise<ProjectDirectory> =>
    invoke<ProjectDirectory>("project_dir_update", { id, patch }),
  dirDelete: (id: number): Promise<void> =>
    invoke<void>("project_dir_delete", { id }),

  appList: (projectId: number): Promise<ProjectApplication[]> =>
    invoke<ProjectApplication[]>("project_app_list", { projectId }),
  appAdd: (input: NewProjectApplicationInput): Promise<ProjectApplication> =>
    invoke<ProjectApplication>("project_app_add", { input }),
  appUpdate: (
    id: number,
    patch: UpdateProjectApplicationPatch,
  ): Promise<ProjectApplication> =>
    invoke<ProjectApplication>("project_app_update", { id, patch }),
  appDelete: (id: number): Promise<void> =>
    invoke<void>("project_app_delete", { id }),

  /** 프로젝트에 매핑된 활성 메모 목록 (pinned DESC, updated_at DESC). */
  listMemos: (projectId: number): Promise<Memo[]> =>
    invoke<Memo[]>("memo_project_list_memos", { projectId }),
  /** 메모 매핑 끊기 — 메모 자체는 삭제하지 않음. */
  unlinkMemo: (memoId: number, projectId: number): Promise<void> =>
    invoke<void>("memo_project_unlink", { memoId, projectId }),

  openInFinder: (path: string): Promise<void> =>
    invoke<void>("open_in_finder", { path }),
  openApplication: (path: string): Promise<void> =>
    invoke<void>("open_application", { path }),
};
