# 텍스트 파일 탐색기/편집기 (`files` 도메인) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 임의 로컬 폴더의 텍스트 파일을 탐색·편집하는 IDE 스타일 `files` 도메인을 workspace-hub의 5번째 도메인으로 추가한다.

**Architecture:** 파일 읽기/쓰기/CRUD는 프론트에서 `@tauri-apps/plugin-fs` 직접 호출. 폴더 히스토리(최대 20개)·즐겨찾기(영구)는 core SQLite 테이블 + Tauri command. 에디터는 CodeMirror 6 raw 텍스트(주요 언어 구문 강조), `.md`에만 Edit ↔ Preview 화면 전환 토글.

**Tech Stack:** Tauri 2 (plugin-fs, plugin-dialog), React 18, CodeMirror 6, marked(md 렌더), rusqlite, vitest, cargo test

**Spec:** `docs/superpowers/specs/2026-06-12-files-explorer-design.md`

---

## 스펙 대비 구현 보정 2가지 (중요)

1. **fs scope는 dialog 자동 부여에 의존하지 않는다.** 히스토리/세션 복원 시에는 dialog 없이 폴더를 다시 열기 때문에 dialog가 부여하는 scope만으로는 부족하다. capabilities에 `$HOME/**` scope를 명시적으로 부여한다 (1인용 로컬 앱이므로 허용).
2. **트리는 lazy 로딩.** 폴더를 펼칠 때 그 한 단계만 `readDir`한다. 재귀 전체 로딩은 `node_modules` 같은 거대 디렉토리에서 앱이 멈추므로 금지.

## 파일 구조

```
core/migrations/V008__add_file_explorer.sql        (생성) 테이블
core/src/models/file_explorer.rs                   (생성) FileExplorerFolder 모델
core/src/models/mod.rs                             (수정) 모듈 등록
core/src/repo/file_explorer.rs                     (생성) list/touch/set_favorite/remove + prune
core/src/repo/mod.rs                               (수정) 모듈 등록
core/src/db.rs                                     (수정) 마이그레이션 배열에 (8, ...) 추가
core/tests/file_explorer_repo.rs                   (생성) repo 단위 테스트

app/src-tauri/Cargo.toml                           (수정) tauri-plugin-fs 추가
app/src-tauri/capabilities/default.json            (수정) fs 권한 + $HOME scope
app/src-tauri/src/lib.rs                           (수정) plugin 등록 + command 4개

app/src/features/files/types.ts                    (생성) ExplorerFolder 등 타입
app/src/features/files/helpers.ts                  (생성) 순수 함수: 확장자→언어, 바이너리 판별
app/src/features/files/__tests__/helpers.test.ts   (생성) vitest
app/src/features/files/api.ts                      (생성) invoke 래퍼
app/src/features/files/fs.ts                       (생성) plugin-fs 래퍼 (listDir, fileOps)
app/src/features/files/FileTree.tsx                (생성) lazy 트리 + 컨텍스트 메뉴 CRUD
app/src/features/files/EditorTabs.tsx              (생성) 탭바
app/src/features/files/FileEditor.tsx              (생성) CodeMirror 6
app/src/features/files/MarkdownPreview.tsx         (생성) .md 렌더
app/src/features/files/FolderBar.tsx               (생성) 히스토리 드롭다운 + 즐겨찾기 + 폴더열기
app/src/features/files/FilesPage.tsx               (생성) 오케스트레이션 (자동저장 debounce 포함)
app/src/App.tsx                                    (수정) files 섹션 등록
app/src/styles/global.css                          (수정) .files-* 스타일 추가
app/package.json                                   (수정) codemirror·plugin-fs·marked
```

각 컴포넌트는 단일 책임: 트리는 파일시스템 구조만, 탭바는 열린 목록만, 에디터는 텍스트 편집만 안다. 자동저장·탭 상태·세션 복원은 전부 `FilesPage`에 모인다.

---

### Task 1: core — 마이그레이션 + 모델 + repo (TDD)

**Files:**
- Create: `core/migrations/V008__add_file_explorer.sql`
- Create: `core/src/models/file_explorer.rs`
- Create: `core/src/repo/file_explorer.rs`
- Create: `core/tests/file_explorer_repo.rs`
- Modify: `core/src/models/mod.rs`, `core/src/repo/mod.rs`, `core/src/db.rs:13-19`

- [ ] **Step 1: 실패하는 repo 테스트 작성**

`core/tests/file_explorer_repo.rs` (기존 `core/tests/project_repo.rs`와 동일한 `TempDir + db::open_at` 격리 패턴):

```rust
//! file_explorer repo 단위 테스트 — project_repo.rs 와 동일한 격리 패턴.

use rusqlite::Connection;
use tempfile::TempDir;
use workspace_hub_core::repo::file_explorer as repo;
use workspace_hub_core::{db, CoreError};

fn fresh_conn() -> (TempDir, Connection) {
    let dir = TempDir::new().expect("tempdir");
    let path = dir.path().join("test.sqlite");
    let conn = db::open_at(&path).expect("open_at");
    (dir, conn)
}

#[test]
fn touch_creates_then_updates_same_row() {
    let (_dir, conn) = fresh_conn();
    let a = repo::touch(&conn, "/Users/me/notes").unwrap();
    let b = repo::touch(&conn, "/Users/me/notes").unwrap();
    assert_eq!(a.id, b.id);
    assert_eq!(repo::list(&conn).unwrap().len(), 1);
}

#[test]
fn touch_rejects_empty_path() {
    let (_dir, conn) = fresh_conn();
    let err = repo::touch(&conn, "   ").unwrap_err();
    assert!(matches!(err, CoreError::InvalidInput(_)));
}

#[test]
fn list_orders_most_recent_first() {
    let (_dir, conn) = fresh_conn();
    repo::touch(&conn, "/a").unwrap();
    repo::touch(&conn, "/b").unwrap();
    let list = repo::list(&conn).unwrap();
    // 같은 초에 들어가도 id DESC 타이브레이크로 /b 가 먼저
    assert_eq!(list[0].path, "/b");
    assert_eq!(list[1].path, "/a");
}

#[test]
fn prune_keeps_only_20_non_favorites() {
    let (_dir, conn) = fresh_conn();
    for i in 0..21 {
        repo::touch(&conn, &format!("/folder-{i}")).unwrap();
    }
    let list = repo::list(&conn).unwrap();
    assert_eq!(list.len(), 20);
    // 가장 오래된(가장 먼저 touch 된) /folder-0 이 잘린다
    assert!(!list.iter().any(|f| f.path == "/folder-0"));
}

#[test]
fn favorites_survive_prune() {
    let (_dir, conn) = fresh_conn();
    let fav = repo::touch(&conn, "/keep-me").unwrap();
    repo::set_favorite(&conn, fav.id, true).unwrap();
    for i in 0..25 {
        repo::touch(&conn, &format!("/folder-{i}")).unwrap();
    }
    let list = repo::list(&conn).unwrap();
    assert!(list.iter().any(|f| f.path == "/keep-me" && f.is_favorite));
    let non_fav = list.iter().filter(|f| !f.is_favorite).count();
    assert_eq!(non_fav, 20);
}

#[test]
fn set_favorite_roundtrip() {
    let (_dir, conn) = fresh_conn();
    let f = repo::touch(&conn, "/x").unwrap();
    assert!(!f.is_favorite);
    let f = repo::set_favorite(&conn, f.id, true).unwrap();
    assert!(f.is_favorite);
    let f = repo::set_favorite(&conn, f.id, false).unwrap();
    assert!(!f.is_favorite);
}

#[test]
fn set_favorite_unknown_id_is_not_found() {
    let (_dir, conn) = fresh_conn();
    let err = repo::set_favorite(&conn, 999, true).unwrap_err();
    assert!(matches!(err, CoreError::NotFound(_)));
}

#[test]
fn remove_deletes_row() {
    let (_dir, conn) = fresh_conn();
    let f = repo::touch(&conn, "/gone").unwrap();
    repo::remove(&conn, f.id).unwrap();
    assert!(repo::list(&conn).unwrap().is_empty());
    let err = repo::remove(&conn, f.id).unwrap_err();
    assert!(matches!(err, CoreError::NotFound(_)));
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cargo test -p workspace-hub-core --test file_explorer_repo`
Expected: 컴파일 에러 — `repo::file_explorer` 모듈 없음

- [ ] **Step 3: 마이그레이션 SQL 작성**

`core/migrations/V008__add_file_explorer.sql`:

```sql
-- workspace-hub v0.2: file_explorer_folder
-- files 도메인(텍스트 파일 탐색기)이 연 폴더의 히스토리/즐겨찾기.
-- 파일 내용은 저장하지 않는다 — 폴더 경로 참조와 UI 상태만.
-- 비즐겨찾기는 최대 20개 보관(touch 시 prune), 즐겨찾기는 영구.

CREATE TABLE IF NOT EXISTS file_explorer_folder (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    path           TEXT NOT NULL UNIQUE,
    is_favorite    INTEGER NOT NULL DEFAULT 0,
    last_opened_at TEXT NOT NULL
);
```

- [ ] **Step 4: 모델 작성**

`core/src/models/file_explorer.rs`:

```rust
use serde::{Deserialize, Serialize};

/// files 도메인이 연 적 있는 로컬 폴더 1건.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileExplorerFolder {
    pub id: i64,
    pub path: String,
    pub is_favorite: bool,
    pub last_opened_at: String,
}
```

`core/src/models/mod.rs`에 한 줄 추가 (알파벳 순):

```rust
pub mod file_explorer;
```

- [ ] **Step 5: repo 작성**

`core/src/repo/file_explorer.rs`:

```rust
use rusqlite::{params, Connection, Row};

use crate::error::CoreError;
use crate::models::file_explorer::FileExplorerFolder;
use crate::repo::now_iso;

/// 즐겨찾기가 아닌 히스토리의 최대 보관 개수. 초과분은 touch 시 오래된 것부터 잘린다.
pub const MAX_HISTORY: usize = 20;

const SELECT_COLUMNS: &str = "id, path, is_favorite, last_opened_at";

fn map_row(row: &Row<'_>) -> rusqlite::Result<FileExplorerFolder> {
    Ok(FileExplorerFolder {
        id: row.get("id")?,
        path: row.get("path")?,
        is_favorite: row.get::<_, i64>("is_favorite")? != 0,
        last_opened_at: row.get("last_opened_at")?,
    })
}

/// 전체 목록 — 최근 연 순. 즐겨찾기/최근 분리는 프론트가 한다.
/// now_iso() 는 초 단위라 같은 초 내 touch 는 id DESC 로 타이브레이크.
pub fn list(conn: &Connection) -> Result<Vec<FileExplorerFolder>, CoreError> {
    let sql = format!(
        "SELECT {SELECT_COLUMNS} FROM file_explorer_folder \
         ORDER BY last_opened_at DESC, id DESC"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], map_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn get(conn: &Connection, id: i64) -> Result<FileExplorerFolder, CoreError> {
    let sql = format!("SELECT {SELECT_COLUMNS} FROM file_explorer_folder WHERE id = ?1");
    conn.query_row(&sql, params![id], map_row).map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            CoreError::NotFound(format!("file_explorer_folder id={id}"))
        }
        other => CoreError::Sqlite(other),
    })
}

/// 폴더를 열 때 호출 — upsert + last_opened_at 갱신 + 비즐겨찾기 초과분 prune.
pub fn touch(conn: &Connection, path: &str) -> Result<FileExplorerFolder, CoreError> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(CoreError::InvalidInput("path is required".into()));
    }
    let now = now_iso();
    conn.execute(
        "INSERT INTO file_explorer_folder (path, is_favorite, last_opened_at)
         VALUES (?1, 0, ?2)
         ON CONFLICT(path) DO UPDATE SET last_opened_at = ?2",
        params![trimmed, now],
    )?;
    prune(conn)?;
    let sql = format!("SELECT {SELECT_COLUMNS} FROM file_explorer_folder WHERE path = ?1");
    conn.query_row(&sql, params![trimmed], map_row)
        .map_err(CoreError::Sqlite)
}

/// 비즐겨찾기 행이 MAX_HISTORY 를 넘으면 오래된 것부터 삭제. 즐겨찾기는 건드리지 않는다.
fn prune(conn: &Connection) -> Result<(), CoreError> {
    conn.execute(
        "DELETE FROM file_explorer_folder
         WHERE is_favorite = 0
           AND id NOT IN (
             SELECT id FROM file_explorer_folder
             WHERE is_favorite = 0
             ORDER BY last_opened_at DESC, id DESC
             LIMIT ?1
           )",
        params![MAX_HISTORY as i64],
    )?;
    Ok(())
}

pub fn set_favorite(
    conn: &Connection,
    id: i64,
    favorite: bool,
) -> Result<FileExplorerFolder, CoreError> {
    let affected = conn.execute(
        "UPDATE file_explorer_folder SET is_favorite = ?1 WHERE id = ?2",
        params![favorite as i64, id],
    )?;
    if affected == 0 {
        return Err(CoreError::NotFound(format!("file_explorer_folder id={id}")));
    }
    get(conn, id)
}

pub fn remove(conn: &Connection, id: i64) -> Result<(), CoreError> {
    let affected = conn.execute(
        "DELETE FROM file_explorer_folder WHERE id = ?1",
        params![id],
    )?;
    if affected == 0 {
        return Err(CoreError::NotFound(format!("file_explorer_folder id={id}")));
    }
    Ok(())
}
```

`core/src/repo/mod.rs`에 한 줄 추가 (알파벳 순):

```rust
pub mod file_explorer;
```

`core/src/db.rs`의 마이그레이션 배열(13~19행) 끝에 추가:

```rust
    (8, include_str!("../migrations/V008__add_file_explorer.sql")),
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cargo test -p workspace-hub-core --test file_explorer_repo`
Expected: `test result: ok. 8 passed`

Run: `cargo test -p workspace-hub-core`
Expected: 기존 테스트 포함 전체 PASS (마이그레이션 추가로 깨진 것 없는지 확인)

- [ ] **Step 7: Commit**

```bash
git add core/
git commit -m "feat(core): file_explorer_folder 테이블 + repo (히스토리 20개 prune, 즐겨찾기 영구)"
```

---

### Task 2: Tauri command 4개

**Files:**
- Modify: `app/src-tauri/src/lib.rs`

- [ ] **Step 1: import 추가**

`lib.rs` 상단 import 블록(6~17행 부근)에 추가:

```rust
use workspace_hub_core::models::file_explorer::FileExplorerFolder;
```

- [ ] **Step 2: command 작성**

`// shell util` 섹션(585행 부근) 앞에 추가:

```rust
// =========================================================================
// files (file explorer)
// =========================================================================

#[tauri::command]
fn files_folder_list(state: tauri::State<DbState>) -> Result<Vec<FileExplorerFolder>, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::file_explorer::list(&conn).map_err(core_err)
}

#[tauri::command]
fn files_folder_touch(
    state: tauri::State<DbState>,
    path: String,
) -> Result<FileExplorerFolder, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::file_explorer::touch(&conn, &path).map_err(core_err)
}

#[tauri::command]
fn files_folder_set_favorite(
    state: tauri::State<DbState>,
    id: i64,
    favorite: bool,
) -> Result<FileExplorerFolder, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::file_explorer::set_favorite(&conn, id, favorite).map_err(core_err)
}

#[tauri::command]
fn files_folder_remove(state: tauri::State<DbState>, id: i64) -> Result<DeletedAck, String> {
    let conn = state.0.lock().map_err(lock_err)?;
    repo::file_explorer::remove(&conn, id).map_err(core_err)?;
    Ok(DeletedAck { deleted: id })
}
```

- [ ] **Step 3: handler 등록**

`generate_handler![...]` 배열의 `open_in_finder,` 앞에 추가:

```rust
            files_folder_list,
            files_folder_touch,
            files_folder_set_favorite,
            files_folder_remove,
```

- [ ] **Step 4: 빌드 확인**

Run: `cargo build -p workspace-hub-app`
Expected: 빌드 성공 (경고 없이)

- [ ] **Step 5: Commit**

```bash
git add app/src-tauri/src/lib.rs
git commit -m "feat(app): files_folder_* Tauri command 4종"
```

---

### Task 3: 의존성 + fs 권한 설정

**Files:**
- Modify: `app/package.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/capabilities/default.json`, `app/src-tauri/src/lib.rs:607-609`

- [ ] **Step 1: npm 의존성 추가**

Run (app/ 디렉토리에서):

```bash
cd app && pnpm add @tauri-apps/plugin-fs codemirror @codemirror/view @codemirror/state @codemirror/language @codemirror/lang-javascript @codemirror/lang-python @codemirror/lang-java @codemirror/lang-json @codemirror/lang-html @codemirror/lang-css @codemirror/lang-markdown marked
```

Expected: `package.json` dependencies에 13개 패키지 추가, 에러 없음

- [ ] **Step 2: Rust 플러그인 추가**

`app/src-tauri/Cargo.toml` `[dependencies]`에 추가:

```toml
tauri-plugin-fs = "2"
```

`app/src-tauri/src/lib.rs`의 `run()` 안 `.plugin(tauri_plugin_dialog::init())` 다음 줄에 추가:

```rust
        .plugin(tauri_plugin_fs::init())
```

- [ ] **Step 3: capabilities에 fs 권한 추가**

`app/src-tauri/capabilities/default.json`을 다음으로 교체:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "identifier": "default",
  "description": "Default capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-read-dir",
    "fs:allow-mkdir",
    "fs:allow-remove",
    "fs:allow-rename",
    "fs:allow-exists",
    {
      "identifier": "fs:scope",
      "allow": [{ "path": "$HOME" }, { "path": "$HOME/**" }]
    }
  ]
}
```

> dialog 자동 scope에 의존하지 않는 이유: 히스토리/세션 복원은 dialog 없이 폴더를 다시 열기 때문. 1인용 로컬 앱이므로 `$HOME/**` 명시 허용.

- [ ] **Step 4: 빌드 확인**

Run: `cd app && cargo build -p workspace-hub-app && pnpm typecheck`
Expected: 둘 다 성공

- [ ] **Step 5: Commit**

```bash
git add app/package.json app/pnpm-lock.yaml app/src-tauri/Cargo.toml ../Cargo.lock app/src-tauri/capabilities/default.json app/src-tauri/src/lib.rs
git commit -m "chore(files): codemirror·plugin-fs·marked 의존성 + fs 권한($HOME scope)"
```

---

### Task 4: 프론트 순수 헬퍼 (TDD)

**Files:**
- Create: `app/src/features/files/types.ts`
- Create: `app/src/features/files/helpers.ts`
- Test: `app/src/features/files/__tests__/helpers.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`app/src/features/files/__tests__/helpers.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { extOf, isHiddenInTree, isMarkdown, languageForFile } from "../helpers";

describe("extOf", () => {
  it("returns lowercase extension", () => {
    expect(extOf("Note.MD")).toBe("md");
    expect(extOf("a.tar.gz")).toBe("gz");
  });
  it("returns empty for no-extension and dotfiles", () => {
    expect(extOf("Makefile")).toBe("");
    expect(extOf(".gitignore")).toBe("");
  });
});

describe("languageForFile", () => {
  it("maps major extensions", () => {
    expect(languageForFile("main.py")).toBe("python");
    expect(languageForFile("App.JAVA")).toBe("java");
    expect(languageForFile("index.tsx")).toBe("typescript");
    expect(languageForFile("util.js")).toBe("javascript");
    expect(languageForFile("data.json")).toBe("json");
    expect(languageForFile("page.html")).toBe("html");
    expect(languageForFile("style.css")).toBe("css");
    expect(languageForFile("note.md")).toBe("markdown");
  });
  it("returns null for unknown text files", () => {
    expect(languageForFile("notes.txt")).toBeNull();
    expect(languageForFile("Makefile")).toBeNull();
  });
});

describe("isMarkdown", () => {
  it("detects .md / .markdown only", () => {
    expect(isMarkdown("a.md")).toBe(true);
    expect(isMarkdown("a.markdown")).toBe(true);
    expect(isMarkdown("a.txt")).toBe(false);
  });
});

describe("isHiddenInTree", () => {
  it("hides binary extensions and .DS_Store", () => {
    expect(isHiddenInTree("photo.PNG")).toBe(true);
    expect(isHiddenInTree("movie.mp4")).toBe(true);
    expect(isHiddenInTree("archive.tar.gz")).toBe(true);
    expect(isHiddenInTree("lib.dylib")).toBe(true);
    expect(isHiddenInTree(".DS_Store")).toBe(true);
  });
  it("keeps text-ish files including dotfiles and no-extension", () => {
    expect(isHiddenInTree(".gitignore")).toBe(false);
    expect(isHiddenInTree("Dockerfile")).toBe(false);
    expect(isHiddenInTree("read.me.md")).toBe(false);
    expect(isHiddenInTree("script.sh")).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd app && pnpm test`
Expected: FAIL — `../helpers` 모듈 없음

- [ ] **Step 3: types.ts + helpers.ts 작성**

`app/src/features/files/types.ts`:

```typescript
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

/** FileTree 가 CRUD 후 FilesPage 에 알리는 변경 — 열린 탭 정리에 사용. */
export type TreeMutation =
  | { type: "delete"; path: string; isDir: boolean }
  | { type: "rename"; path: string; newPath: string; isDir: boolean }
  | { type: "create" };
```

`app/src/features/files/helpers.ts`:

```typescript
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
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "icns", "tiff", "svgz",
  "pdf",
  "zip", "tar", "gz", "bz2", "xz", "7z", "rar", "dmg", "pkg",
  "exe", "dll", "so", "dylib", "bin", "o", "a", "class", "jar", "war",
  "pyc", "pyo", "wasm",
  "mp3", "m4a", "wav", "flac", "ogg",
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

export function isHiddenInTree(name: string): boolean {
  if (name === ".DS_Store") return true;
  return BINARY_EXTENSIONS.has(extOf(name));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd app && pnpm test`
Expected: helpers.test.ts 전체 PASS (기존 테스트 포함)

- [ ] **Step 5: Commit**

```bash
git add app/src/features/files/
git commit -m "feat(files): 확장자→언어 매핑·바이너리 판별 헬퍼 (TDD)"
```

---

### Task 5: api.ts + fs.ts 래퍼

**Files:**
- Create: `app/src/features/files/api.ts`
- Create: `app/src/features/files/fs.ts`

- [ ] **Step 1: api.ts 작성** (memo `api.ts`와 동일한 패턴)

```typescript
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
```

- [ ] **Step 2: fs.ts 작성**

```typescript
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
```

- [ ] **Step 3: typecheck**

Run: `cd app && pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add app/src/features/files/api.ts app/src/features/files/fs.ts
git commit -m "feat(files): invoke·plugin-fs 래퍼 (lazy listDir + fileOps)"
```

---

### Task 6: FileEditor (CodeMirror 6)

**Files:**
- Create: `app/src/features/files/FileEditor.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
import { useEffect, useRef } from "react";
import { basicSetup, EditorView } from "codemirror";
import { EditorState } from "@codemirror/state";
import type { Extension } from "@codemirror/state";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { languageForFile, type LanguageId } from "./helpers";

function languageExtension(id: LanguageId | null): Extension {
  switch (id) {
    case "javascript":
      return javascript();
    case "typescript":
      return javascript({ typescript: true });
    case "python":
      return python();
    case "java":
      return java();
    case "json":
      return json();
    case "html":
      return html();
    case "css":
      return css();
    case "markdown":
      return markdown();
    default:
      return [];
  }
}

interface FileEditorProps {
  /** 바뀌면 에디터를 새 문서로 재구성한다. */
  path: string;
  /** path 가 바뀐 시점의 스냅샷 — 이후 변경은 에디터가 단일 진실. */
  initialContent: string;
  onChange: (content: string) => void;
}

export function FileEditor({ path, initialContent, onChange }: FileEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const name = path.split("/").pop() ?? "";
    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        basicSetup,
        languageExtension(languageForFile(name)),
        EditorView.lineWrapping,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onChangeRef.current(u.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    return () => view.destroy();
    // path 전환 시에만 재구성 — initialContent 는 그 시점 스냅샷이므로 deps 에서 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return <div className="files-editor" ref={hostRef} />;
}
```

- [ ] **Step 2: typecheck**

Run: `cd app && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/src/features/files/FileEditor.tsx
git commit -m "feat(files): CodeMirror 6 raw 에디터 (주요 언어 구문 강조)"
```

---

### Task 7: MarkdownPreview + EditorTabs

**Files:**
- Create: `app/src/features/files/MarkdownPreview.tsx`
- Create: `app/src/features/files/EditorTabs.tsx`

- [ ] **Step 1: MarkdownPreview 작성**

로컬 1인용 앱이 자기 파일을 렌더하는 것이므로 sanitizer 없이 marked만 사용한다.

```tsx
import { useMemo } from "react";
import { marked } from "marked";

export function MarkdownPreview({ content }: { content: string }) {
  const html = useMemo(
    () => marked.parse(content, { async: false }) as string,
    [content],
  );
  return (
    <div
      className="files-md-preview"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

- [ ] **Step 2: EditorTabs 작성**

```tsx
interface TabItem {
  path: string;
  name: string;
  dirty: boolean;
}

interface EditorTabsProps {
  tabs: TabItem[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export function EditorTabs({ tabs, activePath, onSelect, onClose }: EditorTabsProps) {
  if (tabs.length === 0) return null;
  return (
    <div className="files-tabs" role="tablist">
      {tabs.map((t) => (
        <div
          key={t.path}
          role="tab"
          aria-selected={t.path === activePath}
          className={`files-tab${t.path === activePath ? " active" : ""}`}
          title={t.path}
          onClick={() => onSelect(t.path)}
        >
          <span className="files-tab-name">{t.name}</span>
          {t.dirty && <span className="files-tab-dirty" aria-label="unsaved" />}
          <button
            type="button"
            className="files-tab-close"
            aria-label={`close ${t.name}`}
            onClick={(e) => {
              e.stopPropagation();
              onClose(t.path);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: typecheck 후 Commit**

Run: `cd app && pnpm typecheck` — Expected: PASS

```bash
git add app/src/features/files/MarkdownPreview.tsx app/src/features/files/EditorTabs.tsx
git commit -m "feat(files): md 프리뷰 + 에디터 탭바"
```

---

### Task 8: FileTree (lazy 로딩 + 컨텍스트 메뉴 CRUD)

**Files:**
- Create: `app/src/features/files/FileTree.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { showConfirmToast } from "../../components/ui/ConfirmToast";
import { showErrorToast } from "../../components/ui/Toast";
import { useOutsideClick } from "../../components/ui/useOutsideClick";
import { fileOps, listDir } from "./fs";
import type { TreeMutation, TreeNode } from "./types";

interface FileTreeProps {
  root: string;
  activePath: string | null;
  onOpenFile: (node: TreeNode) => void;
  onMutate: (m: TreeMutation) => void;
}

type CtxMenu = { x: number; y: number; node: TreeNode } | null;
/** 인라인 입력 상태 — rename 은 node, create 는 부모 dirPath 기준. */
type Editing =
  | { kind: "rename"; node: TreeNode }
  | { kind: "new-file" | "new-dir"; dirPath: string }
  | null;

export function FileTree({ root, activePath, onOpenFile, onMutate }: FileTreeProps) {
  const [childrenByDir, setChildrenByDir] = useState<Map<string, TreeNode[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [ctxMenu, setCtxMenu] = useState<CtxMenu>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useOutsideClick(menuRef, ctxMenu !== null, () => setCtxMenu(null));

  const loadDir = useCallback(async (dirPath: string) => {
    try {
      const nodes = await listDir(dirPath);
      setChildrenByDir((prev) => new Map(prev).set(dirPath, nodes));
    } catch (e) {
      showErrorToast(`폴더를 읽지 못했습니다: ${e}`);
    }
  }, []);

  // 루트가 바뀌면 캐시·펼침 초기화 후 루트 한 단계 로드
  useEffect(() => {
    setChildrenByDir(new Map());
    setExpanded(new Set());
    setEditing(null);
    setCtxMenu(null);
    void loadDir(root);
  }, [root, loadDir]);

  const toggleDir = (node: TreeNode) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(node.path)) {
        next.delete(node.path);
      } else {
        next.add(node.path);
        if (!childrenByDir.has(node.path)) void loadDir(node.path);
      }
      return next;
    });
  };

  const parentOf = (path: string) => path.slice(0, path.lastIndexOf("/")) || root;

  const commitEditing = async (value: string) => {
    const name = value.trim();
    const ed = editing;
    setEditing(null);
    if (!ed || !name) return;
    try {
      if (ed.kind === "rename") {
        const dir = parentOf(ed.node.path);
        const newPath = `${dir}/${name}`;
        if (newPath !== ed.node.path) {
          await fileOps.rename(ed.node.path, newPath);
          onMutate({ type: "rename", path: ed.node.path, newPath, isDir: ed.node.isDir });
        }
        await loadDir(dir);
      } else {
        const newPath = `${ed.dirPath}/${name}`;
        if (ed.kind === "new-file") await fileOps.createFile(newPath);
        else await fileOps.createDir(newPath);
        onMutate({ type: "create" });
        await loadDir(ed.dirPath);
      }
    } catch (e) {
      showErrorToast(`작업에 실패했습니다: ${e}`);
    }
  };

  const requestDelete = (node: TreeNode) => {
    setCtxMenu(null);
    showConfirmToast({
      message: `"${node.name}" 을(를) 삭제할까요? 디스크에서 실제로 삭제됩니다.`,
      confirmLabel: "삭제",
      cancelLabel: "취소",
      onConfirm: () => {
        void (async () => {
          try {
            await fileOps.remove(node.path);
            onMutate({ type: "delete", path: node.path, isDir: node.isDir });
            await loadDir(parentOf(node.path));
          } catch (e) {
            showErrorToast(`삭제에 실패했습니다: ${e}`);
          }
        })();
      },
    });
  };

  const startCreate = (kind: "new-file" | "new-dir", dirPath: string) => {
    setCtxMenu(null);
    setExpanded((prev) => new Set(prev).add(dirPath));
    if (!childrenByDir.has(dirPath)) void loadDir(dirPath);
    setEditing({ kind, dirPath });
  };

  const renderInlineInput = (defaultValue: string) => (
    <input
      className="files-tree-inline-input"
      autoFocus
      defaultValue={defaultValue}
      onBlur={(e) => void commitEditing(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") void commitEditing(e.currentTarget.value);
        if (e.key === "Escape") setEditing(null);
      }}
    />
  );

  const renderNodes = (dirPath: string, depth: number) => {
    const nodes = childrenByDir.get(dirPath);
    if (!nodes) return null;
    return (
      <>
        {editing?.kind !== "rename" && editing?.dirPath === dirPath && (
          <div className="files-tree-row" style={{ paddingLeft: 8 + depth * 14 }}>
            {renderInlineInput("")}
          </div>
        )}
        {nodes.map((node) => (
          <div key={node.path}>
            <div
              className={[
                "files-tree-row",
                node.path === activePath ? "active" : "",
                node.isDir ? "dir" : "file",
              ].filter(Boolean).join(" ")}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => (node.isDir ? toggleDir(node) : onOpenFile(node))}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu({ x: e.clientX, y: e.clientY, node });
              }}
            >
              {node.isDir && (
                <span className={`files-tree-caret${expanded.has(node.path) ? " open" : ""}`}>▸</span>
              )}
              {editing?.kind === "rename" && editing.node.path === node.path
                ? renderInlineInput(node.name)
                : <span className="files-tree-name">{node.name}</span>}
            </div>
            {node.isDir && expanded.has(node.path) && renderNodes(node.path, depth + 1)}
          </div>
        ))}
      </>
    );
  };

  return (
    <div className="files-tree">
      <div className="files-tree-header">
        <button type="button" className="btn btn-ghost btn--sm" onClick={() => startCreate("new-file", root)}>
          + 파일
        </button>
        <button type="button" className="btn btn-ghost btn--sm" onClick={() => startCreate("new-dir", root)}>
          + 폴더
        </button>
      </div>
      <div className="files-tree-body">{renderNodes(root, 0)}</div>
      {ctxMenu && (
        <div ref={menuRef} className="files-ctxmenu" style={{ top: ctxMenu.y, left: ctxMenu.x }}>
          {ctxMenu.node.isDir && (
            <>
              <button type="button" onClick={() => startCreate("new-file", ctxMenu.node.path)}>새 파일</button>
              <button type="button" onClick={() => startCreate("new-dir", ctxMenu.node.path)}>새 폴더</button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing({ kind: "rename", node: ctxMenu.node });
              setCtxMenu(null);
            }}
          >
            이름 변경
          </button>
          <button type="button" className="danger" onClick={() => requestDelete(ctxMenu.node)}>삭제</button>
        </div>
      )}
    </div>
  );
}
```

> `useOutsideClick`의 실제 시그니처는 `(ref, active, onOutside)` — 위 코드가 이미 맞춰져 있다 (Escape 키 dismiss도 내장).

- [ ] **Step 2: typecheck**

Run: `cd app && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/src/features/files/FileTree.tsx
git commit -m "feat(files): lazy 파일 트리 + 컨텍스트 메뉴 CRUD (삭제는 ConfirmToast)"
```

---

### Task 9: FolderBar (히스토리 + 즐겨찾기 + 폴더 열기)

**Files:**
- Create: `app/src/features/files/FolderBar.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
import { useRef, useState } from "react";
import { useOutsideClick } from "../../components/ui/useOutsideClick";
import type { ExplorerFolder } from "./types";

interface FolderBarProps {
  current: ExplorerFolder | null;
  folders: ExplorerFolder[];
  onPickNewFolder: () => void;
  onSelectFolder: (f: ExplorerFolder) => void;
  onToggleFavorite: (f: ExplorerFolder) => void;
}

const baseName = (p: string) => p.split("/").filter(Boolean).pop() ?? p;

export function FolderBar({
  current,
  folders,
  onPickNewFolder,
  onSelectFolder,
  onToggleFavorite,
}: FolderBarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useOutsideClick(ref, open, () => setOpen(false));

  const favorites = folders.filter((f) => f.is_favorite);
  const recents = folders.filter((f) => !f.is_favorite);

  return (
    <div className="files-folderbar">
      <div className="files-folderbar-current" ref={ref}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setOpen((v) => !v)}
          title={current?.path ?? ""}
        >
          {current ? baseName(current.path) : "폴더를 선택하세요"} ▾
        </button>
        {open && (
          <div className="files-folder-dropdown">
            {favorites.length > 0 && (
              <>
                <div className="files-folder-dropdown-label">즐겨찾기</div>
                {favorites.map((f) => (
                  <FolderRow key={f.id} folder={f} onSelect={onSelectFolder} onToggleFavorite={onToggleFavorite} close={() => setOpen(false)} />
                ))}
              </>
            )}
            <div className="files-folder-dropdown-label">최근</div>
            {recents.length === 0 && <div className="files-folder-dropdown-empty">없음</div>}
            {recents.map((f) => (
              <FolderRow key={f.id} folder={f} onSelect={onSelectFolder} onToggleFavorite={onToggleFavorite} close={() => setOpen(false)} />
            ))}
          </div>
        )}
      </div>
      {current && (
        <button
          type="button"
          className={`files-fav-toggle${current.is_favorite ? " on" : ""}`}
          aria-label="즐겨찾기 토글"
          onClick={() => onToggleFavorite(current)}
        >
          {current.is_favorite ? "★" : "☆"}
        </button>
      )}
      <button type="button" className="btn btn-ghost" onClick={onPickNewFolder}>
        폴더 열기…
      </button>
    </div>
  );
}

function FolderRow({
  folder,
  onSelect,
  onToggleFavorite,
  close,
}: {
  folder: ExplorerFolder;
  onSelect: (f: ExplorerFolder) => void;
  onToggleFavorite: (f: ExplorerFolder) => void;
  close: () => void;
}) {
  return (
    <div className="files-folder-row" title={folder.path}>
      <button
        type="button"
        className="files-folder-row-main"
        onClick={() => {
          close();
          onSelect(folder);
        }}
      >
        <span className="files-folder-row-name">{baseName(folder.path)}</span>
        <span className="files-folder-row-path">{folder.path}</span>
      </button>
      <button
        type="button"
        className={`files-fav-toggle${folder.is_favorite ? " on" : ""}`}
        aria-label="즐겨찾기 토글"
        onClick={() => onToggleFavorite(folder)}
      >
        {folder.is_favorite ? "★" : "☆"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: typecheck 후 Commit**

Run: `cd app && pnpm typecheck` — Expected: PASS

```bash
git add app/src/features/files/FolderBar.tsx
git commit -m "feat(files): 폴더바 — 히스토리 드롭다운·즐겨찾기·폴더 열기"
```

---

### Task 10: FilesPage 오케스트레이션 (자동저장 + 세션 복원)

**Files:**
- Create: `app/src/features/files/FilesPage.tsx`

- [ ] **Step 1: 컴포넌트 작성**

메모 패턴과 동일한 debounce 저장(400ms) + 전환/언로드 시 flush. 탭 콘텐츠는 ref(에디터가 단일 진실)로 들고, dirty 표시만 state로 渡す.

```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { showErrorToast } from "../../components/ui/Toast";
import { filesFolderApi } from "./api";
import { EditorTabs } from "./EditorTabs";
import { FileEditor } from "./FileEditor";
import { FileTree } from "./FileTree";
import { FolderBar } from "./FolderBar";
import { fileOps } from "./fs";
import { isMarkdown } from "./helpers";
import { MarkdownPreview } from "./MarkdownPreview";
import type { ExplorerFolder, TreeMutation, TreeNode } from "./types";

const SAVE_DEBOUNCE_MS = 400;

interface OpenTab {
  path: string;
  name: string;
  /** UTF-8 디코딩 실패 → 에디터 대신 안내 표시. */
  binary: boolean;
}

export default function FilesPage() {
  const [folders, setFolders] = useState<ExplorerFolder[]>([]);
  const [current, setCurrent] = useState<ExplorerFolder | null>(null);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [dirtyPaths, setDirtyPaths] = useState<Set<string>>(new Set());
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
        contentRef.current.clear();
        await refreshFolders();
      } catch (e) {
        showErrorToast(`폴더를 열지 못했습니다: ${e}`);
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
      if (!tabs.some((t) => t.path === node.path)) {
        let binary = false;
        try {
          const content = await fileOps.read(node.path);
          contentRef.current.set(node.path, content);
        } catch {
          binary = true;
        }
        setTabs((prev) => [...prev, { path: node.path, name: node.name, binary }]);
      }
      setActivePath(node.path);
      setMode("edit");
    },
    [activePath, saveNow, tabs],
  );

  const selectTab = useCallback(
    async (path: string) => {
      if (activePath && activePath !== path) await saveNow(activePath);
      setActivePath(path);
      setMode("edit");
    },
    [activePath, saveNow],
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
      }
    },
    [activePath],
  );

  // ── 렌더 ──────────────────────────────────────────────────────────────────
  const activeTab = tabs.find((t) => t.path === activePath) ?? null;
  const showPreviewToggle = activeTab !== null && !activeTab.binary && isMarkdown(activeTab.name);

  return (
    <div className="files-layout">
      <div className="files-side">
        <FolderBar
          current={current}
          folders={folders}
          onPickNewFolder={() => void pickNewFolder()}
          onSelectFolder={(f) => void openFolder(f.path)}
          onToggleFavorite={(f) => void toggleFavorite(f)}
        />
        {current && (
          <FileTree
            root={current.path}
            activePath={activePath}
            onOpenFile={(n) => void openFile(n)}
            onMutate={handleMutation}
          />
        )}
      </div>
      <div className="files-main">
        <div className="files-main-top">
          <EditorTabs
            tabs={tabs.map((t) => ({ path: t.path, name: t.name, dirty: dirtyPaths.has(t.path) }))}
            activePath={activePath}
            onSelect={(p) => void selectTab(p)}
            onClose={(p) => void closeTab(p)}
          />
          {showPreviewToggle && (
            <div className="files-mode-toggle" role="tablist">
              <button type="button" className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")}>
                Edit
              </button>
              <button type="button" className={mode === "preview" ? "active" : ""} onClick={() => setMode("preview")}>
                Preview
              </button>
            </div>
          )}
        </div>
        {!activeTab && <div className="files-empty">파일을 선택하세요</div>}
        {activeTab?.binary && <div className="files-empty">바이너리 파일은 열 수 없습니다</div>}
        {activeTab && !activeTab.binary && mode === "edit" && (
          <FileEditor
            path={activeTab.path}
            initialContent={contentRef.current.get(activeTab.path) ?? ""}
            onChange={(content) => scheduleSave(activeTab.path, content)}
          />
        )}
        {activeTab && !activeTab.binary && mode === "preview" && (
          <MarkdownPreview content={contentRef.current.get(activeTab.path) ?? ""} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: typecheck**

Run: `cd app && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/src/features/files/FilesPage.tsx
git commit -m "feat(files): FilesPage — 탭·자동저장(debounce+flush)·세션 복원·md 프리뷰 토글"
```

---

### Task 11: App.tsx 등록 + CSS

**Files:**
- Modify: `app/src/App.tsx`
- Modify: `app/src/styles/global.css` (끝에 추가)

- [ ] **Step 1: App.tsx에 files 섹션 추가**

`Section` 타입(9행), import, 아이콘, `SECTIONS`(50행), 렌더(86행)를 수정:

```tsx
// import 추가
import FilesPage from "./features/files/FilesPage";

// 타입 확장
type Section = "todo" | "calendar" | "memos" | "project" | "files";

// 아이콘 추가 (ProjectIcon 아래)
const FilesIcon = () => (
  <svg {...iconProps} aria-hidden>
    <path d="M3.5 7.5v11A1.5 1.5 0 0 0 5 20h14a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 19 8h-7.2L9.6 5.7A1.5 1.5 0 0 0 8.5 5H5a1.5 1.5 0 0 0-1.5 1.5z" />
  </svg>
);

// SECTIONS 배열 끝에 추가
  { id: "files", label: "파일", enabled: true, Icon: FilesIcon },

// main--flush 조건에 files 추가
<main className={`main${section === "memos" || section === "project" || section === "files" ? " main--flush" : ""}`}>

// 렌더 추가
{section === "files" && <FilesPage />}
```

> 참고: 기존 사이드바 라벨은 영문(TODO/Calendar/Memo/Workspace)인데 스펙 확정은 "파일". 통일하려면 `label: "Files"` 한 단어 수정.

- [ ] **Step 2: global.css 끝에 .files-* 스타일 추가**

```css
/* ── files 도메인 ─────────────────────────────────────────────────────────── */
.files-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  height: 100%;
  min-height: 0;
}
.files-side {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--color-hairline);
}
.files-folderbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid var(--color-hairline);
}
.files-folderbar-current { position: relative; min-width: 0; flex: 1; }
.files-folder-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 30;
  min-width: 260px;
  max-height: 320px;
  overflow-y: auto;
  background: var(--color-canvas);
  border: 1px solid var(--color-hairline);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 4px;
}
.files-folder-dropdown-label {
  font-size: 11px;
  color: var(--color-stone);
  padding: 6px 8px 2px;
}
.files-folder-dropdown-empty { font-size: 12px; color: var(--color-stone); padding: 4px 8px; }
.files-folder-row { display: flex; align-items: center; }
.files-folder-row-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  padding: 5px 8px;
  border: 0;
  background: none;
  cursor: pointer;
  border-radius: 6px;
  text-align: left;
}
.files-folder-row-main:hover { background: var(--color-surface); }
.files-folder-row-name { font-size: 13px; color: var(--color-ink); }
.files-folder-row-path {
  font-size: 11px;
  color: var(--color-stone);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.files-fav-toggle {
  border: 0;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-stone);
  padding: 4px;
}
.files-fav-toggle.on { color: #d97706; }

.files-tree { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.files-tree-header { display: flex; gap: 2px; padding: 4px 8px; }
.files-tree-body { flex: 1; overflow-y: auto; padding-bottom: 12px; }
.files-tree-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.files-tree-row:hover { background: var(--color-surface); }
.files-tree-row.active { background: var(--color-primary-soft); }
.files-tree-row.dir { font-weight: 500; }
.files-tree-caret { font-size: 10px; transition: transform 0.1s; color: var(--color-stone); }
.files-tree-caret.open { transform: rotate(90deg); }
.files-tree-inline-input {
  font-size: 13px;
  padding: 1px 4px;
  border: 1px solid var(--color-hairline);
  border-radius: 4px;
  width: 160px;
}
.files-ctxmenu {
  position: fixed;
  z-index: 40;
  background: var(--color-canvas);
  border: 1px solid var(--color-hairline);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 4px;
  display: flex;
  flex-direction: column;
  min-width: 120px;
}
.files-ctxmenu button {
  border: 0;
  background: none;
  text-align: left;
  font-size: 13px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}
.files-ctxmenu button:hover { background: var(--color-surface); }
.files-ctxmenu button.danger { color: #b91c1c; }

.files-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.files-main-top {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--color-hairline);
}
.files-tabs { display: flex; flex: 1; min-width: 0; overflow-x: auto; }
.files-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  font-size: 13px;
  color: var(--color-stone);
  cursor: pointer;
  border-right: 1px solid var(--color-hairline);
  white-space: nowrap;
}
.files-tab.active { color: var(--color-ink); background: var(--color-surface); }
.files-tab-dirty {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-stone);
}
.files-tab-close {
  border: 0;
  background: none;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  color: var(--color-stone);
  padding: 0 2px;
}
.files-tab-close:hover { color: var(--color-ink); }
.files-mode-toggle { display: flex; gap: 2px; padding: 0 8px; }
.files-mode-toggle button {
  border: 0;
  background: none;
  font-size: 12px;
  padding: 4px 8px;
  cursor: pointer;
  color: var(--color-stone);
  border-radius: 6px;
}
.files-mode-toggle button.active { color: var(--color-ink); background: var(--color-surface); }

.files-editor { flex: 1; min-height: 0; overflow: hidden; }
.files-editor .cm-editor { height: 100%; font-size: 13px; }
.files-editor .cm-scroller { overflow: auto; }
.files-md-preview {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 24px;
  font-size: 14px;
  line-height: 1.65;
}
.files-md-preview pre {
  background: var(--color-surface);
  padding: 10px 12px;
  border-radius: 8px;
  overflow-x: auto;
}
.files-md-preview code { font-size: 12.5px; }
.files-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-stone);
  font-size: 13px;
}
```

> 색상 토큰은 `tokens.css` 실존 이름으로 확인 완료 — `--color-hairline`(경계선), `--color-stone`(보조 텍스트), `--color-canvas`(배경), `--color-surface`, `--color-primary-soft`, `--color-ink`.

- [ ] **Step 3: 빌드/typecheck**

Run: `cd app && pnpm typecheck && pnpm test`
Expected: 모두 PASS

- [ ] **Step 4: Commit**

```bash
git add app/src/App.tsx app/src/styles/global.css
git commit -m "feat(files): App 섹션 등록 + files 도메인 스타일"
```

---

### Task 12: 통합 검증 (수동)

**Files:** 없음 (검증만)

- [ ] **Step 1: 자동 검증 일괄 실행**

```bash
cargo test && cd app && pnpm typecheck && pnpm test && pnpm build
```

Expected: 모두 PASS

- [ ] **Step 2: 앱 실행 후 수동 체크리스트**

Run: `cd app && pnpm tauri dev`

체크리스트 (각각 실제 동작 확인):

1. 사이드바에 "파일" 섹션 표시, 클릭 시 빈 화면 + "폴더를 선택하세요"
2. "폴더 열기…" → 폴더 선택 → 트리 표시 (폴더 먼저, 이미지 등 바이너리 숨김)
3. 폴더 펼치기 — 하위 한 단계만 로드되는지 (node_modules 있는 폴더로 확인)
4. `.txt` 열기 → plain 에디터, Preview 토글 없음
5. `.py`/`.java` 열기 → 구문 강조, Preview 토글 없음
6. `.md` 열기 → Edit/Preview 토글 표시, Preview에서 렌더 확인, Edit로 복귀
7. 타이핑 → 잠시 후 dirty dot 사라짐 → 외부 에디터로 파일 열어 저장 확인
8. 탭 여러 개 열고 전환·닫기, 탭 전환 시 미저장분 flush 확인
9. 트리 우클릭: 새 파일/새 폴더/이름 변경/삭제(ConfirmToast 확인) 동작 + 열린 탭 정리
10. 열린 파일 이름 변경 → 탭 이름·경로 갱신 확인
11. 폴더 2개 이상 열고 드롭다운에서 히스토리 전환, ★ 토글 → 즐겨찾기 섹션 이동
12. 앱 재시작 → 마지막 폴더 자동 복원
13. 바이너리 파일(확장자 없는 실행파일 등) 열기 시도 → "바이너리 파일은 열 수 없습니다"

- [ ] **Step 3: 문제 발견 시 수정 후 최종 Commit**

```bash
git add -A && git commit -m "fix(files): 통합 검증 중 발견된 문제 수정"
```

---

## 계획 자기 검토 결과

- **스펙 커버리지**: 폴더 열기/히스토리 20개/즐겨찾기 영구(Task 1·9), IDE 레이아웃(Task 11), CodeMirror+주요 언어(Task 6), md 토글 프리뷰(Task 7·10), 자동저장(Task 10), 전체 CRUD+삭제 컨펌(Task 8), plugin-fs 직접+SQLite 상태(Task 3·5), 바이너리 안내(Task 10), 세션 복원(Task 10) — 전부 매핑됨.
- **스펙과 다른 점 2가지**: fs scope를 `$HOME/**` 명시 부여(히스토리 복원 때문), 트리 lazy 로딩(성능) — 문서 상단에 근거 명시.
- **타입 일관성**: `TreeNode`/`TreeMutation`/`ExplorerFolder`는 Task 4의 types.ts 정의를 모든 컴포넌트가 공유. Rust `FileExplorerFolder` ↔ TS `ExplorerFolder` 필드명(snake_case) 일치 확인.
