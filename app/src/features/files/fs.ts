import {
  mkdir,
  readDir,
  readTextFile,
  remove,
  rename,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { isHiddenInTree } from "./helpers";
import type { TreeNode } from "./types";

/**
 * 한 단계만 읽는다(lazy) — node_modules 같은 거대 디렉토리 때문에 재귀 금지.
 * 폴더 먼저, 이름순. 바이너리 확장자·.DS_Store 는 숨긴다(디렉토리는 모두 표시).
 */
export async function listDir(dirPath: string): Promise<TreeNode[]> {
  const entries = await readDir(dirPath);
  return entries
    .filter((e) => e.isDirectory || !isHiddenInTree(e.name))
    .map((e) => ({
      path: `${dirPath}/${e.name}`,
      name: e.name,
      isDir: e.isDirectory,
    }))
    .sort((a, b) =>
      a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1,
    );
}

export const fileOps = {
  /** UTF-8 이 아니면 reject — 호출부에서 "바이너리 파일" 안내로 처리. */
  read: (path: string): Promise<string> => readTextFile(path),
  write: (path: string, content: string): Promise<void> =>
    writeTextFile(path, content),
  createFile: (path: string): Promise<void> => writeTextFile(path, ""),
  createDir: (path: string): Promise<void> => mkdir(path),
  rename: (from: string, to: string): Promise<void> => rename(from, to),
  remove: (path: string): Promise<void> => remove(path, { recursive: true }),
};
