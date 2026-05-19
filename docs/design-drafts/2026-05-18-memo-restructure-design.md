# Memo 앱 재구성 설계 (2026-05-18)

> 가운데 `MemoList` 패널을 제거하고 2열 구조로 단순화한다. 선택 표시의 검정 배경 과다 사용을 줄이고, 검정은 primary CTA 전용으로 축소한다.

## 1. 동기

- 현재 메모 페이지는 **3열 구조**(`168px FolderTree + 280px MemoList + 1fr Editor`)로, "메모" 헤더·"+ 새 메모" 버튼·메모 row가 한 컬럼에 묶여 있어 시선이 분산됨.
- macOS Notes 처럼 **사이드바에서 폴더 탐색 → 메인에서 List/Editor 토글**이 더 자연스러움.
- ADR-0010의 검정 ink primary가 선택 표시까지 침범하여 화면 곳곳에 검정 블록이 과도하게 노출됨. 사용자 피드백: "검정은 특정 버튼(=primary CTA)에만".

## 2. 결정 사항 (합의 완료)

| 항목 | 결정 |
| --- | --- |
| 가운데 `MemoList` 패널 | **제거** |
| 사이드바 폭 | 168px → **224px** (폴더명 + `[+ 새 메모]` CTA 공간 확보) |
| `[+ 새 메모]` 위치 | **사이드바 상단 + List 헤더 둘 다** (macOS Notes 패턴) |
| 사이드바 고정 메뉴 ("모든 메모", "최근 삭제") | **유지** |
| 우측 영역 상태 | `Empty` / `List` / `Editor` 3-state 토글 |
| 폴더 전환 시 | 선택 메모 해제 → 새 폴더 List |
| Editor → List 복귀 | 좌상단 `← {폴더명}` 버튼 + `ESC` 키 |
| 선택 표시 색 | `--color-ink` → **`--color-primary-soft`** (`#f4f4f5`, 이미 정의된 토큰) |
| 적용 범위 | **글로벌 셸 사이드바까지 통일** (ADR-0011 신규 기록) |

## 3. 목표 구조

```
┌─ Sidebar 224px ──┐  ┌─ Main (List | Editor) ─────┐
│ [+ 새 메모]       │  │                             │
│ ─────             │  │   폴더 선택 → List          │
│ 모든 메모         │  │   메모 선택 → Editor        │
│ 최근 삭제         │  │   (스코프 없음 → Empty)     │
│ ─────             │  │                             │
│ ▼ 작업            │  │                             │
│   • 회의록        │  │                             │
│ ▶ 개인            │  │                             │
└──────────────────┘  └─────────────────────────────┘
```

### 3.1 상태 머신

```
[scope=null, memoId=null]              Empty
[scope ∈ {all,trash,folder}, memoId=null]   List
[memoId != null]                       Editor
```

전이:
- 사이드바 폴더 클릭 → `scope=folder, folderId=X, memoId=null` → **List**
- "모든 메모"/"최근 삭제" 클릭 → `scope=all|trash, memoId=null` → **List**
- List에서 메모 클릭 → `memoId=Y` → **Editor** (scope/folderId 유지)
- Editor 뒤로가기/`ESC` → `memoId=null` → **List** (scope/folderId 유지)
- 사이드바에서 다른 폴더 클릭 → `folderId=X', memoId=null` → **List**

### 3.2 List 화면

```
┌ 작업 (12)                              [+] ─┐
│                                              │
│  📌 회의록 v0.2 디자인                       │
│     방금 전 · 디자인 시스템 v0.2 적용...      │
│  ──────────────────────                      │
│     TODO 정리                                │
│     2시간 전 · 오늘 할 일...                 │
└──────────────────────────────────────────────┘
```

- 헤더: `폴더명 (N)` 좌측, `[+]` 우측 (작은 사이즈, primary CTA = 검정)
- 정렬: **pinned 우선 → updated_at DESC** (정렬 변경 UI 없음, YAGNI)
- Row: 제목 1줄 + (시간 · 미리보기) 1줄, hover 옅은 회색
- **List에서 선택 표시 없음**(클릭 즉시 Editor 전환되므로 불필요)
- **빈 List** (폴더에 메모 0개): "메모가 없습니다" + `[+ 새 메모 만들기]` 보조 CTA (List 헤더의 `[+]`와 동일 동작)

### 3.3 Editor 화면

```
┌ ← 작업                                  ⋯  ─┐
│                                              │
│  회의록 v0.2 디자인                          │
│  방금 전                                     │
│  ──────                                      │
│  [에디터 본문 …]                              │
└──────────────────────────────────────────────┘
```

- 좌상단 `← {라벨}` 텍스트 버튼 → List 복귀
  - 라벨: `scope=folder` → 폴더명 / `scope=all` → "모든 메모" / `scope=trash` → "최근 삭제"
- 우상단 `⋯` 메뉴 (핀 토글, 삭제 등 기존 기능 유지)
- `ESC` 키도 List 복귀

## 4. 변경 범위

### 4.1 파일 수준

- `app/src/pages/MemoPage.tsx` — 3-열 grid → 2-열 grid, 상태 머신 (`view: "list" | "editor"`) 추가
- `app/src/components/memo/FolderTree.tsx` — 상단에 `[+ 새 메모]` CTA 추가
- `app/src/components/memo/MemoList.tsx` — 헤더(폴더명 + `[+]`) 정리, 선택 표시 제거, 내부에서 `onSelect` 콜백
- `app/src/components/memo/MemoEditor.tsx` — 좌상단 뒤로가기 버튼·`ESC` 키 핸들러 추가
- `app/src/styles/global.css` —
  - `.memo-shell { grid-template-columns: 224px 1fr }`
  - `.sidebar-item.active` → `background: var(--color-primary-soft); color: var(--color-ink)`
  - `.memo-sidebar-row.selected` → 동일하게 `--color-primary-soft`로
  - `.memo-list-row.selected` 관련 정의는 제거 (List에서 선택 안 함)
  - `.memo-folder-row.selected` 하위 chevron/icon-btn 색 정상화 (`--color-on-primary` 제거)
  - `.memo-list-header-btn`(`+ 새 메모`)는 검정 유지
- `docs/ADR.md` — **ADR-0011**: 검정 ink는 primary CTA 전용, 선택 표시는 `--color-primary-soft`로 통일

### 4.2 데이터 / API

- 변경 없음. 기존 `memo_list`/`memo_add`/`memo_update`/`memo_folder_*` 모두 그대로.

## 5. 비범위 (Out of Scope)

- DB 스키마 / Rust CLI / 외부 API 변경
- 메모 정렬 옵션 (제목/생성일 등 — YAGNI)
- 폴더 트리 드래그앤드롭 (별도 작업)
- 캘린더 도메인 selected 색 변경 (Design System v0.2 마이그 보류 중이라 이번 범위에서 제외)
- TODO 도메인 변경 — 이미 `.todo-row.selected` 가 `--color-primary-soft`. 변경 없음
- 검색 기능, 태그, 즐겨찾기 등 신규 기능

## 6. 검증 기준 (Success Criteria)

작업 완료 판정:

1. 메모 페이지가 **사이드바 + 메인** 2열로 렌더링된다 (가운데 280px 패널 없음).
2. **빈 상태**: 페이지 진입 직후 (선택 없음) → Empty UI 표시.
3. **폴더 클릭** → 해당 폴더 메모를 pinned/updated_at 순으로 List 표시.
4. **메모 클릭** → 같은 영역이 Editor로 전환, 사이드바·폴더 선택 유지.
5. **Editor 좌상단 `← {폴더명}` 클릭** 또는 **`ESC` 키** → List로 복귀, 같은 폴더 유지.
6. **사이드바 `[+ 새 메모]`** → 현재 폴더(or 루트)에 메모 생성, 곧바로 Editor 진입.
7. **List 헤더 `[+]`** → 현재 폴더에 메모 생성, 곧바로 Editor 진입.
8. **선택 색**: 사이드바·글로벌 셸의 active row, 메모 폴더 selected row 모두 `--color-primary-soft` 배경 + `--color-ink` 텍스트. 검정 배경(`--color-ink`)으로 표시되는 selected/active 잔존 없음.
9. **`[+ 새 메모]` CTA·핀 도트 등 의도된 검정**은 그대로 유지.
10. 회귀: TODO/캘린더/프로젝트 도메인 페이지에서 시각적 회귀 없음 (selected 색이 의도된 곳에서만 변함).

## 7. 리스크 & 메모

- `.sidebar-item.active`는 글로벌 셸이 공유. 다른 도메인 페이지에서 active 시각 강조가 너무 약해 보이지 않는지 같이 확인. 필요 시 `font-weight: 600` 보강.
- 메모 List에서 선택 표시 제거 — 사용자가 "어디 있었지?" 헷갈릴 가능성. 대신 Editor 좌상단 뒤로가기에 폴더명을 표시해서 컨텍스트 보존.
- 글로벌 셸 사이드바 폭은 52px(아이콘 only). 메모 내부 사이드바 224px과는 별개.
