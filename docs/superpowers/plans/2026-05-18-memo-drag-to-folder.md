# 메모 → 폴더 드래그&드롭 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이미 만들어진 메모를 좌측 사이드바의 폴더 row 로 드래그&드롭해서 다른 폴더로 옮기는 인터랙션을 추가한다. macOS Notes 톤의 반투명 카드 ghost 와 row 하이라이트 피드백 포함.

**Architecture:** HTML5 native DnD (draggable + setDragImage + dragover/drop). 백엔드 변경 없음 — 기존 `memoApi.update(id, { folder_id })` 재사용. 상태는 `MemoPage` 의 `draggedMemo` 가 들고, `MemoList`(소스) ↔ `MemoPage`(허브) ↔ `FolderTree`(타깃) 가 props 로만 통신.

**Tech Stack:** React 18, TypeScript, Vite, Tauri v2. 기존 메모 도메인 코드. 테스트는 vitest 가 있으나 D&D 상호작용은 수동 시나리오 검증으로 갈음.

---

## Spec

`docs/superpowers/specs/2026-05-18-memo-drag-to-folder-design.md`

## File Structure

| 파일 | 변경 종류 |
|---|---|
| `app/src/features/memo/MemoList.tsx` | 수정 — row 에 draggable + dragstart/end + 새 props 2개 |
| `app/src/features/memo/FolderTree.tsx` | 수정 — FolderNode 에 dragover/leave/drop + hover state + 새 props 2개 |
| `app/src/features/memo/MemoPage.tsx` | 수정 — draggedMemo state + handleDropMemoToFolder + props 전달 |
| `app/src/styles/global.css` | 수정 — `.memo-folder-row--drop-target` 한 블록 + `.memo-list-row` 의 `cursor: grab` |

새 파일 없음. 새 모듈/추상화 없음. 기존 컴포넌트 파일 4개만 수정.

## Verification Strategy

D&D 자동 테스트는 jsdom 한계로 ROI 낮음. 따라서 각 Task 의 검증은 다음 두 가지를 사용:

1. **`pnpm typecheck`** — 모든 prop 변경·새 타입이 컴파일 통과.
2. **수동 시나리오** — `pnpm tauri dev` 띄워서 spec §"수동 검증 시나리오" 의 1~7 케이스 모두 확인.

각 Task 끝의 검증 단계에 어떤 명령·시나리오를 돌릴지 명시.

---

### Task 1: MemoList — drag source

`memo-list-row` 버튼을 draggable 로 만들고, dragstart 에서 ghost 카드를 만들어 `setDragImage` 로 연결, dataTransfer 에 memo id 를 실어 보낸다. dragend 에서 ghost 정리. 휴지통 모드에서는 draggable 끔.

**Files:**
- Modify: `app/src/features/memo/MemoList.tsx`

- [ ] **Step 1: `MemoListProps` 에 새 prop 2개 추가**

`app/src/features/memo/MemoList.tsx` 상단 `MemoListProps` 인터페이스 끝에 추가:

```ts
/** 메모 row 를 드래그 시작했을 때 — MemoPage 가 draggedMemo state 를 set 한다. */
onMemoDragStart: (memoId: number, currentFolderId: number | null) => void;
/** dragend (drop 성공/실패 관계 없이). MemoPage 가 draggedMemo 를 null 로 클리어. */
onMemoDragEnd: () => void;
```

- [ ] **Step 2: ghost 카드 helper 함수를 파일 하단에 추가**

`app/src/features/memo/MemoList.tsx` 의 마지막 (default export 함수 위) 에 추가:

```ts
function createDragGhost(title: string): HTMLElement {
  const el = document.createElement("div");
  el.textContent = title;
  el.style.cssText = [
    "position:absolute",
    "top:-1000px",
    "left:-1000px",
    "width:220px",
    "min-height:56px",
    "padding:10px 14px",
    "border-radius:10px",
    "background:rgba(255,255,255,0.92)",
    "box-shadow:0 8px 24px rgba(0,0,0,0.18)",
    "font:13px/1.4 system-ui",
    "color:#0f0f0f",
    "white-space:nowrap",
    "overflow:hidden",
    "text-overflow:ellipsis",
    "transform:rotate(-2deg)",
    "pointer-events:none",
  ].join(";");
  document.body.appendChild(el);
  return el;
}
```

- [ ] **Step 3: row 에 draggable + dragstart/dragend 핸들러 부착**

`app/src/features/memo/MemoList.tsx` 안의 `props.memos.map((m) => (...))` 부분의 `<button key={m.id} ... className="memo-list-row" onClick={...}>` 를 다음과 같이 바꾼다 (휴지통 모드에서는 draggable=false):

```tsx
<button
  key={m.id}
  type="button"
  className="memo-list-row"
  onClick={() => props.onSelect(m.id)}
  draggable={!props.trashMode}
  onDragStart={(e) => {
    if (props.trashMode) return;
    e.dataTransfer.setData("application/x-memo-id", String(m.id));
    e.dataTransfer.effectAllowed = "move";
    const ghost = createDragGhost(displayTitle(m));
    e.dataTransfer.setDragImage(ghost, 20, 20);
    // setDragImage 가 비트맵 스냅샷을 찍은 직후 ghost 를 제거해도 되지만,
    // 일부 브라우저에서 즉시 제거 시 이미지가 비어버리는 케이스가 보고됨 →
    // dragend 까지 두고, 그 사이 화면엔 off-screen 이라 안 보임.
    (e.currentTarget as HTMLButtonElement).dataset.dragGhostMounted = "1";
    // ghost element 참조를 closure 가 아니라 dataset 으로 들고 가서
    // dragend 에서 정리. 여러 row 가 동시에 드래그될 수 없으므로 안전.
    (window as unknown as { __memoDragGhost?: HTMLElement }).__memoDragGhost = ghost;
    props.onMemoDragStart(m.id, m.folder_id);
  }}
  onDragEnd={() => {
    const g = (window as unknown as { __memoDragGhost?: HTMLElement }).__memoDragGhost;
    if (g) {
      g.remove();
      (window as unknown as { __memoDragGhost?: HTMLElement }).__memoDragGhost = undefined;
    }
    props.onMemoDragEnd();
  }}
>
```

(나머지 자식 노드 `<div className="memo-list-row-content">...</div>` 와 `<div className="memo-list-row-actions ...">...</div>` 는 그대로 둔다.)

- [ ] **Step 4: typecheck**

Run: `cd app && pnpm typecheck`
Expected: ts2322 or "Property 'onMemoDragStart' is missing in type" 같은 에러가 **나와야 함** (아직 MemoPage 가 안 넘김). 이 에러는 다음 Task 에서 해소.

다른 에러가 있으면 — `MemoListProps` 추가나 핸들러 코드 자체의 문제 — 고치고 다시 돌릴 것.

- [ ] **Step 5: 커밋**

```bash
git add app/src/features/memo/MemoList.tsx
git commit -m "feat(memo): MemoList row 에 draggable + ghost 카드 setDragImage"
```

---

### Task 2: FolderTree — drop target

`FolderNode` 가 dragover 에서 hover state 를 켜고 drop 에서 부모 콜백을 부른다. drop 가능 조건은 "draggedMemo 가 존재하고 그 메모의 현재 폴더가 이 노드가 아닐 때". 시스템 row("모든 메모", "최근 삭제", "+ 새 메모", 폴더 추가 input) 에는 핸들러 안 붙임 → 자동 거부.

**Files:**
- Modify: `app/src/features/memo/FolderTree.tsx`

- [ ] **Step 1: `FolderTreeProps` 와 `FolderNodeProps` 에 새 prop 추가**

`app/src/features/memo/FolderTree.tsx` 의 `FolderTreeProps` 에 추가:

```ts
draggedMemo: { id: number; folderId: number | null } | null;
onDropMemoToFolder: (memoId: number, folderId: number) => void;
```

`FolderNodeProps` 에 추가:

```ts
draggedMemo: { id: number; folderId: number | null } | null;
onDropMemoToFolder: (memoId: number, folderId: number) => void;
```

- [ ] **Step 2: 상위 컴포넌트가 새 prop 을 FolderNode 로 전달하도록 수정**

`app/src/features/memo/FolderTree.tsx` 안 `tree.map((node) => (<FolderNode key={node.id} ... />))` 의 props 목록에 추가:

```tsx
<FolderNode
  key={node.id}
  node={node}
  depth={0}
  selectedFolderId={
    props.selectedScope === "folder" ? props.selectedFolderId : null
  }
  onSelect={(id) => props.onSelect("folder", id)}
  addingUnder={addingUnder}
  onStartAdd={(parentId) => setAddingUnder(parentId)}
  onCommitAdd={(parentId, name) => {
    props.onAddFolder(parentId, name);
    setAddingUnder(undefined);
  }}
  onCancelAdd={() => setAddingUnder(undefined)}
  onRename={props.onRenameFolder}
  onDelete={props.onDeleteFolder}
  draggedMemo={props.draggedMemo}
  onDropMemoToFolder={props.onDropMemoToFolder}
/>
```

그리고 `FolderNode` 안에서 자식 노드를 재귀 렌더링하는 `{open && node.children.map((child) => (<FolderNode ... />))}` 부분에도 같은 두 prop 을 추가로 전달한다:

```tsx
{open &&
  node.children.map((child) => (
    <FolderNode
      key={child.id}
      node={child}
      depth={depth + 1}
      selectedFolderId={selectedFolderId}
      addingUnder={addingUnder}
      onSelect={onSelect}
      onStartAdd={onStartAdd}
      onCommitAdd={onCommitAdd}
      onCancelAdd={onCancelAdd}
      onRename={onRename}
      onDelete={onDelete}
      draggedMemo={draggedMemo}
      onDropMemoToFolder={onDropMemoToFolder}
    />
  ))}
```

`FolderNode` 함수 시그니처(destructured props) 에도 두 새 키 추가.

- [ ] **Step 3: `FolderNode` 안에 drop hover state 와 핸들러 추가**

`FolderNode` 함수 본문 안, 기존 `const [open, setOpen] = useState(true);` 줄 아래에 추가:

```ts
const [isDropHover, setIsDropHover] = useState(false);
const canDrop =
  draggedMemo !== null && draggedMemo.folderId !== node.id;
```

그리고 `<div className={\`memo-sidebar-row memo-folder-row ${isSelected ? "selected" : ""}\`} style={...}>` 부분을 다음과 같이 바꾼다 (className 에 drop-target 추가, drag 핸들러 3개 부착):

```tsx
<div
  className={`memo-sidebar-row memo-folder-row ${isSelected ? "selected" : ""} ${
    isDropHover ? "memo-folder-row--drop-target" : ""
  }`}
  style={{ paddingLeft: `${8 + depth * 12}px` }}
  onDragOver={(e) => {
    if (!canDrop) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!isDropHover) setIsDropHover(true);
  }}
  onDragLeave={() => {
    if (isDropHover) setIsDropHover(false);
  }}
  onDrop={(e) => {
    if (!canDrop) return;
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/x-memo-id");
    setIsDropHover(false);
    if (raw === "") return;
    const memoId = Number(raw);
    if (!Number.isFinite(memoId)) return;
    onDropMemoToFolder(memoId, node.id);
  }}
>
```

(이후 자식들 `{node.children.length > 0 ? ... }`, `<span className="memo-folder-icon">...</span>`, rename input/이름 버튼, actions 영역은 그대로.)

- [ ] **Step 4: typecheck**

Run: `cd app && pnpm typecheck`
Expected: `FolderTreeProps` 의 새 prop 2개를 MemoPage 가 안 넘겨서 에러가 **나와야 함**. 다음 Task 에서 해소.

다른 에러(잘못된 destructure, 누락된 핸들러 등)가 있으면 코드 본문 수정 후 다시.

- [ ] **Step 5: 커밋**

```bash
git add app/src/features/memo/FolderTree.tsx
git commit -m "feat(memo): FolderNode 에 dragover/drop 핸들러 + hover state"
```

---

### Task 3: MemoPage — 오케스트레이션 + handleDropMemoToFolder

`draggedMemo` state 를 추가하고, drop handler 에서 (필요시) flushPendingSave 후 `memoApi.update` 로 folder_id 패치, refreshMemos 호출. 그리고 자식 두 컴포넌트에 새 prop 들을 묶어 전달.

**Files:**
- Modify: `app/src/features/memo/MemoPage.tsx`

- [ ] **Step 1: import 와 새 state 추가**

`app/src/features/memo/MemoPage.tsx` 의 기존 `const [error, setError] = useState<string | null>(null);` 아래에 추가:

```ts
const [draggedMemo, setDraggedMemo] = useState<{
  id: number;
  folderId: number | null;
} | null>(null);
```

- [ ] **Step 2: `handleDropMemoToFolder` 콜백 추가**

기존 `const handleTogglePin = useCallback(...)` 근처 (다른 memo 액션 핸들러들과 함께) 에 추가:

```ts
const handleDropMemoToFolder = useCallback(
  async (memoId: number, targetFolderId: number) => {
    try {
      // 같은 메모를 편집 중이면 debounce 저장을 먼저 flush.
      // LESSON 2026-05-18 — debounce save 진입점 누락 방지.
      if (selectedId === memoId) {
        await flushPendingSave();
      }
      await memoApi.update(memoId, { folder_id: targetFolderId });
      await refreshMemos();
    } catch (e) {
      setError(String(e));
    }
  },
  [selectedId, flushPendingSave, refreshMemos],
);
```

- [ ] **Step 3: 자식 컴포넌트에 새 prop 전달**

`<FolderTree ... />` 의 props 끝에 추가:

```tsx
draggedMemo={draggedMemo}
onDropMemoToFolder={handleDropMemoToFolder}
```

`<MemoList ... />` (조건 분기 `selectedMemo === null` 아래) 의 props 끝에 추가:

```tsx
onMemoDragStart={(id, fid) => setDraggedMemo({ id, folderId: fid })}
onMemoDragEnd={() => setDraggedMemo(null)}
```

- [ ] **Step 4: typecheck**

Run: `cd app && pnpm typecheck`
Expected: 0 errors. (앞 Task 들의 prop 들이 이제 모두 연결됨.)

에러가 있으면 prop 이름 오타·타입 mismatch 가능. 메시지 보고 fix.

- [ ] **Step 5: 커밋**

```bash
git add app/src/features/memo/MemoPage.tsx
git commit -m "feat(memo): handleDropMemoToFolder + draggedMemo 상태 + 자식 prop 연결"
```

---

### Task 4: CSS — drop hover 시각 피드백 + cursor grab

drop-target 클래스 한 블록과 list row 의 grab cursor 한 줄.

**Files:**
- Modify: `app/src/styles/global.css`

- [ ] **Step 1: drop-target 스타일 추가**

`app/src/styles/global.css` 의 `.memo-folder-row.selected .memo-sidebar-icon-btn:hover { ... }` 블록(라인 1699 부근, "Folder tree" 섹션 끝) 바로 뒤에 추가:

```css
.memo-folder-row--drop-target {
  background: rgba(15, 15, 15, 0.06);
  box-shadow: inset 0 0 0 1.5px var(--color-ink);
}
.memo-folder-row--drop-target.selected {
  background: rgba(15, 15, 15, 0.06);
}
```

(selected + drop-target 가 겹치는 경우는 spec 상 발생 안 함 — drop-target 은 "다른 폴더로 옮기는 중" 상태라 selected 일 수 없음. 두 번째 룰은 안전망.)

- [ ] **Step 2: list row 에 grab cursor**

같은 파일에서 `.memo-list-row { ... }` 블록(라인 1786 부근) 바로 뒤에 추가:

```css
.memo-list-row[draggable="true"] {
  cursor: grab;
}
.memo-list-row[draggable="true"]:active {
  cursor: grabbing;
}
```

- [ ] **Step 3: 수동 시각 검증**

Run: `cd app && pnpm tauri dev`
Expected:
- 메모 목록의 row 위에서 cursor 가 grab(손) 으로 바뀜.
- 메모를 잡아서 다른 폴더 row 위로 가져가면 그 폴더 row 가 옅은 회색 + 검정 1.5px 테두리로 표시. **selected (#e4e4e7 채움) 과 시각적으로 명확히 구분되어야 함.**

만약 안 보이거나 selected 와 헷갈리면 (LESSON 2026-05-18 — 토큰 contrast) 다음 중 하나로 조정:
- background 알파 0.06 → 0.10 으로 올림.
- inset shadow 두께 1.5px → 2px.

조정 후 다시 dev 띄워서 확인.

- [ ] **Step 4: 커밋**

```bash
git add app/src/styles/global.css
git commit -m "feat(memo): drop hover 하이라이트 + memo-list-row grab cursor"
```

---

### Task 5: end-to-end 수동 검증 + 회귀 확인

spec 의 수동 검증 시나리오 7개 전부 실행. 회귀 의심되는 다른 인터랙션도 같이 본다.

**Files:**
- 없음 (검증만)

- [ ] **Step 1: 앱 띄우기**

Run: `cd app && pnpm tauri dev`

- [ ] **Step 2: 시나리오 1 — 다른 폴더로 이동**

준비: 폴더 A, B 를 만들고 A 안에 메모 m 을 하나 만든다.
실행: A 폴더 선택 → 메모 목록에서 m 을 잡아 사이드바의 B 위로 드래그 → drop.
Expected:
- 드래그 중 ghost 카드(반투명, 그림자, 약간 기울임) 가 커서 옆에 따라옴.
- B row 가 drop hover 스타일로 강조됨.
- drop 후 A 의 메모 목록에서 m 이 사라지고, B 클릭 시 m 이 있음.

- [ ] **Step 3: 시나리오 2 — 같은 폴더로 drop (no-op)**

실행: A 안의 메모 m 을 A row 위로 드래그.
Expected: A row 가 drop hover 로 강조 **안 됨** (canDrop=false). drop 해도 아무 변화 없음 (refreshMemos 호출 안 됨).

- [ ] **Step 4: 시나리오 3 — 시스템 row 에 drop 시도**

실행: 메모를 "모든 메모" / "최근 삭제" row 위로 드래그.
Expected: 두 row 모두 drop hover 강조 안 됨. drop 거부.

- [ ] **Step 5: 시나리오 4 — 휴지통 모드에서 drag 불가**

실행: "최근 삭제" 선택 → 휴지통 메모 row 를 잡으려 시도.
Expected: 드래그 자체가 시작 안 됨 (draggable=false).

- [ ] **Step 6: 시나리오 5 — debounce flush (입력 손실 없음)**

준비: 메모 m 을 폴더 A 에서 열어 본문에 텍스트 입력.
실행: 디바운스(500ms) 가 fire 되기 전 즉시 ← 뒤로 → 목록에서 m 을 다른 폴더 B 로 드래그&드롭.
Expected: B 폴더의 m 에 방금 친 텍스트가 그대로 남아 있음. LESSON 2026-05-18 적용 확인.

- [ ] **Step 7: 시나리오 6 — ghost 카드 시각**

위 시나리오들에서 ghost 카드가:
- 반투명 흰 배경.
- 둥근 모서리.
- 검은 그림자.
- 메모 제목이 한 줄로 표시.
중 어느 하나라도 빠지면 Task 1 의 ghost helper 의 inline style 을 살펴 수정.

- [ ] **Step 8: 시나리오 7 — drop 후 hover 자동 해제**

실행: drop 직후 사이드바 폴더 row 가 잔류 hover 상태로 남는지 본다.
Expected: drop 즉시 hover 강조 해제 (onDrop 안에서 `setIsDropHover(false)` 호출).

- [ ] **Step 9: 회귀 점검**

다음 기존 동작이 영향받지 않았는지 확인:
- 폴더 row 클릭 → 선택 (변함 없어야 함).
- 메모 row 클릭 → 에디터 열림.
- 메모 row 의 핀/삭제 액션 버튼 클릭 (드래그와 별개).
- 폴더 이름 더블클릭으로 rename.
- 폴더 추가/삭제 +/×.

- [ ] **Step 10: 최종 typecheck + test**

Run: `cd app && pnpm typecheck && pnpm test`
Expected: 둘 다 0 에러 / 통과. (메모 도메인의 기존 `useSaveIndicator.test.ts` 는 이번 변경과 무관하지만 회귀가 없는지 봄.)

- [ ] **Step 11: (선택) Lesson 추가 여부 판단**

시각 토큰 조정이 한 번에 안 끝나서 dev 띄워 여러 번 만지작거렸다면, LESSON 2026-05-18(토큰 contrast) 의 반복 횟수를 +1 하거나 강화 (예: "drop hover 같이 selected 와 비슷한 색 영역은 background 만으로 부족 — inset shadow / border 같이 형태 단서를 동반").

LESSON 파일 수정 후 마지막 커밋과 함께 또는 별도로 커밋:

```bash
git add .claude/LESSONS.md
git commit -m "lesson: 토큰 contrast — selected 와 drop-target 같은 인접 상태는 형태 단서 동반"
```

---

## Self-Review

### Spec coverage

| Spec 항목 | 담당 Task |
|---|---|
| 백엔드 변경 없음 | n/a (확인만) |
| MemoList draggable + setDragImage + ghost | Task 1 |
| 휴지통 모드 draggable 끔 | Task 1 (`draggable={!props.trashMode}`) |
| FolderNode dragover/leave/drop + isDropHover | Task 2 |
| canDrop = `draggedMemo.folderId !== node.id` | Task 2 Step 3 |
| 시스템 row(모든 메모/최근 삭제) drop 거부 | n/a — 핸들러 안 붙음, 자동 거부 |
| MemoPage `draggedMemo` state | Task 3 Step 1 |
| `handleDropMemoToFolder` + flushPendingSave 적용 | Task 3 Step 2 |
| Ghost 카드 시각(반투명/그림자/라운드/기울임/제목) | Task 1 Step 2 |
| drop-target CSS + selected 와 구분 | Task 4 Step 1 |
| list row grab cursor | Task 4 Step 2 |
| 수동 검증 시나리오 1~7 | Task 5 Step 2~8 |
| LESSON 2026-05-18 (debounce flush) | Task 3 Step 2 |
| LESSON 2026-05-18 (토큰 contrast) | Task 4 Step 3 + Task 5 Step 11 |

빠진 항목 없음.

### Placeholder scan

- "TBD", "TODO", "implement later" — 없음.
- "Add appropriate error handling" 류 — 없음. setError 패턴 명시.
- "Write tests for the above" without code — 없음. 자동 테스트는 의도적으로 제외하고 수동 시나리오로 대체했음을 §Verification Strategy 에서 명시.
- "Similar to Task N" — 없음.
- 코드 없는 step — 없음.

### Type consistency

- `onMemoDragStart(memoId: number, currentFolderId: number | null)` 시그니처가 MemoListProps(Task 1) 와 MemoPage 전달(Task 3 Step 3) 에서 일치.
- `onMemoDragEnd()` 동일.
- `draggedMemo: { id: number; folderId: number | null } | null` 이 FolderTreeProps / FolderNodeProps / MemoPage state 에서 동일 shape.
- `onDropMemoToFolder(memoId: number, folderId: number)` 시그니처가 FolderTreeProps / FolderNodeProps / MemoPage handler 에서 동일.
- dataTransfer key `"application/x-memo-id"` 가 dragstart(Task 1) 와 drop(Task 2 Step 3) 양쪽에서 동일 문자열.

일관성 OK.
