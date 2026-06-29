/** CodeMirror 구문 강조를 붙일 주요 언어 — 그 외 확장자는 plain text. */
export type LanguageId =
  | "javascript"
  | "typescript"
  | "python"
  | "java"
  | "json"
  | "html"
  | "css"
  | "markdown";

const LANGUAGE_BY_EXT: Record<string, LanguageId> = {
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  java: "java",
  json: "json",
  html: "html",
  htm: "html",
  css: "css",
  md: "markdown",
  markdown: "markdown",
};

/** 트리에서 숨기는 바이너리 확장자 — "텍스트는 최대한 포함"이므로 블랙리스트 방식. */
const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "icns", "tiff", "svgz", "heic", "avif",
  "pdf",
  "zip", "tar", "gz", "tgz", "bz2", "xz", "7z", "rar", "dmg", "pkg",
  "exe", "dll", "so", "dylib", "bin", "o", "a", "class", "jar", "war",
  "pyc", "pyo", "wasm",
  "mp3", "m4a", "wav", "flac", "ogg", "aac", "opus",
  "mp4", "mov", "avi", "mkv", "webm",
  "woff", "woff2", "ttf", "otf", "eot",
  "sqlite", "sqlite3", "db",
]);

/** 소문자 확장자. dotfile(.gitignore)·무확장자(Makefile)는 "". */
export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i <= 0 ? "" : name.slice(i + 1).toLowerCase();
}

export function languageForFile(name: string): LanguageId | null {
  return LANGUAGE_BY_EXT[extOf(name)] ?? null;
}

export function isMarkdown(name: string): boolean {
  return languageForFile(name) === "markdown";
}

export function shouldWrapEditorLines(name: string): boolean {
  return isMarkdown(name);
}

export function isHiddenInTree(name: string): boolean {
  if (name === ".DS_Store") return true;
  return BINARY_EXTENSIONS.has(extOf(name));
}
