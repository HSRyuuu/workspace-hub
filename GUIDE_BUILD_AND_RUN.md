# workspace-hub Build & Run

> Reset 2026-05-18 — v0.1 코드 안정화 시점에 실제 명령 기준으로 다시 작성.

---

## 사전 조건

- Rust (cargo, rustc)
- Node.js 22.13+ (`nvm use` 권장)
- pnpm 11.9+
- macOS

## CLI 빌드·실행

```sh
cargo build --release -p workspace-hub-cli
./target/release/workspace-hub-cli --help
```

CLI 명령·옵션을 바꾸면 정적 명세도 갱신한다 (`spec_matches_checked_in_docs` 테스트가 불일치를 잡는다).

```sh
./target/debug/workspace-hub spec > docs/CLI_SPEC.md
```

## AI 스킬 / CLI sidecar

- 앱은 CLI 를 `externalBin`(`workspace-hub-cli`)으로 번들한다. `pnpm tauri dev|build` 가 `app/scripts/build-cli.sh` 로 자동 준비한다.
- 새로 clone 한 직후 `cargo test --workspace` 처럼 앱 crate 를 직접 빌드하려면 먼저 `sh app/scripts/build-cli.sh` 를 한 번 실행한다 (tauri-build 가 sidecar 파일 존재를 검사).
- 설정 → AI 스킬에서 `skill/SKILL.md` + CLI `spec` 출력을 `~/.claude/skills/workspace-hub`, `~/.codex/skills/workspace-hub` 에 설치·업데이트한다.

## Tauri 앱 개발 모드

```sh
cd app
pnpm install
pnpm tauri dev
```

## 데이터 위치

`~/.workspace-hub/workspace-hub.sqlite`
