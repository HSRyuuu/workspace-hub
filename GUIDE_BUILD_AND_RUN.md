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

## Tauri 앱 개발 모드

```sh
cd app
pnpm install
pnpm tauri dev
```

## 데이터 위치

`~/.workspace-hub/workspace-hub.sqlite`
