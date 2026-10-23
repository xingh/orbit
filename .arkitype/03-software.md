# 03 — Software

Application logic: the native commands, the companion service, the import scanners, and the merge
rules. Product-specific values come from the `SITE PROFILE` in `00`.

## Native commands (Tauri IPC)

```yaml
commands:
  capabilities:     { returns: "{ os, shortcut, shortcut_label }", purpose: what this platform supports }
  load_data:        { returns: workspace JSON, purpose: read the whole workspace }
  save_data:
    args: { json: string, removed: "string[]" }
    behaviour: >
      Reads stored JSON inside the storage lock and keeps any entry the window neither sent nor
      names in `removed`, then re-applies the size limit. This is what stops a window save from
      overwriting a concurrent service write. See knowledge principle 7.
  open_url:         { args: { url }, behaviour: validated against provider hosts, then opened in the default browser }
  open_folder:      { args: { folder }, behaviour: reveal a local path }
  pick_folder:      { returns: path or null, behaviour: native folder picker }
  export_backup:    { behaviour: write the workspace to a file the user chooses }
  client_status:    { args: { provider }, returns: sign-in posture of a local coding tool }
  launch_code:      { args: { provider, folder }, behaviour: gated terminal launch, API keys scrubbed }
  service_info:     { returns: "{ port, paired[], pairing_seconds }" }
  start_pairing:    { returns: seconds, behaviour: open the pairing window }
  stop_pairing:     {}
  unpair_browsers:  { behaviour: new token, every browser must pair again }

events_emitted:
  open-launcher: shortcut or tray asked for the finder
  chats-added:   items the service added or re-linked, so the window merges rather than re-reads
```

## Companion service

```yaml
bind: loopback only, first free port from SITE PROFILE.service.ports
routes:
  GET /health: { auth: none, returns: "{ orbit: true, version }" }
  GET /pair:
    auth: inside the pairing window only
    callers_allowed: [Extension, Headless]
    returns: the token
    note: a web-page caller is refused even with the correct token
  POST /chats:
    auth: token + extension-or-headless caller
    body: "{ items: [...] } or a single item"
    returns: "{ added, linked, skipped, rejected }"
caller_classification:
  Extension: an extension origin
  Headless:  no Origin header — the shape Firefox sends once the host permission is held
  Web:       a page origin; refused on every route that matters
token: 64 hex chars in the `service` table, compared in constant time
accepts: items of type chat and project only
refuses: pinning, local folders, and anything else the window alone may set
```

## Merge rules

The judgements are in `.knowledge/import.reconciliation.md`. The mechanism:

```yaml
merge_chats:
  identity: same id, OR same type and same url
  on_duplicate: skipped, nothing overwritten
  on_duplicate_missing_link: write projectId, report as `linked`, touch nothing else
  link_validity: projectId must name a project already stored or arriving in the same batch
  link_never_moved: a link already in place is left alone
  projectId_validation: non-empty, <= 64 chars, ASCII alphanumeric or '-'
  dedupe_scope: per kind, so a chat and a project may share a url
  default_titles: "Project" for a project, the provider name for an untitled chat
```

## Import scanners (browser extension)

```yaml
order: [claude-projects, claude-chats, chatgpt-projects, chatgpt-chats]
why_this_order: a chat can only be filed under a project that is already saved
independence: each list is read on its own; one failing never costs the others
shared_context: one { links: Map } per import, so a project that lists its own conversations can
                file them even when the chat rows carry no reference
paging:
  offset: stops when a page brings nothing new, for endpoints that ignore offset
  cursor: stops on a missing or repeated cursor, MAX_PAGES 30
row_extraction: >
  shape-agnostic — items | data | conversations | projects | results | chat_conversations, then the
  first nested array of objects. A response with no list reports the keys it did hold.
fallback: >
  when a direct fetch finds nothing, the same requests run inside a tab on the provider via
  scripting.executeScript — same-origin with the signed-in session. An existing tab is reused;
  one opened for the purpose is opened inactive and closed again.
trace: >
  every request records method, status and the FIELD NAMES of the first row (never values), exposed
  as "Copy import report". This is the only diagnostic available for an undocumented endpoint, and
  it is what made every fix so far possible.
endpoints: see .knowledge/provider.web.endpoints.md
```

## Toggles

```yaml
toggles:
  grok:  { default: false, effect: Grok appears in the launcher }
  robot: { default: true,  effect: "3D robot renders; off, Three.js is never fetched" }
  launcher_shows_web_only:
    default: true
    effect: the launcher lists kind == web providers only
    note: the subscription gate and terminal adapters for Claude Code / Codex are built and tested
          but not offered; see .manage/issue.0005.code-tools-in-launcher.md
```

## Open decisions

```yaml
open_decisions:
  - id: workspace-api
    question: Is there one HTTP workspace API that the desktop frontend itself consumes?
    why_it_matters: >
      A web client, a phone and a remote server all need it. Writing it twice — once as Tauri IPC,
      once as HTTP — guarantees drift. Define it once; let the desktop use it locally.
    affects: [01, 02, 04]
    see: .manage/issue.0007.workspace-api.md
  - id: read-endpoint
    question: May the extension read the workspace, not only write to it?
    needed_for: searching Orbit from the browser, and priming a chat from a found entry
    note: >
      The service is write-only today. A read route is the first time Orbit's contents flow outward
      to a browser, so it is a deliberate step, behind the same token-and-caller gate.
    see: .manage/issue.0010.extension-search.md
  - id: prime-only
    decided: 2026-10-23
    decision: Orbit fills a composer and never submits. See knowledge principle 5.
```
