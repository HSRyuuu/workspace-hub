---
name: verify-domain
description: workspace-hub 의 Rust 도메인(core + cli) 자동 QA. `cargo test --workspace` 를 실행하고, 사용자 데이터 디렉토리(`~/.workspace-hub/`)가 테스트로 변경되지 않았음을 md5 로 검증한다.
disable-model-invocation: true
argument-hint: ""
---

# verify-domain

## 목적

workspace-hub 의 Rust 도메인 레이어(`core` 단위 + `cli` 통합) 가 회귀 없이 동작하는지 자동 검증한다. 이 스킬은 다음을 보장한다:

1. `core` 단위 테스트 통과 (도메인 모델·repo CRUD·`normalize_iso_date`·마이그레이션 idempotency)
2. `cli` 통합 테스트 통과 (JSON 출력 형식·exit code 매핑·status 필터·격리)
3. **테스트가 사용자 데이터(`~/.workspace-hub/workspace-hub.sqlite`)를 건드리지 않았음** — 모든 테스트는 `tempfile::TempDir` 로 격리되며, 이 검증은 실측 md5 비교로 한 번 더 보증한다.

## 실행 시점

- 새로운 도메인(memo / event / workspace 등) 을 추가한 후
- core/cli 의 모델·repo·command 시그니처를 변경한 후
- v0.2+ 의 마이그레이션 V002+ 를 추가한 후
- PR 전 통합 검증 (`/verify-implementation` 호출 시 자동 포함)

## 사전 조건

- Rust toolchain 이 PATH 에 있어야 한다 (rustup 설치 + `. "$HOME/.cargo/env"`).
- Cargo workspace 가 워킹 트리 루트에 존재 (`Cargo.toml`).
- 부재 시 보고: "Rust toolchain 부재 — cargo 가 PATH 에 없습니다. BUILD_AND_RUN.md §1 참고."

## 워크플로우

### Step 1 — 사용자 데이터 격리 베이스라인 캡처

```bash
SNAPSHOT_BEFORE=$(ls -la ~/.workspace-hub/ 2>/dev/null | md5)
```

부재 시(`~/.workspace-hub/` 가 아예 없음)도 정상 — 빈 해시가 저장된다.

### Step 2 — 워크스페이스 테스트 실행

```bash
. "$HOME/.cargo/env" 2>/dev/null
cargo test --workspace 2>&1 | tail -80
```

다음 항목을 확인한다:
- 컴파일 에러 없음
- 단위 테스트 (core/tests/repo_todo.rs) 모두 통과 — 현재 16건
- 통합 테스트 (cli/tests/cli_integration.rs) 모두 통과 — 현재 11건
- doc-tests 실패 없음
- 합계 `test result: ok` 표시

실패 발견 시:
- 실패 테스트 이름과 패닉/assert 메시지를 발췌해 보고
- 가능한 원인을 한 줄로 (예: "core/src/models/todo.rs 의 TodoStatus variant 추가 후 cli/src/commands/todo.rs 의 ListStatus 미동기화")

### Step 3 — 데이터 격리 사후 검증

```bash
SNAPSHOT_AFTER=$(ls -la ~/.workspace-hub/ 2>/dev/null | md5)
```

`SNAPSHOT_BEFORE` 와 비교한다:
- 일치 → **PASS** (격리 보증)
- 불일치 → **FAIL — Critical**. 즉시 보고하고 어떤 테스트가 `WORKSPACE_HUB_DATA_DIR` 또는 `db::open_at()` 을 우회했는지 추적. 사용자 데이터가 변경됐을 가능성을 명시.

### Step 4 — 통합 보고

```markdown
## verify-domain 결과

| 항목 | 결과 |
|---|---|
| core 단위 (core/tests/repo_todo.rs) | ✅ N passed |
| cli 통합 (cli/tests/cli_integration.rs) | ✅ N passed |
| 사용자 데이터 격리 (md5 일치) | ✅ |
| 소요 시간 | ~XXX ms |

판정: PASS / FAIL
```

## Exceptions

다음은 위반이 아니다:

- `~/.workspace-hub/` 가 테스트 시작 시점에 부재 — 정상. 사용자가 아직 앱을 실행하지 않은 환경.
- doc-tests 0건 — 본 프로젝트는 doc-test 미사용 (`---` 표시는 단순히 섹션 구분).
- `assert_cmd` / `tempfile` 등 dev-dependencies 만의 변경 — 도메인 변경 아님, 결과 영향 없음.
- 워크스페이스 멤버 추가(예: 새 crate) 시 테스트 0건 — 신규 crate 가 아직 테스트를 갖지 않은 정상 상태.

## 관련 파일

| 영역 | 경로 |
|------|------|
| core 단위 테스트 | `core/tests/repo_todo.rs` |
| cli 통합 테스트 | `cli/tests/cli_integration.rs` |
| 격리 진입점 | `core/src/db.rs::open_at(path)` |
| 격리 env 오버라이드 | `core/src/paths.rs::data_dir` (`WORKSPACE_HUB_DATA_DIR`) |
| 마이그레이션 레지스트리 | `core/src/db.rs::MIGRATIONS` |

## 새 도메인 추가 시 갱신 의무

`docs/SOURCE_MAP.md` 의 **새 도메인 추가 체크리스트** 11 단계 중 일부는 본 스킬의 검증 대상을 늘린다:

- 단계 4 (Repository) → `core/tests/<domain>_repo.rs` 추가 (todo 의 거울)
- 단계 5 (CLI 명령) → `cli/tests/cli_integration.rs` 의 케이스 확장 또는 `cli/tests/<domain>_cli.rs` 추가

새 도메인 작업 후 `/manage-skills` 가 본 스킬을 자동 업데이트하도록 한다.
