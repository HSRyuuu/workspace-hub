pub mod file_explorer;
pub mod memo;
pub mod memo_folder;
pub mod memo_project;
pub mod project;
pub mod project_application;
pub mod project_directory;
pub mod schedule;
pub mod todo;

/// 모든 도메인 repo 가 created_at / updated_at / completed_at 등에 공통으로 사용하는
/// ISO8601 UTC 타임스탬프. v0.2 의 memo / event / workspace 도 같은 형식을 따른다.
pub fn now_iso() -> String {
    chrono::Utc::now()
        .format("%Y-%m-%dT%H:%M:%SZ")
        .to_string()
}

/// nullable string 컬럼 입력값을 정규화: trim 후 빈 문자열이면 `None`, 그 외에는 `Some(s)`.
/// schedule / project / project_directory / project_application 의 description·location·label·color 등이 공통 사용.
pub(crate) fn empty_to_none(v: Option<String>) -> Option<String> {
    v.and_then(|s| {
        let t = s.trim();
        if t.is_empty() {
            None
        } else {
            Some(t.to_string())
        }
    })
}

/// `Some(s)` 인 due/start/end 류 컬럼 입력값을 정규화한다.
/// - `YYYY-MM-DD` 형식이면 자정 UTC 로 늘려 RFC3339 로 반환
/// - 이미 RFC3339 이면 그대로
/// - 빈 문자열은 `None`
/// - 그 외는 `CoreError::Parse`
///
/// CLI 와 (향후) Tauri 셸이 core 를 직접 호출할 때 둘 다 동일한 검증을 거치도록 core 에 둔다.
pub fn normalize_iso_date(input: Option<&str>) -> Result<Option<String>, crate::CoreError> {
    let Some(raw) = input else { return Ok(None) };
    let s = raw.trim();
    if s.is_empty() {
        return Ok(None);
    }
    if s.len() == 10 && s.chars().nth(4) == Some('-') && s.chars().nth(7) == Some('-') {
        match chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d") {
            Ok(_) => Ok(Some(format!("{s}T00:00:00Z"))),
            Err(_) => Err(crate::CoreError::Parse(format!("invalid date: {s}"))),
        }
    } else if chrono::DateTime::parse_from_rfc3339(s).is_ok() {
        Ok(Some(s.to_string()))
    } else {
        Err(crate::CoreError::Parse(format!(
            "expected YYYY-MM-DD or RFC3339, got: {s}"
        )))
    }
}
