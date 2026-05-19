use std::path::PathBuf;

use crate::error::CoreError;

pub const DATA_DIR_NAME: &str = ".workspace-hub";
pub const DB_FILE_NAME: &str = "workspace-hub.sqlite";

pub fn home_dir() -> Result<PathBuf, CoreError> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .ok_or(CoreError::HomeNotFound)
}

pub fn data_dir() -> Result<PathBuf, CoreError> {
    if let Some(override_dir) = std::env::var_os("WORKSPACE_HUB_DATA_DIR") {
        let p = PathBuf::from(override_dir);
        if !p.exists() {
            std::fs::create_dir_all(&p)?;
        }
        return Ok(p);
    }
    let mut p = home_dir()?;
    p.push(DATA_DIR_NAME);
    if !p.exists() {
        std::fs::create_dir_all(&p)?;
    }
    Ok(p)
}

pub fn db_path() -> Result<PathBuf, CoreError> {
    let mut p = data_dir()?;
    p.push(DB_FILE_NAME);
    Ok(p)
}
