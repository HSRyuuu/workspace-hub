pub mod memo;
pub mod memo_folder;
pub mod project;
pub mod schedule;
pub mod todo;

/// nullable string 필드 패치 매핑. `--clear-X` 플래그 우선 — true 면 `Some(None)`(NULL 클리어),
/// 그렇지 않으면 값이 있을 때만 `Some(Some(v))`. core 의 `UpdateXxx { field: Option<Option<String>> }` 시그니처와 매칭.
pub fn clear_or_value(clear: bool, value: Option<String>) -> Option<Option<String>> {
    if clear {
        Some(None)
    } else {
        value.map(Some)
    }
}
