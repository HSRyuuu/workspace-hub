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

## 메모 도메인

| 파일 | 책임 |
|---|---|
| `app/src/features/memo/markdown.ts` | markdown 첫 줄에서 메모 타이틀을 추출하는 `firstLineAsTitle` 헬퍼만. 직렬화는 TipTap 의 `tiptap-markdown` extension 이 담당. |
| `app/src/features/memo/useSaveIndicator.ts` | 메모 저장 상태(idle/saving/saved) 머신 + 상대 시간 포맷. MemoPage 에서 사용. |

## 새 도메인 추가 체크리스트

_v0.1 동작이 안정된 뒤 코드 패턴이 굳으면 작성._
