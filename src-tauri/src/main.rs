#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod clients;
mod paths;
mod providers;
mod terminal;

use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

struct Database(Mutex<Connection>);

#[derive(Serialize, Clone, Default)]
struct Capabilities {
    os: &'static str,
    arch: &'static str,
    /// Linux: `x11`, `wayland` or `unknown`; other platforms: `native`.
    session: String,
    desktop: String,
    tray: bool,
    shortcut: bool,
    shortcut_label: &'static str,
    /// Whether the compositor is expected to honour always-on-top for this window.
    always_on_top: bool,
    terminals: Vec<terminal::TerminalInfo>,
    default_terminal: Option<&'static str>,
}

struct CapabilityState(Mutex<Capabilities>);

const SHORTCUT_LABEL: &str = if cfg!(target_os = "macos") {
    "Cmd + Shift + Space"
} else {
    "Ctrl + Shift + Space"
};

fn linux_session() -> String {
    let kind = std::env::var("XDG_SESSION_TYPE")
        .unwrap_or_default()
        .to_lowercase();
    if kind == "wayland" || std::env::var_os("WAYLAND_DISPLAY").is_some() {
        "wayland".into()
    } else if kind == "x11" || std::env::var_os("DISPLAY").is_some() {
        "x11".into()
    } else {
        "unknown".into()
    }
}

fn base_capabilities() -> Capabilities {
    let session = if cfg!(target_os = "linux") {
        linux_session()
    } else {
        "native".into()
    };
    Capabilities {
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        always_on_top: session != "wayland",
        session,
        desktop: std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default(),
        shortcut_label: SHORTCUT_LABEL,
        terminals: terminal::detect(),
        default_terminal: terminal::default_terminal().map(|t| t.id()),
        ..Default::default()
    }
}

#[tauri::command]
fn capabilities(state: State<CapabilityState>) -> Result<Capabilities, String> {
    state.0.lock().map(|c| c.clone()).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_data(db: State<Database>) -> Result<String, String> {
    db.0.lock()
        .map_err(|e| e.to_string())?
        .query_row("SELECT json FROM workspace WHERE id = 1", [], |row| {
            row.get(0)
        })
        .optional()
        .map(|value: Option<String>| value.unwrap_or_default())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn save_data(json: String, db: State<Database>) -> Result<(), String> {
    if json.len() > 2_000_000 {
        return Err("Workspace exceeds the 2 MB limit. Export and archive older entries.".into());
    }
    let value: serde_json::Value = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    if !value["items"].is_array() {
        return Err("Invalid workspace data".into());
    }
    db.0.lock()
        .map_err(|e| e.to_string())?
        .execute("INSERT INTO workspace (id, json) VALUES (1, ?1) ON CONFLICT(id) DO UPDATE SET json = excluded.json", [json])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    let parsed = providers::validate_official_url(&url)?;
    open::that_detached(parsed.as_str()).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_folder(folder: String) -> Result<(), String> {
    open::that_detached(paths::project_folder(&folder)?).map_err(|e| e.to_string())
}

#[tauri::command]
async fn pick_folder(window: tauri::WebviewWindow) -> Result<Option<String>, String> {
    let dialog = rfd::AsyncFileDialog::new().set_parent(&window);
    let picked = above_companion(&window, dialog.pick_folder()).await;
    Ok(picked.map(|handle| handle.path().to_string_lossy().into_owned()))
}

#[tauri::command]
async fn export_backup(
    window: tauri::WebviewWindow,
    json: String,
) -> Result<Option<String>, String> {
    serde_json::from_str::<serde_json::Value>(&json)
        .map_err(|_| "The backup is not valid JSON.".to_string())?;
    let dialog = rfd::AsyncFileDialog::new()
        .set_parent(&window)
        .set_file_name("orbit-backup.json")
        .add_filter("Orbit backup", &["json"]);
    let Some(handle) = above_companion(&window, dialog.save_file()).await else {
        return Ok(None);
    };
    std::fs::write(handle.path(), json).map_err(|e| e.to_string())?;
    Ok(Some(handle.path().to_string_lossy().into_owned()))
}

/// The always-on-top companion would otherwise cover its own file dialogs on Windows.
async fn above_companion<T>(
    window: &tauri::WebviewWindow,
    dialog: impl std::future::Future<Output = T>,
) -> T {
    let _ = window.set_always_on_top(false);
    let result = dialog.await;
    let _ = window.set_always_on_top(true);
    result
}

#[tauri::command]
async fn client_status(provider: String) -> Result<clients::ClientReport, String> {
    let client = clients::Client::from_provider(&provider).ok_or("Unknown coding tool.")?;
    tauri::async_runtime::spawn_blocking(move || clients::report(client, &provider).0)
        .await
        .map_err(|e| e.to_string())
}

#[derive(Serialize)]
struct LaunchResult {
    /// `launched` or `needs_setup`. `needs_setup` never starts the client.
    status: &'static str,
    message: String,
    client: clients::ClientReport,
}

fn needs_setup(client: clients::ClientReport, message: String) -> LaunchResult {
    LaunchResult {
        status: "needs_setup",
        message,
        client,
    }
}

fn launch_blocking(
    app: tauri::AppHandle,
    provider: String,
    folder: String,
) -> Result<LaunchResult, String> {
    let client = clients::Client::from_provider(&provider).ok_or("Unknown coding tool.")?;
    let dir = if folder.trim().is_empty() {
        paths::home_dir().ok_or("Could not find your home folder.")?
    } else {
        paths::project_folder(&folder)?
    };
    let (report, tool) = clients::report(client, &provider);
    let name = client.name();
    let Some(tool) = tool else {
        return Ok(needs_setup(report, format!("{name} is not installed. Install the official client, sign in with your subscription, then try again. The web version is available now.")));
    };
    match &report.auth {
        clients::AuthState::Subscription { .. } => {}
        clients::AuthState::ApiBilling { .. } => {
            return Ok(needs_setup(report, format!("{name} is signed in with an API key or another billed provider. Orbit only launches it on a subscription sign-in. Sign out and sign in with your subscription, or use the web version.")))
        }
        clients::AuthState::SignedOut => {
            return Ok(needs_setup(report, format!("{name} is installed but not signed in. Sign in with your subscription in the tool, then try again.")))
        }
        clients::AuthState::Unknown { .. } => {
            return Ok(needs_setup(report, format!("Orbit could not confirm that {name} uses your subscription, so it did not start it. Check its sign-in status, or use the web version.")))
        }
    }
    let job = terminal::Job {
        tool: &tool,
        args: &[],
        dir: &dir,
        path_env: clients::child_path(&tool),
    };
    let plan = if cfg!(target_os = "macos") {
        let script_dir = app
            .path()
            .app_cache_dir()
            .map_err(|e| e.to_string())?
            .join("launchers");
        let nonce = format!(
            "{:x}{:x}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        );
        terminal::mac_plan(terminal::Terminal::TerminalApp, &job, &script_dir, &nonce)?
    } else if cfg!(windows) {
        terminal::windows_plan(&job, true)?
    } else {
        let term = terminal::default_terminal().ok_or("No supported terminal was found. Install GNOME Terminal, Konsole, xfce4-terminal, kitty, Alacritty, WezTerm or xterm.")?;
        terminal::linux_plan(term, &job)?
    };
    terminal::spawn(&plan)?;
    Ok(LaunchResult {
        status: "launched",
        message: format!("{name} opened in a terminal using your subscription sign-in."),
        client: report,
    })
}

#[tauri::command]
async fn launch_code(
    app: tauri::AppHandle,
    provider: String,
    folder: String,
) -> Result<LaunchResult, String> {
    tauri::async_runtime::spawn_blocking(move || launch_blocking(app, provider, folder))
        .await
        .map_err(|e| e.to_string())?
}

fn reveal(app: &tauri::AppHandle) {
    // Activating from a second launch or the Dock can turn the menu-bar companion into a regular app.
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.emit("open-launcher", ());
    }
}

fn toggle(app: &tauri::AppHandle) {
    match app.get_webview_window("main") {
        Some(window)
            if window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(false) =>
        {
            let _ = window.hide();
        }
        _ => reveal(app),
    }
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = tauri::menu::MenuItem::with_id(app, "show", "Open Orbit", true, None::<&str>)?;
    let hide = tauri::menu::MenuItem::with_id(app, "hide", "Hide Orbit", true, None::<&str>)?;
    let quit = tauri::menu::MenuItem::with_id(app, "quit", "Quit Orbit", true, None::<&str>)?;
    let menu = tauri::menu::Menu::with_items(app, &[&show, &hide, &quit])?;
    let mut tray = tauri::tray::TrayIconBuilder::with_id("orbit")
        .tooltip("Orbit")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => reveal(app),
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app).map(|_| ())
}

fn main() {
    tauri::Builder::default()
        // Must be registered first: a second launch focuses the running companion instead of starting another.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| reveal(app)))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let data_path = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_path)?;
            let db = Connection::open(data_path.join("orbit.sqlite"))?;
            db.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY, json TEXT NOT NULL);")?;
            app.manage(Database(Mutex::new(db)));

            let mut caps = base_capabilities();
            let modifier = if cfg!(target_os = "macos") { Modifiers::SUPER } else { Modifiers::CONTROL };
            // A shortcut collision or an unsupported compositor must not prevent the companion from opening.
            match app.global_shortcut().register(Shortcut::new(Some(modifier | Modifiers::SHIFT), Code::Space)) {
                Ok(()) => caps.shortcut = true,
                Err(error) => eprintln!("Global shortcut unavailable: {error}"),
            }
            match build_tray(app) {
                Ok(()) => caps.tray = true,
                Err(error) => eprintln!("Tray unavailable: {error}"),
            }
            if let Some(window) = app.get_webview_window("main") {
                // Without a tray or shortcut the taskbar/dock entry is the only reliable way back to a hidden window.
                if !(caps.tray && caps.shortcut) {
                    let _ = window.set_skip_taskbar(false);
                }
            }
            app.manage(CapabilityState(Mutex::new(caps)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![capabilities, load_data, save_data, open_url, open_folder, pick_folder, export_backup, client_status, launch_code])
        .build(tauri::generate_context!())
        .expect("Could not start Orbit")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = _event {
                reveal(_app);
            }
        });
}
