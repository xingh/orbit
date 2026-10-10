#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{path::PathBuf, sync::Mutex};
use rusqlite::{Connection, OptionalExtension};
use tauri::{Emitter, Manager, State};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

struct Database(Mutex<Connection>);

#[tauri::command]
fn load_data(db: State<Database>) -> Result<String, String> {
    db.0.lock().map_err(|e| e.to_string())?
        .query_row("SELECT json FROM workspace WHERE id = 1", [], |row| row.get(0))
        .optional().map(|value: Option<String>| value.unwrap_or_default()).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_data(json: String, db: State<Database>) -> Result<(), String> {
    if json.len() > 2_000_000 { return Err("Workspace exceeds the 2 MB limit. Export and archive older entries.".into()); }
    let value: serde_json::Value = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    if !value["items"].is_array() { return Err("Invalid workspace data".into()); }
    db.0.lock().map_err(|e| e.to_string())?
        .execute("INSERT INTO workspace (id, json) VALUES (1, ?1) ON CONFLICT(id) DO UPDATE SET json = excluded.json", [json])
        .map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|_| "Invalid URL")?;
    let host = parsed.host_str().unwrap_or_default();
    if parsed.scheme() != "https" || !parsed.username().is_empty() || parsed.password().is_some() || parsed.port().is_some()
        || !["claude.ai", "chatgpt.com", "grok.com"].contains(&host) {
        return Err("Only official HTTPS service links can be opened.".into());
    }
    open::that(parsed.as_str()).map_err(|e| e.to_string())
}

fn folder_path(folder: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(folder);
    if !path.is_absolute() || !path.is_dir() { return Err("Choose an existing absolute project folder.".into()); }
    path.canonicalize().map_err(|e| e.to_string())
}

#[tauri::command]
fn open_folder(folder: String) -> Result<(), String> { open::that(folder_path(&folder)?).map_err(|e| e.to_string()) }

#[tauri::command]
async fn pick_folder() -> Result<Option<String>, String> {
    Ok(rfd::AsyncFileDialog::new().pick_folder().await.map(|handle| handle.path().to_string_lossy().into_owned()))
}

#[tauri::command]
fn launch_code(provider: String, folder: String) -> Result<(), String> {
    let tool = match provider.as_str() { "codex" => "codex", "claude-code" => "claude", _ => return Err("Unknown coding tool.".into()) };
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // Check installation without running the user's tool or passing a user-built command.
        let exists = std::process::Command::new("where.exe").arg(tool).creation_flags(0x08000000)
            .output().map_err(|e| e.to_string())?;
        if !exists.status.success() { return Err(format!("{} is not installed or is not on PATH. Install its official client first.", tool)); }
        let mut command = std::process::Command::new("powershell.exe");
        // Folder comes from an environment variable, never executable shell text.
        command.args(["-NoLogo", "-NoProfile", "-NoExit", "-Command",
            "if ($env:ORBIT_PROJECT_DIR) { Set-Location -LiteralPath $env:ORBIT_PROJECT_DIR }; Write-Host 'Use your subscription sign-in in this tool.'; & $env:ORBIT_CODE_TOOL"]);
        command.env("ORBIT_CODE_TOOL", tool).env_remove("ORBIT_PROJECT_DIR");
        if !folder.trim().is_empty() { command.env("ORBIT_PROJECT_DIR", folder_path(&folder)?); }
        for key in ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDE_CODE_USE_FOUNDRY", "OPENAI_API_KEY", "OPENAI_BASE_URL"] { command.env_remove(key); }
        command.creation_flags(0x00000010).spawn().map(|_| ()).map_err(|e| e.to_string())
    }
    #[cfg(not(windows))]
    { let _ = (tool, folder); Err("Local terminal launch is currently supported on Windows.".into()) }
}

fn reveal(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show(); let _ = window.set_focus(); let _ = window.emit("open-launcher", ());
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().with_handler(|app, _, event| {
            if event.state() == ShortcutState::Pressed { reveal(app); }
        }).build())
        .setup(|app| {
            let data_path = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_path)?;
            let db = Connection::open(data_path.join("orbit.sqlite"))?;
            db.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY, json TEXT NOT NULL);")?;
            app.manage(Database(Mutex::new(db)));
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space);
            // A shortcut collision should not prevent the companion from opening.
            if let Err(error) = app.global_shortcut().register(shortcut) { eprintln!("Shortcut unavailable: {}", error); }
            let show = tauri::menu::MenuItem::with_id(app, "show", "Open Orbit", true, None::<&str>)?;
            let hide = tauri::menu::MenuItem::with_id(app, "hide", "Hide Orbit", true, None::<&str>)?;
            let quit = tauri::menu::MenuItem::with_id(app, "quit", "Quit Orbit", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&show, &hide, &quit])?;
            let mut tray = tauri::tray::TrayIconBuilder::new().tooltip("Orbit Companion").menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => reveal(app),
                    "hide" => { if let Some(window) = app.get_webview_window("main") { let _ = window.hide(); } },
                    "quit" => app.exit(0),
                    _ => {}
                });
            if let Some(icon) = app.default_window_icon() { tray = tray.icon(icon.clone()); }
            tray.build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![load_data, save_data, open_url, open_folder, pick_folder, launch_code])
        .run(tauri::generate_context!())
        .expect("Could not start Orbit Companion");
}
