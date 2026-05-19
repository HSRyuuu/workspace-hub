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

## 설치 — .dmg 다운로드

1. [Releases](https://github.com/HSRyuuu/workspace-hub/releases) 에서 최신 `.dmg` 다운로드
2. `.dmg` 더블클릭 → `workspace-hub.app` 을 `/Applications` 으로 드래그
3. **첫 실행 시 Gatekeeper 경고**가 뜹니다. 코드사이닝이 안 되어 있어 그렇습니다. 터미널에서 한 번만 실행:

   ```bash
   xattr -dr com.apple.quarantine /Applications/workspace-hub.app
   ```

   이후로는 정상적으로 실행됩니다.

> 코드사이닝과 노타라이즈는 Apple Developer Program 비용($99/년)이 들기 때문에 개인 프로젝트 범위에서는 생략했습니다.

---

## 데이터 위치

모든 데이터는 다음 경로에 저장됩니다.

```
~/.workspace-hub/workspace-hub.sqlite
```

- 백업하려면 위 폴더를 그대로 복사해두면 됩니다.
- 앱을 삭제해도 데이터는 남습니다. 완전 삭제하려면 `~/.workspace-hub/` 디렉토리도 함께 지우세요.

---

## 직접 빌드해서 쓰기

릴리스 .dmg 대신 소스에서 빌드하고 싶다면:

### 사전조건

- Rust (rustup, 안정판) — `rustc >= 1.78`
- Node.js 20+ / pnpm
- Xcode Command Line Tools (`xcode-select --install`)

### 빌드

```bash
git clone https://github.com/HSRyuuu/workspace-hub.git
cd workspace-hub/app
pnpm install
pnpm tauri build
```

결과물:

```
app/src-tauri/target/release/bundle/dmg/workspace-hub_*.dmg
app/src-tauri/target/release/bundle/macos/workspace-hub.app
```

`.app` 을 `/Applications` 에 끌어다 놓으면 됩니다. 본인이 직접 빌드한 앱은 Gatekeeper quarantine 이 안 붙어 위의 `xattr` 명령 없이 바로 실행됩니다.

상세한 빌드 환경 사전조건은 [`BUILD_AND_RUN.md`](./BUILD_AND_RUN.md) 참고.

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
