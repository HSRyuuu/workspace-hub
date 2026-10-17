---
name: workspace-hub
description: Use when the user wants to read, add, edit, clean up, or organize their workspace-hub data — TODO, 캘린더 일정, 메모·메모 폴더. Triggers - "할 일 추가해줘", "TODO 정리해줘", "오늘 할 일 뭐야", "일정 잡아줘", "이번 주 일정 보여줘", "메모 남겨줘", "메모 폴더 정리해줘", "휴지통 비워줘", "workspace-hub".
---

# workspace-hub

사용자의 로컬 workspace-hub 앱 데이터(`~/.workspace-hub/`)를 아래 CLI 로 조회·수정한다.

```
CLI={{CLI}}
```

- 명세의 `workspace-hub ...` 는 모두 위 `$CLI` 로 실행한다. 예: `"$CLI" todo list --status open`
- 전체 명령·옵션은 [`references/cli-spec.md`](references/cli-spec.md). 처음 쓰는 명령은 반드시 명세를 먼저 확인한다.
- `$CLI` 가 없으면 앱이 이동·삭제된 것이다. 사용자에게 앱 설정 → AI 스킬에서 다시 설치하라고 안내한다.

## 규칙

1. **출력은 JSON** (stdout). `--human` 은 사용자에게 표로 보여줄 때만 쓴다.
2. **실패**: stderr 에 `error: ...`. 종료코드 1 = 입력 오류(not found·parse 포함), 2 = 시스템 오류.
3. **수정 전에 조회**: `update`/`delete` 전에 `list`/`get` 으로 id 와 현재 값을 확인한다. id 를 추측하지 않는다.
4. **파괴적 명령은 확인 후 실행**: `todo delete`, `schedule delete`, `memo purge`, `memo empty-trash`, `memo-folder delete`. 대상 목록을 보여주고 사용자 승인을 받는다. `memo delete` 는 휴지통 이동이라 `memo restore` 로 되돌릴 수 있다.
5. **일괄 정리**: 여러 건을 바꿀 때는 먼저 변경 계획(대상 id·전→후)을 표로 보여주고 승인받은 뒤 한 건씩 실행한다. 실행 후 결과를 다시 조회해 보고한다.
6. **날짜**: `YYYY-MM-DD` 또는 RFC3339. 시각이 있는 일정은 오프셋을 명시한다 (예: `2026-10-20T09:00:00+09:00`).
7. **본문**: 메모 본문은 markdown. 여러 줄은 `--body "$(cat <<'EOF' ... EOF)"` 처럼 heredoc 으로 넘긴다.
8. 앱 화면은 CLI 변경을 자동 반영하지 않는다. 수정 후 앱에서 해당 화면을 다시 열면 보인다고 알려준다.

## 자주 쓰는 명령

```bash
"$CLI" todo list --status open
"$CLI" todo add --title "보고서 초안" --due 2026-10-20 --priority high
"$CLI" todo update 12 --status hold
"$CLI" todo complete 12
"$CLI" schedule list --from 2026-10-19 --to 2026-10-25
"$CLI" schedule add --title "치과" --start 2026-10-21T15:00:00+09:00 --end 2026-10-21T16:00:00+09:00
"$CLI" memo list
"$CLI" memo get 7
"$CLI" memo add --title "회의 메모" --body "- 결정사항 ..." --folder 3
"$CLI" memo-folder list
```
