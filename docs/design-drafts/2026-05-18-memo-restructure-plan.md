# Memo 앱 재구성 구현 계획 (2026-05-18)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메모 페이지의 가운데 `MemoList` 패널을 제거하고 2열(Sidebar + List/Editor 토글) 구조로 단순화한다. 선택 표시의 검정 배경을 옅은 회색(`--color-primary-soft`)으로 통일하고, 검정 ink는 primary CTA 전용으로 축소한다.

**Architecture:** React + Tauri 셸. 상태 머신은 클라이언트 사이드 (`selectedId === null` 이면 List, 그 외 Editor). 폴더 전환 시 `selectedId`를 명시적으로 초기화. CSS 전역 토큰 변경은 글로벌 셸 사이드바까지 영향. CLI/DB는 변경 없음.

**Tech Stack:** React 18, TypeScript, Vite, Tauri 2, TipTap, vitest+RTL(인프라만, 이번 작업에서는 visual 검증 위주).

**검증 도구:**
- `pnpm typecheck` — TS 컴파일
- `pnpm tauri dev` — 실제 동작 확인 (사용자가 직접 또는 Claude가 수동 시나리오 따라가며)

**참조:**
- 스펙: `docs/design-drafts/2026-05-18-memo-restructure-design.md`
- 토큰 정의: `app/src/styles/tokens.css` (`--color-primary-soft: #f4f4f5` 이미 존재)

---

## File Structure

**수정할 파일 (Modify):**
- `app/src/features/memo/MemoPage.tsx` — 그리드 2열, 상태 토글, Editor 뒤로가기/ESC, MemoList에 라벨 prop 전달, FolderTree에 onCreateMemo 전달
- `app/src/features/memo/MemoList.tsx` — 헤더(`{label} ({n}) + [+]`), 선택 표시 제거, 빈 상태 보조 CTA
- `app/src/features/memo/FolderTree.tsx` — 상단 `[+ 새 메모]` 풀폭 버튼, onCreateMemo prop
- `app/src/styles/global.css` — `.memo-shell` 2열, `.sidebar-item.active` / `.memo-sidebar-row.selected` / `.memo-folder-row.selected` 자식 색 정상화, MemoList 헤더/뒤로가기 스타일 추가
- `docs/ADR.md` — ADR-0011 추가

**손대지 않을 파일:**
- `app/src/features/memo/MemoEditor.tsx` (TipTap 본문) — 뒤로가기는 MemoPage 레벨에서 처리하므로 변경 없음
- `app/src/features/memo/api.ts`, `types.ts`, `markdown.ts`
- CLI/Rust 측 일체

---

## Task 1: 글로벌 selected 색 옅은 회색으로 변경

> 가장 안전하고 독립적인 변경부터. CSS 토큰만 손대 visual baseline을 확보한다.

**Files:**
- Modify: `app/src/styles/global.css` (라인 80-86, 1563-1568, 1586-1588, 1607-1611, 1631-1632, 1666-1669, 1744-1750, 1765)

- [ ] **Step 1: `.sidebar-item.active` 변경 (글로벌 셸 사이드바)**

`app/src/styles/global.css` 라인 80-86을 다음으로 교체:

```css
.sidebar-item.active {
  background: var(--color-primary-soft);
  color: var(--color-ink);
  font-weight: 600;
}
.sidebar-item.active .sidebar-item-icon {
  color: var(--color-ink);
}
```

- [ ] **Step 2: `.memo-sidebar-row.selected` + 하위 자식들 변경**

라인 1563-1568, 1586-1588을 다음으로 교체 (자식 요소의 `--color-on-primary` 잔존을 모두 ink로 되돌림):

```css
.memo-sidebar-row.selected {
  background: var(--color-primary-soft);
  color: var(--color-ink);
}
.memo-sidebar-row.selected .memo-folder-name-btn {
  color: var(--color-ink);
}
```

라인 1586-1588 (`.memo-sidebar-row.selected .memo-sidebar-badge`)도 동일하게 ink 톤으로 (아래 Step 3에서 함께 처리).

- [ ] **Step 3: 배지·chevron·icon-btn 색 정상화**

배지(원래 흰 글씨)는 옅은 톤 row 위에서 ink로:
```css
.memo-sidebar-row.selected .memo-sidebar-badge {
  background: var(--color-hairline);
  color: var(--color-ink);
}
```

`.memo-folder-row.selected .memo-folder-chevron` (라인 1631), `.memo-folder-row.selected .memo-sidebar-icon-btn` (라인 1666-1669) 등 색 지정이 `--color-on-primary` 인 곳은 모두 `var(--color-ink)` 으로 교체. hover 시 색이 너무 약하면 `--color-ink-deep` 사용.

- [ ] **Step 4: `.memo-list-row.selected` 정의 제거 (List에서 선택 표시 안 함)**

라인 1744-1750, 1765의 `.memo-list-row.selected` 관련 정의를 모두 삭제. 사용처가 없어지므로 dead CSS가 됨. (다음 Task에서 MemoList의 className 조립도 제거하므로 일관됨)

- [ ] **Step 5: typecheck + 빌드 확인**

Run:
```sh
cd app && pnpm typecheck
```
Expected: PASS (CSS 변경만이라 TS 영향 없음 — sanity check)

- [ ] **Step 6: visual 검증**

`pnpm tauri dev` 실행 후 다음을 직접 클릭해 확인:
- 좌측 글로벌 셸 사이드바에서 도메인(TODO/메모/캘린더/프로젝트) 전환 시 active row가 옅은 회색 + 검정 텍스트 + 굵게
- 메모 페이지 사이드바에서 폴더/모든 메모/최근 삭제 클릭 시 동일
- "검정 배경 + 흰 글씨"인 selected가 어디에도 남아있지 않음 (단, `+ 새 메모`/우선순위 active 같은 의도된 검정은 유지)

- [ ] **Step 7: Commit**

```sh
git add app/src/styles/global.css
git commit -m "style(design-system): selected 표시를 옅은 회색(primary-soft)으로 통일

검정 ink primary는 [+ 새 메모] 같은 CTA 버튼 전용으로 남기고,
글로벌 셸 사이드바·메모 사이드바 row·메모 폴더 row의 selected/active 표시를
모두 --color-primary-soft 배경 + --color-ink 텍스트로 통일.

ADR-0011 으로 별도 기록 예정."
```

---

## Task 2: MemoList 헤더 재구성 + 선택 표시 제거 + 빈 상태 CTA

> MemoList를 "폴더 컨텍스트가 들어오면 라벨·메모 수를 표시하는 단순 뷰"로 바꾼다. 추후 MemoPage가 prop을 새 형태로 넘기게 됨.

**Files:**
- Modify: `app/src/features/memo/MemoList.tsx`
- Modify: `app/src/styles/global.css` (`.memo-list-header`, `.memo-list-row` 관련 스타일)

- [ ] **Step 1: MemoListProps 갱신**

`app/src/features/memo/MemoList.tsx` 의 `MemoListProps` 인터페이스를 다음으로 교체:

```ts
interface MemoListProps {
  memos: Memo[];
  /** 헤더에 표시할 라벨 — "모든 메모", "최근 삭제", "루트", 또는 폴더명. */
  label: string;
  onSelect: (id: number) => void;
  onCreate: () => void;
  /** 휴지통 모드 — 영구 삭제·복원 액션을 노출. */
  trashMode: boolean;
  onRestore: (id: number) => void;
  onPurge: (id: number) => void;
  onEmptyTrash: () => void;
}
```

(`selectedId` prop 제거 — List에서 더 이상 선택 표시를 하지 않음)

- [ ] **Step 2: 헤더 마크업 교체**

기존 `memo-list-header` 안의 마크업을 다음으로 교체:

```tsx
<div className="memo-list-header">
  <span className="memo-list-title">
    {props.label} <span className="memo-list-count">({props.memos.length})</span>
  </span>
  {props.trashMode ? (
    <button
      type="button"
      className="memo-list-header-btn memo-list-header-btn--danger"
      onClick={props.onEmptyTrash}
      disabled={props.memos.length === 0}
    >
      모두 비우기
    </button>
  ) : (
    <button
      type="button"
      className="memo-list-header-btn memo-list-header-btn--icon"
      onClick={props.onCreate}
      title="새 메모"
      aria-label="새 메모"
    >
      +
    </button>
  )}
</div>
```

- [ ] **Step 3: row className 에서 `selected` 토글 제거**

기존 `memos.map(...)` 안의:
```tsx
className={`memo-list-row ${props.selectedId === m.id ? "selected" : ""}`}
```
을 다음으로 단순화:
```tsx
className="memo-list-row"
```

- [ ] **Step 4: 빈 상태 보조 CTA**

기존 빈 상태:
```tsx
<div className="memo-list-empty">
  {props.trashMode ? "휴지통이 비었습니다" : "메모가 없습니다"}
</div>
```
을 다음으로 교체:
```tsx
<div className="memo-list-empty">
  <p className="memo-list-empty-msg">
    {props.trashMode ? "휴지통이 비었습니다" : "메모가 없습니다"}
  </p>
  {!props.trashMode && (
    <button
      type="button"
      className="memo-list-empty-cta"
      onClick={props.onCreate}
    >
      + 새 메모 만들기
    </button>
  )}
</div>
```

- [ ] **Step 5: 새 헤더/빈 상태 스타일 추가**

`app/src/styles/global.css` 에 `.memo-list-header` 정의 근처에 추가:

```css
.memo-list-count {
  color: var(--color-stone);
  font-weight: 400;
  margin-left: 4px;
}
.memo-list-header-btn--icon {
  width: 28px;
  padding: 0;
  font-size: 16px;
  line-height: 1;
}
.memo-list-empty-msg {
  color: var(--color-stone);
  margin: 0 0 12px;
}
.memo-list-empty-cta {
  background: transparent;
  border: 1px solid var(--color-hairline);
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--color-ink);
  cursor: pointer;
}
.memo-list-empty-cta:hover {
  background: var(--color-primary-soft);
}
```

- [ ] **Step 6: typecheck**

Run:
```sh
cd app && pnpm typecheck
```
Expected: FAIL — MemoPage 가 `selectedId`/`onSelect={setSelectedId}` 를 여전히 넘기고 `label` 을 안 넘김. 이건 다음 Task에서 고친다.

- [ ] **Step 7: Commit (red — MemoList 단독 변경)**

```sh
git add app/src/features/memo/MemoList.tsx app/src/styles/global.css
git commit -m "refactor(memo): MemoList 헤더에 라벨/카운트 표시, 선택 표시 제거

- selectedId prop 제거 (List 클릭 즉시 Editor로 전환되므로 불필요)
- 헤더: '메모' 텍스트 + '+ 새 메모' 큰 버튼 → '{label} (N)' + 작은 [+]
- 빈 상태에 '+ 새 메모 만들기' 보조 CTA 추가

후속 커밋에서 MemoPage 가 새 props 모양으로 호출하도록 wiring."
```

(이 커밋만으로는 typecheck 안 통과 — 다음 Task에서 곧바로 호출부를 맞춤. 시간 간격 짧게 유지)

---

## Task 3: FolderTree 상단 `[+ 새 메모]` CTA

> 사이드바 최상단에 풀폭 검정 버튼을 추가. macOS Notes의 우상단 새 노트 버튼과 같은 역할.

**Files:**
- Modify: `app/src/features/memo/FolderTree.tsx`
- Modify: `app/src/styles/global.css`

- [ ] **Step 1: FolderTreeProps 에 onCreateMemo 추가**

`app/src/features/memo/FolderTree.tsx` 의 `FolderTreeProps` 인터페이스 끝에 추가:

```ts
interface FolderTreeProps {
  // ... 기존 props
  onCreateMemo: () => void;
}
```

- [ ] **Step 2: 사이드바 최상단 CTA 추가**

`<aside className="memo-sidebar">` 의 첫 자식으로 다음 블록 삽입 (기존 `<div className="memo-sidebar-section">` 보다 위):

```tsx
<div className="memo-sidebar-cta">
  <button
    type="button"
    className="memo-sidebar-new-btn"
    onClick={props.onCreateMemo}
  >
    + 새 메모
  </button>
</div>
```

- [ ] **Step 3: 스타일 추가**

`app/src/styles/global.css` 의 `.memo-sidebar` 정의 근처에 추가:

```css
.memo-sidebar-cta {
  padding: 12px 8px 8px;
}
.memo-sidebar-new-btn {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-ink);
  color: var(--color-on-primary);
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.memo-sidebar-new-btn:hover {
  background: var(--color-ink-deep);
}
```

- [ ] **Step 4: typecheck**

Run: `cd app && pnpm typecheck`
Expected: FAIL — MemoPage가 아직 `onCreateMemo` 를 안 넘김. 다음 Task에서 wiring.

- [ ] **Step 5: Commit (체크포인트)**

```sh
git add app/src/features/memo/FolderTree.tsx app/src/styles/global.css
git commit -m "feat(memo): 사이드바 상단에 [+ 새 메모] CTA 추가

검정 ink primary 풀폭 버튼. macOS Notes 패턴.
다음 커밋에서 MemoPage 와 wiring."
```

---

## Task 4: MemoPage 2열 그리드 + 상태 토글 + Editor 뒤로가기 + ESC

> 핵심 작업. 모든 wiring을 한 번에 끝내고 typecheck/빌드 PASS 상태로 복귀.

**Files:**
- Modify: `app/src/features/memo/MemoPage.tsx`
- Modify: `app/src/styles/global.css` (`.memo-shell` 그리드, 뒤로가기 버튼 스타일)

- [ ] **Step 1: 그리드 2열로 변경**

`app/src/styles/global.css` 의 `.memo-shell` 정의를 찾아 `grid-template-columns` 를 다음으로 교체:

```css
.memo-shell {
  display: grid;
  grid-template-columns: 224px 1fr;
  /* 나머지(height, gap 등 기존) 유지 */
}
```

(현재 `168px 280px 1fr` → `224px 1fr`)

- [ ] **Step 2: MemoPage 내 라벨 계산 헬퍼**

`MemoPage` 함수 본문 상단(`const selectedMemo = useMemo(...)` 근처)에 다음을 추가:

```tsx
const currentLabel = useMemo(() => {
  if (scope === "active") return "모든 메모";
  if (scope === "trash") return "최근 삭제";
  if (scope === "root") return "루트";
  // scope === "folder"
  const f = folders.find((x) => x.id === folderId);
  return f?.name ?? "폴더";
}, [scope, folderId, folders]);
```

- [ ] **Step 3: handleSelect 에서 선택 메모 초기화**

기존:
```tsx
const handleSelect = useCallback(
  (next: MemoListScope, fid: number | null) => {
    setScope(next);
    setFolderId(fid);
  },
  [],
);
```
을 다음으로 교체:
```tsx
const handleSelect = useCallback(
  (next: MemoListScope, fid: number | null) => {
    setScope(next);
    setFolderId(fid);
    setSelectedId(null);
  },
  [],
);
```

- [ ] **Step 4: refreshMemos 에서 자동 첫번째 선택 제거**

기존 `refreshMemos`:
```tsx
setSelectedId((cur) => {
  if (cur !== null && list.some((m) => m.id === cur)) return cur;
  return list[0]?.id ?? null;
});
```
을 다음으로 교체 (현재 선택이 사라진 경우만 null 로):
```tsx
setSelectedId((cur) => {
  if (cur === null) return null;
  return list.some((m) => m.id === cur) ? cur : null;
});
```

(이유: 자동 첫번째 선택이 사라지면 폴더 클릭 시 List 모드 유지 가능)

- [ ] **Step 5: handleBack + ESC 키 핸들러 추가**

`MemoPage` 함수 본문에 다음 추가:

```tsx
const handleBack = useCallback(() => {
  setSelectedId(null);
}, []);

useEffect(() => {
  if (selectedId === null) return;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setSelectedId(null);
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [selectedId]);
```

- [ ] **Step 6: handleCreateMemo 끝에 selectedId 설정은 이미 있음 — 확인만**

기존 `handleCreateMemo` 가 `setSelectedId(created.id)` 로 끝나는지 재확인. 그대로 두면 신규 생성 시 자동 Editor 진입. (변경 없음)

- [ ] **Step 7: return 절 전체 재작성**

기존 `return (...)` 블록을 다음으로 교체:

```tsx
return (
  <div className="memo-shell">
    <FolderTree
      folders={folders}
      selectedScope={scope}
      selectedFolderId={folderId}
      onSelect={handleSelect}
      onAddFolder={handleAddFolder}
      onRenameFolder={handleRenameFolder}
      onDeleteFolder={handleDeleteFolder}
      trashCount={trashCount}
      onCreateMemo={handleCreateMemo}
    />
    <div className="memo-main-pane">
      {selectedMemo === null ? (
        <MemoList
          memos={memos}
          label={currentLabel}
          onSelect={setSelectedId}
          onCreate={handleCreateMemo}
          trashMode={scope === "trash"}
          onRestore={handleRestore}
          onPurge={handlePurge}
          onEmptyTrash={handleEmptyTrash}
        />
      ) : (
        <div className="memo-editor-pane">
          <div className="memo-editor-header">
            <button
              type="button"
              className="memo-back-btn"
              onClick={handleBack}
              aria-label="목록으로"
            >
              ← {currentLabel}
            </button>
            <div className="memo-editor-meta-bar">
              {scope !== "trash" && (
                <button
                  type="button"
                  className={`memo-meta-btn ${selectedMemo.pinned ? "active" : ""}`}
                  onClick={handleTogglePin}
                  title={selectedMemo.pinned ? "고정 해제" : "상단 고정"}
                  aria-pressed={selectedMemo.pinned}
                >
                  {selectedMemo.pinned ? "고정됨" : "고정"}
                </button>
              )}
              {scope !== "trash" && (
                <button
                  type="button"
                  className="memo-meta-btn memo-meta-btn--danger"
                  onClick={handleDeleteSelected}
                  title="휴지통으로"
                >
                  휴지통
                </button>
              )}
            </div>
          </div>
          {scope === "trash" ? (
            <div className="memo-editor-readonly">
              <h2>{selectedMemo.title || firstLineAsTitle(selectedMemo.body) || "(제목 없음)"}</h2>
              <pre className="memo-readonly-body">{selectedMemo.body}</pre>
              <p className="memo-readonly-note">
                휴지통의 메모는 읽기 전용입니다. 복원 후 편집할 수 있습니다.
              </p>
            </div>
          ) : (
            <>
              <input
                className="memo-title-input"
                value={draftTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="제목"
                aria-label="제목"
              />
              <MemoEditor
                memoId={selectedMemo.id}
                value={draftBody}
                onChange={handleBodyChange}
              />
            </>
          )}
        </div>
      )}
    </div>
    {error && (
      <div className="memo-error-toast" role="alert" onClick={() => setError(null)}>
        {error}
      </div>
    )}
  </div>
);
```

기존 "메모를 선택하거나 새로 만드세요" 빈 상태는 더 이상 필요 없음 (List가 그 자리). 휴지통 빈 상태도 List 안에서 처리됨.

- [ ] **Step 8: 새 컨테이너/뒤로가기 버튼 스타일 추가**

`app/src/styles/global.css` 의 `.memo-editor-pane` 근처에 추가:

```css
.memo-main-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}
.memo-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--color-hairline);
}
.memo-back-btn {
  background: transparent;
  border: none;
  color: var(--color-stone);
  font-size: 13px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
}
.memo-back-btn:hover {
  background: var(--color-primary-soft);
  color: var(--color-ink);
}
```

- [ ] **Step 9: typecheck**

Run: `cd app && pnpm typecheck`
Expected: PASS — 이 시점에 모든 컴포넌트 prop 시그니처가 일치.

- [ ] **Step 10: 시나리오 visual 검증**

`pnpm tauri dev` 실행 후 다음 시나리오 직접 확인:

1. 메모 페이지 진입 → 사이드바 + List (모든 메모) 보임. 가운데 280px 패널 없음.
2. 사이드바 폴더 클릭 → List 라벨이 폴더명으로 바뀜, 메모 수 표시.
3. List에서 메모 클릭 → 같은 영역이 Editor로 전환, 좌상단 `← {폴더명}` 보임.
4. `← {폴더명}` 클릭 → List로 복귀, 폴더 선택 유지.
5. Editor에서 `ESC` 키 → List로 복귀.
6. 사이드바 `+ 새 메모` 클릭 → 현재 폴더(없으면 루트)에 생성, 곧바로 Editor.
7. List 헤더 `[+]` 클릭 → 동일.
8. 빈 폴더 선택 → "메모가 없습니다" + `[+ 새 메모 만들기]` 표시. 그 CTA 클릭도 동작.
9. 휴지통 진입 → 헤더 "최근 삭제 (N)" + "모두 비우기" 버튼. 메모 클릭 시 readonly Editor + 뒤로가기.
10. 폴더 전환 시 선택된 메모는 해제되어 List 표시 (Editor 잔류 안 됨).

문제 있으면 해당 Step 다시 보고 수정. 통과 시 다음.

- [ ] **Step 11: Commit**

```sh
git add app/src/features/memo/MemoPage.tsx app/src/styles/global.css
git commit -m "feat(memo): 2열 레이아웃 + List/Editor 토글 + 뒤로가기

- 가운데 MemoList 패널(280px) 제거, 사이드바 224px + 메인 1fr 그리드
- selectedId === null 이면 List, 아니면 Editor (같은 영역에서 토글)
- Editor 좌상단 '← {라벨}' 버튼 + ESC 키로 List 복귀
- 폴더/스코프 전환 시 selectedId 자동 해제
- 자동 첫번째 메모 선택 동작 제거 (의도된 List 잔류)

라벨은 scope에 따라 '모든 메모'/'최근 삭제'/'루트'/{폴더명}."
```

---

## Task 5: 회귀 visual 검증 (다른 도메인)

> Task 1에서 글로벌 셸 사이드바를 건드렸으므로, 다른 도메인에 시각 회귀가 없는지 확인.

**Files:**
- 코드 변경 없음. 검증만.

- [ ] **Step 1: 다른 도메인 클릭해보기**

`pnpm tauri dev` 가 떠 있는 상태에서:

1. TODO 도메인 — active 도메인 표시(사이드바)가 옅은 회색 + 검정 텍스트로 적절히 보이는지. TODO row 선택 색은 원래 `--color-primary-soft` 였으므로 일관됨.
2. 캘린더 도메인 — `.cal-bar.selected` 등은 이번 변경 범위 밖. 캘린더 셀 selected 색이 검정이라도 유지(스펙의 Out of Scope 항목).
3. 프로젝트 도메인 — `.project-items li.active` 색 확인. 만약 검정 배경이 남아있다면 그건 별도 작업 (스펙은 글로벌 셸 사이드바 + 메모 도메인까지가 범위).

- [ ] **Step 2: 발견 사항 메모**

문제가 보이면 plan 마지막 "후속 작업"에 적어둠. **이번 plan 범위 밖이면 건드리지 말 것** (Surgical Changes 원칙).

---

## Task 6: ADR-0011 기록

> 결정을 영구화. ADR.md 형식은 기존 ADR-0010 등을 참고.

**Files:**
- Modify: `docs/ADR.md`

- [ ] **Step 1: ADR.md 끝부분 형식 확인**

Run: `tail -50 docs/ADR.md` 로 ADR-0010 형식 확인. 같은 헤딩 레벨·필드 구성으로 ADR-0011 추가.

- [ ] **Step 2: ADR-0011 항목 추가**

ADR.md 맨 끝에 다음 형식으로 추가 (실제 형식은 ADR-0010 을 따름):

```markdown
## ADR-0011: 검정 ink primary 는 CTA 전용, selected 표시는 옅은 회색으로 통일

- **날짜**: 2026-05-18
- **상태**: 채택
- **결정**: `--color-ink` 검정 배경은 primary CTA 버튼(예: `+ 새 메모`)에 한정한다. 사이드바·List·트리의 selected/active 표시는 `--color-primary-soft` 배경 + `--color-ink` 텍스트 + `font-weight: 600` 으로 통일한다.
- **근거**: 사용자 피드백 — 현재 모든 selected 표시에 검정 배경 + 흰 텍스트가 적용되어 화면 전반에 검정 블록이 과도하게 노출됨. macOS Notes 등 OS 네이티브 앱은 selected 에 옅은 톤을 쓰고 CTA 강조와 분리.
- **영향 범위**: 글로벌 셸 사이드바(`.sidebar-item.active`), 메모 사이드바 row(`.memo-sidebar-row.selected`), 메모 폴더 row 자식 요소. 캘린더 도메인(`.cal-bar.selected` 등)은 Design System v0.2 마이그레이션 보류 상태라 이번 범위에서 제외.
- **유지되는 검정 사용처**: `+ 새 메모` 버튼(사이드바·List 헤더), 우선순위 토글 active, 체크박스 체크 상태, underline 탭 active 텍스트 등.
- **참조**: `docs/design-drafts/2026-05-18-memo-restructure-design.md`
```

- [ ] **Step 3: Commit**

```sh
git add docs/ADR.md
git commit -m "docs(adr): ADR-0011 — 검정 ink 는 CTA 전용, selected 는 옅은 회색

ADR-0010(Design System v0.2)의 ink primary 사용 범위를 좁힘.
2026-05-18 메모 앱 재구성 작업에서 합의."
```

---

## 후속 작업 (Out of Scope, 발견 시 별도 plan)

- 캘린더 도메인의 `.cal-bar.selected` / `.ws-cal-cell.selected` 색 통일 (Design System v0.2 마이그 시점에)
- 프로젝트 도메인의 `.project-items li.active` 색 확인 및 필요 시 통일
- 메모 List 정렬 옵션, 검색, 태그 등 신규 기능
- 폴더 드래그앤드롭

---

## 검증 체크리스트 (전체 plan 종료 시점)

스펙의 "성공 기준" 10개 항목을 모두 시연:

- [ ] 2열 레이아웃 (사이드바 + 메인), 가운데 280px 패널 없음
- [ ] 페이지 진입 직후 빈 상태(또는 모든 메모 List)
- [ ] 폴더 클릭 → List + 라벨/카운트
- [ ] 메모 클릭 → Editor 전환, 사이드바·폴더 선택 유지
- [ ] `← {라벨}` / `ESC` → List 복귀
- [ ] 사이드바 `+ 새 메모` → 현재 폴더에 생성, 곧바로 Editor
- [ ] List 헤더 `[+]` → 동일
- [ ] selected/active 가 모두 옅은 회색
- [ ] `+ 새 메모` 등 의도된 검정은 유지
- [ ] TODO/캘린더/프로젝트 도메인 시각 회귀 없음
