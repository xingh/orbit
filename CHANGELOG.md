# Changelog

Notable changes to Orbit. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project aims at [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each entry names the issue it came from where there is one. The reasoning behind a change — what
was ruled out, and why — lives in `.manage/` and `.knowledge/`, not here.

## [Unreleased]

### Added

- **The index mirrors the provider, rather than remembering what used to be there**
  ([#8](https://github.com/xingh/orbit/issues/8),
  [#9](https://github.com/xingh/orbit/issues/9)). A title the provider has changed replaces the
  stored one, and a project the provider no longer lists — deleted or archived — is removed. On a
  real workspace the first run refreshed 498 titles, 28 of them projects, and removed 2 projects
  whose links had been 404ing for months.
- **A sweep that looks like a short read is refused whole.** Removing on absence is how an index
  gets emptied by a 403 or a dropped page, so a sweep names one provider and one kind, must carry
  at least one id, and is refused outright — with the reason surfaced in the popup — when it would
  take more than a third of what Orbit can see. Only the project lists sweep: the chat lists are
  walked by `offset` over a list ordered by recency, where a chat updated mid-walk shifts pages and
  is never seen.
- **The extension is Orbit Link** ([#28](https://github.com/xingh/orbit/issues/28)), and every
  release attaches it as `Orbit-Link-<version>.zip` beside the installers, with per-browser
  instructions for loading it.
- **The panel opens where there is room** ([#4](https://github.com/xingh/orbit/issues/4)). Below
  the robot when it fits, above it near the bottom of the screen, and diagonally away from a corner,
  with the robot left exactly where it was put.
- **The pill shows only on hover** (or keyboard focus), so a resting Orbit is just the robot.
- **Double-click the robot to hide it in the tray**; on Windows, double-click the tray icon to
  bring it back open.
- **Projects are imported, and chats are filed under them.** Each service's projects are read
  before its chats, a chat carries its own project reference through, and a project list that
  names its conversations files them when the chat list does not.
- **A re-import repairs what is already saved.** A chat that was imported before its project
  existed gains the link on the next run, reported separately as "filed", with nothing else about
  the entry touched.
- **The 3D robot can be turned off** (Preferences → 3D robot). Off, it leaves a flat mark, never
  fetches the renderer at all — Three.js moved into its own 482 KB chunk — and gives the window
  about 100 points of height back. Groundwork for [#17](https://github.com/xingh/orbit/issues/17).
- **The companion service accepts projects**, with per-kind deduplication and a validated
  `projectId`, and answers with `added` / `linked` / `skipped` / `rejected`.
- **Copy import report** in the extension popup: each request, its status, and the field *names*
  of the first row it held. Never values — the report is meant to be pasted into an issue.
- **The project's own context lives in the repository**, in the [Arkitype](https://github.com/xingh/arkitype)
  layout: `.knowledge/` (what is true), `.arkitype/` (how Orbit is constituted, in layers),
  `.manage/` (one file per GitHub issue, plus the roadmap), `.archive/` (what was done), and a
  `manage` script to move work between them.
- **Reproducible screenshots.** `docs/screenshots/capture/capture.py` runs the real build in
  Firefox on a virtual display with Tauri's bridge stubbed, drives it through Marionette, and
  assembles the README animation — from a synthetic workspace of the same shape as a real one.
- **A devcontainer** (`.devcontainer/`). Tauri's Linux prerequisites, Node 22, Rust stable, the
  GitHub CLI and Firefox, on the Ubuntu 24.04 that CI builds on — plus a real desktop over noVNC,
  because Orbit is a window and `pnpm tauri dev` needs somewhere to open it. Xvfb, xdotool and xwd
  come with it, so a layout change can be checked without a monitor.

### Changed

- **The widget fits a small screen** ([#4](https://github.com/xingh/orbit/issues/4)). The open
  companion stays inside a fifth of the monitor's work area, scaling down from its design size to
  a 330×430 floor, with a tighter layout below 430 points wide. Measured at 330×529 on a
  1280×680 work area, against a hard-coded 510×820 before.
- **The saved list is one line per entry**, so the same screen area shows about as many threads as
  the provider's own sidebar does. It showed four.
- The launcher offers web chat only while the extension and import settle;
  [#5](https://github.com/xingh/orbit/issues/5) tracks bringing Claude Code and Codex back.

### Fixed

- **Claude accounts with more than one organization.** Only some organizations serve a chat list
  and the rest answer 403, so using the first one reported "signed-out" and imported nothing.
  Every organization is tried, chat-capable first, and whatever answers is kept.
- **ChatGPT's project list stopping at the first page.** It is cursor-paged, not offset-paged, and
  was being called exactly once. Every page is followed now, ending on a missing or repeated
  cursor rather than looping.
- **A write-back race that lost entries silently.** The window saves the whole workspace and built
  its JSON before taking the storage lock, while the companion service reads, merges and writes
  under it — so a service write landing in between was overwritten, and a later batch could re-add
  a chat without its project. Nothing errored. A window save now keeps any stored entry it has
  neither sent nor deleted, deletions are explicit, and a queued save writes the freshest state.
- An import that read nothing now says so, naming the keys the response did hold, instead of
  reporting a silent zero.

## [0.1.0]

The first working build: the floating robot widget with its New chat / Find / Projects pill, a
native shell for Windows, macOS and Linux with installers on every tag, the subscription check in
front of Claude Code and Codex, the loopback companion service with token pairing, and a browser
extension that saves the current chat into the running app.
