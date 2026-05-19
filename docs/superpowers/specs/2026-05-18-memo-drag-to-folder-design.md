# 메모 → 폴더 드래그&드롭 (spec)

- 작성일: 2026-05-18
- 도메인: `memo`
- 영향 범위: 프론트엔드만 (Tauri/Rust CLI 변경 0건)

## 문제

현재 이미 만들어진 메모를 다른 폴더로 옮기는 UI가 없다. 메모를 만들 때 `scope === "folder"` 이면 그 폴더에 들어가고, 그 외엔 폴더 없는 메모가 된다. 만든 뒤에는 폴더를 바꿀 수 없다.

## 목표

macOS Notes 와 동일한 인터랙션:

- 메모 목록의 row 를 드래그하면 반투명 카드 한 장이 커서를 따라다닌다.
- 좌측 사이드바의 폴더 row 위에 hover 하면 그 row 가 하이라이트된다.
- drop 하면 메모의 `folder_id` 가 그 폴더로 바뀐다.

## 비목표 (YAGNI)

- "모든 메모" / "최근 삭제" 같은 시스템 스코프로의 drop. (drop 타깃은 **사용자 폴더만**.)
- 폴더 ↔ 폴더 드래그 정렬·재배치.
- 다중 선택 후 한꺼번에 드래그.
- 자동 스크롤 (사이드바가 짧다는 1인 사용자 가정).
- 메모 목록 내부 정렬 변경.

## 백엔드

변경 없음. 이미 구현되어 있음:

- `memoApi.update(id, { folder_id: number | null })` → `memo_update` 커맨드.
- `UpdateMemoPatch.folder_id`: `undefined` = 변경 없음 / `number` = 그 폴더로 / `null` = 루트로.

## 프론트엔드 변경

### 컴포넌트별 책임

#### `MemoList.tsx` — 드래그 소스

- `memo-list-row` 버튼에 `draggable={true}` (단, `props.trashMode === true` 일 때는 `false`).
- 새 prop:
  - `onMemoDragStart: (memoId: number, currentFolderId: number | null) => void`
  - `onMemoDragEnd: () => void`
- `onDragStart(e, m)`:
  1. `e.dataTransfer.setData("application/x-memo-id", String(m.id))`
  2. `e.dataTransfer.effectAllowed = "move"`
  3. ghost 카드 element (아래 §드래그 ghost) 를 만들어 `document.body` 에 off-screen append 후 `setDragImage(ghost, 20, 20)` 호출. ref 에 들고 있다가 `onDragEnd` 에서 remove.
  4. `props.onMemoDragStart(m.id, m.folder_id)` 호출.
- `onDragEnd`: ghost 정리 + `props.onMemoDragEnd()`.

#### `FolderTree.tsx` — 드롭 타깃

- 새 prop:
  - `draggedMemo: { id: number; folderId: number | null } | null`
  - `onDropMemoToFolder: (memoId: number, folderId: number) => void`
- `FolderNode` 내부:
  - 로컬 state `isDropHover: boolean`.
  - drop 가능 조건: `draggedMemo !== null && draggedMemo.folderId !== node.id`.
  - `onDragOver(e)`: drop 가능하면 `e.preventDefault()` + `e.dataTransfer.dropEffect = "move"` + `setIsDropHover(true)`. drop 불가하면 `preventDefault` 호출 안 함 → 브라우저가 자동으로 not-allowed 처리.
  - `onDragLeave`: `setIsDropHover(false)`.
  - `onDrop(e)`: `e.preventDefault()` → `memoId = Number(e.dataTransfer.getData("application/x-memo-id"))` → `props.onDropMemoToFolder(memoId, node.id)` → `setIsDropHover(false)`.
- "모든 메모" / "최근 삭제" / "+ 새 메모" 버튼: drop 핸들러 안 붙임. (자동으로 drop 거부.)
- 시각 피드백: `isDropHover` 일 때 row 에 `.memo-folder-row--drop-target` 클래스 부여 → 배경 하이라이트. 색은 sidebar 배경(#fff) 대비 한 단계 진한 토큰 (`#e4e4e7` 라인). selected 와 시각적으로 구분되어야 함 — `--color-primary-soft` 보다 더 진한 톤. LESSON 2026-05-18(토큰 대비) 적용: 실제 dev 띄워서 보이는지 확인.

#### `MemoPage.tsx` — 오케스트레이션

- 새 state: `const [draggedMemo, setDraggedMemo] = useState<{ id: number; folderId: number | null } | null>(null);`
- 새 handler:
  ```ts
  const handleDropMemoToFolder = useCallback(
    async (memoId: number, targetFolderId: number) => {
      try {
        // 드래그한 메모가 현재 편집 중이면 debounce 저장을 먼저 flush.
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
- `MemoList` 에 `onMemoDragStart={(id, fid) => setDraggedMemo({ id, folderId: fid })}` / `onMemoDragEnd={() => setDraggedMemo(null)}` 전달.
- `FolderTree` 에 `draggedMemo={draggedMemo}` / `onDropMemoToFolder={handleDropMemoToFolder}` 전달.

### 드래그 ghost (반투명 카드)

`dragstart` 시점에 다음 DOM 을 생성해 `document.body` 에 append 하고 `setDragImage` 의 인자로 넘긴다. `dragend` 에서 `remove()`.

- 크기: `width: 220px; min-height: 56px;`
- 스타일: `border-radius: 10px; background: rgba(255,255,255,0.92); box-shadow: 0 8px 24px rgba(0,0,0,0.18); padding: 10px 14px; font: 13px/1.4 system-ui;`
- 내용: 메모 제목 (또는 `firstLineAsTitle(body)` fallback). 1줄, ellipsis.
- 위치: `position: absolute; top: -1000px; left: -1000px;` (off-screen). `setDragImage` 가 호출되는 시점에만 브라우저가 스냅샷.
- 회전: `transform: rotate(-2deg)` 는 OS/브라우저에 따라 무시될 수 있다. 그림자·라운드만으로도 카드 느낌은 충분.

`setDragImage` 의 결과는 dragstart 시점의 **정적 비트맵**이라서, 진짜 "회전·바운싱" 같은 motion 은 표현되지 않는다. 사용자 요구의 핵심(반투명/카드 모양/그림자/약간 기울임)은 정적으로도 충족.

### CSS 추가 (`app/src/styles/global.css` 의 메모 사이드바 섹션)

- `.memo-folder-row.memo-folder-row--drop-target`: 배경 강조 (selected 와 구분되는 톤).
- (선택) `.memo-list-row[draggable="true"] { cursor: grab; }`, `:active { cursor: grabbing; }`.

## 데이터 흐름

```
[MemoList row]
  → dragstart
  → MemoPage.setDraggedMemo({ id, folderId })

[FolderTree.FolderNode]
  → dragover (drop 가능 조건 통과)
  → e.preventDefault() + isDropHover=true

  → drop
  → MemoPage.handleDropMemoToFolder(memoId, folderId)
    → (필요시) flushPendingSave()
    → memoApi.update(memoId, { folder_id: targetFolderId })
    → refreshMemos()

[어디서든]
  → dragend
  → MemoPage.setDraggedMemo(null)
  → ghost element remove
```

## Edge cases / 결정

| 케이스 | 동작 |
|---|---|
| 같은 폴더(`folderId === node.id`)에 drop | hover 하이라이트 안 뜸, `preventDefault` 호출 안 함 → 브라우저가 not-allowed 자동 처리. no-op. |
| "모든 메모"/"최근 삭제"에 drop 시도 | drop 핸들러 없음 → 거부. |
| 휴지통 모드(`trashMode === true`) row 드래그 | `draggable={false}` 라 시작 자체 안 됨. |
| 메모 편집 중(=목록 안 보임) | 목록을 닫고 row 가 사라진 상태이므로 드래그 source 자체가 없음. 이동하려면 뒤로가기 후. |
| 드래그 중 메모 자동저장 timer fire | `handleDropMemoToFolder` 가 `selectedId === memoId` 일 때 `flushPendingSave()` 를 먼저 부르므로 입력 손실 없음. LESSON 2026-05-18 적용. |
| drop 후 API 실패 | `setError(String(e))` 로 토스트 표시. 기존 패턴 유지. |

## 수동 검증 시나리오

자동 테스트는 메모 도메인에 부재 → 수동.

1. 두 폴더 A, B 가 있고 메모 m 이 A 에 있을 때, m 을 B 로 드래그. drop 후 B 를 클릭하면 m 이 거기 있음. A 에는 없음.
2. m 을 A(같은 폴더)에 드래그. hover 하이라이트 안 뜸. drop 도 효과 없음.
3. "모든 메모" / "최근 삭제" 에 drag-over. 하이라이트 안 뜸.
4. 휴지통 모드에서 row 를 잡으려고 시도. 드래그 자체가 안 시작됨.
5. 메모 편집 중 → 뒤로가기 → 곧바로 목록에서 다른 폴더로 drag&drop. 입력 손실 없음 (debounce flush 동작).
6. 드래그 중 ghost 카드가 커서 옆에 보임. 반투명 + 그림자 카드 모양. 메모 제목 표시.
7. drop 직후 sidebar 의 폴더 row hover 가 자동으로 해제됨.

## 파일별 변경 요약

| 파일 | 변경 |
|---|---|
| `app/src/features/memo/MemoList.tsx` | `draggable`, `onDragStart`, `onDragEnd` + 새 props 2개. |
| `app/src/features/memo/FolderTree.tsx` | `FolderNode` 에 dragover/leave/drop, 로컬 hover state, 새 props 2개. |
| `app/src/features/memo/MemoPage.tsx` | `draggedMemo` state + `handleDropMemoToFolder` + props 전달. |
| `app/src/styles/global.css` | `.memo-folder-row--drop-target` 한 블록, 메모 row `cursor: grab` (선택). |

## 추적

- LESSON 2026-05-18(debounce flush)을 새 진입점(`handleDropMemoToFolder` 의 `selectedId === memoId` 분기)에 추가 적용.
- LESSON 2026-05-18(토큰 대비)을 drop hover 배경색 결정에 적용: 실제 `pnpm tauri dev` 로 띄워 sidebar 배경(#fff) 대비 보이는지 확인.
