# workspace-hub

> 흩어져 있던 **TODO · 캘린더 · 메모 · 작업공간 바로가기**를 한 곳에 모아주는 macOS 데스크톱 앱.

개인용으로 만든 도구이지만 코드를 공개합니다. 같은 문제(여러 노트앱·캘린더·바로가기를 왔다 갔다 하는 피로)를 겪고 있다면 가져다 써도 좋습니다.

---

## 특징

- **로컬 우선** — 모든 데이터는 `~/.workspace-hub/` SQLite에 저장. 외부 네트워크 호출 없음.
- **한 화면에 4가지** — TODO · 캘린더 · 메모 · 워크스페이스(디렉토리·앱·URL 바로가기 묶음).
- **macOS 네이티브** — Tauri v2 기반. 가볍고 빠르게 뜬다.
- **외부 캘린더 연동 없음** — Google/iCloud 연동은 의도적으로 빼고 앱 내부 캘린더만.

상세 기획·범위는 [`docs/PROJECT_OVERVIEW.md`](./docs/PROJECT_OVERVIEW.md) 참고.

---

## 시스템 요구사항

- **macOS** (Apple Silicon / Intel)
- 그 외 OS는 지원하지 않습니다.

---

## 설치 — 소스에서 빌드

배포된 `.dmg`를 따로 제공하지 않고, **저장소를 clone 해서 본인 머신에서 빌드**하는 방식입니다. 본인이 직접 빌드한 앱은 macOS Gatekeeper의 quarantine 대상이 아니라 별도 우회 명령 없이 바로 실행됩니다.

### 사전조건 (한 번만)

```bash
brew install pnpm
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh   # rustup
xcode-select --install                                            # 이미 있으면 skip
```

### 설치 (install.sh 사용 — 권장)

```bash
git clone https://github.com/HSRyuuu/workspace-hub.git
cd workspace-hub
./install.sh
```

`install.sh` 는 사전조건 확인 → 의존성 설치 → `pnpm tauri build` → `/Applications` 으로 복사까지 한 번에 수행합니다. 빌드 자체는 수 분 소요됩니다(첫 빌드 기준).

### 설치 (수동)

스크립트를 쓰지 않고 직접 빌드하고 싶다면:

```bash
git clone https://github.com/HSRyuuu/workspace-hub.git
cd workspace-hub/app
pnpm install
pnpm tauri build
cp -R src-tauri/target/release/bundle/macos/workspace-hub.app /Applications/
```

설치 후 Launchpad/Finder 에서 `workspace-hub` 검색 → 더블클릭으로 실행.

> 코드사이닝·노타라이즈(Apple Developer Program $99/년)는 개인 프로젝트 범위라 생략했습니다. 그래서 사전 빌드된 `.dmg` 대신 소스 빌드 방식을 택했습니다.

---

## 데이터 위치

모든 데이터는 다음 경로에 저장됩니다.

```
~/.workspace-hub/workspace-hub.sqlite
```

- 백업하려면 위 폴더를 그대로 복사해두면 됩니다.
- 앱을 삭제해도 데이터는 남습니다. 완전 삭제하려면 `~/.workspace-hub/` 디렉토리도 함께 지우세요.

---

## 구조

| 영역 | 위치 | 설명 |
|---|---|---|
| Desktop Shell | `app/` | Tauri v2 + React + TypeScript |
| 도메인·DB 로직 | `core/` | `workspace-hub-core` crate. 단일 진실 원천 |
| CLI | `cli/` | `workspace-hub` 바이너리. `core` 를 감싼 JSON 출력 |

코드 위치 상세는 [`docs/SOURCE_MAP.md`](./docs/SOURCE_MAP.md).

---

## 라이선스

[MIT](./LICENSE)
