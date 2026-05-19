# workspace-hub Architecture Decision Records

> Reset 2026-05-18 — 디자인·아키텍처 결정이 v0.1 MVP 가 끝나기 전에 두 번 뒤집힌 churn 을 정리하기 위해 비움.
> v0.1 MVP 가 동작·디자인 양쪽으로 잡힌 뒤, 되돌리기 어려운 결정만 다시 ADR 로 기록한다.

---

## 인덱스

| # | 결정 | 상태 | 날짜 | 태그 |
|---|------|------|------|------|
| 0011 | 검정 ink primary 는 CTA 전용, selected 표시는 옅은 회색 | Accepted | 2026-05-18 | design-system, color |
| 0012 | Tauri 셸은 `core` 를 in-process 호출 (CLI sidecar 폐기) | Accepted | 2026-05-18 | architecture, ipc |

> 상태 표기:
> - **Proposed** — 검토 중, 아직 미적용
> - **Accepted** — 채택, 코드/인프라에 반영됨 (또는 반영 예정)
> - **Superseded by ADR-NNNN** — 후속 결정으로 대체됨 (원문은 그대로 둠)
> - **Deprecated** — 더 이상 적용되지 않음, 후속 결정도 없음

---

## ADR-0011: 검정 ink primary 는 CTA 전용, selected 표시는 옅은 회색

- **상태**: Accepted
- **날짜**: 2026-05-18

### 결정

`--color-ink` 검정 배경은 primary CTA 버튼(예: `+ 새 메모`, 우선순위 토글 active, 체크박스 체크 상태)에 한정한다. 사이드바·List·트리의 selected/active 표시는 `--color-primary-soft` 배경 + `--color-ink` 텍스트 + `font-weight: 600` 으로 통일한다.

### 근거

- 사용자 피드백 — 모든 selected 표시에 검정 배경 + 흰 텍스트가 적용되어 화면 전반에 검정 블록이 과도하게 노출됨.
- macOS Notes 등 OS 네이티브 앱은 selected 에 옅은 톤을 쓰고 CTA 강조와 분리.
- TODO 도메인은 이미 `.todo-row.selected` 가 `--color-primary-soft` 를 사용 중. 다른 도메인이 이 패턴에 수렴.

### 영향 범위

- 글로벌 셸 사이드바(`.sidebar-item.active`)
- 메모 사이드바 row(`.memo-sidebar-row.selected`)
- 메모 폴더 row 자식 요소(chevron, icon-btn, badge)
- `.memo-list-row.selected` 정의는 제거됨 (List 에서 더 이상 선택 표시 안 함 — 클릭 즉시 Editor 전환)

### 유지되는 검정 사용처

- `+ 새 메모` 버튼 (사이드바 상단 풀폭 + List 헤더 아이콘)
- `.prio-toggle.active` (우선순위 토글)
- 체크박스 체크 상태
- `.tabs-underline .tab.active` (텍스트 색만 ink)

### 보류된 범위

- 캘린더 도메인(`.cal-bar.selected`, `.ws-cal-cell.selected`) — Design System v0.2 마이그레이션 보류 상태라 별도 ADR/작업으로 분리.

### 참조

- 스펙: `docs/design-drafts/2026-05-18-memo-restructure-design.md`
- 구현: commit `4823225` (CSS 토큰), commits `dd99b51`, `e8bf0cb`, `f1a1816`, `f8e47d0` (구조/wiring/follow-up)

---

## ADR-0012: Tauri 셸은 `core` 를 in-process 호출 (CLI sidecar 폐기)

- **상태**: Accepted
- **날짜**: 2026-05-18

### 결정

Tauri 셸은 `workspace-hub-core` crate 를 cargo workspace 의존으로 직접 호출한다. 앱 시작 시 `db::open()` 으로 단일 `Connection` 을 열고 `Mutex<Connection>` 을 Tauri State 로 공유한다. 더 이상 `workspace-hub` CLI 바이너리를 sidecar 로 spawn 하지 않는다.

CLI(`cli/` crate)는 그대로 유지하되 **Claude Code 스킬 전용 외부 인터페이스**로 역할을 좁힌다. CLI 도 같은 `core` 를 호출하므로 두 호출 경로의 도메인 동작은 동일하다.

### 근거

- **버그 클래스 제거**: 메모 삭제·todo 갱신 등에서 sidecar 호출이 `error: unexpected argument '- ' found` 같은 clap 파싱 에러를 일으켰다. JSON → CLI args → clap → stdout JSON 경로의 인자 이스케이프 버그가 구조적으로 사라진다.
- **응답성**: process spawn + stdout 파싱 오버헤드(macOS 기준 한 호출 약 2~5ms)를 제거. UI 의 read-after-write 가 즉시.
- **동시성 제어 용이**: 단일 `Mutex<Connection>` 으로 모든 invoke 핸들러를 직렬화. SQLite WAL + busy_timeout 에만 의존하던 멀티프로세스 시나리오보다 race window 가 좁다.
- **타입 안전**: Tauri command 가 `Result<Memo, String>` 같이 모델 struct 를 직접 반환 → Tauri 의 serde 직렬화가 한 번만 일어남. 기존엔 `serde_json::Value` 로 중간 변환이 끼어 있었다.
- **코어 분리는 이미 끝난 상태**: 도메인 로직은 이미 `workspace-hub-core` crate 로 분리되어 있었다(CLI 가 그걸 의존). 이번 결정은 Tauri 도 같은 의존을 추가하는 것뿐 — 큰 리팩토링 없이 적용 가능했다.

### 영향 범위

- `app/src-tauri/Cargo.toml` 에 `workspace-hub-core` + `rusqlite` workspace 의존성 추가.
- `app/src-tauri/src/lib.rs` 의 35개 `#[tauri::command]` 핸들러 전부 `repo::*` 직접 호출로 교체. `run_cli()` / `cli_path()` 헬퍼 제거.
- 프런트엔드 호출 시그니처(`invoke('memo_delete', { id })` 등)는 변경 없음 — 응답 JSON shape 도 모델 struct 의 `Serialize` 가 기존 CLI stdout JSON 과 동일하게 만들어 호환 유지.

### 트레이드오프 / 보류된 사항

- **DB 동시 접근**: Tauri 앱과 CLI 가 동시에 실행되면 같은 SQLite 파일에 두 프로세스가 붙는다. WAL + 5s busy_timeout 으로 충돌은 회피되지만, 동시 마이그레이션(앱 시작과 CLI 호출이 V### 적용을 동시에 시도) race 가 이론상 존재. 1인 사용 시 거의 발생하지 않으나, `core/src/db.rs` 의 `INSERT INTO schema_version` 을 `INSERT OR IGNORE` 로 바꾸는 후속 작업으로 방어 가능.
- **에러 직렬화**: `CoreError → String` 으로 단순 평탄화. NotFound/InvalidInput/Parse 만 사람 친화 매핑이고 Sqlite/Io 는 raw `to_string()`. 프런트엔드가 에러 종류별로 분기해야 할 일이 생기면 `#[serde(tag="kind")]` 구조 응답으로 전환.
- **Add 버튼 연타 race(중복 생성)**: 이 결정으로 해결되지 않는다. `Mutex<Connection>` 은 손상은 막지만 두 번 호출되면 두 row 가 생긴다. UI 측 디바운스/disable 이 필요.

### 슈퍼시드된 결정

이전 PROJECT_OVERVIEW.md 의 "Tauri는 CLI 를 sidecar 로 호출한다" 문구는 본 ADR 로 무효화. 문서에서도 갱신.

### 참조

- 구현: `app/src-tauri/Cargo.toml`, `app/src-tauri/src/lib.rs` (단일 PR/커밋)
- 관련 문서: `docs/PROJECT_OVERVIEW.md` (호출 흐름), `docs/DB_SCHEMA.md` (접근 범위), `docs/SOURCE_MAP.md` (디렉터리 역할), `.claude/CLAUDE.md` (전체 구조 요약)
