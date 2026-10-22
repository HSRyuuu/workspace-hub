# workspace-hub Design System

> 단일 진실 원천은 코드다: 색·크기 토큰은 `app/src/styles/tokens.css`, 컴포넌트 스타일은 `app/src/styles/global.css`, 공유 컴포넌트는 `app/src/components/ui/`.
> 이 문서는 "어떤 규칙으로 쓰는가"만 적는다. 값이 바뀌면 tokens.css 를 고치고 여기는 규칙이 바뀔 때만 손댄다.
> 테마·내비게이션 결정 근거: ADR-0014.

---

## Themes

두 테마를 지원한다. 토큰 **이름은 공통**이고 `<html data-theme="light|dark">` 에 따라 값만 바뀐다.

| 테마 | 이름 | 성격 | Primary(CTA) | Accent |
|---|---|---|---|---|
| light (기본) | Quiet Ink | 흰 바탕 + 중립 회색 + 잉크 검정 | `#18181b` (검정) | `#3f6ac4` 블루 |
| dark | Graphite Lime | 흑연 `#111` + 라임 포인트 | `#c6f24e` (라임) | `#c6f24e` |

- 선택: 설정 > 화면 테마 (시스템 / 라이트 / 다크). 저장은 localStorage `wh.theme`, 적용은 `src/theme.ts`, 첫 페인트 전 적용은 `index.html` 인라인 스크립트.
- 컴포넌트 CSS 는 **색 값을 직접 쓰지 않는다.** 항상 토큰을 참조한다. 새 색이 필요하면 tokens.css 에 라이트·다크 값을 같이 추가한다.
- 면에 올리는 글자색은 짝 토큰을 쓴다: `--color-primary` ↔ `--color-on-primary`, `--color-toast-bg` ↔ `--color-toast-fg`. (다크에서 primary 가 밝아지므로 `#fff` 하드코딩 금지)
- 일정 pill 처럼 사용자가 고른 색을 쓰는 곳은 `--pill-*-pct`, `--pill-mix` 로 섞는 비율만 테마별로 바꾼다.
- 코드 하이라이트는 `--syntax-*` (CodeMirror: `features/files/syntaxTheme.ts`).

## Tokens

### 색 역할

| 역할 | 토큰 |
|---|---|
| 면 | `--color-page`(앱 바탕·전체 폭 패널) → 그 위에 `--color-canvas`(카드·입력·버튼) · `--color-surface`(카드 안 헤더·hover) · `--color-surface-soft`(사이드바) · `--color-elevated`(팝오버·모달) |
| 선택 | `--color-primary-soft` — selected 행·active 메뉴 (ADR-0011) |
| 글자 | `--color-ink` > charcoal > slate > steel > `--color-stone`(메타·라벨) · `--color-muted`는 placeholder/비활성 전용 |
| 경계 | `--color-hairline`(기본) · `-soft` · `-strong`(입력·팝오버) |
| 강조 | `--color-accent` / `-soft` / `-ink` — 포커스 링·"다음" 표시·표 선택 |
| 의미 | `--color-error`(지난 마감·삭제·높음) · `--color-warning` · `--color-success` · `--color-link-blue` |
| 우선순위 점 | 낮음 `--color-data-slate` · 보통 `--color-data-emerald` · 높음 `--color-error` (색만으로 전달하지 않고 라벨/툴팁을 함께 둔다) |

대비 기준: 본문·메타 텍스트는 WCAG 4.5:1 이상. 라이트 `--color-stone #62626b` 는 흰 배경 6.0:1, 사이드바 5.5:1.

### 타이포·간격

| 토큰 | 값 | 용도 |
|---|---|---|
| `--fs-h1` | 22px | 페이지 제목 |
| `--fs-h3` | 15px | 카드·패널 제목, 검색 입력 |
| `--fs-body` | 13px | 기본 본문 |
| `--fs-sm` | 12px | 보조 정보·메타 |
| `--fs-xs` | 11px | 그룹 라벨·배지 (최소 크기 — 10px 이하 금지) |

폰트는 시스템 스택(`-apple-system`, `Apple SD Gothic Neo`)만 쓴다. 날짜·시간·개수는 `font-variant-numeric: tabular-nums`.
반경·간격 토큰(`--radius-*`, `--space-*`)은 유지한다. 새 CSS 에는 직접 px 대신 토큰을 쓴다.

## Shell

- **사이드바**: 216px 라벨 사이드바, `⌘\` 로 52px 아이콘 모드. 항목은 실제 `<button>` (포커스 링 전역 `:focus-visible`).
- **단축키**: `⌘1~5` 화면 이동(Today · TODO · Calendar · Memo · 파일탐색기) · `⌘,` 설정 · `⌘K` 통합 검색 · `⌘\` 사이드바 접기. `⌘⌥`/`⌘⇧` 조합은 에디터 단축키라 앱 셸이 가로채지 않는다.
- **⌘K 통합 검색**: TODO·메모·일정을 클라이언트에서 검색(`features/search`). 입력이 비어 있으면 화면 이동 목록.

## Layout 패턴

- **상세 패널은 목록 위에 겹친다**: 좌우 분할 대신 `ResizablePanel`(`components/ui`)을 목록 위 우측에 띄운다. 왼쪽 경계선을 드래그(또는 ←/→)로 폭 조절, 폭은 마운트 중에만 기억하고 앱을 다시 켜면 기본값(460px). TODO 에서 사용.
- **좁은 창(최소 800px)**: 한 줄 텍스트는 `text-overflow: ellipsis`, 도구 줄은 wrap, 폼 열은 `auto-fit` 으로 접는다. 칩·배지처럼 행을 밀어내는 요소는 제목 줄 안에 둔다.
- **Today = 대시보드**: 핵심 숫자 타일 → 다가오는 7일 스트립 → 오늘 일정/오늘 마감/지난 마감/오래 열린 TODO 카드. 메모·폴더 목록은 두지 않는다.

## Components

_공유 UI 컴포넌트는 `app/src/components/ui/` 디렉터리 참조._ `SegmentedControl`(2~4개 선택지 토글)은 설정의 테마 선택에 쓴다.

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

- 라이트/다크 이중 테마, 검정 CTA → "Primary 1색" — ADR-0014 (ADR-0011 의 selected 규칙은 유지)
