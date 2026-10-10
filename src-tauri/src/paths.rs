//! Native folder validation. Uses OS path semantics (drive letters, UNC, Unicode) rather than string rules.

use std::path::PathBuf;

pub fn project_folder(folder: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(folder.trim());
    if !path.is_absolute() {
        return Err("Use an absolute folder path for this computer.".into());
    }
    if !path.is_dir() {
        return Err("This folder does not exist on this computer. Edit the project to choose its folder here.".into());
    }
    // dunce strips Windows `\\?\` verbatim prefixes that Explorer and PowerShell handle poorly.
    dunce::canonicalize(&path).map_err(|e| e.to_string())
}

pub fn home_dir() -> Option<PathBuf> {
    let key = if cfg!(windows) { "USERPROFILE" } else { "HOME" };
    std::env::var_os(key)
        .filter(|v| !v.is_empty())
        .map(PathBuf::from)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_relative_and_missing_folders() {
        assert!(project_folder("relative/path").is_err());
        assert!(project_folder("").is_err());
        let missing = std::env::temp_dir().join("orbit-definitely-missing-folder-ø");
        assert!(project_folder(missing.to_str().unwrap()).is_err());
    }

    #[test]
    fn accepts_unicode_and_metacharacter_folders() {
        let root = tempfile::tempdir().unwrap();
        let dir = root.path().join("Projets ø 日本 $HOME ; & 'q'");
        std::fs::create_dir_all(&dir).unwrap();
        let resolved = project_folder(dir.to_str().unwrap()).unwrap();
        assert!(resolved.is_dir());
        assert!(resolved.to_string_lossy().contains("日本"));
    }
}
