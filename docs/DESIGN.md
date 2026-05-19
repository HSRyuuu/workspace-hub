# workspace-hub Design System

> Reset 2026-05-18 — 디자인 시스템이 v0.1 종료 전 두 번 뒤집혀 churn 누적. v0.1 MVP 동작이 끝나고 며칠 써본 뒤 톤이 고정되면 그때 다시 작성한다.
> 현재 코드의 실제 토큰은 `app/src/styles/tokens.css` 와 `app/src/styles/global.css` 가 단일 진실 원천이다.

---

## Tokens

_토큰 정의는 `app/src/styles/tokens.css` 참조._

## Components

_공유 UI 컴포넌트는 `app/src/components/ui/` 디렉터리 참조._

### Feedback / Notification

피드백·알림 UI는 다음 두 싱글톤 컴포넌트로 통일한다. 도메인별로 자체 모달·alert·`window.confirm`을 만들지 않는다.

| 상황 | 쓰는 것 | 호출 |
|---|---|---|
| 파괴적/되돌릴 수 없는 액션 확인 (삭제 등) | `ConfirmToast` | `showConfirmToast({ message, confirmLabel, cancelLabel, onConfirm, onCancel })` |
| 비동기 작업 실패 알림 (재시도 가능) | `Toast` (error) | `showErrorToast(message, retry?)` |

- 두 컴포넌트는 `App.tsx` 루트에 한 번씩만 마운트되며, 호출부는 `show*` 함수만 import 한다 (`app/src/components/ui/index.ts` 재수출).
- 우선순위: `ConfirmToast`가 표시 중이면 `Toast`(error)는 숨겨진다 — `Toast.tsx:66` 참고.
- 레퍼런스 사용 예: `app/src/features/todo/TodoPage.tsx`의 삭제 플로우(`onDelete` → `showConfirmToast` → 실패 시 `showErrorToast`).

### 메모 에디터 (Notes 스타일 WYSIWYG)

메모 에디터 활성 노드: H1~H6, paragraph, bullet list, ordered list, task list, code block, bold, italic, inline code (총 13종). 직렬화는 `tiptap-markdown` extension 이 담당.

#### 단축키

| 단축키 | 동작 |
|---|---|
| ⌘⌥1~6 | H1~H6 |
| ⌘⌥0 | 본문 (paragraph) |
| ⌘⌥7 | Bullet list |
| ⌘⌥8 | Ordered list |
| ⌘⌥9 | Task list |
| ⌘B / ⌘I | Bold / Italic |
| ⌘E | Inline code |
| ` ``` ` | Code block (markdown 단축어) |

#### Markdown 단축어

- `# `, `## `, `### `, `#### `, `##### `, `###### ` → H1~H6
- `- ` → bullet list
- `1. ` → ordered list
- `- [ ] ` → task list
- ` ``` ` → code block

## Decisions

_아직 고정된 디자인 결정 없음. v0.1 완료 후 정리._
