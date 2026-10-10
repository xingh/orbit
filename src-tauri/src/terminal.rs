//! Terminal adapters. Every launch is an executable plus an argument array; the project folder and client
//! path are passed as separate arguments, environment values, or (macOS) strictly single-quoted script
//! literals. User text is never spliced into an unquoted shell or AppleScript command.

use crate::clients::{find_executable, search_dirs, SCRUBBED_ENV};
use serde::Serialize;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum Terminal {
    GnomeTerminal,
    Konsole,
    Xfce4Terminal,
    Kitty,
    Alacritty,
    Wezterm,
    Xterm,
    TerminalApp,
    Iterm2,
    Powershell,
}

pub const LINUX_TERMINALS: &[Terminal] = &[
    Terminal::GnomeTerminal,
    Terminal::Konsole,
    Terminal::Xfce4Terminal,
    Terminal::Kitty,
    Terminal::Alacritty,
    Terminal::Wezterm,
    Terminal::Xterm,
];

impl Terminal {
    pub fn id(self) -> &'static str {
        match self {
            Self::GnomeTerminal => "gnome-terminal",
            Self::Konsole => "konsole",
            Self::Xfce4Terminal => "xfce4-terminal",
            Self::Kitty => "kitty",
            Self::Alacritty => "alacritty",
            Self::Wezterm => "wezterm",
            Self::Xterm => "xterm",
            Self::TerminalApp => "terminal-app",
            Self::Iterm2 => "iterm2",
            Self::Powershell => "powershell",
        }
    }
    pub fn name(self) -> &'static str {
        match self {
            Self::GnomeTerminal => "GNOME Terminal",
            Self::Konsole => "Konsole",
            Self::Xfce4Terminal => "Xfce Terminal",
            Self::Kitty => "kitty",
            Self::Alacritty => "Alacritty",
            Self::Wezterm => "WezTerm",
            Self::Xterm => "xterm",
            Self::TerminalApp => "Terminal",
            Self::Iterm2 => "iTerm2",
            Self::Powershell => "PowerShell",
        }
    }
    pub fn all() -> &'static [Terminal] {
        if cfg!(target_os = "macos") {
            &[Terminal::TerminalApp, Terminal::Iterm2]
        } else if cfg!(windows) {
            &[Terminal::Powershell]
        } else {
            LINUX_TERMINALS
        }
    }
    fn linux_binary(self) -> &'static str {
        self.id()
    }
}

#[derive(Serialize, Clone, Debug)]
pub struct TerminalInfo {
    pub id: &'static str,
    pub name: &'static str,
    pub available: bool,
}

pub fn detect() -> Vec<TerminalInfo> {
    Terminal::all()
        .iter()
        .map(|&t| TerminalInfo {
            id: t.id(),
            name: t.name(),
            available: is_available(t),
        })
        .collect()
}

fn is_available(t: Terminal) -> bool {
    match t {
        Terminal::TerminalApp => {
            Path::new("/System/Applications/Utilities/Terminal.app").exists()
                || Path::new("/Applications/Utilities/Terminal.app").exists()
        }
        Terminal::Iterm2 => Path::new("/Applications/iTerm.app").exists(),
        Terminal::Powershell => cfg!(windows),
        _ => find_executable(t.linux_binary(), &search_dirs()).is_some(),
    }
}

/// Desktop-appropriate default, then the first installed adapter.
pub fn default_terminal() -> Option<Terminal> {
    if cfg!(target_os = "macos") {
        return Some(Terminal::TerminalApp);
    }
    if cfg!(windows) {
        return Some(Terminal::Powershell);
    }
    let desktop = std::env::var("XDG_CURRENT_DESKTOP")
        .unwrap_or_default()
        .to_uppercase();
    let preferred = if desktop.contains("KDE") {
        Some(Terminal::Konsole)
    } else if desktop.contains("XFCE") {
        Some(Terminal::Xfce4Terminal)
    } else if desktop.contains("GNOME") || desktop.contains("UNITY") || desktop.contains("UBUNTU") {
        Some(Terminal::GnomeTerminal)
    } else {
        None
    };
    preferred
        .filter(|t| is_available(*t))
        .or_else(|| LINUX_TERMINALS.iter().copied().find(|t| is_available(*t)))
}

/// What to start inside the terminal.
pub struct Job<'a> {
    pub tool: &'a Path,
    pub args: &'a [&'a str],
    pub dir: &'a Path,
    pub path_env: OsString,
}

#[derive(Debug, Default)]
pub struct Plan {
    pub program: PathBuf,
    pub args: Vec<OsString>,
    pub cwd: Option<PathBuf>,
    pub env: Vec<(String, OsString)>,
    pub env_remove: Vec<&'static str>,
    /// macOS: a launcher script written before `program` runs.
    pub script: Option<(PathBuf, String)>,
}

/// `/usr/bin/env -u KEY… PATH=… <tool> <args…>`: a plain argv that removes API credentials inside the
/// terminal regardless of how the terminal server builds the child environment.
pub fn unix_inner(job: &Job) -> Result<Vec<OsString>, String> {
    if job.tool.to_string_lossy().contains('=') {
        return Err("The client path contains '=', which is not supported.".into());
    }
    let mut argv: Vec<OsString> = vec!["/usr/bin/env".into()];
    for key in SCRUBBED_ENV {
        argv.push("-u".into());
        argv.push((*key).into());
    }
    let mut path = OsString::from("PATH=");
    path.push(&job.path_env);
    argv.push(path);
    argv.push(job.tool.into());
    argv.extend(job.args.iter().map(OsString::from));
    Ok(argv)
}

pub fn linux_plan(term: Terminal, job: &Job) -> Result<Plan, String> {
    let program = find_executable(term.linux_binary(), &search_dirs())
        .ok_or_else(|| format!("{} is not installed.", term.name()))?;
    let inner = unix_inner(job)?;
    let dir: OsString = job.dir.into();
    let mut args: Vec<OsString> = Vec::new();
    match term {
        Terminal::GnomeTerminal => {
            let mut flag = OsString::from("--working-directory=");
            flag.push(&dir);
            args.push(flag);
            args.push("--".into());
        }
        Terminal::Konsole => args.extend(["--workdir".into(), dir, "-e".into()]),
        Terminal::Xfce4Terminal => args.extend(["--working-directory".into(), dir, "-x".into()]),
        Terminal::Kitty => args.extend(["--directory".into(), dir]),
        Terminal::Alacritty => args.extend(["--working-directory".into(), dir, "-e".into()]),
        Terminal::Wezterm => args.extend(["start".into(), "--cwd".into(), dir, "--".into()]),
        Terminal::Xterm => args.push("-e".into()),
        _ => return Err("This terminal is not available on Linux.".into()),
    }
    args.extend(inner);
    Ok(Plan {
        program,
        args,
        cwd: Some(job.dir.to_path_buf()),
        env_remove: SCRUBBED_ENV.to_vec(),
        ..Default::default()
    })
}

/// POSIX single-quote literal: everything is literal except `'`, which is closed, escaped and reopened.
pub fn sh_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', r"'\''"))
}

pub fn mac_script(job: &Job, script_path: &Path) -> Result<String, String> {
    let lossless = |p: &Path, what: &str| {
        p.to_str()
            .map(str::to_owned)
            .ok_or_else(|| format!("The {what} path is not valid Unicode."))
    };
    let dir = lossless(job.dir, "project folder")?;
    let tool = lossless(job.tool, "client")?;
    let script = lossless(script_path, "launcher")?;
    let path_env = job.path_env.to_str().ok_or("PATH is not valid Unicode.")?;
    if [&dir, &tool, &script].iter().any(|s| s.contains('\0')) {
        return Err("Paths cannot contain NUL characters.".into());
    }
    let unset = SCRUBBED_ENV
        .iter()
        .map(|k| format!("-u {k}"))
        .collect::<Vec<_>>()
        .join(" ");
    let args = job
        .args
        .iter()
        .map(|a| sh_quote(a))
        .collect::<Vec<_>>()
        .join(" ");
    Ok(format!(
        "#!/bin/sh\nrm -f -- {script}\ncd -- {dir} || exit 1\necho 'Orbit: using your subscription sign-in in this tool.'\nexec /usr/bin/env {unset} PATH={path} {tool} {args}\n",
        script = sh_quote(&script),
        dir = sh_quote(&dir),
        path = sh_quote(path_env),
        tool = sh_quote(&tool),
    ))
}

pub fn mac_plan(term: Terminal, job: &Job, script_dir: &Path, nonce: &str) -> Result<Plan, String> {
    let app = match term {
        Terminal::TerminalApp => "Terminal",
        Terminal::Iterm2 => "iTerm",
        _ => return Err("This terminal is not available on macOS.".into()),
    };
    if !nonce.chars().all(|c| c.is_ascii_alphanumeric()) {
        return Err("Invalid launcher name.".into());
    }
    let script_path = script_dir.join(format!("orbit-launch-{nonce}.command"));
    let script = mac_script(job, &script_path)?;
    Ok(Plan {
        program: "/usr/bin/open".into(),
        args: vec!["-a".into(), app.into(), script_path.clone().into()],
        script: Some((script_path, script)),
        ..Default::default()
    })
}

pub const WINDOWS_PS_COMMAND: &str = "Set-Location -LiteralPath $env:ORBIT_PROJECT_DIR; Write-Host 'Orbit: using your subscription sign-in in this tool.'; & $env:ORBIT_CODE_TOOL";

/// PowerShell receives the folder and client through environment variables only. Client arguments are not
/// supported here because PowerShell would have to re-split them from text.
pub fn windows_plan(job: &Job, keep_open: bool) -> Result<Plan, String> {
    if !job.args.is_empty() {
        return Err("Client arguments are not supported by the Windows launcher.".into());
    }
    let mut args: Vec<OsString> = vec!["-NoLogo".into(), "-NoProfile".into()];
    if keep_open {
        args.push("-NoExit".into());
    }
    args.push("-Command".into());
    args.push(WINDOWS_PS_COMMAND.into());
    Ok(Plan {
        program: "powershell.exe".into(),
        args,
        cwd: Some(job.dir.to_path_buf()),
        env: vec![
            ("ORBIT_PROJECT_DIR".into(), job.dir.into()),
            ("ORBIT_CODE_TOOL".into(), job.tool.into()),
            ("PATH".into(), job.path_env.clone()),
        ],
        env_remove: SCRUBBED_ENV.to_vec(),
        script: None,
    })
}

pub fn command(plan: &Plan) -> Command {
    let mut command = Command::new(&plan.program);
    command.args(&plan.args);
    if let Some(cwd) = &plan.cwd {
        command.current_dir(cwd);
    }
    for key in &plan.env_remove {
        command.env_remove(key);
    }
    for (key, value) in &plan.env {
        command.env(key, value);
    }
    command
}

pub fn spawn(plan: &Plan) -> Result<(), String> {
    if let Some((path, contents)) = &plan.script {
        write_script(path, contents)?;
    }
    let mut command = command(plan);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0000_0010); // CREATE_NEW_CONSOLE
    }
    command
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Could not start the terminal: {e}"))
}

fn write_script(path: &Path, contents: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(path, contents).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o700))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Folder names that break naive shell interpolation. Windows forbids `"` and a few others in names.
    fn hostile_names() -> Vec<&'static str> {
        let mut names = vec![
            "with space",
            "semi;colon",
            "dollar $HOME $(whoami)",
            "back`tick`",
            "amp & caret ^ %PATH%",
            "quote's",
            "Unicodé 日本 ø",
            "-leading-dash",
        ];
        if !cfg!(windows) {
            names.extend([
                "pipe |",
                "double\"quote",
                "new\nline",
                "glob*?[x]",
                "back\\slash",
            ]);
        }
        names
    }

    #[test]
    fn sh_quote_is_literal() {
        assert_eq!(sh_quote("a'b"), r"'a'\''b'");
        assert_eq!(sh_quote("$(x)"), "'$(x)'");
    }

    #[cfg(unix)]
    #[test]
    fn unix_inner_runs_in_literal_folder_without_api_keys() {
        for name in hostile_names() {
            let root = tempfile::tempdir().unwrap();
            let dir = root.path().join(name);
            std::fs::create_dir_all(&dir).unwrap();
            let tool = Path::new("/bin/sh");
            let args = ["-c", "pwd; printf '%s' \"${ANTHROPIC_API_KEY-unset}\""];
            let job = Job {
                tool,
                args: &args,
                dir: &dir,
                path_env: "/usr/bin:/bin".into(),
            };
            let argv = unix_inner(&job).unwrap();
            let out = Command::new(&argv[0])
                .args(&argv[1..])
                .current_dir(&dir)
                .env("ANTHROPIC_API_KEY", "sk-test")
                .output()
                .unwrap();
            let text = String::from_utf8(out.stdout).unwrap();
            let expected = dunce::canonicalize(&dir).unwrap();
            assert!(
                text.starts_with(expected.to_str().unwrap()),
                "{name}: {text}"
            );
            assert!(text.ends_with("unset"), "{name}: {text}");
        }
    }

    #[cfg(unix)]
    #[test]
    fn mac_script_keeps_paths_literal() {
        for name in hostile_names() {
            let root = tempfile::tempdir().unwrap();
            let dir = root.path().join(name);
            std::fs::create_dir_all(&dir).unwrap();
            let marker = root.path().join("pwned");
            let script_path = root.path().join("orbit-launch-test.command");
            let args = ["-c", "pwd; printf '%s' \"${OPENAI_API_KEY-unset}\""];
            let job = Job {
                tool: Path::new("/bin/sh"),
                args: &args,
                dir: &dir,
                path_env: "/usr/bin:/bin".into(),
            };
            let script = mac_script(&job, &script_path).unwrap();
            write_script(&script_path, &script).unwrap();
            let out = Command::new("/bin/sh")
                .arg(&script_path)
                .env("OPENAI_API_KEY", "sk-test")
                .env("PWNED", &marker)
                .output()
                .unwrap();
            let text = String::from_utf8(out.stdout).unwrap();
            assert!(text.contains(dir.to_str().unwrap()), "{name}: {text}");
            assert!(text.ends_with("unset"), "{name}: {text}");
            assert!(!script_path.exists(), "launcher removes itself");
            assert!(!marker.exists());
        }
    }

    #[test]
    fn mac_plan_uses_open_with_argv() {
        let dir = std::env::temp_dir();
        let job = Job {
            tool: Path::new("/usr/local/bin/claude"),
            args: &[],
            dir: &dir,
            path_env: "/usr/bin".into(),
        };
        let plan = mac_plan(Terminal::TerminalApp, &job, &dir, "abc123").unwrap();
        assert_eq!(plan.program, PathBuf::from("/usr/bin/open"));
        assert_eq!(plan.args[0], OsString::from("-a"));
        assert_eq!(plan.args[1], OsString::from("Terminal"));
        assert!(mac_plan(Terminal::TerminalApp, &job, &dir, "../x").is_err());
    }

    #[cfg(windows)]
    #[test]
    fn windows_plan_keeps_paths_literal() {
        let tools = tempfile::tempdir().unwrap();
        let cmd = tools.path().join("printcwd.cmd");
        std::fs::write(&cmd, "@cd\r\n").unwrap();
        for name in hostile_names() {
            let root = tempfile::tempdir().unwrap();
            let dir = root.path().join(name);
            std::fs::create_dir_all(&dir).unwrap();
            let job = Job {
                tool: &cmd,
                args: &[],
                dir: &dir,
                path_env: std::env::var_os("PATH").unwrap(),
            };
            let plan = windows_plan(&job, false).unwrap();
            let out = command(&plan)
                .env("ANTHROPIC_API_KEY", "sk-test")
                .output()
                .unwrap();
            let text = String::from_utf8_lossy(&out.stdout);
            let expected = dunce::canonicalize(&dir).unwrap();
            assert!(
                text.trim().eq_ignore_ascii_case(expected.to_str().unwrap()) || text.contains(name),
                "{name}: {text} / {}",
                String::from_utf8_lossy(&out.stderr)
            );
        }
    }

    #[cfg(target_os = "linux")]
    #[test]
    fn linux_adapters_put_folder_in_its_own_argument() {
        let dir = PathBuf::from("/tmp/a b;$(x)");
        let job = Job {
            tool: Path::new("/usr/bin/claude"),
            args: &[],
            dir: &dir,
            path_env: "/usr/bin".into(),
        };
        for &term in LINUX_TERMINALS {
            if let Ok(plan) = linux_plan(term, &job) {
                assert!(
                    plan.args
                        .iter()
                        .any(|a| a.to_string_lossy().ends_with("/tmp/a b;$(x)")),
                    "{:?}",
                    term
                );
                assert!(plan.args.iter().any(|a| a == "/usr/bin/claude"));
            }
        }
    }
}
