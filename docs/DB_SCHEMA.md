# workspace-hub DB Schema

> Reset 2026-05-18 — 스키마 실제 정의(`core/src/db.rs` 의 마이그레이션 SQL)와 docs 가 drift 했음.
> v0.1 MVP 가 끝나는 시점에 실제 SQL 기준으로 다시 그린다. 그 전까지는 `core/src/db.rs` 가 단일 진실 원천.

---

## 테이블 목록

_`core/src/db.rs` 의 `include_str!` 마이그레이션 SQL 참조._

## 제약·접근 범위

_`core` 라이브러리만 SQLite 에 접근. Tauri 앱은 `core` 를 in-process 호출, Claude Code 스킬은 `core` 를 감싼 `workspace-hub` CLI 를 spawn 해서 호출(ADR-0012)._
