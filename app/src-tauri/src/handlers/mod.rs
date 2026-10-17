use serde::Serialize;
use workspace_hub_core::models::todo::{Priority, TodoStatus};
use workspace_hub_core::CoreError;

pub(crate) mod capture;
pub(crate) mod dashboard;
pub(crate) mod files;
pub(crate) mod memo;
pub(crate) mod project;
pub(crate) mod schedule;
pub(crate) mod skill;
pub(crate) mod todo;

pub(super) fn core_err(e: CoreError) -> String {
    match e {
        CoreError::InvalidInput(m) => m,
        CoreError::NotFound(m) => format!("not found: {m}"),
        CoreError::Parse(m) => format!("parse error: {m}"),
        other => other.to_string(),
    }
}

pub(super) fn lock_err<T>(_: std::sync::PoisonError<T>) -> String {
    "db lock poisoned".into()
}

pub(super) fn parse_priority(s: &str) -> Result<Priority, String> {
    Priority::parse(s).ok_or_else(|| format!("unknown priority: {s}"))
}

pub(super) fn parse_status(s: &str) -> Result<TodoStatus, String> {
    TodoStatus::parse(s).ok_or_else(|| format!("unknown status: {s}"))
}

/// PATCH 의미: 키 없음 = `None`(변경 없음), `null`/`""` = `Some(None)`(클리어), 그 외 = `Some(Some(v))`.
pub(super) fn nullable_string_patch(v: Option<&serde_json::Value>) -> Option<Option<String>> {
    match v {
        None => None,
        Some(x) if x.is_null() => Some(None),
        Some(x) => match x.as_str() {
            Some("") => Some(None),
            Some(s) => Some(Some(s.to_string())),
            None => None,
        },
    }
}

pub(super) fn nullable_i64_patch(v: Option<&serde_json::Value>) -> Option<Option<i64>> {
    match v {
        None => None,
        Some(value) if value.is_null() => Some(None),
        Some(value) => value.as_i64().map(Some),
    }
}

#[derive(Serialize)]
pub(super) struct DeletedAck {
    pub(super) deleted: i64,
}

#[derive(Serialize)]
pub(super) struct PurgedCountAck {
    pub(super) purged_count: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn nullable_string_patch_returns_no_change_for_absent_key() {
        assert_eq!(nullable_string_patch(None), None);
    }

    #[test]
    fn nullable_string_patch_returns_clear_for_null() {
        let value = serde_json::Value::Null;
        assert_eq!(nullable_string_patch(Some(&value)), Some(None));
    }

    #[test]
    fn nullable_string_patch_returns_clear_for_empty_string() {
        let value = json!("");
        assert_eq!(nullable_string_patch(Some(&value)), Some(None));
    }

    #[test]
    fn nullable_string_patch_returns_value_for_non_empty_string() {
        let value = json!("updated");
        assert_eq!(
            nullable_string_patch(Some(&value)),
            Some(Some("updated".to_string()))
        );
    }

    #[test]
    fn nullable_string_patch_ignores_non_string_value() {
        let value = json!(42);
        assert_eq!(nullable_string_patch(Some(&value)), None);
    }

    #[test]
    fn parse_priority_accepts_known_values() {
        assert_eq!(parse_priority("low"), Ok(Priority::Low));
        assert_eq!(parse_priority("mid"), Ok(Priority::Mid));
        assert_eq!(parse_priority("high"), Ok(Priority::High));
    }

    #[test]
    fn parse_priority_rejects_unknown_value() {
        assert_eq!(
            parse_priority("urgent"),
            Err("unknown priority: urgent".to_string())
        );
    }

    #[test]
    fn parse_status_accepts_known_values() {
        assert_eq!(parse_status("open"), Ok(TodoStatus::Open));
        assert_eq!(parse_status("hold"), Ok(TodoStatus::Hold));
        assert_eq!(parse_status("done"), Ok(TodoStatus::Done));
    }

    #[test]
    fn parse_status_rejects_unknown_value() {
        assert_eq!(
            parse_status("archived"),
            Err("unknown status: archived".to_string())
        );
    }
}
