# 메모 에디터 Notes 스타일 심화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TipTap 메모 에디터에 list/task-list/code-block 노드, markdown 단축어·단축키, placeholder, 저장 인디케이터를 추가하고, 자체 markdown 직렬화를 `tiptap-markdown` 라이브러리로 교체한다. ADR-0011(검정 ink는 CTA 전용) 위반인 툴바 active 색도 정리한다.

**Architecture:** 에디터 기반은 TipTap v3 유지. StarterKit에서 비활성화돼 있던 list/codeBlock 을 활성화하고 별도 extension 3종(`TaskList`, `TaskItem`, `Placeholder`)과 직렬화 extension 1종(`tiptap-markdown`)을 추가한다. 저장 인디케이터는 `MemoPage` 의 saveState/lastSavedAt 두 state와 `MemoEditor` 우측 렌더 영역으로 구성. DB·Rust CLI·schema 변경 없음.

**Tech Stack:** TypeScript / React 18 / TipTap v3 (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`) / Vite / Vitest 2 / pnpm / Tauri v2

**Spec:** `docs/design-drafts/2026-05-18-memo-editor-notes-style-design.md`

---

## 파일 책임 맵

| 파일 | 변경 | 책임 |
|---|---|---|
| `app/package.json` | 의존성 4종 추가 | tiptap-markdown, extension-task-list, extension-task-item, extension-placeholder |
| `app/src/features/memo/markdown.ts` | 슬림화 | `firstLineAsTitle` 만 남기고 자체 직렬화 함수 전부 삭제 |
| `app/src/features/memo/useSaveIndicator.ts` | **신규** | saveState 머신 + relativeTime 헬퍼 (단위 테스트 대상) |
| `app/src/features/memo/hooks/__tests__/useSaveIndicator.test.ts` | **신규** | useSaveIndicator hook 단위 테스트 |
| `app/src/features/memo/MemoEditor.tsx` | 큰 폭 수정 | extensions 확장(list/task/code/placeholder/markdown), 툴바 버튼 추가, 저장 인디케이터 슬롯, ¶ → "본문" |
| `app/src/features/memo/MemoPage.tsx` | 부분 수정 | `markdownToDoc`/`docToMarkdown` import 제거, useSaveIndicator 통합, scheduleSave/flushPendingSave 전이 호출 |
| `app/src/styles/global.css` | 부분 수정 | 툴바 active 색(ADR-0011), list/taskList/codeBlock/placeholder/저장 인디케이터 스타일 |
| `docs/DESIGN.md` | 부분 수정 | 메모 에디터 활성 노드 11종, 단축키 표 |
| `docs/SOURCE_MAP.md` | 부분 수정 | `markdown.ts` 책임 축소(직렬화 → 타이틀 추출만) |

---

## Task 1: 의존성 설치 + tiptap-markdown TipTap v3 호환 확인

**Files:**
- Modify: `app/package.json`
- Modify: `app/pnpm-lock.yaml` (자동)

배경: `tiptap-markdown` 은 TipTap v2 시절 패키지. v3 지원 여부를 가장 먼저 확인하고, 안 되면 fallback 결정.

- [ ] **Step 1: 의존성 추가**

```bash
cd /Users/happyhsryu/dev/personal/workspace-hub/app
pnpm add tiptap-markdown @tiptap/extension-task-list @tiptap/extension-task-item @tiptap/extension-placeholder
```

- [ ] **Step 2: TipTap v3 호환 빠른 검증**

`app/src/features/memo/_compat-check.ts` 임시 파일을 만들어 import + 빌드:

```ts
import { Markdown } from "tiptap-markdown";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";

// peer dep 확인용 — 런타임 동작은 추후 task 에서 검증
export const _check = { Markdown, TaskList, TaskItem, Placeholder };
```

Run: `cd app && pnpm typecheck`
Expected: PASS. 만약 `Markdown` export 가 없거나 peer dep 충돌 에러면 Step 3 분기 진입.

- [ ] **Step 3: (조건부) tiptap-markdown 가 TipTap v3 호환 안 될 때 fallback 결정**

만약 Step 2 실패 시:
- Option A: `tiptap-markdown` fork (v3 지원 PR 머지된 fork) 검토 — npm 에서 `tiptap-markdown@v3-compatible` 같은 태그
- Option B: `prosemirror-markdown` 직접 사용 + TipTap doc ↔ ProseMirror node 변환 (`editor.schema.nodeFromJSON` 등)

본 plan 은 tiptap-markdown 정상 import 가정. 실패 시 사용자에게 보고 후 별도 결정.

- [ ] **Step 4: `_compat-check.ts` 삭제**

```bash
rm /Users/happyhsryu/dev/personal/workspace-hub/app/src/features/memo/_compat-check.ts
```

- [ ] **Step 5: Commit**

```bash
cd /Users/happyhsryu/dev/personal/workspace-hub
git add app/package.json app/pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(memo): tiptap-markdown / task-list / placeholder 의존성 추가

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `markdown.ts` 슬림화 — `firstLineAsTitle` 만 보존

**Files:**
- Modify: `app/src/features/memo/markdown.ts`

직렬화 책임을 라이브러리에 넘기므로 자체 함수 전부 삭제. `firstLineAsTitle` 는 휴지통 readonly 렌더에서 사용 중이라 보존.

- [ ] **Step 1: 의존 호출처 확인**

```bash
cd /Users/happyhsryu/dev/personal/workspace-hub/app
grep -rn "docToMarkdown\|markdownToDoc\|parseBlock\|parseInline\|inlineToMarkdown\|inlineNodeToMarkdown" src --include='*.ts' --include='*.tsx'
```

Expected: `MemoEditor.tsx` 에서 `docToMarkdown`/`markdownToDoc` import. `MemoPage.tsx` 에서 `firstLineAsTitle` import. 다른 호출 없음 확인.

- [ ] **Step 2: `markdown.ts` 를 다음 내용으로 교체**

```ts
/**
 * 메모 본문 markdown 유틸. 직렬화·역직렬화는 tiptap-markdown 으로 위임함.
 * 이 파일은 markdown 첫 라인에서 타이틀을 추출하는 헬퍼만 보유한다.
 */

/** markdown 본문 첫 줄에서 제목으로 쓸 만한 텍스트를 뽑는다 (`#` 기호·공백 제거). */
export function firstLineAsTitle(md: string): string {
  for (const line of (md ?? "").split("\n")) {
    const trimmed = line.replace(/^#+\s*/, "").trim();
    if (trimmed !== "") return trimmed;
  }
  return "";
}
```

- [ ] **Step 3: typecheck**

Run: `cd app && pnpm typecheck`
Expected: **FAIL** — `MemoEditor.tsx` 가 사라진 `docToMarkdown`/`markdownToDoc` 를 import 하므로. 이는 의도된 빨간불 (Task 3 에서 해결).

- [ ] **Step 4: 커밋 없이 Task 3 로 진행**

이 단계는 빌드가 깨진 상태. 단일 commit 으로 묶어 두 step 을 합치는 게 안전하므로 Task 3 끝에서 합쳐 commit.

---

## Task 3: `MemoEditor` extensions 확장 + markdown 직렬화 교체

**Files:**
- Modify: `app/src/features/memo/MemoEditor.tsx`

활성 노드 5종 → 11종. 직렬화는 `editor.storage.markdown.getMarkdown()`, 역직렬화는 `editor.commands.setContent(markdownString)` 으로 라이브러리에 위임.

- [ ] **Step 1: `MemoEditor.tsx` 의 import 와 useEditor 블록을 다음으로 교체**

기존 1~53행을 아래로 바꿈:

```tsx
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { useEffect, useRef } from "react";

interface MemoEditorProps {
  /** mount 시점·메모 전환 시점에 한 번 doc 에 주입할 markdown.
   *  이후 typing 은 TipTap 내부 상태가 단일 진실 원천이며, onChange 로 외부에 보고만 함. */
  initialMarkdown: string;
  /** typing 추적용 onChange — markdown 문자열. */
  onChange: (markdown: string) => void;
  /** 메모 전환을 감지해 doc 을 다시 로드하기 위한 키. */
  memoId: number | null;
  /** 툴바 우측에 렌더할 저장 상태 표시 (선택). */
  saveIndicator?: React.ReactNode;
}

/**
 * TipTap 기반 WYSIWYG 에디터. 활성 노드: H1~H4, paragraph, bullet/ordered/task list,
 * code block, marks: bold/italic/code. 직렬화는 tiptap-markdown.
 */
export default function MemoEditor({
  initialMarkdown,
  onChange,
  memoId,
  saveIndicator,
}: MemoEditorProps) {
  const memoIdRef = useRef<number | null>(null);
  const initialMarkdownRef = useRef(initialMarkdown);
  initialMarkdownRef.current = initialMarkdown;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        blockquote: false,
        horizontalRule: false,
        strike: false,
        // bulletList / orderedList / listItem / codeBlock 는 기본값(활성) 유지
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: "내용을 입력하세요",
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: "-",
        linkify: false,
        breaks: false,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: initialMarkdown,
    onUpdate: ({ editor: ed }: { editor: Editor }) => {
      const md = ed.storage.markdown.getMarkdown();
      onChange(md);
    },
    editorProps: {
      attributes: {
        class: "memo-editor",
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (memoIdRef.current !== memoId) {
      memoIdRef.current = memoId;
      editor.commands.setContent(initialMarkdownRef.current, {
        emitUpdate: false,
      });
    }
  }, [editor, memoId]);

  if (!editor) return null;
```

- [ ] **Step 2: 툴바 핸들러와 마크업 교체**

기존 `setHeading`/`setParagraph` 정의부터 컴포넌트 끝까지를 아래로 교체:

```tsx
  const setHeading = (level: 1 | 2 | 3 | 4) =>
    editor.chain().focus().toggleHeading({ level }).run();
  const setParagraph = () => editor.chain().focus().setParagraph().run();
  const toggleBullet = () => editor.chain().focus().toggleBulletList().run();
  const toggleOrdered = () => editor.chain().focus().toggleOrderedList().run();
  const toggleTask = () => editor.chain().focus().toggleTaskList().run();
  const toggleCodeBlock = () => editor.chain().focus().toggleCodeBlock().run();

  return (
    <div className="memo-editor-shell">
      <div className="memo-editor-toolbar" role="toolbar" aria-label="formatting">
        <button
          type="button"
          className={editor.isActive("paragraph") ? "active" : ""}
          onClick={setParagraph}
          title="본문 (⌘⌥0)"
        >
          본문
        </button>
        {([1, 2, 3, 4] as const).map((l) => (
          <button
            key={l}
            type="button"
            className={editor.isActive("heading", { level: l }) ? "active" : ""}
            onClick={() => setHeading(l)}
            title={`H${l} (⌘⌥${l})`}
          >
            H{l}
          </button>
        ))}
        <span className="memo-toolbar-sep" />
        <button
          type="button"
          className={editor.isActive("bold") ? "active" : ""}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (⌘B)"
        >
          <b>B</b>
        </button>
        <button
          type="button"
          className={editor.isActive("italic") ? "active" : ""}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (⌘I)"
        >
          <i>I</i>
        </button>
        <button
          type="button"
          className={editor.isActive("code") ? "active" : ""}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline code (⌘E)"
        >
          {"<>"}
        </button>
        <span className="memo-toolbar-sep" />
        <button
          type="button"
          className={editor.isActive("bulletList") ? "active" : ""}
          onClick={toggleBullet}
          title="Bullet list (⌘⇧8)"
        >
          •
        </button>
        <button
          type="button"
          className={editor.isActive("orderedList") ? "active" : ""}
          onClick={toggleOrdered}
          title="Ordered list (⌘⇧7)"
        >
          1.
        </button>
        <button
          type="button"
          className={editor.isActive("taskList") ? "active" : ""}
          onClick={toggleTask}
          title="Task list (⌘⇧9)"
        >
          ☐
        </button>
        <button
          type="button"
          className={editor.isActive("codeBlock") ? "active" : ""}
          onClick={toggleCodeBlock}
          title="Code block (```)"
        >
          {"{}"}
        </button>
        {saveIndicator && <span className="memo-save-indicator">{saveIndicator}</span>}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
```

- [ ] **Step 3: typecheck**

Run: `cd app && pnpm typecheck`
Expected: 메모 관련 PASS. 단 `MemoPage.tsx` 가 여전히 `markdownToDoc`/`docToMarkdown` import 하지 않는지 확인. 안 한다면 PASS. 한다면 Task 4 에서 정리.

```bash
grep -n "markdownToDoc\|docToMarkdown" app/src/features/memo/MemoPage.tsx
```

Expected: no output (import 하지 않음).

- [ ] **Step 4: 빌드도 통과 확인**

Run: `cd app && pnpm build`
Expected: PASS. tiptap-markdown 번들 포함, 에러 없음.

- [ ] **Step 5: Commit (Task 2 + 3 합쳐서)**

```bash
cd /Users/happyhsryu/dev/personal/workspace-hub
git add app/src/features/memo/markdown.ts app/src/features/memo/MemoEditor.tsx
git commit -m "$(cat <<'EOF'
feat(memo): list·task·code block 노드 + tiptap-markdown 직렬화로 교체

- StarterKit 의 bulletList/orderedList/listItem/codeBlock 활성
- TaskList/TaskItem extension 추가
- Placeholder extension 추가 ("내용을 입력하세요")
- 자체 markdown.ts 직렬화 함수 폐기, tiptap-markdown 으로 위임
- firstLineAsTitle 만 markdown.ts 에 보존
- 툴바 버튼 4종 추가 (bullet, ordered, task, code block)
- ¶ 버튼 라벨을 "본문"으로 변경, 단축키 안내 title 보강
- saveIndicator slot prop 추가 (Task 5/6 에서 wire)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 저장 인디케이터 hook + 단위 테스트

**Files:**
- Create: `app/src/features/memo/useSaveIndicator.ts`
- Create: `app/src/features/memo/hooks/__tests__/useSaveIndicator.test.ts`

작은 상태 머신이지만 인디케이터 라벨 계산(`방금`/`N분 전`/`N시간 전`)이 명시적 테스트 가치가 있음. `useDebouncedUpdate` 테스트 패턴 참고 (`vitest`의 `vi.useFakeTimers`).

- [ ] **Step 1: 실패하는 테스트 먼저 작성**

`app/src/features/memo/hooks/__tests__/useSaveIndicator.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { formatRelative, useSaveIndicator } from "../../useSaveIndicator";

describe("formatRelative", () => {
  const NOW = new Date("2026-05-18T12:00:00Z").getTime();

  it("returns '방금' for < 30s", () => {
    expect(formatRelative(NOW - 5_000, NOW)).toBe("방금");
    expect(formatRelative(NOW - 29_000, NOW)).toBe("방금");
  });

  it("returns 'N분 전' for >= 30s and < 1h", () => {
    expect(formatRelative(NOW - 60_000, NOW)).toBe("1분 전");
    expect(formatRelative(NOW - 30 * 60_000, NOW)).toBe("30분 전");
    expect(formatRelative(NOW - 59 * 60_000, NOW)).toBe("59분 전");
  });

  it("returns 'N시간 전' for >= 1h", () => {
    expect(formatRelative(NOW - 60 * 60_000, NOW)).toBe("1시간 전");
    expect(formatRelative(NOW - 5 * 60 * 60_000, NOW)).toBe("5시간 전");
  });
});

describe("useSaveIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-18T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useSaveIndicator());
    expect(result.current.state).toBe("idle");
    expect(result.current.label).toBeNull();
  });

  it("markSaving -> 'saving' / '저장 중…'", () => {
    const { result } = renderHook(() => useSaveIndicator());
    act(() => result.current.markSaving());
    expect(result.current.state).toBe("saving");
    expect(result.current.label).toBe("저장 중…");
  });

  it("markSaved -> 'saved' / '저장됨 · 방금'", () => {
    const { result } = renderHook(() => useSaveIndicator());
    act(() => result.current.markSaved());
    expect(result.current.state).toBe("saved");
    expect(result.current.label).toBe("저장됨 · 방금");
  });

  it("reset -> 'idle'", () => {
    const { result } = renderHook(() => useSaveIndicator());
    act(() => result.current.markSaved());
    act(() => result.current.reset());
    expect(result.current.state).toBe("idle");
    expect(result.current.label).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd app && pnpm test src/features/memo/hooks/__tests__/useSaveIndicator.test.ts`
Expected: FAIL — `useSaveIndicator` / `formatRelative` 가 정의 안 됨.

- [ ] **Step 3: hook 구현**

`app/src/features/memo/useSaveIndicator.ts`:

```ts
import { useCallback, useMemo, useState } from "react";

export type SaveState = "idle" | "saving" | "saved";

interface UseSaveIndicatorReturn {
  state: SaveState;
  lastSavedAt: number | null;
  /** typing 시 호출 — "저장 중…" 으로 전환. */
  markSaving: () => void;
  /** debounce 저장 또는 flush 성공 시 호출. timestamp 박힘. */
  markSaved: (now?: number) => void;
  /** 메모 전환 시 호출 — 인디케이터 숨김. */
  reset: () => void;
  /** 렌더용 라벨. idle 이면 null. */
  label: string | null;
}

export function useSaveIndicator(): UseSaveIndicatorReturn {
  const [state, setState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const markSaving = useCallback(() => setState("saving"), []);
  const markSaved = useCallback((now: number = Date.now()) => {
    setState("saved");
    setLastSavedAt(now);
  }, []);
  const reset = useCallback(() => {
    setState("idle");
    setLastSavedAt(null);
  }, []);

  const label =
    state === "idle"
      ? null
      : state === "saving"
        ? "저장 중…"
        : `저장됨 · ${formatRelative(lastSavedAt ?? Date.now(), Date.now())}`;

  // 반환 객체 reference 를 useMemo 로 안정화 — MemoPage 의 useCallback/useEffect deps 에
  // saveIndicator 통째로 들어갈 때 매 렌더 새 객체로 인한 무한 재실행 회피.
  return useMemo(
    () => ({ state, lastSavedAt, markSaving, markSaved, reset, label }),
    [state, lastSavedAt, markSaving, markSaved, reset, label],
  );
}

/** 두 timestamp(ms) 의 차이를 한국어 상대 시간으로. < 30s → "방금", < 1h → "N분 전", else "N시간 전". */
export function formatRelative(then: number, now: number): string {
  const diff = Math.max(0, now - then);
  if (diff < 30_000) return "방금";
  if (diff < 60 * 60_000) {
    const mins = Math.floor(diff / 60_000);
    return `${mins}분 전`;
  }
  const hours = Math.floor(diff / (60 * 60_000));
  return `${hours}시간 전`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd app && pnpm test src/features/memo/hooks/__tests__/useSaveIndicator.test.ts`
Expected: PASS (모든 케이스 ✓).

- [ ] **Step 5: 전체 테스트 회귀**

Run: `cd app && pnpm test`
Expected: 기존 테스트도 PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/happyhsryu/dev/personal/workspace-hub
git add app/src/features/memo/useSaveIndicator.ts app/src/features/memo/hooks/__tests__/useSaveIndicator.test.ts
git commit -m "$(cat <<'EOF'
feat(memo): useSaveIndicator hook + 상대 시간 포맷 유틸

idle / saving / saved 3상태 머신. formatRelative 는 < 30s '방금',
< 1h 'N분 전', 그 외 'N시간 전'. 다음 task 에서 MemoPage 에 wire.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `MemoPage` 에 저장 인디케이터 통합

**Files:**
- Modify: `app/src/features/memo/MemoPage.tsx`

- [ ] **Step 1: hook import + state 통합**

`MemoPage.tsx` 상단 import 블록에 추가:

```tsx
import { useSaveIndicator } from "./useSaveIndicator";
```

기존 state 선언부 (대략 21~38행) 아래 — `draftBodyRef.current = draftBody;` 직후 — 에 한 줄 추가:

```tsx
  const saveIndicator = useSaveIndicator();
```

- [ ] **Step 2: scheduleSave / flushPendingSave / selectedId effect 에 전이 호출 끼우기**

기존 `scheduleSave` (대략 116~130행) 를 다음으로 교체:

```tsx
  const scheduleSave = useCallback(
    (targetId: number, title: string, body: string) => {
      clearTimer(saveTimerRef);
      saveIndicator.markSaving();
      saveTimerRef.current = window.setTimeout(async () => {
        saveTimerRef.current = null;
        try {
          await memoApi.update(targetId, { title, body });
          saveIndicator.markSaved();
          await refreshMemos();
        } catch (e) {
          setError(String(e));
        }
      }, DEBOUNCE_MS);
    },
    [refreshMemos, saveIndicator],
  );
```

기존 `flushPendingSave` (대략 82~96행) 의 try 블록 안 `await memoApi.update(...)` 다음 줄에 `saveIndicator.markSaved();` 한 줄 추가:

```tsx
    try {
      await memoApi.update(id, {
        title: draftTitleRef.current,
        body: draftBodyRef.current,
      });
      saveIndicator.markSaved();
      await refreshMemos();
    } catch (e) {
      setError(String(e));
    }
```

deps 배열에 `saveIndicator` 추가:

```tsx
  }, [refreshMemos, saveIndicator]);
```

선택 메모 변경 effect (대략 100~114행) 의 `if (selectedId === null)` 블록 안에 reset 호출:

```tsx
    if (selectedId === null) {
      setDraftTitle("");
      setDraftBody("");
      draftMemoIdRef.current = null;
      saveIndicator.reset();
      return;
    }
```

그리고 `draftMemoIdRef.current = m.id;` 직후에도 `saveIndicator.reset();` 추가 — 다른 메모로 전환되는 경우.

deps 배열에 `saveIndicator` 추가.

- [ ] **Step 3: MemoEditor 에 saveIndicator prop 전달**

JSX 의 `<MemoEditor ... />` (대략 416~420행) 부분 교체:

```tsx
                <MemoEditor
                  memoId={selectedMemo.id}
                  initialMarkdown={selectedMemo.body}
                  onChange={handleBodyChange}
                  saveIndicator={saveIndicator.label}
                />
```

- [ ] **Step 4: typecheck + 전체 테스트**

Run: `cd app && pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/happyhsryu/dev/personal/workspace-hub
git add app/src/features/memo/MemoPage.tsx
git commit -m "$(cat <<'EOF'
feat(memo): MemoPage 에 useSaveIndicator wire (saving / saved / reset)

scheduleSave 시작 시 markSaving, 완료/flush 성공 시 markSaved,
메모 전환 시 reset. MemoEditor 툴바 우측에 label 표시.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: CSS — 툴바 active(ADR-0011), list, task list, code block, placeholder, 인디케이터

**Files:**
- Modify: `app/src/styles/global.css:1997-2046` 부근 (memo-editor 블록)

- [ ] **Step 1: 툴바 active 색 교체 (ADR-0011)**

`global.css` 의 `.memo-editor-toolbar button.active` 규칙 (1997~2001행) 을 다음으로 교체:

```css
.memo-editor-toolbar button.active {
  background: var(--color-primary-soft);
  color: var(--color-ink);
  font-weight: 600;
  border-color: transparent;
}
```

- [ ] **Step 2: 툴바에 인디케이터 우측 정렬용 + 인디케이터 자체 스타일 추가**

`.memo-toolbar-sep` 규칙(2002~2006행) 다음에 추가:

```css
.memo-save-indicator {
  margin-left: auto;
  font-size: var(--fs-xs);
  color: var(--color-steel);
  align-self: center;
  padding: 0 4px;
  white-space: nowrap;
}
```

- [ ] **Step 3: list / task list / code block / placeholder 스타일 추가**

`.memo-editor code` 규칙(2040~2046행) 다음에 추가:

```css
.memo-editor ul,
.memo-editor ol {
  margin: 0 0 0.4em;
  padding-left: 1.5em;
}
.memo-editor ul li,
.memo-editor ol li {
  margin: 0.1em 0;
}
.memo-editor ul li::marker {
  color: var(--color-steel);
}
.memo-editor ol li::marker {
  color: var(--color-steel);
}

.memo-editor ul[data-type="taskList"] {
  list-style: none;
  padding-left: 0;
}
.memo-editor ul[data-type="taskList"] li {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0.2em 0;
}
.memo-editor ul[data-type="taskList"] li > label {
  flex: 0 0 auto;
  margin-top: 0.2em;
  user-select: none;
}
.memo-editor ul[data-type="taskList"] li > label > input[type="checkbox"] {
  cursor: pointer;
  margin: 0;
}
.memo-editor ul[data-type="taskList"] li > div {
  flex: 1 1 auto;
}
.memo-editor ul[data-type="taskList"] li[data-checked="true"] > div {
  color: var(--color-stone);
  text-decoration: line-through;
}

.memo-editor pre {
  background: var(--color-surface-soft);
  padding: var(--space-sm);
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
  color: var(--color-charcoal);
  overflow-x: auto;
  margin: 0.4em 0;
}
.memo-editor pre code {
  background: transparent;
  padding: 0;
  border-radius: 0;
  font-size: inherit;
}

.memo-editor p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: var(--color-steel);
  float: left;
  height: 0;
  pointer-events: none;
}
```

- [ ] **Step 4: 시각 검증 (수동)**

Run: `cd app && pnpm tauri dev`

빈 메모를 만들고 다음을 직접 확인:
- 빈 본문에 "내용을 입력하세요" placeholder 가 옅은 회색으로 표시
- 툴바 active 버튼(`본문` 또는 헤딩 클릭 후) 이 옅은 회색 배경 + 굵게, 검정 배경 없음
- `- ` 입력 → bullet list 변환, marker 가 옅은 회색
- `- [ ] ` 입력 → 체크박스 렌더, 클릭 시 토글되며 토글된 항목은 회색 + 취소선
- ```` ``` ```` 입력 → code block 진입, 회색 배경 + monospace
- 타이핑 직후 툴바 우측에 "저장 중…", 500ms 뒤 "저장됨 · 방금" 표시

- [ ] **Step 5: Commit**

```bash
cd /Users/happyhsryu/dev/personal/workspace-hub
git add app/src/styles/global.css
git commit -m "$(cat <<'EOF'
style(memo): list/taskList/codeBlock/placeholder/저장 인디케이터 스타일 + ADR-0011 적용

- 툴바 active 검정 배경 → --color-primary-soft + font-weight 600
- ul/ol/li 리스트 들여쓰기·마커 색
- taskList 체크박스 정렬, 완료 항목 회색 + 취소선
- code block 배경·monospace·overflow
- placeholder ::before
- .memo-save-indicator 우측 정렬

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 기존 메모 호환 + 회귀 수동 검증

**Files:** (검증만, 변경 없음)

- [ ] **Step 1: 기존 메모 로드 확인**

`pnpm tauri dev` 상태에서:
- 기존 메모(자체 파서로 저장된 markdown) 가 손실 없이 렌더되는지
- 헤딩, bold, italic, 인라인 code 모두 정상

- [ ] **Step 2: 새 입력 → 저장 → 재로드 확인**

같은 메모에 list / task list / code block 추가 → 저장 인디케이터 "저장됨" → 다른 메모로 전환 후 다시 돌아왔을 때 그대로 보이는지.

- [ ] **Step 3: spec §10 검증 기준 10항목 체크리스트**

Spec `docs/design-drafts/2026-05-18-memo-editor-notes-style-design.md` §10 의 1~10번 항목을 순서대로 한 번씩 직접 수행:

1. ⌘⌥1 단축어 → H1
2. ⌘⌥2 단축키 → H2
3. `- [ ] 할일` → 체크박스, 클릭 토글
4. ```` ``` ```` → code block, ⇧엔터로 빠져나오기
5. 빈 본문 placeholder
6. 타이핑 직후 "저장 중…", 500ms 후 "저장됨"
7. 툴바 active 색
8. ¶ 자리에 "본문" 라벨
9. 기존 메모 로드 손실 없음
10. 회귀: 휴지통 readonly, 자동 빈 메모 삭제, 폴더 전환 flush, 핀/삭제/복원/휴지통 비우기

- [ ] **Step 4: 발견된 버그 정리**

각 항목 실패 시 spec/plan 에 보고. 본 plan 의 후속 task 로 추가.

- [ ] **Step 5: (검증 통과 시) 회귀 commit 없음 — 다음 task 로 진행**

검증 task 라 새 commit 없음.

---

## Task 8: 문서 업데이트 (DESIGN.md, SOURCE_MAP.md)

**Files:**
- Modify: `docs/DESIGN.md`
- Modify: `docs/SOURCE_MAP.md`

- [ ] **Step 1: `docs/DESIGN.md` 의 메모 에디터 섹션 갱신**

해당 섹션을 찾아 (`grep -n "메모 에디터\|MemoEditor" docs/DESIGN.md`), 활성 노드 목록을 11종으로 갱신:

> 메모 에디터 활성 노드: H1~H4, paragraph, bullet list, ordered list, task list, code block, bold, italic, inline code (총 11종). 직렬화는 `tiptap-markdown` 사용.

단축키 표 추가:

| 단축키 | 동작 |
|---|---|
| ⌘⌥1~4 | H1~H4 |
| ⌘⌥0 | 본문 |
| ⌘⇧7 | Ordered list |
| ⌘⇧8 | Bullet list |
| ⌘⇧9 | Task list |
| ⌘B / ⌘I | Bold / Italic |
| ⌘E | Inline code |
| ``` ``` ``` | Code block (markdown 단축어) |

(만약 해당 섹션이 없으면 "디자인 시스템 v0.2 — 메모 에디터" 항목 신설.)

- [ ] **Step 2: `docs/SOURCE_MAP.md` 의 `markdown.ts` 항목 수정**

`grep -n "markdown.ts" docs/SOURCE_MAP.md` 로 위치 확인 후, 책임 설명을 다음으로 교체:

> `app/src/features/memo/markdown.ts` — markdown 첫 줄에서 메모 타이틀을 추출하는 `firstLineAsTitle` 헬퍼만. 직렬화는 TipTap 의 `tiptap-markdown` extension 이 담당.

- [ ] **Step 3: 새 파일 항목 추가**

`docs/SOURCE_MAP.md` 의 메모 도메인 섹션에 추가:

> `app/src/features/memo/useSaveIndicator.ts` — 메모 저장 상태(idle/saving/saved) 머신 + 상대 시간 포맷. MemoPage 에서 사용.

- [ ] **Step 4: Commit**

```bash
cd /Users/happyhsryu/dev/personal/workspace-hub
git add docs/DESIGN.md docs/SOURCE_MAP.md
git commit -m "$(cat <<'EOF'
docs: 메모 에디터 노드 11종 / 단축키 / markdown.ts 책임 축소 반영

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 최종 빌드 + 테스트 + 정리

**Files:** (검증만)

- [ ] **Step 1: 전체 빌드 + 타입체크**

```bash
cd /Users/happyhsryu/dev/personal/workspace-hub/app
pnpm typecheck && pnpm test && pnpm build
```

Expected: 셋 다 PASS.

- [ ] **Step 2: Tauri dev 한 번 더 실행 → spec §10 모든 항목 마지막 확인**

Run: `pnpm tauri dev`

Spec §10 1~10번 항목 PASS 시 작업 완료.

- [ ] **Step 3: git log 로 commit 흐름 점검**

```bash
cd /Users/happyhsryu/dev/personal/workspace-hub
git log --oneline -10
```

Expected: 본 plan 의 commit (chore → feat × 2 → style → docs) 이 시간순으로 나옴.

---

## 리스크 / 핵폭탄

- **`tiptap-markdown` peer dep 충돌 (TipTap v3)**: Task 1 Step 2 에서 즉시 발견. 발견 시 본 plan 중단 → 사용자 보고 → ProseMirror-markdown 직접 사용 plan 으로 분기.
- **`useEditor({ content: markdownString })` 와 `editor.commands.setContent(markdownString)` 가 markdown 문자열을 그대로 받는지**: tiptap-markdown 의 `Markdown` extension 이 설치되면 양쪽 모두 markdown 입력을 자동 파싱하도록 hook 함. 만약 일부 버전에서 string 을 HTML 로 취급해 깨지면 fallback 패턴: `editor.commands.setContent(editor.storage.markdown.parser.parse(md), { emitUpdate: false })`. Task 3 Step 4 (`pnpm build` 후 dev 실행) 에서 기존 메모 로드가 깨지면 즉시 fallback 패턴 적용.
- **저장 인디케이터 effect deps 무한 루프**: `saveIndicator` 객체가 매 렌더 새로 생성되면 deps 가 매번 바뀌어 효과 무한 fire. `useSaveIndicator` 가 반환하는 함수들을 `useCallback` 으로 안정화한 이유. 만약 그래도 무한 루프 보이면, 반환 객체를 `useMemo` 로 감싸 reference 안정성 추가.
- **macOS 시스템 단축키 충돌 (⌘⇧7/8/9)**: macOS Finder 의 보기 전환 단축키와 안 겹침 확인됨. Tauri webview 가 가로채는 게 없는지 실측은 Task 7 Step 3 에서.
- **자체 파서 출력 호환**: 기존 메모 markdown 이 자체 파서 outputs 만 있을 거라는 가정. CLI 에서 직접 markdown 을 INSERT 한 경우 GFM/CommonMark 비표준 가능성 — 다행히 `tiptap-markdown` 은 markdown-it 기반이라 관대하게 파싱. 그래도 실데이터 한 번 살펴서 확인 (Task 7 Step 1).
