#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod clients;
mod paths;
mod providers;
mod service;
mod terminal;

use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;
use std::sync::{Arc, Mutex};
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

/// Saves the window's workspace without discarding what it has not seen.
///
/// The companion service also writes here, and the window builds its JSON before taking the lock,
/// so a plain overwrite loses any entry the service saved in between — which is how an imported
/// chat could reappear without the project it belonged to. Entries in storage that the window
/// neither sent nor says it removed are therefore kept.
#[tauri::command]
fn save_data(json: String, removed: Vec<String>, db: State<Database>) -> Result<(), String> {
    if json.len() > 2_000_000 {
        return Err("Workspace exceeds the 2 MB limit. Export and archive older entries.".into());
    }
    let mut value: serde_json::Value = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    if !value["items"].is_array() {
        return Err("Invalid workspace data".into());
    }
    let db = db.0.lock().map_err(|e| e.to_string())?;
    let stored: Option<String> = db
        .query_row("SELECT json FROM workspace WHERE id = 1", [], |row| {
            row.get(0)
        })
        .optional()
        .unwrap_or(None);
    let kept = unseen_items(&value, stored.as_deref(), &removed);
    if !kept.is_empty() {
        let items = value["items"].as_array_mut().expect("items array");
        items.extend(kept);
    }
    let merged = value.to_string();
    if merged.len() > 2_000_000 {
        return Err("Workspace exceeds the 2 MB limit. Export and archive older entries.".into());
    }
    db.execute("INSERT INTO workspace (id, json) VALUES (1, ?1) ON CONFLICT(id) DO UPDATE SET json = excluded.json", [merged])
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// Stored entries the incoming workspace does not mention and the window did not remove.
fn unseen_items(
    incoming: &serde_json::Value,
    stored: Option<&str>,
    removed: &[String],
) -> Vec<serde_json::Value> {
    let Some(previous) = stored
        .filter(|raw| !raw.is_empty())
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(raw).ok())
    else {
        return Vec::new();
    };
    let sent: std::collections::HashSet<&str> = incoming["items"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item["id"].as_str())
                .collect()
        })
        .unwrap_or_default();
    previous["items"]
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter(|item| {
                    item["id"].as_str().is_some_and(|id| {
                        !sent.contains(id) && !removed.iter().any(|gone| gone == id)
                    })
                })
                .cloned()
                .collect()
        })
        .unwrap_or_default()
}

#[tauri::command]
fn service_info(
    app: tauri::AppHandle,
    service: State<Option<Arc<service::Service>>>,
) -> Option<service::ServiceInfo> {
    service.inner().as_ref().map(|s| service::info(&app, s))
}

#[tauri::command]
fn start_pairing(service: State<Option<Arc<service::Service>>>) -> Result<u64, String> {
    service
        .inner()
        .as_ref()
        .map(|s| service::open_pairing(s))
        .ok_or_else(|| "The companion service is not running.".to_string())
}

#[tauri::command]
fn stop_pairing(service: State<Option<Arc<service::Service>>>) {
    if let Some(service) = service.inner().as_ref() {
        service::close_pairing(service);
    }
}

#[tauri::command]
fn unpair_browsers(
    app: tauri::AppHandle,
    service: State<Option<Arc<service::Service>>>,
) -> Result<(), String> {
    if let Some(service) = service.inner().as_ref() {
        service::close_pairing(service);
    }
    // Rotating the token is what actually revokes access; clearing the list alone would not.
    service::rotate_token(&app)
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

fn show_window(app: &tauri::AppHandle) -> Option<tauri::WebviewWindow> {
    // Activating from a second launch or the Dock can turn the menu-bar companion into a regular app.
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
    let window = app.get_webview_window("main")?;
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    Some(window)
}

fn reveal(app: &tauri::AppHandle) {
    if let Some(window) = show_window(app) {
        let _ = window.emit("open-launcher", ());
    }
}

/// Opens the companion straight onto one of its panels, for the tray menu.
fn show_view(app: &tauri::AppHandle, view: &str) {
    if let Some(window) = show_window(app) {
        let _ = window.emit("open-view", view);
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
    use tauri::menu::{MenuItem, PredefinedMenuItem};
    let item = |id: &str, label: &str| MenuItem::with_id(app, id, label, true, None::<&str>);
    let show = item("show", "Open Orbit")?;
    let new_chat = item("view:new", "New chat…")?;
    let find = item("view:find", "Find saved work…")?;
    let projects = item("view:projects", "Projects…")?;
    let preferences = item("view:settings", "Preferences…")?;
    let pair = item("pair", "Pair a browser…")?;
    let hide = item("hide", "Hide Orbit")?;
    let quit = item("quit", "Quit Orbit")?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = tauri::menu::Menu::with_items(
        app,
        &[
            &show,
            &separator,
            &new_chat,
            &find,
            &projects,
            &separator,
            &preferences,
            &pair,
            &separator,
            &hide,
            &quit,
        ],
    )?;
    let mut tray = tauri::tray::TrayIconBuilder::with_id("orbit")
        .tooltip("Orbit")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => reveal(app),
            "pair" => {
                // Opening the window on Preferences shows the countdown the browser has to answer.
                if let Some(service) = app
                    .state::<Option<Arc<service::Service>>>()
                    .inner()
                    .as_ref()
                {
                    service::open_pairing(service);
                }
                show_view(app, "settings");
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "quit" => app.exit(0),
            id => {
                if let Some(view) = id.strip_prefix("view:") {
                    show_view(app, view);
                }
            }
        })
        // Windows and macOS report icon clicks; a Linux AppIndicator tray reports none, so there the
        // menu's Open Orbit stays the way in.
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::DoubleClick {
                button: tauri::tray::MouseButton::Left,
                ..
            } = event
            {
                reveal(tray.app_handle());
            }
        });
    // A menu opened by the first click swallows the second, and Windows tray menus belong on the
    // right button anyway. macOS keeps its menu-on-click convention, so it has no double-click.
    #[cfg(windows)]
    {
        tray = tray.show_menu_on_left_click(false);
    }
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

            // The extension can only reach Orbit while it is running; a failure here must not stop
            // the window from opening, so it is reported and the service is simply absent.
            let service = {
                let state: State<Database> = app.state();
                let token = state.0.lock().ok().and_then(|db| service::prepare(&db).ok());
                match token {
                    Some(token) => service::start(&app.handle().clone(), token)
                        .inspect_err(|error| eprintln!("Companion service unavailable: {error}"))
                        .ok(),
                    None => {
                        eprintln!("Companion service unavailable: no pairing token");
                        None
                    }
                }
            };
            app.manage(service);

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
        .invoke_handler(tauri::generate_handler![capabilities, load_data, save_data, open_url, open_folder, pick_folder, export_backup, client_status, launch_code, service_info, start_pairing, stop_pairing, unpair_browsers])
        .build(tauri::generate_context!())
        .expect("Could not start Orbit")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = _event {
                reveal(_app);
            }
        });
}

#[cfg(test)]
mod tests {
    use super::unseen_items;

    fn workspace(ids: &[&str]) -> serde_json::Value {
        serde_json::json!({
            "items": ids.iter().map(|id| serde_json::json!({ "id": id })).collect::<Vec<_>>(),
        })
    }

    #[test]
    fn a_window_save_keeps_what_it_has_not_seen() {
        let stored = workspace(&["a", "b", "imported-while-saving"]).to_string();
        // The window sends what it knows and names nothing as deleted.
        let kept = unseen_items(&workspace(&["a", "b"]), Some(&stored), &[]);
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0]["id"], "imported-while-saving");
    }

    #[test]
    fn a_deletion_is_not_mistaken_for_an_unseen_entry() {
        let stored = workspace(&["a", "b"]).to_string();
        let kept = unseen_items(&workspace(&["a"]), Some(&stored), &["b".to_string()]);
        assert!(kept.is_empty());
    }

    #[test]
    fn nothing_is_invented_from_empty_or_unreadable_storage() {
        for stored in [None, Some(""), Some("not json")] {
            assert!(unseen_items(&workspace(&["a"]), stored, &[]).is_empty());
        }
    }
}
