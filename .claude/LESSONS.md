# workspace-hub Lessons

> 사용자 피드백·수정 사항을 모아 **같은 실수를 반복하지 않도록** 한다.
> Claude는 **매 세션 시작 시 이 파일을 가장 먼저 읽고**, 현재 작업 영역에 해당하는 lesson을 의식적으로 적용한다.

---

## 자기계발 순환 (운영 규칙)

1. **기록 (Record)** — 사용자가 수정·정정·"이렇게 하지 마" / "이거 다시 해" 같은 피드백을 주면, 즉시 아래 **Lessons** 섹션 맨 위에 새 항목을 추가한다.
2. **규칙화 (Rule-ify)** — "사용자가 X를 싫어했다"로 끝내지 않는다. **"다음부터 무엇을 다르게 할 것인가"**를 한 문장 규칙으로 적는다.
3. **반복 적용 (Apply)** — 매 세션 시작 시 lesson 목록을 훑고, 현재 작업과 관련된 항목을 적용한다.
4. **격상 (Escalate)** — 같은 실수가 한 번 더 반복되면 새 항목을 만들지 말고 **기존 항목을 강화**한다.

---

## Lesson 형식

```markdown
### YYYY-MM-DD — <한 줄 요약>

- **Trigger**: <어떤 작업·요청이었는지 — 1~2줄>
- **문제**: <Claude가 한 행동, 왜 잘못이었는지 — 1~2줄>
- **Rule**: <다음부터 지킬 한 줄 규칙 — 단정적·구체적>
- **적용 영역**: <영향받는 파일·작업 종류·도메인 — 쉼표로 구분>
- **반복 횟수**: 1
- **승격 후보**: no
```

---

## Lessons (최신 위에 추가)

> Reset 2026-05-18 — 적립한 lesson 이 실제로 적용되지 않은 채 디자인 churn 이 반복되어 비움. 다음 lesson 부터는 매 세션 시작에 반드시 훑고 적용한다.

### 2026-06-29 — 캘린더 상단 컨트롤과 월 그리드 사이 여백 유지

- **Trigger**: 캘린더 월 변경 버튼 영역과 월 그리드가 다시 붙어 보여, 이전에 고친 간격이 누락된 회귀 수정 요청.
- **문제**: `.cal-toolbar` 다음에 `.cal-split` 이 바로 이어지는데 툴바 하단 spacing 규칙이 없어 월 그리드 border 가 버튼 영역에 붙어 보임.
- **Rule**: 캘린더 상단 컨트롤을 수정할 때는 `.cal-toolbar` 아래 여백이 유지되는지 확인하고, 월 그리드의 top border 와 버튼 바닥이 붙지 않게 한다.
- **적용 영역**: `app/src/styles/global.css`, `app/src/features/calendar/CalendarPage.tsx`, 캘린더 레이아웃 변경.
- **반복 횟수**: 1
- **승격 후보**: no

### 2026-05-18 — debounce save 는 selection 전환 진입점마다 명시적 flush 필요

- **Trigger**: 메모 앱 재구성에서 selectedId 토글로 Editor mount/unmount 구조로 바꾼 직후, "새 메모 입력 → 뒤로가기 → 다시 그 메모 클릭" 시 입력 내용이 사라지는 회귀.
- **문제**: `setSelectedId(null)` 만 호출하면 saveTimer 가 아직 살아있어도 OK 라 가정했지만, 같은 메모를 timer fire 전에 다시 선택하면 useEffect 가 `m.body` (저장 전 값)로 `draftBody` 를 덮어씀. 그 후 timer fire 가 DB 만 갱신해서 UI ↔ DB 불일치. setState 의존만으론 race 가 안 잡힘.
- **Rule**: debounce 저장이 있는 컴포넌트에서, 편집 대상이 바뀌거나 화면을 떠나는 모든 진입점(뒤로가기 / ESC / scope 전환 / 컴포넌트 unmount)에서 **명시적 `flushPendingSave()` 호출 후** state 변경. `useCallback` helper 하나로 추출해 중복 없이.
- **적용 영역**: `app/src/features/memo/MemoPage.tsx` (기본 패턴), 향후 캘린더·프로젝트 등 debounce 저장을 추가하는 다른 도메인.
- **반복 횟수**: 1
- **승격 후보**: no

### 2026-05-18 — 디자인 토큰은 사용 컨텍스트의 배경 위에서 contrast 검증

- **Trigger**: ADR-0011 적용에서 `--color-primary-soft: #f4f4f5` 를 sidebar/list selected 배경으로 채택했더니, 실제 화면에서 거의 안 보임.
- **문제**: 토큰 값 (#f4f4f5) 자체만 보고 "옅은 회색이니 OK" 로 판단했지만, 사이드바·메인 패널의 캔버스 (#ffffff) 와 차이가 거의 없었음. `pnpm tauri dev` 로 실제 띄워보지 않은 채 코드 리뷰만으로 통과시킴.
- **Rule**: 토큰을 추가하거나 값을 바꿀 때, **`global.css` 의 배경(.memo-sidebar, .memo-shell, .todo-shell, 등)과 함께 hex 값 비교**. 차이가 10 step 이하(예: #fff vs #f4f4f5)면 거의 안 보임 — 최소 한 단계 더 진하게 (#e4e4e7 등). 가능하면 visual 검증을 코드 리뷰 전에 한 번이라도 끼워넣기.
- **적용 영역**: `app/src/styles/tokens.css`, `app/src/styles/global.css`, 새로운 디자인 토큰 도입 시 전체.
- **반복 횟수**: 1
- **승격 후보**: no
