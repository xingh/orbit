# Validation — October 19, 2026

> This file is the release artifact required by `docs/PRD.md`: the support matrix as of the last
> release. The **living** record of what has been verified, what has not, and by which agent in
> which environment is `.arkitype/agent.local.md`. Update that one as work happens; refresh this
> one at a release, from it.

## Passed

- TypeScript compilation with strict checking.
- Production frontend bundling with Vite 6.
- Three unit tests covering official URL/provider matching, hostile URL rejection, and multiword search/filter/pin ordering.
- Automated end-to-end checks in a separate headless Microsoft Edge profile: actual WebGL robot render, project creation, chat linking, search, pin/unpin, refresh persistence, optional Grok, provider link opening, backup export, deduplicating import, project deletion with linked-chat preservation, Escape/Ctrl+K, and 390-pixel layout without horizontal overflow.
- No uncaught page errors during the tested flows.
- Desktop preview screenshot visually inspected.

### Companion service (October 17, 2026)

- 24 Rust unit tests, including project import and per-kind dedupe, extension-origin matching, constant-time token comparison, the
  pairing window, chat merge/dedupe, and rejection of hostile or mismatched conversation links.
- End-to-end against the running app on Linux: `GET /health`, the CORS preflight, and a save that
  reached SQLite and appeared in the widget live, with no restart.
- Rejection paths exercised against the running service: no token (401), a wrong token (401), a
  web-page origin holding the correct token (403 on both `/pair` and `/chats`), and `GET /pair`
  outside the pairing window (403).
- A request carrying no `Origin` header, which is the shape Firefox sends once the extension holds
  the host permission, reaches the token and pairing-window gates rather than being refused as a
  web page.
- Deduplication verified across a different id with the same link.
- A 12-chat bulk post applied in one request, appeared in the widget live, and left the entries
  already saved untouched.
- Window sizing measured on a HiDPI display: 330x529 logical open (20.0% of the work area) and
  330x205 collapsed, against a hard-coded 510x820 before, which did not fit the screen at all.

### History import, after a real run (October 19, 2026)

Evidence from the user's own machine, read out of the extension's `storage.local` and Orbit's
SQLite rather than inferred:

- **ChatGPT chat import works.** 616 conversations were read from
  `chatgpt.com/backend-api/conversations` and are in the workspace, so the `items`/`id`/`title`
  mapping and the `/api/auth/session` token are correct against a live account.
- **Claude chat import failed with `signed-out`**, and `/api/organizations` had answered first.
  The cause: the account has more than one organization and the scanner used the first one with a
  `uuid`, which answers 403 for a chat list. It now tries every organization, chat-capable ones
  first, and keeps whatever answers. Reproduced in `tests/scanners.test.mjs` with an account whose
  first organization 403s.
- **Project import could not have worked at all.** `service.rs` rejected any item whose `type` was
  not `chat` ("Only conversations can be saved from a browser"), so even a correct scan would have
  been refused. The service now takes `project` as well, with per-kind dedupe.
- Projects verified end to end against the running app: a Claude project, a ChatGPT project and a
  chat posted in one request returned `{"added":3}` with the unknown type rejected; re-posting the
  same links under new ids returned `{"skipped":2}`; both projects were stored with `type: project`
  and the window's own defaults. The three probe entries were then removed, leaving the 619 real
  entries untouched.
- Scanner unit tests cover the multi-organization recovery, gathering several organizations
  without repeats, an endpoint that ignores `offset` (stops instead of looping), a response with no
  list in it (names the keys it did hold), archived Claude projects being skipped, only `g-p-` ids
  counting as ChatGPT projects, and every generated id and link satisfying the service's own rules.

### Project links and ChatGPT paging (October 19, 2026)

Read out of the user's own extension storage and Orbit's SQLite after a real import of 437 Claude
chats, 21 Claude projects, 618 ChatGPT chats and 5 ChatGPT projects:

- **Nothing was related to anything.** Every imported chat had `projectId: ""`, because no scanner
  read a project reference and the service forced the field blank. Chats now carry
  `project_uuid`/`project`/`gizmo_id` through, each service's projects are read before its chats,
  and a project list that names its own conversations is used when the chat list does not.
- **ChatGPT projects were truncated at 5.** The recorded trace shows
  `/backend-api/gizmos/snorlax/sidebar` returning `items|cursor` and being called exactly **once**:
  the list is cursor-paged and only its first page was read. Every page is followed now, stopping on
  a missing or repeated cursor.
- **Re-importing would not have fixed existing entries**, since a duplicate was only ever counted as
  skipped. The merge now fills in a project link an already-saved chat lacks, reports it separately
  as `linked`, and leaves everything else about that entry alone — verified against 1055 entries'
  worth of behaviour in unit tests, including that a link already in place is never moved.
- The import report now records the field *names* of the first row of each response (never values),
  which is what a wrong mapping needs to be fixed in one pass.
- 25 Rust tests and 22 scanner tests, covering the link being kept only for a project that exists,
  a chat refusing to be filed under another chat, a hostile or overlong `projectId` being dropped,
  cursor paging to the end, and a repeated cursor ending the walk instead of looping.

### A write-back race that broke links (October 19, 2026)

Found while testing the link work, by posting four batches back to back the way an import does:

- The window saves the **whole** workspace on every change, building its JSON before it takes the
  storage lock, while the companion service reads, merges and writes under that same lock. A service
  write landing in between was silently overwritten. Observed directly: a batch of three vanished
  and its chat was re-added by a later batch **without its project**, because the project had been
  overwritten too. This is the mechanism by which an import could lose entries, or import them
  unrelated, with no error anywhere.
- `save_data` now keeps any stored entry the window neither sent nor names as deleted, the window
  reports deletions explicitly, and a queued save writes the freshest state rather than the one
  captured when it was queued. Three tests cover keeping an unseen entry, not resurrecting a
  deleted one, and inventing nothing from empty or unreadable storage.

### Project links, on real data (October 28, 2026)

The extension was reinstalled into the user's own Firefox profile and the import re-run, driven
headlessly over Marionette. Read out of Orbit's SQLite and the extension's import trace afterwards:

- **Every chat that has a project now has one.** The workspace went from 1081 entries with **0**
  project links to 1135 entries with **817** of 1071 chats filed — 411 of 448 Claude chats and 406
  of 623 ChatGPT chats. No link pointed at a project that had not also been imported.
- The import reported `added 5, already saved 702, filed 404`, with no problems. That is the
  link-filling merge doing on real data what the unit tests cover: an entry already saved gains the
  project it lacked, and nothing else about it moves.
- **Claude projects:** 43 rows returned, 30 stored. The rows do carry `archived_at` (beside
  `archiver`), and 13 were skipped on this run and the last, which settles the open question of why
  21 of 34 arrived in October.
- **ChatGPT projects:** the cursor walk followed 7 pages to the end and stored 34, against 5 when
  only the first page was read.
- **The multi-organization recovery, in the wild:** one organization answered 200 and the other 403
  for both the project and the chat list; the import kept what answered.
- The pairing token survived the browser restart, so no re-pairing was needed: Firefox keeps an
  extension's UUID, its granted origins and its `storage.local` against the extension id, even for
  a temporary add-on.

## Not verified

- Windows and macOS: the tray, global shortcut, transparent window, folder picker, terminal launching and the companion service were exercised on Linux only. Rust now compiles and its tests pass in this environment.
- Actual provider account/subscription authentication, usage entitlements, and billing. Orbit opens official surfaces; the user signs in there.
- The in-page fallback (`scripting.executeScript` inside a provider tab) has not run in a browser
  here. It is the second attempt only: the direct fetch, which is the path that imported 616
  ChatGPT chats, still runs first.
- Grok has no scanner. Only the two services with reachable list endpoints are imported.
- The Firefox host-permission prompt, and the extension's background script under Chrome's service
  worker versus Firefox's event page.
- The **Pair a browser** button and the 60-second window as driven from the UI. The window's own
  logic is unit-tested and the closed-window rejection was verified over HTTP, but no GUI automation
  was available in this environment to click it.
- Full conversation-history search, local coding-session enumeration, or GrokBot automation. These are not implemented.
- An installer, signing, and auto-update distribution.

The Three.js model is procedural geometry for this prototype. It can be replaced with a polished Blender GLB without changing the launcher workflows.
