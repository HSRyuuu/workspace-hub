# 텍스트 파일 탐색기/편집기 (`files` 도메인) 설계

> 2026-06-12 브레인스토밍 확정안.

## 목적

임의의 로컬 폴더를 열어 텍스트 기반 파일(.md, .txt, .py, .java 등)을 탐색·편집하는
IDE 스타일 화면을 workspace-hub의 5번째 도메인으로 추가한다.
기존 메모(TipTap WYSIWYG)와는 완전히 별개인 **raw 텍스트 편집기**이며,
`.md` 파일에 한해 Edit ↔ Preview 화면 전환을 제공한다.

## 확정 결정 사항

| 항목 | 결정 |
|---|---|
| 탐색 대상 | 임의의 로컬 폴더 (폴더 피커로 열기) |
| 레이아웃 | IDE 스타일 — 좌측 파일트리, 우측 탭바 + 에디터 |
| 폴더 히스토리 | 최근 연 폴더 최대 20개 저장, 즐겨찾기(★)는 개수 무관 영구 보관 |
| 에디터 | CodeMirror 6 (줄번호, 현재 줄 하이라이트) |
| 구문 강조 | 주요 언어만 — js/ts, python, java, json, html, css, markdown. 그 외 plain |
| `.md` Preview | **화면 전환(토글)** 방식 — `[Edit | Preview]` 버튼, `.md` 탭에서만 노출 |
| 저장 | 자동 저장 (debounce, 기존 메모 패턴과 동일) |
| 파일 관리 | 전체 CRUD — 새 파일/폴더, 이름변경, 삭제 (삭제는 ConfirmToast 확인) |
| 파일 작업 (fs) | 프론트에서 `@tauri-apps/plugin-fs` 직접 호출 |
| 상태 저장 | 폴더 히스토리·즐겨찾기는 SQLite (core 테이블 + Tauri command) |
| 텍스트 판별 | 알려진 바이너리 확장자만 트리에서 숨김(최대한 포함) + 열기 시 UTF-8 디코딩 실패하면 "바이너리 파일" 안내 |
| 사이드바 라벨 | "파일" |
| 세션 복원 | 마지막 루트 폴더만 복원. 열린 탭 복원은 v2로 보류 |

## 화면 레이아웃

```
┌── 앱 사이드바 ──┬───────────── files 도메인 ─────────────┐
│ TODO          │ ┌ 폴더바: [현재폴더 ▾]  ★  [폴더 열기]    │
│ 캘린더         │ ├ 파일트리 ───┬─ 탭바: a.md ×  b.py × ───┤
│ 메모           │ │ ▸ src/     │  [Edit | Preview]*       │
│ 프로젝트       │ │   a.md     │ ┌──────────────────────┐ │
│ ▶ 파일        │ │   b.py     │ │ CodeMirror 6         │ │
│               │ │            │ │ (또는 .md preview)    │ │
└───────────────┴─┴────────────┴─└──────────────────────┘─┘
```

- 폴더바: 폴더 히스토리 드롭다운(최근순) + 즐겨찾기 별 토글 + 폴더 열기 버튼(dialog)
- `*` Preview 토글은 활성 탭이 `.md`일 때만 노출. 한 번에 한 모드만 표시(분할 아님)
- 탭에 미저장 변경 표시(dirty dot)는 자동저장 debounce 사이의 짧은 구간에만 나타남

## 컴포넌트 구조 — `app/src/features/files/`

| 파일 | 역할 |
|---|---|
| `FilesPage.tsx` | 오케스트레이션: 루트 폴더, 열린 탭, 활성 탭, 저장 상태 |
| `FolderBar.tsx` | 폴더 히스토리 드롭다운 + 즐겨찾기 토글 + 폴더 열기(dialog) |
| `FileTree.tsx` | 재귀 트리 렌더 + CRUD 컨텍스트 메뉴(새 파일/폴더, 이름변경, 삭제) |
| `EditorTabs.tsx` | 열린 파일 탭, dirty dot, 닫기 |
| `FileEditor.tsx` | CodeMirror 6 — 확장자→언어 매핑, 자동저장 debounce |
| `MarkdownPreview.tsx` | `.md` 읽기 전용 렌더 (가벼운 md→html) |
| `fs.ts` | plugin-fs/plugin-dialog 래퍼 (readDir/readText/writeText/create/rename/remove) |
| `api.ts` | SQLite 상태용 Tauri command 래퍼 |
| `types.ts` | 타입 정의 |

기존 메모 도메인과 공유하는 것은 디자인 토큰과 공통 UI(`Button`, `Toast`,
`ConfirmToast`)뿐이다. `MarkdownEditor.tsx`(TipTap)는 재사용하지 않는다.

## SQLite 상태 (core 테이블 신설)

파일 *내용*은 저장하지 않는다. 폴더 참조와 UI 상태만 저장한다.

```sql
CREATE TABLE file_explorer_folder (
  id             INTEGER PRIMARY KEY,
  path           TEXT NOT NULL UNIQUE,
  is_favorite    INTEGER NOT NULL DEFAULT 0,
  last_opened_at TEXT NOT NULL
);
```

- **Pruning**: `is_favorite = 0`인 행이 20개를 넘으면 `last_opened_at` 오래된
  것부터 삭제. 즐겨찾기는 개수 무관 영구 보관.
- **세션 복원**: 앱 시작 시 `last_opened_at` 최신 1건을 루트 폴더로 복원.

Tauri command (`app/src-tauri/src/lib.rs`):

| command | 동작 |
|---|---|
| `files_folder_list` | 히스토리 + 즐겨찾기 목록 (최근순) |
| `files_folder_touch(path)` | upsert + `last_opened_at` 갱신 + prune |
| `files_folder_set_favorite(path, bool)` | 즐겨찾기 토글 |
| `files_folder_remove(path)` | 히스토리에서 제거 |

## 파일 작업 흐름 (plugin-fs 직접)

- **폴더 열기**: plugin-dialog `open({ directory: true })` → 선택 경로를
  `files_folder_touch` → 트리 로드. Tauri 2에서 dialog로 선택한 경로는
  자동으로 fs 접근 scope에 추가된다.
- **트리 로드**: plugin-fs `readDir` 재귀. 디렉토리는 모두 표시.
  파일은 알려진 바이너리 확장자(이미지·동영상·압축·실행파일 등)만 숨기고
  나머지는 표시한다 — "텍스트 기반은 최대한 포함" 의도.
- **파일 열기**: `readTextFile` → CodeMirror에 주입.
  UTF-8 디코딩 실패 시 에디터 대신 "바이너리 파일입니다" 안내 표시.
- **자동저장**: CodeMirror onChange → debounce(250~500ms) → `writeTextFile`.
  탭/폴더 전환·앱 종료 시 pending 저장을 즉시 flush (기존 메모 패턴).
- **CRUD**: 트리 컨텍스트 메뉴 → `mkdir` / `create` / `rename` / `remove`.
  삭제는 외부 실제 파일이므로 `ConfirmToast`로 확인 후 실행.

## 에디터 & 프리뷰

- CodeMirror 6: `@codemirror/view`, `@codemirror/state` + 언어 패키지
  (`@codemirror/lang-javascript`, `-python`, `-java`, `-json`, `-html`,
  `-css`, `-markdown`). 확장자→언어 매핑 테이블, 매핑 없으면 plain text.
- Preview: 활성 탭이 `.md`일 때만 `[Edit | Preview]` 토글 노출.
  Preview는 읽기 전용 마크다운 렌더. 전환 시 에디터 내용 기준으로 렌더.

## 의존성 추가

- `app/package.json`: `@codemirror/*` 패키지들, `@tauri-apps/plugin-fs`
- `app/src-tauri/Cargo.toml`: `tauri-plugin-fs = "2"`
- `app/src-tauri/capabilities/default.json`: `fs:default` 권한 추가
- `lib.rs`: `.plugin(tauri_plugin_fs::init())` 등록 + 위 4개 command
- core: `file_explorer_folder` 마이그레이션 + 리포지토리

## 테스트

- `fs.ts` 래퍼: 확장자→언어 매핑, 바이너리 확장자 판별, 디코딩 실패 처리
  단위 테스트 (vitest, 기존 `__tests__/` 패턴)
- core: `file_explorer_folder` 리포지토리 — touch 시 upsert·갱신,
  20개 초과 prune, 즐겨찾기 영구 보관 테스트 (Rust)

## 범위 밖 (v2 이후)

- 열린 탭 세션 복원
- 파일/폴더 이동(드래그앤드롭)
- 트리 내 검색, 파일 내용 검색
- `.md` 외 포맷의 preview (csv 테이블 뷰 등)
