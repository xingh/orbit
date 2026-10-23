//! Loopback companion service. The browser extension posts saved conversations straight into Orbit
//! instead of exporting a file the user has to import by hand.
//!
//! A service on loopback is reachable by every page the user visits and every local process, so each
//! write needs two things: a bearer token *and* a browser-extension origin. The token is only handed
//! out by `GET /pair` during a short window the user opens from Preferences, which keeps a web page
//! that stumbles onto the port from doing anything with it.

use crate::providers;
use crate::Database;
use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;
use std::io::Read;
use std::sync::{Arc, Mutex, PoisonError};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};
use tiny_http::{Header, Method, Request, Response, Server};

/// The first free port is used. The extension probes the same list, so the two stay in step.
pub const PORTS: &[u16] = &[41479, 41480, 41481, 41482, 41483];
/// How long `GET /pair` will hand out the token after the user asks for it.
const PAIRING_WINDOW: Duration = Duration::from_secs(60);
const MAX_BODY: usize = 256 * 1024;
/// Matches the ceiling `save_data` enforces for the window's own writes.
const WORKSPACE_LIMIT: usize = 2_000_000;

pub struct Service {
    pub port: u16,
    token: String,
    pair_until: Mutex<Option<Instant>>,
}

#[derive(Serialize, Clone)]
pub struct PairedClient {
    origin: String,
    label: String,
    paired_at: i64,
}

#[derive(Serialize)]
pub struct ServiceInfo {
    port: u16,
    /// Seconds left in the pairing window; 0 when it is closed.
    pairing_seconds: u64,
    paired: Vec<PairedClient>,
}

type Reply = Response<std::io::Cursor<Vec<u8>>>;

/// Creates the service tables and returns this installation's token, generating it on first run.
pub fn prepare(db: &Connection) -> rusqlite::Result<String> {
    db.execute_batch(
        "CREATE TABLE IF NOT EXISTS service (id INTEGER PRIMARY KEY CHECK (id = 1), token TEXT NOT NULL);
         CREATE TABLE IF NOT EXISTS paired (origin TEXT PRIMARY KEY, label TEXT NOT NULL, paired_at INTEGER NOT NULL);",
    )?;
    if let Some(token) = db
        .query_row("SELECT token FROM service WHERE id = 1", [], |row| {
            row.get::<_, String>(0)
        })
        .optional()?
    {
        return Ok(token);
    }
    // SQLite seeds its PRNG from the OS, so the token needs no extra random-number dependency.
    let token: String = db.query_row("SELECT lower(hex(randomblob(32)))", [], |row| row.get(0))?;
    db.execute("INSERT INTO service (id, token) VALUES (1, ?1)", [&token])?;
    Ok(token)
}

/// Binds the first free port in [`PORTS`] and serves it on its own thread.
pub fn start(app: &AppHandle, token: String) -> Result<Arc<Service>, String> {
    let (server, port) = PORTS
        .iter()
        .find_map(|port| Server::http(("127.0.0.1", *port)).ok().map(|s| (s, *port)))
        .ok_or("Every port in the Orbit range is already in use.")?;
    let service = Arc::new(Service {
        port,
        token,
        pair_until: Mutex::new(None),
    });
    let handle = app.clone();
    let shared = service.clone();
    std::thread::Builder::new()
        .name("orbit-service".into())
        .spawn(move || loop {
            match server.recv() {
                Ok(request) => respond(&handle, &shared, request),
                Err(error) => {
                    eprintln!("Companion service stopped: {error}");
                    break;
                }
            }
        })
        .map_err(|e| e.to_string())?;
    Ok(service)
}

pub fn open_pairing(service: &Service) -> u64 {
    *service
        .pair_until
        .lock()
        .unwrap_or_else(PoisonError::into_inner) = Some(Instant::now() + PAIRING_WINDOW);
    PAIRING_WINDOW.as_secs()
}

pub fn close_pairing(service: &Service) {
    *service
        .pair_until
        .lock()
        .unwrap_or_else(PoisonError::into_inner) = None;
}

fn pairing_seconds(service: &Service) -> u64 {
    service
        .pair_until
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .and_then(|until| until.checked_duration_since(Instant::now()))
        .map(|left| left.as_secs() + 1)
        .unwrap_or(0)
}

pub fn info(app: &AppHandle, service: &Service) -> ServiceInfo {
    ServiceInfo {
        port: service.port,
        pairing_seconds: pairing_seconds(service),
        paired: paired_clients(app),
    }
}

fn paired_clients(app: &AppHandle) -> Vec<PairedClient> {
    let state: State<Database> = app.state();
    let Ok(db) = state.0.lock() else {
        return Vec::new();
    };
    let mut statement =
        match db.prepare("SELECT origin, label, paired_at FROM paired ORDER BY paired_at DESC") {
            Ok(statement) => statement,
            Err(_) => return Vec::new(),
        };
    let rows = statement.query_map([], |row| {
        Ok(PairedClient {
            origin: row.get(0)?,
            label: row.get(1)?,
            paired_at: row.get(2)?,
        })
    });
    rows.map(|rows| rows.filter_map(Result::ok).collect())
        .unwrap_or_default()
}

/// Rotating the token is how a user revokes a browser they no longer trust: every paired
/// extension stops being able to write until it pairs again.
pub fn rotate_token(app: &AppHandle) -> Result<(), String> {
    let state: State<Database> = app.state();
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let token: String = db
        .query_row("SELECT lower(hex(randomblob(32)))", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    db.execute("UPDATE service SET token = ?1 WHERE id = 1", [&token])
        .map_err(|e| e.to_string())?;
    db.execute("DELETE FROM paired", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn header(name: &str, value: &str) -> Header {
    Header::from_bytes(name.as_bytes(), value.as_bytes()).expect("valid header")
}

/// Only a browser extension may talk to the service. Chrome ids are lowercase letters; Firefox
/// uses a UUID, optionally brace-wrapped.
fn is_extension_origin(origin: &str) -> bool {
    let id = match origin
        .strip_prefix("chrome-extension://")
        .or_else(|| origin.strip_prefix("moz-extension://"))
    {
        Some(id) => id,
        None => return false,
    };
    !id.is_empty()
        && id.len() <= 64
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '{' | '}'))
}

/// Who is on the other end.
///
/// A web page cannot suppress its `Origin`: browsers always set one on a cross-origin fetch. A
/// browser extension holding the host permission is the opposite case — Firefox treats its requests
/// as privileged and sends no `Origin` at all. So a missing header is the extension's normal shape,
/// while a present one that is not an extension is a page that has no business here.
enum Caller {
    Extension(String),
    /// No `Origin`: an extension with host permission, or a local program. The token is what
    /// authorises it; `GET /pair` is additionally gated on the window the user opened.
    Headless,
    Web,
}

fn caller_of(origin: Option<String>) -> Caller {
    match origin {
        None => Caller::Headless,
        Some(origin) if is_extension_origin(&origin) => Caller::Extension(origin),
        Some(_) => Caller::Web,
    }
}

impl Caller {
    /// The origin to echo back. Nothing is echoed to a caller that sent none, because no browser
    /// CORS check is running for it.
    fn cors(&self) -> Option<&str> {
        match self {
            Caller::Extension(origin) => Some(origin),
            _ => None,
        }
    }
}

fn label_for(origin: &str) -> &'static str {
    if origin.starts_with("moz-extension://") {
        "Firefox"
    } else {
        "Chrome or Edge"
    }
}

/// Only ever used to name a paired browser in Preferences, never to decide access.
fn label_from_agent(agent: Option<&str>) -> &'static str {
    match agent {
        Some(agent) if agent.contains("Edg") => "Edge",
        Some(agent) if agent.contains("Firefox") => "Firefox",
        Some(agent) if agent.contains("Chrome") => "Chrome",
        _ => "A browser",
    }
}

fn json(status: u16, body: String, origin: Option<&str>) -> Reply {
    let mut reply = Response::from_string(body)
        .with_status_code(status)
        .with_header(header("Content-Type", "application/json; charset=utf-8"))
        .with_header(header("Cache-Control", "no-store"));
    if let Some(origin) = origin {
        reply = reply
            .with_header(header("Access-Control-Allow-Origin", origin))
            .with_header(header("Vary", "Origin"));
    }
    reply
}

fn error(status: u16, message: &str, origin: Option<&str>) -> Reply {
    json(
        status,
        serde_json::json!({ "error": message }).to_string(),
        origin,
    )
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|since| since.as_millis() as i64)
        .unwrap_or_default()
}

fn respond(app: &AppHandle, service: &Service, mut request: Request) {
    let method = request.method().clone();
    let path = request
        .url()
        .split('?')
        .next()
        .unwrap_or_default()
        .to_string();
    let value_of = |name: &'static str| {
        request
            .headers()
            .iter()
            .find(|header| header.field.equiv(name))
            .map(|header| header.value.as_str().to_string())
    };
    let authorization = value_of("Authorization");
    let agent = value_of("User-Agent");
    let caller = caller_of(value_of("Origin"));
    let allowed = caller.cors().map(str::to_string);

    let reply = match (&method, path.as_str()) {
        (Method::Options, _) => Response::from_string(String::new())
            .with_status_code(204)
            .with_header(header(
                "Access-Control-Allow-Origin",
                allowed.as_deref().unwrap_or("null"),
            ))
            .with_header(header("Access-Control-Allow-Methods", "GET, POST, OPTIONS"))
            .with_header(header(
                "Access-Control-Allow-Headers",
                "Authorization, Content-Type",
            ))
            .with_header(header("Access-Control-Max-Age", "600"))
            .with_header(header("Vary", "Origin")),
        (Method::Get, "/health") => json(
            200,
            serde_json::json!({ "orbit": true, "version": env!("CARGO_PKG_VERSION") }).to_string(),
            allowed.as_deref(),
        ),
        (Method::Get, "/pair") => match caller {
            Caller::Web => error(403, "A web page cannot pair with Orbit.", None),
            _ if pairing_seconds(service) == 0 => error(
                403,
                "Open Orbit, go to Preferences and choose Pair a browser, then try again.",
                allowed.as_deref(),
            ),
            ref caller => {
                remember_paired(app, caller, agent.as_deref());
                json(
                    200,
                    serde_json::json!({ "token": service.token }).to_string(),
                    allowed.as_deref(),
                )
            }
        },
        (Method::Post, "/chats") => match caller {
            Caller::Web => error(403, "A web page cannot save to Orbit.", None),
            _ if !authorized(service, authorization.as_deref()) => error(
                401,
                "Pair this browser with Orbit first.",
                allowed.as_deref(),
            ),
            _ => save_chats(app, &mut request, allowed.as_deref()),
        },
        _ => error(404, "Not found.", allowed.as_deref()),
    };
    let _ = request.respond(reply);
}

fn authorized(service: &Service, authorization: Option<&str>) -> bool {
    let presented = match authorization.and_then(|value| value.strip_prefix("Bearer ")) {
        Some(value) => value.trim().as_bytes(),
        None => return false,
    };
    let expected = service.token.as_bytes();
    // Compared without an early exit so a wrong token leaks nothing through timing.
    presented.len() == expected.len()
        && presented
            .iter()
            .zip(expected)
            .fold(0u8, |differences, (a, b)| differences | (a ^ b))
            == 0
}

fn remember_paired(app: &AppHandle, caller: &Caller, agent: Option<&str>) {
    // Firefox sends no origin, so the browser is named from its user agent instead. That name is
    // cosmetic: the token, not this row, is what grants access.
    let (origin, label) = match caller {
        Caller::Extension(origin) => (origin.clone(), label_for(origin)),
        _ => {
            let label = label_from_agent(agent);
            (format!("browser:{}", label.to_lowercase()), label)
        }
    };
    let origin = origin.as_str();
    let state: State<Database> = app.state();
    let locked = state.0.lock();
    if let Ok(db) = locked {
        let _ = db.execute(
            "INSERT INTO paired (origin, label, paired_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(origin) DO UPDATE SET paired_at = excluded.paired_at",
            rusqlite::params![origin, label, now_ms()],
        );
    }
}

/// Normalises one posted conversation or project into a workspace item, rejecting anything the
/// window itself would not accept.
fn workspace_item(raw: &serde_json::Value) -> Result<serde_json::Value, String> {
    let kind = match raw["type"].as_str().unwrap_or("chat") {
        "chat" => "chat",
        "project" => "project",
        _ => return Err("Only conversations and projects can be saved from a browser.".into()),
    };
    let provider = raw["provider"].as_str().unwrap_or_default();
    let url = providers::validate_chat_url(raw["url"].as_str().unwrap_or_default(), provider)?;
    let title = match trimmed(&raw["title"], 120) {
        title if title.is_empty() && kind == "project" => "Project".to_string(),
        title if title.is_empty() => "Saved conversation".to_string(),
        title => title,
    };
    let id = identifier(&raw["id"]).unwrap_or_else(|| format!("ext-{:x}", now_ms()));
    // Only a chat is filed under a project, and only one that turns out to exist: `merge_chats`
    // clears a link that names nothing, so a browser cannot invent a project by referring to it.
    let project_id = match kind {
        "chat" => identifier(&raw["projectId"]).unwrap_or_default(),
        _ => String::new(),
    };
    let updated = raw["updated"].as_i64().filter(|value| *value > 0);
    Ok(serde_json::json!({
        "id": id,
        "type": kind,
        "title": title,
        "provider": provider,
        "url": url.as_str(),
        "note": trimmed(&raw["note"], 240),
        "folder": "",
        "projectId": project_id,
        "pinned": false,
        "updated": updated.unwrap_or_else(now_ms),
    }))
}

/// An id Orbit will store: short, and only the characters its own ids use.
fn identifier(value: &serde_json::Value) -> Option<String> {
    value
        .as_str()
        .filter(|id| {
            !id.is_empty()
                && id.len() <= 64
                && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
        })
        .map(str::to_string)
}

fn trimmed(value: &serde_json::Value, limit: usize) -> String {
    value
        .as_str()
        .unwrap_or_default()
        .trim()
        .chars()
        .take(limit)
        .collect()
}

/// What one merge did: the entries saved, the ones already saved that gained a project link, how
/// many changed nothing, and why anything was refused.
pub struct Merged {
    pub added: Vec<serde_json::Value>,
    pub linked: Vec<serde_json::Value>,
    pub skipped: usize,
    pub rejected: Vec<String>,
}

/// Merges posted conversations and projects into the workspace, keeping the dedupe rule the
/// window's own import uses: same id, or the same link already saved as the same kind of entry.
pub fn merge_chats(workspace: &mut serde_json::Value, incoming: &[serde_json::Value]) -> Merged {
    if !workspace["items"].is_array() {
        workspace["items"] = serde_json::json!([]);
    }
    let items = workspace["items"].as_array_mut().expect("items array");
    let mut merged = Merged {
        added: Vec::new(),
        linked: Vec::new(),
        skipped: 0,
        rejected: Vec::new(),
    };
    for raw in incoming {
        match workspace_item(raw) {
            Err(reason) => merged.rejected.push(reason),
            Ok(mut item) => {
                // A link is kept only when the project is really there — already saved, or arriving
                // in this same batch, since each service's projects are read before its chats.
                let project = item["projectId"].as_str().unwrap_or_default().to_string();
                let known = !project.is_empty()
                    && items
                        .iter()
                        .any(|existing| existing["type"] == "project" && existing["id"] == project);
                if !known {
                    item["projectId"] = serde_json::json!("");
                }
                let seen = items.iter().position(|existing| {
                    existing["id"] == item["id"]
                        || (existing["type"] == item["type"] && existing["url"] == item["url"])
                });
                if let Some(at) = seen {
                    // Already saved, so nothing is overwritten — except a project link it does not
                    // have yet. A chat saved before its project was imported would otherwise stay
                    // loose no matter how often the import ran.
                    let fills_a_gap = known
                        && items[at]["type"] == "chat"
                        && items[at]["projectId"]
                            .as_str()
                            .unwrap_or_default()
                            .is_empty();
                    if fills_a_gap {
                        items[at]["projectId"] = serde_json::json!(project);
                        merged.linked.push(items[at].clone());
                    } else {
                        merged.skipped += 1;
                    }
                    continue;
                }
                items.push(item.clone());
                merged.added.push(item);
            }
        }
    }
    merged
}

fn save_chats(app: &AppHandle, request: &mut Request, origin: Option<&str>) -> Reply {
    if request.body_length().unwrap_or(0) > MAX_BODY {
        return error(413, "That is too much data for one save.", origin);
    }
    let mut body = String::new();
    if request
        .as_reader()
        .take(MAX_BODY as u64 + 1)
        .read_to_string(&mut body)
        .is_err()
        || body.len() > MAX_BODY
    {
        return error(400, "Could not read that request.", origin);
    }
    let parsed: serde_json::Value = match serde_json::from_str(&body) {
        Ok(parsed) => parsed,
        Err(_) => return error(400, "Could not read that request.", origin),
    };
    let incoming = match parsed["items"].as_array() {
        Some(items) => items.clone(),
        None => vec![parsed],
    };
    if incoming.is_empty() {
        return error(400, "No conversation was included.", origin);
    }

    let state: State<Database> = app.state();
    let Ok(db) = state.0.lock() else {
        return error(500, "Orbit could not reach its own storage.", origin);
    };
    let stored: Option<String> = db
        .query_row("SELECT json FROM workspace WHERE id = 1", [], |row| {
            row.get(0)
        })
        .optional()
        .unwrap_or(None);
    let mut workspace: serde_json::Value = stored
        .as_deref()
        .filter(|raw| !raw.is_empty())
        .and_then(|raw| serde_json::from_str(raw).ok())
        .unwrap_or_else(
            || serde_json::json!({ "items": [], "settings": { "grok": false, "compact": false, "robot": true } }),
        );

    let merged = merge_chats(&mut workspace, &incoming);
    let changed: Vec<serde_json::Value> = merged
        .added
        .iter()
        .chain(merged.linked.iter())
        .cloned()
        .collect();
    if !changed.is_empty() {
        let serialized = workspace.to_string();
        if serialized.len() > WORKSPACE_LIMIT {
            return error(
                409,
                "Orbit's saved work is at its 2 MB limit. Export a backup and remove older entries.",
                origin,
            );
        }
        if db
            .execute(
                "INSERT INTO workspace (id, json) VALUES (1, ?1) ON CONFLICT(id) DO UPDATE SET json = excluded.json",
                [&serialized],
            )
            .is_err()
        {
            return error(500, "Orbit could not save that conversation.", origin);
        }
    }
    // Released before the window is told, so the UI's own read does not wait on this request.
    drop(db);

    if !changed.is_empty() {
        let _ = app.emit("chats-added", &changed);
    }
    json(
        200,
        serde_json::json!({
            "added": merged.added.len(),
            "linked": merged.linked.len(),
            "skipped": merged.skipped,
            "rejected": merged.rejected,
        })
        .to_string(),
        origin,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The provider follows the link's host, so a helper call is never a mismatch by accident.
    fn chat(id: &str, url: &str) -> serde_json::Value {
        let provider = if url.contains("chatgpt.com") {
            "chatgpt"
        } else if url.contains("grok.com") {
            "grok"
        } else {
            "claude"
        };
        serde_json::json!({ "id": id, "type": "chat", "title": "A chat", "provider": provider, "url": url })
    }

    #[test]
    fn accepts_only_extension_origins() {
        assert!(is_extension_origin(
            "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
        ));
        assert!(is_extension_origin(
            "moz-extension://47039d97-4e36-4416-bbd3-aed5b8470741"
        ));
        assert!(!is_extension_origin("https://evil.example"));
        assert!(!is_extension_origin("http://127.0.0.1:41479"));
        assert!(!is_extension_origin("moz-extension://"));
        assert!(!is_extension_origin("moz-extension://abc/../.."));
        assert!(!is_extension_origin("null"));
    }

    #[test]
    fn a_missing_origin_is_not_treated_as_a_web_page() {
        // Firefox sends no Origin for a permitted extension request; a page always sends one.
        assert!(matches!(caller_of(None), Caller::Headless));
        assert!(matches!(
            caller_of(Some(
                "moz-extension://47039d97-4e36-4416-bbd3-aed5b8470741".into()
            )),
            Caller::Extension(_)
        ));
        assert!(matches!(
            caller_of(Some(
                "chrome-extension://abcdefghijklmnopabcdefghijklmnop".into()
            )),
            Caller::Extension(_)
        ));
        assert!(matches!(
            caller_of(Some("https://evil.example".into())),
            Caller::Web
        ));
        assert!(matches!(caller_of(Some("null".into())), Caller::Web));
        // Only an extension origin is echoed back; nothing else gets CORS headers.
        assert!(caller_of(None).cors().is_none());
        assert!(caller_of(Some("https://evil.example".into()))
            .cors()
            .is_none());
    }

    #[test]
    fn browsers_are_named_from_their_user_agent_when_no_origin_arrives() {
        assert_eq!(
            label_from_agent(Some("Mozilla/5.0 Firefox/142.0")),
            "Firefox"
        );
        assert_eq!(
            label_from_agent(Some("Mozilla/5.0 Chrome/141 Edg/141")),
            "Edge"
        );
        assert_eq!(
            label_from_agent(Some("Mozilla/5.0 Chrome/141 Safari/537")),
            "Chrome"
        );
        assert_eq!(label_from_agent(None), "A browser");
    }

    #[test]
    fn only_the_exact_bearer_token_is_accepted() {
        let service = Service {
            port: 0,
            token: "a".repeat(64),
            pair_until: Mutex::new(None),
        };
        assert!(authorized(
            &service,
            Some(&format!("Bearer {}", "a".repeat(64)))
        ));
        assert!(!authorized(
            &service,
            Some(&format!("Bearer {}", "a".repeat(63)))
        ));
        assert!(!authorized(
            &service,
            Some(&format!("Bearer {}", "b".repeat(64)))
        ));
        assert!(!authorized(&service, Some("Bearer")));
        assert!(!authorized(&service, Some(&"a".repeat(64))));
        assert!(!authorized(&service, None));
    }

    #[test]
    fn pairing_window_opens_and_closes() {
        let service = Service {
            port: 0,
            token: String::new(),
            pair_until: Mutex::new(None),
        };
        assert_eq!(pairing_seconds(&service), 0);
        assert_eq!(open_pairing(&service), PAIRING_WINDOW.as_secs());
        assert!(pairing_seconds(&service) > 0);
        close_pairing(&service);
        assert_eq!(pairing_seconds(&service), 0);
    }

    #[test]
    fn merges_new_chats_and_skips_duplicates() {
        let mut workspace = serde_json::json!({ "items": [], "settings": {} });
        let merged = merge_chats(
            &mut workspace,
            &[
                chat("one", "https://claude.ai/chat/1"),
                chat("two", "https://chatgpt.com/c/2"),
            ],
        );
        assert_eq!(
            (merged.added.len(), merged.skipped, merged.rejected.len()),
            (2, 0, 0)
        );

        // Same id, then the same link under a new id: both are already saved.
        let merged = merge_chats(
            &mut workspace,
            &[
                chat("one", "https://claude.ai/chat/1"),
                chat("three", "https://claude.ai/chat/1"),
            ],
        );
        assert_eq!((merged.added.len(), merged.skipped), (0, 2));
        assert_eq!(workspace["items"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn rejects_hostile_and_mismatched_payloads() {
        let mut workspace = serde_json::json!({ "items": [] });
        let merged = merge_chats(
            &mut workspace,
            &[
                chat("a", "http://claude.ai/chat/1"),
                chat("b", "https://evil.example/chat/1"),
                chat("c", "https://user:pass@claude.ai/chat/1"),
                serde_json::json!({ "id": "d", "type": "note", "title": "p", "provider": "claude", "url": "https://claude.ai/chat/1" }),
                serde_json::json!({ "id": "e", "type": "chat", "title": "x", "provider": "pirate", "url": "https://claude.ai/chat/1" }),
            ],
        );
        assert!(merged.added.is_empty());
        assert_eq!(merged.rejected.len(), 5);
    }

    #[test]
    fn imports_projects_as_well_as_chats() {
        let project = |id: &str, url: &str| serde_json::json!({ "id": id, "type": "project", "title": "A project", "provider": "claude", "url": url });
        let mut workspace = serde_json::json!({ "items": [], "settings": {} });
        let merged = merge_chats(
            &mut workspace,
            &[
                project("claude-project-1", "https://claude.ai/project/1"),
                chat("claude-2", "https://claude.ai/chat/2"),
            ],
        );
        assert_eq!(
            (merged.added.len(), merged.skipped, merged.rejected.len()),
            (2, 0, 0)
        );
        assert_eq!(merged.added[0]["type"], "project");
        assert_eq!(merged.added[0]["url"], "https://claude.ai/project/1");
        // A project keeps the window's own defaults, so it lands unpinned and unfiled.
        assert_eq!(merged.added[0]["pinned"], false);
        assert_eq!(merged.added[0]["projectId"], "");

        // Importing again changes nothing, even when the id was rewritten on the way in.
        let again = merge_chats(
            &mut workspace,
            &[project("claude-project-1", "https://claude.ai/project/1")],
        );
        assert_eq!((again.added.len(), again.skipped), (0, 1));

        // A chat and a project may share a link without hiding each other.
        let mixed = merge_chats(
            &mut workspace,
            &[chat("claude-3", "https://claude.ai/project/1")],
        );
        assert_eq!(mixed.added.len(), 1);
    }

    #[test]
    fn chats_are_filed_under_a_project_that_exists() {
        let filed = |id: &str, url: &str, project: &str| {
            serde_json::json!({
                "id": id, "type": "chat", "title": "A chat", "provider": "claude",
                "url": url, "projectId": project,
            })
        };
        let project = serde_json::json!({
            "id": "claude-project-1", "type": "project", "title": "A project",
            "provider": "claude", "url": "https://claude.ai/project/1",
        });
        let mut workspace = serde_json::json!({ "items": [], "settings": {} });

        // The project and its chat arrive together, projects first, as the scanners send them.
        let merged = merge_chats(
            &mut workspace,
            &[
                project,
                filed("claude-2", "https://claude.ai/chat/2", "claude-project-1"),
                filed("claude-3", "https://claude.ai/chat/3", "claude-project-404"),
            ],
        );
        assert!(merged.rejected.is_empty());
        assert_eq!(merged.added[1]["projectId"], "claude-project-1");
        // A link to a project nobody has is dropped, so the chat is still saved, just unfiled.
        assert_eq!(merged.added[2]["projectId"], "");

        // A chat arriving in a later batch still finds the project already in the workspace.
        let later = merge_chats(
            &mut workspace,
            &[filed(
                "claude-4",
                "https://claude.ai/chat/4",
                "claude-project-1",
            )],
        );
        assert_eq!(later.added[0]["projectId"], "claude-project-1");

        // The chat already saved without a link is the one this has to reach: an import that only
        // ever skipped duplicates would leave every earlier chat loose for good.
        let refiled = merge_chats(
            &mut workspace,
            &[filed(
                "claude-3",
                "https://claude.ai/chat/3",
                "claude-project-1",
            )],
        );
        assert_eq!(
            (refiled.added.len(), refiled.linked.len(), refiled.skipped),
            (0, 1, 0)
        );
        assert_eq!(refiled.linked[0]["projectId"], "claude-project-1");
        // Running it a third time has nothing left to do.
        let settled = merge_chats(
            &mut workspace,
            &[filed(
                "claude-3",
                "https://claude.ai/chat/3",
                "claude-project-1",
            )],
        );
        assert_eq!((settled.linked.len(), settled.skipped), (0, 1));
        // A link already in place is never moved by a later import.
        let moved = merge_chats(
            &mut workspace,
            &[filed(
                "claude-3",
                "https://claude.ai/chat/3",
                "claude-project-2",
            )],
        );
        assert_eq!(moved.skipped, 1);
        let stored = workspace["items"]
            .as_array()
            .unwrap()
            .iter()
            .find(|item| item["id"] == "claude-3")
            .unwrap()
            .clone();
        assert_eq!(stored["projectId"], "claude-project-1");
        // A chat cannot be filed under another chat.
        let sneaky = merge_chats(
            &mut workspace,
            &[filed("claude-5", "https://claude.ai/chat/5", "claude-2")],
        );
        assert_eq!(sneaky.added[0]["projectId"], "");
    }

    #[test]
    fn untitled_projects_are_named_as_projects() {
        let item = workspace_item(&serde_json::json!({
            "id": "p", "type": "project", "provider": "claude", "url": "https://claude.ai/project/9"
        }))
        .expect("project");
        assert_eq!(item["title"], "Project");
    }

    #[test]
    fn normalises_titles_notes_and_flags() {
        let item = workspace_item(&serde_json::json!({
            "id": "x",
            "title": format!("  {}  ", "t".repeat(400)),
            "provider": "claude",
            "url": "https://claude.ai/chat/1",
            "note": "  a note  ",
            "pinned": true,
            "folder": "/etc",
            "projectId": "injected",
        }))
        .expect("valid chat");
        assert_eq!(item["title"].as_str().unwrap().chars().count(), 120);
        assert_eq!(item["note"], "a note");
        // A browser cannot pin an entry or attach a local folder.
        assert_eq!(item["pinned"], false);
        assert_eq!(item["folder"], "");
        assert!(item["updated"].as_i64().unwrap() > 0);

        // A project link is carried this far as a plain token; whether it names a real project is
        // settled in `merge_chats`, which has the workspace to check it against.
        assert_eq!(item["projectId"], "injected");
        for hostile in ["../../etc", "a b", "", &"p".repeat(65)] {
            let item = workspace_item(&serde_json::json!({
                "id": "y", "title": "t", "provider": "claude",
                "url": "https://claude.ai/chat/1", "projectId": hostile,
            }))
            .expect("valid chat");
            assert_eq!(item["projectId"], "", "{hostile}");
        }
        // A project is never filed inside another project.
        let nested = workspace_item(&serde_json::json!({
            "id": "n", "type": "project", "title": "t", "provider": "claude",
            "url": "https://claude.ai/project/1", "projectId": "claude-project-other",
        }))
        .expect("valid project");
        assert_eq!(nested["projectId"], "");

        let untitled = workspace_item(&serde_json::json!({
            "id": "z", "type": "chat", "provider": "grok", "url": "https://grok.com/c/1"
        }))
        .expect("valid chat");
        assert_eq!(untitled["title"], "Saved conversation");
        assert_eq!(untitled["provider"], "grok");

        // An id the extension did not supply, or one that is not a plain token, is replaced.
        let generated = workspace_item(&serde_json::json!({
            "type": "chat", "title": "t", "provider": "claude", "url": "https://claude.ai/chat/1"
        }))
        .expect("valid chat");
        assert!(generated["id"].as_str().unwrap().starts_with("ext-"));
    }
}
