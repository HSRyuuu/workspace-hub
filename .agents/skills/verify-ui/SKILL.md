---
name: verify-ui
description: Use when workspace-hub의 React, CSS, Vitest, frontend 설정 또는 Tauri 셸 UI 변경을 리뷰·PR 전에 검증해야 할 때.
disable-model-invocation: true
argument-hint: ""
---

# verify-ui

## Purpose

workspace-hub UI 변경의 다음 회귀를 자동 검증한다.

1. React/TypeScript 타입 계약
2. Vitest 컴포넌트·상호작용 회귀
3. ESLint 규칙과 diff whitespace
4. Design System CSS token 참조
5. Tauri 셸 command 등록·Rust 컴파일

## When to Run

- `app/src/**/*.ts`, `app/src/**/*.tsx`, `app/src/**/*.css` 변경 후
- `app/src-tauri/src/**/*.rs` command/handler 배선 변경 후
- UI 기능 구현 또는 디자인 시스템 적용 후
- 코드 리뷰나 PR 생성 전

## Related Files

| File | Purpose |
|---|---|
| `app/src/App.tsx` | 앱 셸과 섹션 배선 |
| `app/src/features/` | 도메인별 React UI·API·테스트 |
| `app/src/components/ui/` | 공유 UI 컴포넌트 |
| `app/src/styles/tokens.css` | 허용된 디자인 토큰 정의 |
| `app/src/styles/global.css` | 전역·도메인 스타일 |
| `app/src-tauri/src/` | Tauri command와 handler 등록 |
| `app/package.json` | typecheck/test/lint script |
| `app/src-tauri/Cargo.toml` | Tauri Rust crate 정의 |

## Workflow

### Step 1 — 변경·검사 표면 확인

```bash
git status --short -- app
rg --files app/src app/src-tauri/src | sort
```

- PASS: 변경 파일이 위 Related Files 범위와 매핑된다.
- FAIL: UI 변경이 검사 표면 밖에 있거나 신규 소스 루트가 누락됐다.
- 수정: Related Files와 이후 검사 명령을 실제 신규 경로에 맞게 갱신한다.

### Step 2 — Tauri 셸 Rust 검증

```bash
cargo test -p workspace-hub-app
```

- PASS: command 등록을 포함한 crate 테스트·컴파일이 모두 성공한다.
- FAIL: 컴파일 오류나 테스트 실패가 하나라도 있다.
- 수정: `app/src-tauri/src/handlers/`와 `lib.rs`의 command 계약·등록을 동기화한다.

### Step 3 — TypeScript 타입 검사

```bash
cd app && npm run typecheck
```

- PASS: `tsc --noEmit` exit 0.
- FAIL: 타입 오류가 하나라도 있다.
- 수정: Rust JSON 계약, feature `types.ts`, 컴포넌트 props와 호출부를 함께 맞춘다.

### Step 4 — Vitest 회귀 검사

```bash
cd app && npm test
```

- PASS: 모든 test file과 test가 통과한다.
- FAIL: 실패·timeout·unhandled error가 하나라도 있다.
- 수정: 실패한 동작을 재현하는 테스트와 구현을 동기화한다. fake timer 테스트는 microtask flush 여부도 확인한다.

### Step 5 — ESLint 검사

```bash
cd app && npm run lint
```

- PASS: warning 0, exit 0.
- FAIL: warning 또는 error가 하나라도 있다.
- 수정: 보고된 파일만 기존 코드 스타일에 맞춰 수정한다.

### Step 6 — Diff whitespace 검사

```bash
git diff --check -- app
```

- PASS: 출력 없음, exit 0.
- FAIL: trailing whitespace나 conflict marker가 보고된다.
- 수정: 해당 줄만 정리하고 다시 실행한다.

### Step 7 — Design token 참조 검사

```bash
for token in $(rg -o 'var\(--[a-z0-9-]+' app/src --glob '*.css' | sed 's/.*var(//' | sort -u); do
  if ! rg -q --glob '*.css' --fixed-strings -- "$token:" app/src \
    && ! rg -q --glob '*.{ts,tsx}' --fixed-strings -- "[\"$token\"" app/src \
    && ! rg -q --glob '*.{ts,tsx}' --fixed-strings -- "\"$token\":" app/src; then
    echo "MISSING: $token"
  fi
done
```

- PASS: `MISSING:` 출력 없음.
- FAIL: 참조한 `var(--...)`가 `tokens.css` 또는 사용 범위의 CSS에 정의되지 않았다.
- 수정: 오타면 참조를 고친다. 공유 디자인 값은 승인 후 `tokens.css`에 추가하고, 컴포넌트 내부 값은 해당 CSS 범위에 선언한다.

## Output Format

```markdown
## verify-ui 결과

| 항목 | 결과 |
|---|---|
| Tauri crate | PASS / FAIL |
| TypeScript | PASS / FAIL |
| Vitest | PASS / FAIL — N files / N tests |
| ESLint | PASS / FAIL |
| Diff whitespace | PASS / FAIL |
| Design tokens | PASS / FAIL |

판정: PASS / FAIL
```

## Exceptions

- `node_modules/`, `dist/`, `target/` 생성물은 검사 대상이 아니다.
- `git diff --check`가 표시하지 않는 신규 untracked 파일은 typecheck·Vitest·ESLint의 소스 탐색으로 검증하며, 최종 상태 목록에서 별도로 확인한다.
- `--bar-color`처럼 React style object 또는 CSS 범위에서 선언·소비하는 local custom property는 `tokens.css`에 없어도 위반이 아니다.
- 외부 라이브러리 내부 CSS custom property는 `app/src` 밖에 있으므로 token 검사 대상이 아니다.
- 수동 네이티브 창 QA가 macOS 권한 때문에 불가능할 수 있다. 이때 자동 테스트 결과와 스킵 사유를 함께 보고한다.

## Common Mistakes

- `npm test`만 실행하고 typecheck·lint를 생략하지 않는다.
- React 테스트만 통과했다고 Tauri command 등록이 유효하다고 가정하지 않는다.
- token 검사에서 `rg`의 `--`를 빼 `--color-*`를 옵션으로 해석하게 만들지 않는다.
