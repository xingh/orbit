//! Official local coding clients: discovery, version and documented subscription-status checks.
//!
//! Claude Code: `claude auth status` prints JSON whose `authMethod` is one of
//! `none`, `claude.ai`, `oauth_token`, `api_key`, `api_key_helper`, `third_party`.
//! Codex: `codex login status` reports the active authentication method.
//! Neither command starts a model task.

use serde::Serialize;
use std::ffi::OsString;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// Variables removed from every client child process so an API key or alternate backend is never picked up silently.
pub const SCRUBBED_ENV: &[&str] = &[
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_PROFILE",
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
    "CLAUDE_CODE_USE_FOUNDRY",
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "CODEX_API_KEY",
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Client {
    ClaudeCode,
    Codex,
}

impl Client {
    pub fn from_provider(provider: &str) -> Option<Self> {
        match provider {
            "claude-code" => Some(Self::ClaudeCode),
            "codex" => Some(Self::Codex),
            _ => None,
        }
    }
    pub fn binary(self) -> &'static str {
        match self {
            Self::ClaudeCode => "claude",
            Self::Codex => "codex",
        }
    }
    pub fn name(self) -> &'static str {
        match self {
            Self::ClaudeCode => "Claude Code",
            Self::Codex => "Codex",
        }
    }
    pub fn status_args(self) -> &'static [&'static str] {
        match self {
            Self::ClaudeCode => &["auth", "status"],
            Self::Codex => &["login", "status"],
        }
    }
    pub fn install_url(self) -> &'static str {
        match self {
            Self::ClaudeCode => "https://code.claude.com/docs/en/setup",
            Self::Codex => "https://developers.openai.com/codex/cli",
        }
    }
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum AuthState {
    Subscription { method: String },
    ApiBilling { method: String },
    SignedOut,
    Unknown { detail: String },
}

pub fn parse_claude_status(stdout: &str) -> AuthState {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(stdout.trim()) else {
        return AuthState::Unknown {
            detail: "Claude Code did not report a readable status.".into(),
        };
    };
    match value.get("authMethod").and_then(|v| v.as_str()) {
        Some(m @ ("claude.ai" | "oauth_token")) => AuthState::Subscription { method: m.into() },
        Some(m @ ("api_key" | "api_key_helper" | "third_party")) => {
            AuthState::ApiBilling { method: m.into() }
        }
        Some("none") => AuthState::SignedOut,
        Some(other) => AuthState::Unknown {
            detail: format!("Unrecognized sign-in method: {other}"),
        },
        None if value.get("loggedIn").and_then(|v| v.as_bool()) == Some(false) => {
            AuthState::SignedOut
        }
        None => AuthState::Unknown {
            detail: "Claude Code did not report its sign-in method.".into(),
        },
    }
}

pub fn parse_codex_status(output: &str) -> AuthState {
    let text = output.to_lowercase();
    if text.contains("not logged in") || text.contains("not signed in") {
        AuthState::SignedOut
    } else if text.contains("api key") {
        AuthState::ApiBilling {
            method: "api_key".into(),
        }
    } else if text.contains("chatgpt") {
        AuthState::Subscription {
            method: "chatgpt".into(),
        }
    } else {
        AuthState::Unknown {
            detail: "Codex did not report a recognizable sign-in method.".into(),
        }
    }
}

/// Directories searched in addition to PATH. Finder/desktop-launched apps often get a minimal PATH.
pub fn extra_dirs(home: Option<&Path>) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if cfg!(windows) {
        if let Some(appdata) = std::env::var_os("APPDATA") {
            dirs.push(PathBuf::from(appdata).join("npm"));
        }
        if let Some(home) = home {
            dirs.push(home.join(".local").join("bin"));
        }
        return dirs;
    }
    if let Some(home) = home {
        for rel in [
            ".local/bin",
            ".claude/local",
            ".npm-global/bin",
            ".bun/bin",
            ".volta/bin",
        ] {
            dirs.push(home.join(rel));
        }
        if let Ok(entries) = std::fs::read_dir(home.join(".nvm/versions/node")) {
            let mut versions: Vec<PathBuf> =
                entries.flatten().map(|e| e.path().join("bin")).collect();
            versions.sort();
            versions.reverse();
            dirs.extend(versions);
        }
    }
    for dir in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"] {
        dirs.push(PathBuf::from(dir));
    }
    dirs
}

pub fn search_dirs() -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|p| std::env::split_paths(&p).collect())
        .unwrap_or_default();
    for dir in extra_dirs(crate::paths::home_dir().as_deref()) {
        if !dirs.contains(&dir) {
            dirs.push(dir);
        }
    }
    dirs
}

/// PATH for client processes: the client's own directory first (npm shims need a sibling `node`), then the search list.
pub fn child_path(executable: &Path) -> OsString {
    let mut dirs = Vec::new();
    if let Some(parent) = executable.parent() {
        dirs.push(parent.to_path_buf());
    }
    dirs.extend(search_dirs());
    std::env::join_paths(dirs).unwrap_or_default()
}

pub fn find_executable(name: &str, dirs: &[PathBuf]) -> Option<PathBuf> {
    for dir in dirs {
        if cfg!(windows) {
            for ext in ["exe", "cmd", "bat", "com"] {
                let candidate = dir.join(format!("{name}.{ext}"));
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        } else {
            let candidate = dir.join(name);
            if is_executable(&candidate) {
                return Some(candidate);
            }
        }
    }
    None
}

#[cfg(unix)]
fn is_executable(path: &Path) -> bool {
    use std::os::unix::fs::PermissionsExt;
    path.metadata()
        .map(|m| m.is_file() && m.permissions().mode() & 0o111 != 0)
        .unwrap_or(false)
}
#[cfg(not(unix))]
fn is_executable(path: &Path) -> bool {
    path.is_file()
}

pub struct Output {
    pub success: bool,
    pub text: String,
}

/// Runs a client with fixed arguments, scrubbed environment, no stdin and a timeout. Output is never logged.
pub fn run_client(executable: &Path, args: &[&str], timeout: Duration) -> Result<Output, String> {
    let mut command = Command::new(executable);
    command
        .args(args)
        .env("PATH", child_path(executable))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for key in SCRUBBED_ENV {
        command.env_remove(key);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let mut child = command.spawn().map_err(|e| e.to_string())?;
    let mut stdout = child.stdout.take().unwrap();
    let mut stderr = child.stderr.take().unwrap();
    let out_reader = std::thread::spawn(move || {
        let mut s = String::new();
        let _ = stdout.read_to_string(&mut s);
        s
    });
    let err_reader = std::thread::spawn(move || {
        let mut s = String::new();
        let _ = stderr.read_to_string(&mut s);
        s
    });
    let started = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            break status;
        }
        if started.elapsed() > timeout {
            let _ = child.kill();
            let _ = child.wait();
            return Err("The client did not respond in time.".into());
        }
        std::thread::sleep(Duration::from_millis(40));
    };
    let mut text = out_reader.join().unwrap_or_default();
    let err = err_reader.join().unwrap_or_default();
    if !err.is_empty() {
        text.push('\n');
        text.push_str(&err);
    }
    Ok(Output {
        success: status.success(),
        text,
    })
}

#[derive(Serialize, Clone, Debug)]
pub struct ClientReport {
    pub provider: String,
    pub name: String,
    /// `available` | `missing` | `error`
    pub state: String,
    pub path: Option<String>,
    pub version: Option<String>,
    pub auth: AuthState,
    pub install_url: String,
}

pub fn report(client: Client, provider: &str) -> (ClientReport, Option<PathBuf>) {
    let mut report = ClientReport {
        provider: provider.into(),
        name: client.name().into(),
        state: "missing".into(),
        path: None,
        version: None,
        auth: AuthState::Unknown {
            detail: "Not installed".into(),
        },
        install_url: client.install_url().into(),
    };
    let Some(path) = find_executable(client.binary(), &search_dirs()) else {
        return (report, None);
    };
    report.path = Some(path.to_string_lossy().into_owned());
    report.state = "available".into();
    if let Ok(out) = run_client(&path, &["--version"], Duration::from_secs(8)) {
        report.version = out
            .text
            .lines()
            .map(str::trim)
            .find(|l| !l.is_empty())
            .map(|l| l.chars().take(80).collect());
    }
    report.auth = match run_client(&path, client.status_args(), Duration::from_secs(10)) {
        Ok(out) => match client {
            Client::ClaudeCode => match (out.text.find('{'), out.text.rfind('}')) {
                (Some(s), Some(e)) if e > s => parse_claude_status(&out.text[s..=e]),
                _ if !out.success => AuthState::SignedOut,
                _ => parse_claude_status(&out.text),
            },
            Client::Codex => parse_codex_status(&out.text),
        },
        Err(e) => {
            report.state = "error".into();
            AuthState::Unknown { detail: e }
        }
    };
    (report, Some(path))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claude_status_mapping() {
        assert_eq!(
            parse_claude_status(r#"{"loggedIn":true,"authMethod":"claude.ai"}"#),
            AuthState::Subscription {
                method: "claude.ai".into()
            }
        );
        assert_eq!(
            parse_claude_status(r#"{"authMethod":"oauth_token"}"#),
            AuthState::Subscription {
                method: "oauth_token".into()
            }
        );
        assert_eq!(
            parse_claude_status(r#"{"authMethod":"api_key"}"#),
            AuthState::ApiBilling {
                method: "api_key".into()
            }
        );
        assert_eq!(
            parse_claude_status(r#"{"authMethod":"api_key_helper"}"#),
            AuthState::ApiBilling {
                method: "api_key_helper".into()
            }
        );
        assert_eq!(
            parse_claude_status(r#"{"authMethod":"third_party"}"#),
            AuthState::ApiBilling {
                method: "third_party".into()
            }
        );
        assert_eq!(
            parse_claude_status(r#"{"authMethod":"none","loggedIn":false}"#),
            AuthState::SignedOut
        );
        assert!(matches!(
            parse_claude_status("not json"),
            AuthState::Unknown { .. }
        ));
        assert!(matches!(
            parse_claude_status(r#"{"authMethod":"future"}"#),
            AuthState::Unknown { .. }
        ));
    }

    #[test]
    fn codex_status_mapping() {
        assert_eq!(
            parse_codex_status("Logged in using ChatGPT"),
            AuthState::Subscription {
                method: "chatgpt".into()
            }
        );
        assert_eq!(
            parse_codex_status("Logged in using an API key - sk-***"),
            AuthState::ApiBilling {
                method: "api_key".into()
            }
        );
        assert_eq!(parse_codex_status("Not logged in"), AuthState::SignedOut);
        assert!(matches!(parse_codex_status(""), AuthState::Unknown { .. }));
    }

    #[test]
    fn finds_only_executables() {
        let dir = tempfile::tempdir().unwrap();
        let name = if cfg!(windows) {
            "fakeclient.cmd"
        } else {
            "fakeclient"
        };
        let file = dir.path().join(name);
        std::fs::write(&file, "echo hi").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert!(find_executable("fakeclient", &[dir.path().to_path_buf()]).is_none());
            std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        assert_eq!(
            find_executable("fakeclient", &[dir.path().to_path_buf()]),
            Some(file)
        );
        assert!(find_executable("nonexistent-orbit-client", &[dir.path().to_path_buf()]).is_none());
    }

    #[cfg(unix)]
    #[test]
    fn status_runs_with_scrubbed_environment() {
        use std::os::unix::fs::PermissionsExt;
        let dir = tempfile::tempdir().unwrap();
        let fake = dir.path().join("claude");
        std::fs::write(&fake, "#!/bin/sh\nif [ -n \"$ANTHROPIC_API_KEY\" ]; then echo '{\"authMethod\":\"api_key\"}'; else echo '{\"authMethod\":\"claude.ai\"}'; fi\n").unwrap();
        std::fs::set_permissions(&fake, std::fs::Permissions::from_mode(0o755)).unwrap();
        std::env::set_var("ANTHROPIC_API_KEY", "sk-test-not-real");
        let out = run_client(&fake, &["auth", "status"], Duration::from_secs(5)).unwrap();
        std::env::remove_var("ANTHROPIC_API_KEY");
        assert_eq!(
            parse_claude_status(&out.text),
            AuthState::Subscription {
                method: "claude.ai".into()
            }
        );
    }
}
