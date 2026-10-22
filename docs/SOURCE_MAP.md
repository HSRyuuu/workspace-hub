# workspace-hub Source Map

> Reset 2026-05-18 — 코드 구조와 drift 가 누적되어 비움. v0.1 MVP 가 끝나는 시점에 실제 코드 기준으로 다시 그린다.

---

## 디렉터리 개요

```
workspace-hub/
├── app/        # Tauri 셸 + React UI (`core` 를 in-process 호출, ADR-0012)
├── cli/        # `workspace-hub` CLI 바이너리 (Claude Code 스킬용 외부 인터페이스)
├── core/       # 도메인 모델·DB 접근 라이브러리 — Tauri/CLI 공통 의존
└── docs/       # 프로젝트 문서
```

## 도메인 라우팅

_각 도메인의 진입점·API·DB 테이블 매핑은 v0.1 완료 후 다시 정리._

## 앱 셸·테마·검색

| 파일 | 책임 |
|---|---|
| `app/src/App.tsx` | 라벨 사이드바(접기 상태 localStorage `wh.sidebar.collapsed`), 섹션 전환, ⌘1~5/⌘,/⌘K/⌘\ 단축키, TODO 개수 배지 |
| `app/src/theme.ts` | 테마 선택(system/light/dark) 저장·적용. 값은 `styles/tokens.css`, 첫 페인트 전 적용은 `index.html` 인라인 스크립트 |
| `app/src/features/search/` | ⌘K 팔레트 UI(`CommandPalette.tsx`)와 순수 검색 로직(`search.ts`) |
| `app/src/components/ui/ResizablePanel.tsx` | 목록 위에 겹쳐 뜨는 우측 상세 패널(경계선 드래그·키보드 폭 조절, Esc 닫기) |
| `app/src/features/calendar/MonthPicker.tsx` | 캘린더 툴바의 연·월 선택 팝업 |
| `app/src/features/today/TodayPage.tsx` | Today 대시보드(타일·7일 스트립·카드 4종) |
| `app/src/features/todo/dueLabel.ts` | 마감 표시("오늘"/"N일 지남") 공용 헬퍼 |
| `app/src/features/todo/grouping.ts` | 마감 시점별 그룹(지난 마감/오늘/이번 주/나중/기한 없음/완료) |
| `app/src/features/files/syntaxTheme.ts` | CodeMirror 하이라이트 색(`--syntax-*` 토큰) |

## 메모 도메인

| 파일 | 책임 |
|---|---|
| `app/src/features/memo/markdown.ts` | markdown 첫 줄에서 메모 타이틀을 추출하는 `firstLineAsTitle` 헬퍼만. 직렬화는 TipTap 의 `tiptap-markdown` extension 이 담당. |
| `app/src/features/memo/useSaveIndicator.ts` | 메모 저장 상태(idle/saving/saved) 머신 + 상대 시간 포맷. MemoPage 에서 사용. |

## 새 도메인 추가 체크리스트

_v0.1 동작이 안정된 뒤 코드 패턴이 굳으면 작성._
