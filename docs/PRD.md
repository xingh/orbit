# Orbit: cross-platform desktop robot companion

**Version:** 1.1 · **Date:** October 9, 2026 · **Status:** Implementation-ready specification

**Product owner:** Rahul · **Implementer:** Codex on the Linux computer

## 1. Product decision

Build a local desktop companion that lets Rahul start an AI conversation, find saved conversations, and reopen projects from one small floating robot. Support Claude, Claude Code, ChatGPT, and Codex; Grok is optional. Use the user's existing accounts and eligible subscriptions through official websites and local clients. No model API key is required by Orbit.

The visual character is a miniature mechanical 3D robot with an omnidirectional camera ring. It should resemble an engineered miniature bot, with metal surfaces and practical proportions. The camera ring is decorative; this application does not capture a webcam or screen.

**Required platforms:** Windows, macOS, and Linux are first-release targets with the same core workflows. Linux is Rahul's primary development machine, not a restriction on supported operating systems. Use one shared codebase with explicit operating-system adapters and native build/test jobs. A successful Linux build alone does not satisfy this release. In this desktop-companion specification, “all platforms” means the three major desktop operating systems; mobile apps are a separate potential product, not evidence of desktop-platform completion.

## 2. Problem and audience

Rahul moves between several AI services and loses time locating conversations and the project folders associated with them. Each service has its own account, history, and interface. A compact launcher should provide a consistent entry point while preserving each service's native conversation and subscription experience.

This is initially a personal tool for Rahul across Windows, macOS, and Linux computers. No team administration, hosted backend, or commercial onboarding is needed.

## 3. Goals and success measures

These are release targets, not measurements already achieved:

| Outcome | Acceptance target | Measurement |
|---|---|---|
| Start work quickly | Open a provider entry page within two deliberate actions from the companion | Manual task test; exclude provider network/login time |
| Recover saved work | Locate a known entry within 5 seconds in a collection of 1,000 items | Local benchmark plus task test |
| Keep the desktop usable | Drag, collapse, hide, and restore the companion without losing access | Native desktop test |
| Preserve work | Saved chats, projects, preferences, and pins survive restarts and backup/import | Automated storage and migration tests |
| Respect subscriptions | Orbit makes zero model API requests and never silently substitutes API-key billing | Network and launch-policy tests |

Leading indicators: completion of new-chat, save/find, and project-reopen tasks; activation failures; search latency. Lagging indicators: during a seven-day personal trial, use Orbit on at least five days and reopen saved work on at least three days. Track these through a local test log and user review; do not add remote analytics.

## 4. User stories

- As Rahul, I want to choose an AI service from the robot so I can begin work without locating its window first.
- As Rahul, I want to save and search a conversation link so I can return to a useful thread later.
- As Rahul, I want a project to group a local folder and related chats so I can resume the whole context.
- As Rahul, I want Claude Code or Codex to start in the selected folder using the official client so I can continue coding with my subscription.
- As Rahul, I want the robot to occupy little space and move out of the way so it does not interrupt other applications.
- As Rahul, I want clear recovery instructions when a desktop feature, coding client, or login is unavailable so I am never stranded.

## 5. Release scope

### P0: required for the first cross-platform release

1. Native desktop companion with a 3D robot and three primary actions: **New chat**, **Find**, **Projects**.
2. Provider website launching through the normal browser, plus local Claude Code/Codex launch where installed and correctly authenticated.
3. Saved chat links, multiword search, provider filters, pins, and deletion.
4. Projects containing a folder, preferred tool, and related saved chats.
5. Local SQLite persistence, versioned backup export/import, and existing-prototype import.
6. Platform-specific setup instructions, launchable native builds, and installable Windows, macOS, and Linux artifacts.
7. Capability-aware desktop behavior on every platform, including Linux X11/Wayland, and a reliable restore path.
8. Tests and an honest validation report.

### P1: follow-up improvements

- Browser extension saving of the active chat's title and URL; explicit export/import is acceptable initially. Validate the included extension before claiming it works.
- A polished Blender-authored GLB robot replacing procedural geometry.
- Opt-in autostart, configurable shortcut, and browser-profile selection.
- Import of conversation metadata from user-supplied official exports, with provider-specific parsers and preview before import.
- Local coding-session discovery/resume only when the installed official client documents a stable mechanism. Keep manually saved links as a fallback.

### P2: future considerations

- Live extension synchronization, additional distributions/architectures, and optional GrokBot integration after an official integration path is verified. Windows/macOS support must not be deferred to this tier.
- An in-companion AI chat surface only if a provider officially permits the intended subscription integration. This is not a prerequisite for the launcher.

### Explicit non-goals

- Pooling subscriptions between providers: each account and its usage limits remain separate.
- Automatic access to every historical conversation: the initial index contains saved/imported metadata, not all provider history.
- Scraping private service APIs, copying authentication cookies/tokens, or using a subscription credential as an unofficial model API key.
- Autonomous cross-service prompt dispatch, automatic message sending, webcam capture, screen recording, and voice input.
- Cloud sync, team features, billing, telemetry, and model inference inside Orbit.

## 6. Experience and visual requirements

### Robot

Use a compact cylindrical titanium/graphite body, small wheels, restrained articulated arms, and a dark panoramic ring with lenses distributed around the head. Accent lighting should be soft cyan/teal. Avoid animal features, cartoon facial eyes, exaggerated emoting, or constant attention-seeking motion.

At rest, target a visible robot approximately 90–120 logical pixels tall. Keep the renderer independent of the model asset, so the existing procedural Three.js model can ship first and a GLB can replace it later. A concept render is design reference, not a finished 3D asset.

States: idle, launcher open, action in progress, and action failed. Animation communicates only known local activity; never imply a provider is thinking or a task has completed without actual evidence. Respect reduced-motion preferences. Pause rendering when hidden; limit idle animation to 15–30 FPS. Provide a static robot fallback if WebGL fails, keeping all controls usable.

### Desktop states

- **Collapsed:** robot and compact New chat / Find / Projects controls.
- **Expanded:** searchable panel, about 420–500 logical pixels wide, sized within the current monitor's usable bounds.
- **Hidden:** no overlay; restore from a tested tray, application launcher, or supported shortcut.
- **Compatibility mode:** a normal decorated window retaining every core workflow when overlay features fail.

Provide a drag handle, collapse button, hide control, and clear Quit action. Transparent empty areas should not unnecessarily intercept clicks. If selective input regions cannot be supported reliably, shrink the window and offer compatibility mode. Never make the entire interactive window click-through.

### Panels

**New chat:** provider tiles, optional local-terminal action for coding clients, Save chat link action, and a short explanation that sign-in occurs in the service.

**Find:** search field; All tools/provider filters; saved chat and project results with title, provider, type, note, and pin state. Display “Searches saved chats and projects” rather than implying full-history access.

**Projects:** create/edit project, choose folder, select preferred tool, and link/unlink saved chats. Opening a project reveals its context without automatically launching several applications. Explicit actions open its folder, a related chat, or its coding tool.

**Preferences:** optional Grok, animation/reduced-motion behavior, tested desktop capabilities, restore/shortcut status, terminal selection, backup/import, and basic local diagnostics. Do not display unverified “Connected,” subscription, billing, or usage status.

Support keyboard navigation, visible focus, accessible names, dialog focus trapping/restoration, Enter to submit/open the focused item, and Escape to close a dialog before collapsing the panel. Ctrl+K opens Find on Windows/Linux and Cmd+K on macOS while Orbit is focused. Aim for WCAG AA text contrast.

## 7. Provider and subscription contract

| Provider | P0 integration | Account behavior |
|---|---|---|
| Claude | Official website entry page and saved conversation links | Existing browser account/subscription |
| ChatGPT | Official website entry page and saved conversation links | Existing browser account/subscription |
| Claude Code | Official local `claude` client; official web workspace as fallback where available | Official subscription sign-in |
| Codex | Official local `codex` client; official web workspace as fallback where available | Official ChatGPT subscription sign-in |
| Grok | Optional official website launcher | Existing Grok account/entitlements |

Verify current provider URLs and client commands from official documentation during implementation. New chat may open an entry page where the user still needs to select a repository, model, or new task. Never promise a new task was created just because a page opened.

Claude Code documents subscription authentication and credential precedence. Codex documents ChatGPT sign-in for subscription access. Provider behavior changes, so verify installed versions and supported authentication checks rather than hard-coding undocumented credential formats. [Claude Code authentication](https://code.claude.com/docs/en/authentication), [Codex authentication](https://developers.openai.com/codex/auth/).

### Subscription-only launch policy

Orbit must not ask for, store, or use model API keys. Open web services in the user's normal external browser; do not embed login pages and assume they share its sessions.

For coding clients:

1. Detect installation and version without initiating a task.
2. Remove relevant API-key, custom-endpoint, cloud-provider, and gateway-selection variables from the **child process** where appropriate. Do not modify the user's global environment or authentication/configuration files.
3. Prefer documented subscription-only enforcement if supported by that client/version. Use documented status mechanisms without logging credentials.
4. If authentication is absent, clearly API-backed, or cannot be safely established as subscription-backed, show a setup/status action. Do not automatically start a potentially billable model task.
5. The setup action opens the official interactive login/status flow. If evidence remains unavailable, keep web launching available and label local subscription status unknown. Do not infer successful subscription use from environment-variable removal alone.
6. Respect enterprise-managed client policies. Report a conflict rather than overriding those policies.

Acceptance: absent clients produce actionable messages; clean subscription-authenticated clients launch normally; simulated API credentials/configurations trigger the setup/conflict path; Orbit itself issues no model API requests. Real-account validation requires the owner's interactive sign-in and is reported separately from mocked tests.

## 8. Functional requirements and acceptance criteria

### R1. Start and restore the companion

Given any supported Windows, macOS, or Linux desktop, launching Orbit displays the robot and usable controls. Starting a second instance activates the existing one. Closing, hiding, or losing tray support must never leave an inaccessible process; a desktop launcher or terminal command can restore it. Missing shortcut/tray capabilities do not crash startup.

### R2. Start a conversation

Given a provider tile, activating it opens the validated official HTTPS entry page in the default browser. Failed opening displays a recoverable error. Grok is absent until enabled. The UI does not claim to authenticate or send a prompt.

### R3. Save and edit a chat

Require a title, provider, and valid official HTTPS URL. Optional fields: note, pin, and project association. Permit editing and relinking. Reject executable schemes, credentials in URLs, lookalike hosts, mismatched provider hosts, and unexpected ports. Validate again in Rust before opening. Clearly define shared ChatGPT/Codex and Claude/Claude Code domain mappings.

### R4. Find and reopen work

Search title, provider, note, and project/folder metadata with case-insensitive multiword matching. Filter by provider. Pinned entries precede unpinned entries; within each group use most recently opened/updated first. Opening a chat launches its original service link; opening a project shows its detail panel. Handle empty index and no matches distinctly. Benchmark 1,000 entries with p95 search time below 100 ms on the reported test machine.

### R5. Organize projects

Create/edit title, note, preferred provider, and optional folder. Folder picker and typed paths must accept valid native absolute paths, spaces, and Unicode on each platform, including Windows drive paths and appropriate UNC handling. Resolve and validate paths through OS APIs rather than POSIX-only string rules. Missing folders produce an error and an edit/reselect action. Link/unlink chats. Deleting a project preserves related chats and clears their association; deleting an Orbit entry never deletes files or the original provider conversation.

### R6. Launch a local coding client

Given a valid project directory and supported terminal/client, start the official client in that working directory after satisfying the subscription-only policy. Use executable plus argument arrays and a literal working directory. Never interpolate titles, paths, or user data into executable shell commands. Test paths containing spaces, quotes, semicolons, dollar signs, and Unicode. A missing terminal has a choose-terminal/web fallback, not a silent failure.

### R7. Persist, export, and import

Use transactional SQLite persistence and versioned migrations. A failed read must not overwrite existing data with an empty workspace. A failed write visibly reports unsaved state and permits backup/retry. Export a versioned JSON backup. Import validates the whole file before committing; invalid files leave existing data untouched. Preview added/skipped entries, deduplicate canonical provider/URL pairs, and remap project IDs/references when merging unrelated backups. Back up before schema migration.

Import the existing prototype's unversioned `{ items, settings }` format as a documented legacy version. Preserve titles, notes, pins, project associations, and Grok preference. Treat paths from another OS or machine as unresolved metadata; offer explicit per-machine folder replacement rather than creating or guessing those paths. Preserve project identity and relationships during replacement. Missing project references become unassigned chats with an import notice.

## 9. Cross-platform desktop compatibility

Perform a capability spike before broad UI work. Inspect OS/version, architecture, desktop/session type, GPU/WebGL support, and terminal applications. Return capability states to the UI instead of treating OS detection as proof of support.

### Required release matrix

| Platform | Initial supported baseline | Architecture | Deliverable |
|---|---|---|---|
| Windows | Windows 11 | x86-64 | NSIS installer; native executable for smoke tests |
| macOS | macOS 14 or later, subject to tested toolchain compatibility | Apple Silicon and Intel | Native .app/.dmg per architecture or tested universal build |
| Linux | Ubuntu 24.04 LTS baseline; test X11 and Wayland sessions | x86-64 | .deb and AppImage where supported |

These are declared support targets, not claims that the current prototype supports them. Additional Linux distributions, Windows ARM64, and Linux ARM64 are P1 compatibility expansion. Build against deployment targets that actually run on the declared minimum versions; document changes if a dependency raises the minimum.

### Shared behavior and OS adapters

Core New chat, saved-chat Find, Projects, browser/folder opening, backups, and persistence must have feature parity on all required platforms. Local coding tools must work when an official client and supported terminal are available; unavailable clients get the same setup/web fallback everywhere.

| Capability | Windows | macOS | Linux |
|---|---|---|---|
| Overlay | Test transparency, sizing, dragging, DPI, and topmost behavior | Test transparency, Spaces/full-screen behavior, display scaling, and window levels | Test X11/compositor behavior; compatible decorated window where Wayland restricts an operation |
| Restore | System tray, Start-menu launcher, supported shortcut | Menu-bar item, application activation, supported shortcut | Tray where supported, desktop launcher, supported shortcut/portal |
| Keyboard | Ctrl+K; default Ctrl+Shift+Space activation | Cmd+K; default Cmd+Shift+Space activation | Ctrl+K; default Ctrl+Shift+Space activation where supported |
| Local terminal | Windows Terminal or explicit supported PowerShell adapter | Terminal.app; optional iTerm2 adapter | Verified GNOME Terminal, Konsole, or Xfce adapter |
| Lifecycle | Close/hide and explicit Quit remain distinct | Dock/menu-bar policy, Cmd+Q, application reopen, and last-window behavior are explicit | Missing tray/shortcut never leaves the application inaccessible |

Do not assume identical global shortcuts, absolute window placement, tray support, or full-screen overlay behavior across OSes. Detect/test actual behavior; explain unavailable features and offer the compatibility window. Test multiple monitors and scale factors, monitor removal, sleep/resume, keyboard layouts, and focus restoration. The robot must not steal typing focus merely by animating or showing status.

For Wayland, use a supported portal/backend if available and a launcher/desktop-configured activation fallback otherwise. The XDG GlobalShortcuts portal defines an official mechanism; verify actual host availability. [Portal reference](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.GlobalShortcuts.html).

Shortcut conflicts must appear in preferences with recovery options. Do not demand a session switch, disable operating-system protections, or require invasive accessibility permissions for ordinary launching. If a terminal adapter needs OS consent, request only that capability and retain the web fallback.

If the development machine lacks a GUI session, compile and run headless-safe checks and provide a manual native test procedure. A headless build is not a pass for native UI acceptance. Record tested and untested combinations separately.

## 10. Architecture and data contract

### Stack

- **Tauri 2 + Rust:** native windows, desktop adapters, validated process launching, storage, and capability reporting.
- **React + TypeScript + Vite:** shared launcher UI and browser preview.
- **Three.js:** procedural/GLB robot renderer with lifecycle cleanup and a static fallback.
- **SQLite:** local data, migrations, and transactions.
- **Optional Manifest V3 extension:** explicit user-initiated metadata capture; no credential access.

Use the existing lockfile as the starting point. Resolve compatibility problems deliberately and pin reproducible versions. Do not silently replace the desktop stack with Electron or a web-only site.

Suggested native boundaries: `storage`, `providers`, `subscription_status`, `terminal_launcher`, `desktop_capabilities`, and `window_state`. Return typed states such as `available`, `missing`, `unsupported`, `unknown`, and `error`, plus user-facing recovery information. Native code is responsible for validation even when the frontend has already checked inputs.

### Data model

| Entity | Required fields |
|---|---|
| Chat | UUID, provider ID, title, canonical HTTPS URL, note, pinned, optional project UUID, created/updated/last-opened UTC timestamps |
| Project | UUID, title, note, optional folder path, preferred provider, pinned, created/updated timestamps |
| Preferences | schema version, Grok enabled, motion setting, terminal adapter/executable, supported saved window state, shortcut preference |
| Backup | format ID, schema version, exported timestamp, chats, projects, portable preferences |

Use relational tables/constraints for the release rather than relying permanently on a single JSON blob. Preserve compatibility through a legacy importer. Store data in the appropriate per-user application directory on each OS via Tauri/platform APIs: Windows application data, macOS Application Support, and Linux XDG directories. Do not commit private data, credentials, or machine-specific paths. Cloud sync is not required to transfer work; an exported backup moves between computers.

### Platform adapters and terminal safety

Use a shared interface for browser opening, folder selection/opening, application activation, tray/menu-bar behavior, shortcuts, terminal launch, and capability reporting. Keep implementation differences in Rust modules such as `platform/windows`, `platform/macos`, and `platform/linux`; use conditional compilation only at these boundaries. UI workflows, schema, provider definitions, and robot assets stay shared.

Use process argument arrays, canonical executable paths, and working-directory APIs. On Windows, safely handle official CLI `.cmd`/`.ps1` shims rather than assuming every client is an `.exe`. On macOS, resolve installed clients explicitly because a Finder-launched app may have a different PATH from an interactive shell; use documented terminal automation with tested escaping if required. On Linux, choose a verified terminal adapter rather than assuming a universal `-e` option. Never splice arbitrary user strings into a shell or AppleScript command.

Where a terminal requires a command string, prefer an owned launcher helper and a restrictive argument contract; prove literal path handling with adversarial path tests before release. Custom terminal settings must be validated executable/argument templates. Keep authentication material out of logs and command arguments. Client detection and subscription-status checking use the same process-safety policy on every OS.

Backups are platform-neutral. Folder bindings and terminal/window preferences are machine-specific and must be reviewed or reset during import; portable chat/project metadata keeps the same identity. This is manual transfer, not automatic multi-computer synchronization.

## 11. Existing prototype: reuse and required changes

The handoff includes `prototype/` with React/TypeScript/Three.js UI, procedural robot, provider metadata, browser local-storage persistence, Rust SQLite snapshot persistence, a Windows-oriented Tauri shell, unit tests, and an unpacked extension. Included images show the intended visual direction and the current browser UI.

Previously reported passing checks apply to the Windows-hosted browser prototype only. No Linux or native desktop validation is established by this PRD.

| Area | Reuse | Required cross-platform release work |
|---|---|---|
| UI/robot | Existing panels and renderer | Editing, capability states, idle rendering control, final accessibility/performance validation |
| Coding launch | Provider IDs and action intent | Implement Windows, macOS, and Linux terminal adapters and subscription checks; audit the existing Windows path rather than assuming it works |
| Packaging | Tauri structure and icons | Use OS-specific packaging configuration and icons: Windows ICO, macOS ICNS, Linux PNG; build on appropriate native runners |
| Persistence | Legacy saved-entry format | Versioned relational SQLite, migration/backup handling, import-reference remapping |
| Desktop controls | Existing tray/shortcut/window intent | Verify native controls on all three OS families; handle macOS lifecycle and Linux Wayland limitations |
| Tests | URL/search cases | Portable shared tests plus native platform-adapter tests; no hard-coded personal paths or a single OS browser executable |
| Extension | Unpacked source | Validate permissions and capture/export on actual supported browsers |

Do not copy `node_modules`, `dist`, target directories, or Windows runtime paths as build dependencies. Regenerate frontend and Rust artifacts with the build toolchain for each target platform. Keep the browser preview as a development aid; installed native applications for all required platforms are the release deliverables.

## 12. Build setup, CI, packaging, and delivery

The implementing Codex starts on Linux and maintains one repository. Inspect the machine and existing repository instructions before installing dependencies. Pin toolchains/dependencies and use platform-specific Tauri configuration without duplicating business logic.

| Build/test host | Required setup | Output |
|---|---|---|
| Linux | Compatible Rust/Node/pnpm, C/C++ toolchain, pkg-config, WebKitGTK and current distribution-specific Tauri libraries | Linux binary, .deb, AppImage where supported |
| Windows native runner | Compatible Rust MSVC toolchain, Microsoft C++ Build Tools, WebView2, Node/pnpm | NSIS installer and native binary |
| macOS native runners | Compatible Rust/Node/pnpm, Xcode command-line tools, appropriate target architectures | Apple Silicon/Intel .app and .dmg, or verified universal package |

Prepare Windows/macOS CI jobs from Linux, but use appropriate native runners to produce and validate release artifacts. Do not promise that Linux alone can build, sign, and exercise every native package. A missing runner is a reported release dependency, never a reason to label the product Linux-only. Follow current [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) and [distribution guidance](https://v2.tauri.app/distribute/).

Supply reviewable, OS-specific setup instructions/scripts using normal package managers and permission flows. Do not disable TLS verification or silently alter system security settings. Do not embed credentials into source, CI YAML, logs, or artifacts.

Expected shared commands after setup:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm test
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
pnpm tauri dev
pnpm tauri build
```

Provide documented commands for browser end-to-end tests and each platform's native smoke checks. Fix lockfile incompatibilities and commit the intentional update; keep frozen installs reproducible.

### CI requirements

- Shared type, unit, schema/import, and browser-flow checks.
- Native compile/unit/package jobs for Linux x86-64, Windows x86-64, macOS ARM64, and macOS x86-64 (or both tested targets from a universal build).
- Adapter tests for process arguments, URL validation, folder semantics, and subscription policy on each OS.
- Native runtime smoke tests on GUI-capable hosts; manual recorded tests where automation is unavailable. CI build success is not runtime proof.
- Archived packages, checksums, and environment-specific validation reports. Keep signing secrets external and injected through the runner's secret mechanism.

### Signing and distribution

For personal development, unsigned packages may be generated and must be clearly labeled. Public macOS distribution requires the appropriate signing/notarization workflow and owner-supplied credentials; configure it without fabricating credentials. Windows signing is a separate distribution milestone; report signing status for its installer. Missing signing access does not block local implementation, but does block claiming a signed distribution release. [macOS signing](https://v2.tauri.app/distribute/sign/macos/), [Windows installer guidance](https://v2.tauri.app/distribute/windows-installer/).

Required final artifacts: source repository, PRD, platform setup/run README, portable-data/migration notes, unpacked extension if included, verified packages for all required platforms, checksums, screenshots from tested native apps, and `VALIDATION.md` listing the exact support matrix. End-user startup must not require Vite, Node, or Rust. If a package cannot be built/tested because runner access is absent, identify that platform as blocked and supply the prepared build job and concrete next action; the cross-platform release remains incomplete.

## 13. Implementation milestones and release gate

No delivery date is fixed. Keep all three desktop platforms in scope from the first milestone:

1. **Inventory and shared foundation:** inspect the Linux development host; audit prototype; define platform adapters and portable schemas; prepare all native runner jobs; establish Linux compilation and Windows/macOS compile checks where runners exist.
2. **Native vertical slices:** robot/controls, provider opening, folder opening, activation/restore, compatibility mode, and subscription-aware terminal launching on each platform. Test the installed application, not just the browser UI.
3. **Reliable workspace:** edit/save/search/projects, transactional storage, migrations, legacy imports, cross-OS folder rebinding, versioned backups, and error recovery.
4. **Desktop finish:** overlay/focus/input behavior, keyboard conventions, power/motion handling, tray/menu bar, monitors/DPI, lifecycle, accessibility, and optional extension validation.
5. **Cross-platform release:** native build/package/install/run checks, performance measures, screenshots, checksums, and platform-specific validation reports. No platform is declared complete solely because another platform passes.

### Release checklist

- [ ] Native packages exist and start without a development server on Windows, macOS, and Linux.
- [ ] New chat, saved-chat Find, Projects, folder opening, and backups have feature parity across supported OSes.
- [ ] Official local coding clients launch safely or expose a tested setup/web fallback on every OS.
- [ ] API credentials/unknown subscription status never initiate an automatic billable task.
- [ ] Storage migrations, failed reads/writes, backup merges, and legacy project references are tested.
- [ ] Cross-platform import preserves relationships and requests replacement of unusable folder bindings.
- [ ] Single-instance activation, close/hide/quit, absent tray, absent shortcut, and WebGL failure are tested per OS.
- [ ] Windows scaling/monitors, macOS activation/Spaces, and Linux X11/Wayland results are recorded.
- [ ] Paths containing spaces, quotes, metacharacters, and Unicode stay literal on every terminal adapter.
- [ ] Hidden rendering stops; reduced-motion settings work; the robot does not steal typing focus.
- [ ] On reported 4-core/8-GB baselines, target idle CPU below 3% of one core, RSS below 250 MB, and launcher-open p95 below 200 ms; measure each OS and investigate overruns. Exclude provider/browser processes.
- [ ] No remote telemetry, hosted backend, credential copying, or model API calls are introduced.
- [ ] Native test evidence, signing status, install instructions, checksums, and remaining limitations are documented.

A Linux-only artifact is a development checkpoint. The requested cross-platform product is complete only when every required platform meets its release criteria, or remaining external runner/account/signing dependencies are explicitly reported as blocking release.

## 14. Open questions with defaults

| Question | Owner | Default / effect |
|---|---|---|
| Exact Linux distribution, architecture, desktop, session type? | Engineering | Inspect the host immediately; Ubuntu 24.04 x86-64 is the planning baseline |
| Which terminal/browser/profile is preferred? | Rahul / engineering | System default browser; detected terminal with explicit selection if ambiguous |
| Which provider subscriptions/clients are installed? | Rahul / engineering | Discover clients; keep account authentication interactive and service-owned |
| Reference to Rahul's original miniature bot design? | Design / Rahul | Use included cylindrical camera-ring concept; replace model later without blocking core work |
| Where are Windows/macOS build and test runners available? | Engineering / Rahul | Inspect available local/CI hosts; prepare the matrix on Linux and report missing runner access without reducing platform scope |

These are non-blocking for inspection, shared implementation, and the first native vertical slice. Missing Windows/macOS runner access blocks cross-platform release validation, not work on the shared implementation. Real-account testing may wait for interactive sign-in; record it accurately rather than fabricating results.

## 15. Instruction to the implementing Codex

Build the native Windows, macOS, and Linux applications against this specification, with development initiated on the Linux computer. Inspect the provided prototype and host first; reuse working UI and robot assets. Work through the milestones, fix failures, and test the installed app where a GUI session exists. Do not stop at a browser mockup or a scaffold. Preserve the subscription-only policy and clear saved-history scope. If a desktop capability is unsupported, implement and test its documented fallback. Report only evidence-backed build/runtime outcomes and list any remaining blockers with the exact next action needed.
