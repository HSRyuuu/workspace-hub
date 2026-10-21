# workspace-hub CLI 명세

> `workspace-hub spec` 으로 생성. 직접 수정하지 말 것.

## `workspace-hub`

```text
workspace-hub CLI — single source of truth for local TODO / memo / calendar / workspace data.

Usage: workspace-hub [OPTIONS] <COMMAND>

Commands:
  todo         TODO 명령
  schedule     캘린더 일정 명령
  memo         메모 명령
  memo-folder  메모 폴더 명령
  version      버전 출력
  spec         전체 명령 명세를 Markdown 으로 출력 (AI 스킬 references 용)
  help         Print this message or the help of the given subcommand(s)

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help

  -V, --version
          Print version
```

## `workspace-hub todo`

```text
TODO 명령

Usage: workspace-hub todo [OPTIONS] <COMMAND>

Commands:
  add         새 TODO 추가
  list        TODO 목록
  update      TODO 업데이트 (제목·설명·마감·우선순위·상태)
  complete    TODO 완료 처리
  uncomplete  TODO 완료 해제
  delete      TODO 삭제
  help        Print this message or the help of the given subcommand(s)

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```

## `workspace-hub todo add`

```text
새 TODO 추가

Usage: workspace-hub todo add [OPTIONS] --title <TITLE>

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

      --title <TITLE>
          제목 (필수)

      --description <DESCRIPTION>
          상세 설명 (선택)

      --summary <SUMMARY>
          한 줄 요약 (선택)

      --link <URL>
          링크 URL — http(s) 만 허용. 여러 번 지정 가능, 지정 순서 유지

      --start <START>
          시작일 — YYYY-MM-DD 또는 RFC3339. DateTime 이면 날짜만 보존

      --due <DUE>
          마감일 — YYYY-MM-DD 또는 RFC3339. DateTime 이면 날짜만 보존

      --due-time <DUE_TIME>
          마감 시간 — HH:MM 또는 0..1439 분

      --priority <PRIORITY>
          우선순위 (low / mid / high)
          
          [default: mid]
          [possible values: low, mid, high]

      --workspace <WORKSPACE>
          워크스페이스 ID (선택)

  -h, --help
          Print help
```

## `workspace-hub todo list`

```text
TODO 목록

Usage: workspace-hub todo list [OPTIONS]

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

      --status <STATUS>
          상태 필터
          
          [default: all]
          [possible values: all, open, hold, done]

  -h, --help
          Print help
```

## `workspace-hub todo update`

```text
TODO 업데이트 (제목·설명·마감·우선순위·상태)

Usage: workspace-hub todo update [OPTIONS] <ID>

Arguments:
  <ID>
          TODO id

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

      --title <TITLE>
          새 제목

      --description <DESCRIPTION>
          새 설명

      --clear-description
          설명 지우기

      --summary <SUMMARY>
          새 요약

      --clear-summary
          요약 지우기

      --link <URL>
          링크 URL — http(s) 만 허용. 지정하면 기존 링크 목록 전체를 이 값들로 교체한다. 여러 번 지정 가능

      --clear-links
          링크 모두 지우기

      --due <DUE>
          새 마감일 (YYYY-MM-DD 또는 RFC3339)

      --start <START>
          새 시작일 (YYYY-MM-DD 또는 RFC3339)

      --due-time <DUE_TIME>
          새 마감 시간 — HH:MM 또는 0..1439 분

      --clear-due
          마감일 지우기

      --priority <PRIORITY>
          우선순위 (low / mid / high)
          
          [possible values: low, mid, high]

      --status <STATUS>
          상태 (open / hold / done)
          
          [possible values: open, hold, done]

  -h, --help
          Print help
```

## `workspace-hub todo complete`

```text
TODO 완료 처리

Usage: workspace-hub todo complete [OPTIONS] <ID>

Arguments:
  <ID>
          TODO id

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```

## `workspace-hub todo uncomplete`

```text
TODO 완료 해제

Usage: workspace-hub todo uncomplete [OPTIONS] <ID>

Arguments:
  <ID>
          TODO id

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```

## `workspace-hub todo delete`

```text
TODO 삭제

Usage: workspace-hub todo delete [OPTIONS] <ID>

Arguments:
  <ID>
          TODO id

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```

## `workspace-hub schedule`

```text
캘린더 일정 명령

Usage: workspace-hub schedule [OPTIONS] <COMMAND>

Commands:
  add     새 일정 추가
  list    일정 목록 (`--from`/`--to` 미지정 시 전체)
  get     일정 단건 조회
  update  일정 수정 (지정한 필드만)
  delete  일정 삭제
  help    Print this message or the help of the given subcommand(s)

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```

## `workspace-hub schedule add`

```text
새 일정 추가

Usage: workspace-hub schedule add [OPTIONS] --title <TITLE> --start <START> --end <END>

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

      --title <TITLE>
          제목 (필수)

      --start <START>
          시작 — YYYY-MM-DD 또는 RFC3339 (예: 2026-05-20T09:00:00Z)

      --end <END>
          종료 — YYYY-MM-DD 또는 RFC3339

      --all-day
          종일 여부

      --description <DESCRIPTION>
          상세 설명 (선택)

      --location <LOCATION>
          장소 (선택)

      --color <COLOR>
          색상 (hex, 예: #3F3393)

  -h, --help
          Print help
```

## `workspace-hub schedule list`

```text
일정 목록 (`--from`/`--to` 미지정 시 전체)

Usage: workspace-hub schedule list [OPTIONS]

Options:
      --from <FROM>
          범위 시작 (포함)

      --human
          Human-readable output (table). Default is JSON for programmatic callers

      --to <TO>
          범위 끝 (제외)

  -h, --help
          Print help
```

## `workspace-hub schedule get`

```text
일정 단건 조회

Usage: workspace-hub schedule get [OPTIONS] <ID>

Arguments:
  <ID>
          schedule id

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```

## `workspace-hub schedule update`

```text
일정 수정 (지정한 필드만)

Usage: workspace-hub schedule update [OPTIONS] <ID>

Arguments:
  <ID>
          schedule id

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

      --title <TITLE>
          

      --start <START>
          

      --end <END>
          

      --all-day <ALL_DAY>
          종일 여부 (지정 시에만 변경)
          
          [possible values: true, false]

      --description <DESCRIPTION>
          설명

      --clear-description
          설명 지우기

      --location <LOCATION>
          장소

      --clear-location
          장소 지우기

      --color <COLOR>
          색상

      --clear-color
          색상 지우기

  -h, --help
          Print help
```

## `workspace-hub schedule delete`

```text
일정 삭제

Usage: workspace-hub schedule delete [OPTIONS] <ID>

Arguments:
  <ID>
          schedule id

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```

## `workspace-hub memo`

```text
메모 명령

Usage: workspace-hub memo [OPTIONS] <COMMAND>

Commands:
  add          새 메모 추가
  list         메모 목록 (필터: `--folder <id>` / `--root` / `--trash`. 기본은 휴지통 제외 전체)
  get          메모 단건 조회
  update       메모 수정 (지정한 필드만)
  delete       메모를 휴지통으로 (soft-delete)
  restore      휴지통에서 복원
  purge        영구 삭제 (휴지통의 메모만 허용)
  empty-trash  휴지통 비우기 (삭제된 모든 메모 영구 삭제)
  help         Print this message or the help of the given subcommand(s)

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```

## `workspace-hub memo add`

```text
새 메모 추가

Usage: workspace-hub memo add [OPTIONS]

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

      --title <TITLE>
          제목 (선택; 비우면 본문 첫 줄이 표시 제목)
          
          [default: ""]

      --body <BODY>
          본문 (markdown). 미지정 시 빈 메모
          
          [default: ""]

      --folder <FOLDER>
          소속 폴더 id (미지정 시 루트)

  -h, --help
          Print help
```

## `workspace-hub memo list`

```text
메모 목록 (필터: `--folder <id>` / `--root` / `--trash`. 기본은 휴지통 제외 전체)

Usage: workspace-hub memo list [OPTIONS]

Options:
      --folder <FOLDER>
          특정 폴더만 (id 지정)

      --human
          Human-readable output (table). Default is JSON for programmatic callers

      --root
          루트(folder NULL) 만

      --trash
          휴지통만

  -h, --help
          Print help
```

## `workspace-hub memo get`

```text
메모 단건 조회

Usage: workspace-hub memo get [OPTIONS] <ID>

Arguments:
  <ID>
          memo id

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```

## `workspace-hub memo update`

```text
메모 수정 (지정한 필드만)

Usage: workspace-hub memo update [OPTIONS] <ID>

Arguments:
  <ID>
          memo id

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

      --title <TITLE>
          

      --body <BODY>
          

      --folder <FOLDER>
          소속 폴더로 이동 (id 지정)

      --to-root
          루트로 이동 (folder_id NULL)

      --pinned <PINNED>
          핀 토글 (true/false)
          
          [possible values: true, false]

  -h, --help
          Print help
```

## `workspace-hub memo delete`

```text
메모를 휴지통으로 (soft-delete)

Usage: workspace-hub memo delete [OPTIONS] <ID>

Arguments:
  <ID>
          memo id

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```

## `workspace-hub memo restore`

```text
휴지통에서 복원

Usage: workspace-hub memo restore [OPTIONS] <ID>

Arguments:
  <ID>
          memo id

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```

## `workspace-hub memo purge`

```text
영구 삭제 (휴지통의 메모만 허용)

Usage: workspace-hub memo purge [OPTIONS] <ID>

Arguments:
  <ID>
          memo id

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```

## `workspace-hub memo empty-trash`

```text
휴지통 비우기 (삭제된 모든 메모 영구 삭제)

Usage: workspace-hub memo empty-trash [OPTIONS]

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```

## `workspace-hub memo-folder`

```text
메모 폴더 명령

Usage: workspace-hub memo-folder [OPTIONS] <COMMAND>

Commands:
  add      새 폴더 추가 (`--parent <id>` 미지정 시 루트)
  list     전체 폴더 목록 (트리 조립은 호출자 책임)
  rename   폴더 이름 변경
  move     폴더 이동 (`--to-root` 면 루트, 아니면 `--parent <id>`)
  reorder  같은 부모 아래 형제 폴더들의 순서를 `--order` 배열대로 0..N 으로 재할당
  delete   폴더 삭제 — 자손 폴더는 함께 삭제, 속한 메모는 휴지통으로 이동
  help     Print this message or the help of the given subcommand(s)

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```

## `workspace-hub memo-folder add`

```text
새 폴더 추가 (`--parent <id>` 미지정 시 루트)

Usage: workspace-hub memo-folder add [OPTIONS] --name <NAME>

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

      --name <NAME>
          폴더 이름 (필수)

      --parent <PARENT>
          부모 폴더 id (미지정 시 루트)

  -h, --help
          Print help
```

## `workspace-hub memo-folder list`

```text
전체 폴더 목록 (트리 조립은 호출자 책임)

Usage: workspace-hub memo-folder list [OPTIONS]

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```

## `workspace-hub memo-folder rename`

```text
폴더 이름 변경

Usage: workspace-hub memo-folder rename [OPTIONS] --name <NAME> <ID>

Arguments:
  <ID>
          memo_folder id

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

      --name <NAME>
          새 이름

  -h, --help
          Print help
```

## `workspace-hub memo-folder move`

```text
폴더 이동 (`--to-root` 면 루트, 아니면 `--parent <id>`)

Usage: workspace-hub memo-folder move [OPTIONS] <ID>

Arguments:
  <ID>
          memo_folder id

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

      --parent <PARENT>
          새 부모 폴더 id

      --to-root
          루트로 이동

  -h, --help
          Print help
```

## `workspace-hub memo-folder reorder`

```text
같은 부모 아래 형제 폴더들의 순서를 `--order` 배열대로 0..N 으로 재할당

Usage: workspace-hub memo-folder reorder [OPTIONS] --order <ORDER>

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

      --parent <PARENT>
          대상 부모 폴더 id (미지정 시 루트). `--at-root` 와는 동의어 — 둘 다 미지정이면 루트

      --order <ORDER>
          같은 부모 아래의 모든 형제 폴더 id 를 원하는 순서대로 콤마 구분으로 나열. 빠짐없이. 예: `--order 12,9,5`

  -h, --help
          Print help
```

## `workspace-hub memo-folder delete`

```text
폴더 삭제 — 자손 폴더는 함께 삭제, 속한 메모는 휴지통으로 이동

Usage: workspace-hub memo-folder delete [OPTIONS] <ID>

Arguments:
  <ID>
          memo_folder id

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```

## `workspace-hub version`

```text
버전 출력

Usage: workspace-hub version [OPTIONS]

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```

## `workspace-hub spec`

```text
전체 명령 명세를 Markdown 으로 출력 (AI 스킬 references 용)

Usage: workspace-hub spec [OPTIONS]

Options:
      --human
          Human-readable output (table). Default is JSON for programmatic callers

  -h, --help
          Print help
```
