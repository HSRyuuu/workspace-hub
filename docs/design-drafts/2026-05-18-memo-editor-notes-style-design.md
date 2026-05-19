# 메모 에디터 Notes 스타일 심화 설계 (2026-05-18)

> macOS Notes 스타일의 WYSIWYG 경험을 깊게 적용한다. TipTap 기반·Markdown 저장은 유지하고, 활성 노드를 5종 → 11종으로 늘리며 자체 markdown 파서를 라이브러리로 승격한다. 입력 마찰(단축어/단축키/placeholder)과 신뢰 마찰(저장 인디케이터)을 동시에 해소한다. ADR-0011(검정 ink는 CTA 전용)의 잔존 위반(툴바 active)도 함께 정리한다.

## 1. 동기

- 현재 에디터는 H1~H4 + paragraph + bold/italic/inline code 5종만 활성. **list·체크리스트·코드블록이 없어 "포맷 적용된 메모"라기보다 "헤딩만 가능한 텍스트"**에 머묾.
- macOS Notes 같은 WYSIWYG 입력 경험 부재 — **markdown 단축어(`# `, `- `, `- [ ] `, ```` ``` ````), 단축키(⌘⌥1~4, ⌘⇧7/8/9), placeholder, 저장 인디케이터 모두 없음**.
- 툴바 active 버튼이 `--color-ink`(검정) 배경 — ADR-0011("검정은 primary CTA 전용, 토글/선택은 `--color-primary-soft`") 잔존 위반.
- `markdown.ts` 자체 파서 상단 주석: *"활성 노드 종류가 5종 미만일 때만 자체 함수가 유효하며, 이를 넘기는 시점에 라이브러리로 승격한다."* — 본 설계로 11종이 되어 **승격 조건 충족**.

## 2. 결정 사항 (합의 완료)

| 항목 | 결정 |
| --- | --- |
| 방향 | **macOS Notes 스타일 WYSIWYG 심화** (Obsidian Live Preview hybrid 보류) |
| 에디터 기반 | TipTap 유지 (CodeMirror 6 전환 보류) |
| 저장 형식 | **Markdown** (DB 변경 0, `memo.body TEXT` 그대로) |
| Markdown 직렬화 | 자체 `markdown.ts` → **`tiptap-markdown` 라이브러리**로 교체 |
| 제목/본문 구조 | 현재처럼 **`<input>` 분리 유지** (첫 줄=제목 자동 인식 안 함) |
| List 계열 | bullet · ordered · **task list** 모두 추가 |
| 코드 블록 | 추가 (인라인 code와 별개로 ```` ``` ```` 펜스) |
| 저장 인디케이터 | **추가** ("저장됨 · 방금" / "저장 중…") |
| 툴바 active 색 | `--color-ink` → `--color-primary-soft` + `font-weight: 600` (ADR-0011 적용) |
| ¶ 버튼 라벨 | "본문"으로 변경 |
| Placeholder | TipTap `Placeholder` extension — 빈 본문 시 "내용을 입력하세요" |

## 3. 활성 노드·마크 매트릭스

| 카테고리 | 현재 | A안 | 비고 |
|---|---|---|---|
| Heading H1~H4 | ✅ | ✅ | 한 줄 = 하나의 블록 (블록 노드) |
| Paragraph | ✅ | ✅ | 본문 |
| **Bullet List** (`- item`) | ❌ | ✅ | 신규 |
| **Ordered List** (`1. item`) | ❌ | ✅ | 신규 |
| **Task List** (`- [ ] / - [x]`) | ❌ | ✅ | 신규 — GFM task list |
| **Code Block** (```` ```lang … ``` ````) | ❌ | ✅ | 신규 (여러 줄 코드) |
| Bold (`**…**`) | ✅ | ✅ | |
| Italic (`*…*`) | ✅ | ✅ | |
| Inline Code (`` `…` ``) | ✅ | ✅ | |
| Blockquote · HR · Strike | ❌ | ❌ | YAGNI |
| Link · Image · Table | ❌ | ❌ | YAGNI (v0.5+ 검토) |

총 활성 노드/마크: **5종 → 11종**.

## 4. 입력 수단 3종

| 수단 | 어떻게 | 비고 |
|---|---|---|
| **Markdown 단축어** | 행 첫머리에 `# `, `## `, `### `, `#### `, `- `, `1. `, `- [ ] `, ```` ``` ```` 입력 시 즉시 변환 | TipTap StarterKit의 inputRule + listKit 기본 동작. 단, code block은 `CodeBlock` extension의 fenced inputRule 활성 필요 |
| **단축키** | ⌘⌥1~4(H1~H4), ⌘⌥0(본문), ⌘⇧7(ordered), ⌘⇧8(bullet), ⌘⇧9(task), ⌘E(인라인 code), ⌘B/I 기본 | Notes의 ⌘⌥ 헤딩 단축키 패턴 차용 (Obsidian의 ⌘1~6 대신) |
| **툴바** | 항상 노출 (Notes 패턴). 현재 7버튼 → 10버튼 + 저장 인디케이터 | floating bubble menu 도입 안 함 |

### 4.1 툴바 레이아웃 (좌→우)

```
[본문] [H1] [H2] [H3] [H4] │ [B] [I] [<>] │ [•] [1.] [☐] [{}] │             저장됨·방금
```

- `[본문]` = paragraph
- `[<>]` = inline code (현재 유지)
- `[•]` = bullet list, `[1.]` = ordered, `[☐]` = task list
- `[{}]` = code block (여러 줄)
- `│` = `.memo-toolbar-sep`
- 저장 인디케이터는 툴바 우측 정렬 (flex `margin-left: auto`)

## 5. UI 변경 상세

### 5.1 ADR-0011 적용 — 툴바 active 색

```css
/* before */
.memo-editor-toolbar button.active {
  background: var(--color-ink);
  color: var(--color-on-primary);
  border-color: var(--color-ink);
}

/* after */
.memo-editor-toolbar button.active {
  background: var(--color-primary-soft);
  color: var(--color-ink);
  font-weight: 600;
  border-color: transparent;
}
```

### 5.2 Placeholder

- TipTap `@tiptap/extension-placeholder` 추가
- 빈 doc의 첫 paragraph에 "내용을 입력하세요" 표시
- CSS: `.memo-editor p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--color-steel); float: left; pointer-events: none; height: 0; }`

### 5.3 저장 인디케이터

- 상태: `MemoPage` 가 `saveState: "idle" | "saving" | "saved"` + `lastSavedAt: number | null` 추가
- 전이:
  - `handleTitleChange` / `handleBodyChange` 발생 → `"saving"`
  - `scheduleSave` 의 setTimeout 콜백 성공 → `"saved" + lastSavedAt = Date.now()`
  - `flushPendingSave` 성공 → `"saved" + lastSavedAt = Date.now()`
  - 메모 전환 시 → `"idle"`
- 위치: **툴바 우측** (`.memo-editor-toolbar` 안, `margin-left: auto`)
- 표시:
  - `idle` → 비표시
  - `saving` → "저장 중…"
  - `saved` → "저장됨 · {relative}" (방금 / N분 전 / N시간 전) — 30초 단위 리렌더 필요 없음. 단순히 timestamp만 박고 다음 typing/전환 시 갱신.

### 5.4 ¶ 버튼 라벨

- `¶` → `본문` (3글자 한글)
- min-width 충돌 시 padding 조정

## 6. 라이브러리 변경

| 추가 | 용도 | 비고 |
|---|---|---|
| `@tiptap/extension-task-list` | 체크리스트 컨테이너 | 신규 |
| `@tiptap/extension-task-item` | 체크리스트 항목 | 신규, `nested: true` |
| `@tiptap/extension-placeholder` | 본문 가이드 | 신규 |
| **`tiptap-markdown`** | Markdown ↔ TipTap doc 직렬화 | 자체 `markdown.ts` 직렬화 폐기. `firstLineAsTitle`만 보존 |

StarterKit의 `bulletList`, `orderedList`, `listItem`, `codeBlock` 는 `false` → `true` (또는 옵션 제거) 로 활성.

### 6.1 자체 파서와의 호환

- 기존 메모는 자체 파서로 직렬화된 markdown이 DB에 저장돼 있음
- `tiptap-markdown` 의 markdown 파싱은 CommonMark + GFM 기반 — 자체 파서 출력은 CommonMark 부분집합이므로 **읽기 100% 호환**
- 단방향 마이그 불필요. 한 번이라도 저장하면 라이브러리 직렬화 결과로 자연스럽게 normalize 됨

## 7. 영향 파일

### 7.1 코드

- `app/src/features/memo/MemoEditor.tsx`
  - `useEditor` extensions 확장 (`TaskList`, `TaskItem`, `Placeholder`, code block 활성, list 활성)
  - 툴바 버튼 3종 추가 (bullet/ordered/task), code block 토글 버튼 추가
  - `setHeading` 외에 `toggleBulletList`, `toggleOrderedList`, `toggleTaskList`, `toggleCodeBlock` 핸들러 추가
  - `markdownToDoc`/`docToMarkdown` import 제거 → `editor.storage.markdown.getMarkdown()` / `editor.commands.setContent(markdown)` 사용
  - 단축키는 TipTap extension 기본 등록 + `Mod-Alt-1..4` 가 기본인지 확인 (StarterKit Heading 기본 `Mod-Alt-{level}`)

- `app/src/features/memo/MemoPage.tsx`
  - `docToMarkdown`/`markdownToDoc` import 제거
  - `saveState`, `lastSavedAt` state + 전이 로직 추가
  - `saveState` 와 `lastSavedAt` 를 `MemoEditor` 에 prop 으로 전달 → 툴바 우측에 렌더

- `app/src/features/memo/markdown.ts`
  - `docToMarkdown` / `markdownToDoc` / `parseBlock` / `parseInline` / `inlineNodeToMarkdown` 등 직렬화 함수 **전부 삭제**
  - `firstLineAsTitle` 만 보존 (MemoPage 의 readonly 모드 fallback 에서 사용)
  - 파일 상단 주석을 단일 함수 용도로 갱신

- `app/src/styles/global.css`
  - `.memo-editor-toolbar button.active` 색 교체 (5.1)
  - `.memo-editor ul`, `.memo-editor ol`, `.memo-editor li` — list 스타일 (들여쓰기 1.25em, marker 색 `--color-steel`)
  - `.memo-editor ul[data-type="taskList"]` 와 `li[data-type="taskItem"]` — 체크박스 정렬, 완료 항목 `text-decoration: line-through; color: var(--color-stone)`
  - `.memo-editor pre` — code block 스타일 (`background: var(--color-surface-soft)`, `padding: var(--space-sm)`, `border-radius: 4px`, monospace)
  - `.memo-editor p.is-editor-empty:first-child::before` — placeholder
  - `.memo-save-indicator` — 우측 정렬, `font-size: var(--fs-xs)`, `color: var(--color-steel)`

- `app/package.json` — 위 4개 의존성 추가. 버전은 현재 TipTap major 와 일치 (`^2.x` 또는 사용 중인 major)

### 7.2 docs

- `docs/ADR.md` — 변경 없음 (ADR-0011 의 "유지되는 검정 사용처" 표에 메모 툴바 active 는 이미 없음 — 본 작업은 ADR-0011 적용 사례)
- `docs/DESIGN.md` — 메모 에디터 활성 노드 5종 → 11종 갱신, 단축키 표 추가
- `docs/SOURCE_MAP.md` — `markdown.ts` 의 책임이 직렬화에서 "타이틀 추출"로 축소됨 반영

## 8. 비범위 (Out of Scope)

- **첫 줄 = 제목 자동 인식** (옵션 2 선택 — `<input>` 분리 유지)
- CodeMirror 6 전환 / Obsidian Live Preview 스타일 hybrid (옵션 B)
- Floating bubble menu
- 링크 / 이미지 / 표 / 첨부 (v0.5+ 검토)
- 메모 본문 검색
- 자동 백업 / 버전 히스토리
- Rust CLI 변경 — `memo_*` 명령 시그니처/응답 그대로
- DB 스키마 변경 — `memo`, `memo_folder` 테이블 그대로

## 9. 마이그레이션 / 회귀

- DB 마이그 없음
- 기존 메모는 자체 파서가 저장한 CommonMark 부분집합 → `tiptap-markdown` 으로 **읽기 100% 호환** (위 §6.1)
- 첫 저장 시점에 markdown 표현이 라이브러리 표준으로 normalize 됨 — 의미적 동일성은 보장되지만 raw 텍스트 diff 는 발생 가능 (예: bold `**x**` 위치 정규화)
- 휴지통 readonly 모드: `firstLineAsTitle(selectedMemo.body)` 그대로 사용 — `markdown.ts` 의 이 함수만 보존하면 무영향

## 10. 검증 기준 (Success Criteria)

1. **단축어**: 본문 빈 줄에서 `# 제목` 입력 → 즉시 H1로 변환. `## `, `### `, `#### `, `- `, `1. `, `- [ ] `, ```` ``` ```` 동일.
2. **단축키**: ⌘⌥2 → H2, ⌘⌥0 → 본문, ⌘⇧7 → ordered list, ⌘⇧8 → bullet, ⌘⇧9 → task list, ⌘E → 인라인 code 토글.
3. **체크리스트**: `- [ ] 할일` 입력 → 체크박스 렌더. 클릭 시 토글 + markdown 직렬화에서 `- [x] 할일` 로 저장.
4. **코드 블록**: ```` ``` ```` 입력 → pre/code 블록 진입. 안에서 엔터 시 새 줄, ⌘A → 블록 전체 선택. 빠져나가려면 ⇧엔터 또는 아래 화살표 두 번.
5. **Placeholder**: 빈 메모 본문에 "내용을 입력하세요" 표시. 첫 글자 입력 시 사라짐.
6. **저장 인디케이터**: 타이핑 직후 헤더에 "저장 중…", 500ms 후 "저장됨 · 방금". 메모 전환 시 새 메모는 인디케이터 비표시.
7. **툴바 색**: active 버튼이 옅은 회색 배경(`--color-primary-soft`) + 굵게. 검정 배경 없음.
8. **¶ 버튼**: 라벨 "본문" 으로 표시.
9. **호환성**: 기존 메모 로드 → 손실 없이 렌더. 한 번 저장 후 다시 로드 → 동일하게 렌더.
10. **회귀**: 휴지통 읽기 전용·자동 빈 메모 삭제·폴더 전환 시 flush·debounce 저장·핀 토글·삭제·복원·휴지통 비우기 모두 동작.

## 11. 리스크 / 메모

- **`tiptap-markdown` 패키지 선택**: TipTap 생태계에 동일 이름·다른 메인테이너 패키지가 여럿 존재 (`@aarkue/tiptap-markdown`, `tiptap-markdown` etc.). 구현 단계에서 다운로드/star 수와 마지막 commit 기준으로 가장 활발한 것 1개 픽 — 결정 시점에 ADR 한 줄 추가 권장.
- **단축어 학습 곡선**: macOS Notes는 `- ` 자동 변환 안 함. 사용자가 Obsidian/VS Code 사용 경험이 있어야 자연스러움. (브레인스토밍 단계에서 사용자가 Obsidian 패턴 선호한다고 확인됨 — 영향 없음)
- **저장 인디케이터의 "방금"**: 단순 timestamp 기반 — 30초·1분 단위로 화면 갱신하는 인터벌 없음. 사용자가 화면을 30초 응시해도 "방금"으로 머묾. **의도된 트레이드오프** (틱 비용 회피). 다음 typing 시 자연스럽게 갱신됨.
- **자체 파서 호환 가정**: 모든 기존 메모가 자체 파서 출력으로만 저장됐다는 전제. CLI에서 직접 INSERT 한 메모가 있다면 비표준 markdown 일 수 있음 — 실제 데이터 살펴서 한 번 확인.
- **macOS Notes 단축키 충돌**: ⌘⇧7/8/9 가 macOS 시스템 또는 Tauri webview 에서 가로채는 게 있는지 실측 필요. 충돌 시 ⌘⇧L (task) 같은 대안 매핑.
