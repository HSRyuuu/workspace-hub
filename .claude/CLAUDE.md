# workspace-hub

> 흩어져 있던 **TODO·캘린더·메모·작업공간 바로가기**를 한 곳에 모아주는 macOS 데스크톱 앱.
> (코드명 `workspace-hub` — UI 표시 이름은 미정)

### 프로젝트 개요

프로젝트의 상세 내용은 **`docs/PROJECT_OVERVIEW.md`** 에 작성되어있다.

- **타깃**: 본인(현식) 1인용. macOS 데스크톱 전용. 단일 사용자·로컬 우선.
- **구조**: Tauri v2 + React 셸 → Rust `core` 라이브러리(`workspace-hub-core`) → SQLite. `core`가 도메인·DB의 단일 진실 원천. Tauri 앱은 `core`를 in-process 의존으로 직접 호출(ADR-0012).
- **두 호출자**: Tauri UI는 `core`를 라이브러리로 직접 호출. Claude Code 스킬은 같은 `core`를 감싼 `workspace-hub` CLI 바이너리를 호출 (JSON I/O 기본, `--human` 플래그).
- **외부 의존 없음**: 네트워크 호출 금지. 동기화·클라우드·외부 캘린더는 v0.5 이후 보류.
- **현재 상태**: v0.2 진행 중 — schedule / memo / project 도메인 추가 완료. **Design System v0.2 적용 (ADR-0010)**: TODO · 메모 · 프로젝트 도메인이 공유 UI 컴포넌트로 일관화 (검정 ink primary + 라벨 사이드바 + dot 칩 + underline 탭). 캘린더 도메인 마이그레이션 보류. 새 도메인 작업 시 [`docs/SOURCE_MAP.md`](../docs/SOURCE_MAP.md#새-도메인-추가-체크리스트)의 체크리스트를 따른다.

이 문서는 Claude가 매 세션에 가장 먼저 읽는다. 따라서 **고정된 규약과 진입점만** 두고, 영역별 상세 지침은 아래 [문서 매핑](#문서-매핑) 표에서 필요할 때 끌어다 쓴다 (점진적 공개).

---

## Core Principles

- 코딩시에 흔히 발생하는 오류를 줄이기 위한 지침입니다.
- TRADE-OFF: 이 지침은 속도보다는 신중함을 우선시합니다. 사소한 작업의 경우 판단력을 발휘하세요.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

BEFORE IMPLEMENTING:

- 가정한 내용을 명확하게 밝히세요. 확실하지 않으면 질문하세요. **CLARIFY FIRST**
- 여러 가지 해석이 가능하다면, 모두 제시하십시오. **DONT PICK SILENTLY**
- 더 간단한 방법이 있다면 언급하십시오. 필요하다면 반박하십시오. **CHALLENGE ASSUMPTIONS**
- 이해가 안 되는 부분이 있으면 멈추세요. 무엇이 헷갈리는지 말하고 질문하세요. **ASK, DON'T GUESS**

### 2. Simplicity First

**Minimum code that solves problem**

- 명시적으로 요청한 기능 외에는 추가 기능이 없습니다.
- 일회용 코드에는 추상화가 필요없습니다.
- 요청하지 않은 "유연성"이나 "설정 가능성"은 없습니다.
- 발생 불가능한 시나리오에 대한 오류 처리는 하지 않습니다.
- 200줄을 썼는데 50줄로 줄일 수 있다면 다시 작성하세요.
- 임시방편(hack)처럼 느껴지는 해결책이라면, 지금 아는 것을 모두 동원해 더 우아한 방안으로 다시 실행하세요.

ASK YOURSELF: "시니어 엔지니어가 이것이 지나치게 복잡하다고 말할까?" 라고 질문하세요. 만약 그렇다면, 단순화(**SIMPLIFY**)하세요.

### 3. Sugical Changes

**Touch only what you must. Clean up only your own mess.**

기존 코드를 편집할 때:

- 인접한 코드, 주석, 서식 등을 "개선" 하지 마세요.
- 멀쩡한 것을 굳이 리팩터링 하지 마세요.
- 기존 스타일과 일치시키세요. 당신이 더 나은 코드를 짜더라도 기존 스타일이 우선입니다.
- 관련 없는 사용되지 않는 코드 (Dead Code)를 발견하면 절대 삭제하지말고, 언급해주세요.

변경 사항으로 인해 고아 파일이 생성되는 경우:

- 사용자가 변경한 내용으로 인해 더 이상 사용되지 않는 import, var, func 를 제거하세요.
- 따로 요청받지 않는 한 기존의 사용되지 않는 코드를 삭제하지 마세요.

The Test: 변경된 모든 줄은 사용자의 요청과 직접적으로 연결되어야 합니다.

### 4. Goal-Driven Execution

**Define Success Criteria. Loop Until Verified.**

과제를 검증 가능한 목표로 전환:

- "유효성 검사 추가" -> "유효하지 않은 입력에 대한 테스트를 작성하고, 해당 테스트를 통과하도록 만들기"
- "버그 수정" -> "버그를 재현하는 테스트를 작성하고, 해당 테스트를 통과하도록 만들기"
- "리팩토링" -> "변경 전후에 테스트가 통과하도록 만들기"

여러 단계를 거치는 작업의 경우 간략한 계획을 제시하십시오.

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

명확한 성공 기준은 독립적인 반복 작업을 가능하게 하고, 모호한 기준("make it work")은 지속적인 명확화를 요구합니다.

---

## Workflows

- 복잡한 작업시에 아래 워크플로우를 준수하세요.
- TRADE-OFF: 이 지침은 신중함을 우선시합니다. 사소한 작업의 경우 판단력을 발휘하세요.

### 1. Planning default

- 복잡하거나 까다로운 작업(3단계 이상 또는 구조적 결정)을 수행하기 전에는 **항상 계획(PLANNING)**을 먼저 세우세요.
- 작업중 일이 잘못되면 즉시 멈추고 다시 계획하세요. **DONT KEEP PUSHING**
- 구현, 빌드모드 뿐만 아니라 계획모드(PLANNING)을 사용해서 검증 단계를 수행하세요.
- 불확실성을 줄이기 위해 사전에 상세한 사양(SPEC)을 먼저 정의하세요.

### 2. Subagent Strategy

- Main Context Window를 깨끗하게 유지하기 위해 **SubAgent** 적극적으로 활용하세요.
- 연구, 탐색 및 병렬 분석을 SubAgent로 넘기세요.
- 복잡한 문제의 경우 SubAgent를 통해 더 많은 컴퓨팅 자원을 투입하세요.
- 집중적인 실행을 위해 Subagent하나 당 하나의 전략만 사용합니다. **ONE TASK PER SUBAGENT**

### 3. Self-Improvement Loop

- 사용자의 수정사항이 있을 경우 **`.claude/LESSONS.md`** 에 정해진 패턴으로 업데이트하세요.
- 같은 실수를 반복하지 않도록 스스로 규칙을 정하세요.
- 오류율이 떨어질 때까지 이러한 교훈들을 냉정하게 반복 적용하세요.
- 세션 시작 시 LESSONS 내용을 리뷰하세요.

### 4. Verification Before Done

- 작업이 제대로 작동하는지 확인하기 전에는 절대로 작업을 완료로 표시하지 마세요.
- 관련성이 있을 경우, Main버전과 변경 사항 간의 동작 차이를 확인하세요.
- ASK YOURSELF: **"동료 엔지니어가 이것을 승인할까?"**
- RUN TESTS, CHECK LOGS, DEMONSTRATE CORRECTNESS

### 5. Autonomous Bug Fixing
- 버그 신고를 받으면 바로 수정하세요. 일일히 설명해달라고 하지 마세요.
- **로그, 오류, 실패한 테스트**에 집중하세요. 그 다음에 해결하세요.
- 사용자는 컨텍스트 전환이 전혀 필요하지 않습니다.

## 문서 매핑

### 프로젝트 스킬

| 스킬                      | 용도                                                                          |
| ------------------------- | ----------------------------------------------------------------------------- |
| `/manage-skills`          | 세션 변경사항을 분석해 verify-* 스킬을 생성/갱신, 등록 목록 관리              |
| `/verify-implementation`  | 등록된 모든 verify-* 스킬을 순차 실행하여 통합 검증 보고서 생성               |
| `/update-project-docs`    | 작업 문서를 코드베이스 실제 상태와 비교해 드리프트 동기화                     |

### 외부문서

| 문서                          | 용도                                                                |
| ----------------------------- | ------------------------------------------------------------------- |
| `docs/PROJECT_OVERVIEW.md`    | 프로젝트 정체성·기술 스택·마일스톤·핵심 링크                        |
| `docs/SOURCE_MAP.md`          | 소스코드 라우팅 맵 + **새 도메인 추가 체크리스트** (v0.2 진입 시 필독) |
| `docs/DB_SCHEMA.md`           | DB 테이블·컬럼·제약·접근 범위                                       |
| `docs/DEPLOY.md`              | 인프라·도메인·환경변수·롤백 절차                                    |
| `docs/DESIGN.md`              | 디자인 시스템 — 색상 팔레트·타이포·컴포넌트 스타일                  |
| `docs/ADR.md`                 | Architecture Decision Records — 되돌리기 어려운 결정 로그           |
| `BUILD_AND_RUN.md`            | 빌드·실행 사전조건(아이콘, cargo PATH) + CLI/Tauri 실행 절차        |
| `.claude/LESSONS.md`          | 사용자 피드백 누적, 자기개선 순환                                   |
