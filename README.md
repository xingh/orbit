# Orbit Companion — early build 01

A miniature 3D desktop robot with New chat, Find, and Projects. React + TypeScript + Three.js, with a Tauri 2 Windows shell and local SQLite storage.

## Try the interface

Install Node.js 22+ and pnpm, then run these commands in this directory:

```powershell
pnpm install
pnpm dev
```

Open http://127.0.0.1:1420. The browser preview saves to this browser's local storage. Use Preferences → Workspace backup before clearing browser data. Its links open in the browser hosting the preview; for existing browser logins, use your normal Chrome or Edge window.

## Build the Windows companion

Install the prerequisites from https://v2.tauri.app/start/prerequisites/: Rust 1.90+, Microsoft C++ Build Tools with Desktop development with C++, and WebView2. Then:

```powershell
pnpm install
pnpm tauri dev
# Create the installer:
pnpm tauri build
```

The native shell has a transparent always-on-top window, a drag handle, a system tray menu, Ctrl+Shift+Space, folder selection/opening, and local Claude Code/Codex terminal launch. SQLite is stored in the application's per-user data directory. The browser preview uses local storage instead. Native compilation was not possible in the initial environment because Rust/C++ build tools were unavailable; these desktop features require native validation.

## What works in the browser preview

- An actual animated 3D robot with eight lenses in a panoramic ring; reduced-motion support.
- Open the official Claude, ChatGPT, Codex, and Claude Code web surfaces; optional Grok toggle.
- Save chat titles and official HTTPS links, add notes, pin and remove entries.
- Search saved entries by title, notes, tool, and folder; filter by provider.
- Create projects with a local folder path and preferred tool; link chats to projects.
- Export backups and merge imported entries, retaining existing data.
- Ctrl+K opens Find; Escape closes dialogs or collapses the panel.

## Subscription access

Sign in with your subscriptions in the official services. Orbit does not store passwords, copy authentication cookies, make model API calls, or pool subscriptions. Each provider's own plan and limits still apply. For local coding clients, install and authenticate the official tool before using Orbit's terminal launcher. The launcher removes common API/provider environment variables from its child process. Existing client configuration can still affect billing; verify subscription authentication in the tool itself. This is not a billing-status verifier.

New chat opens the provider's official entry page; some coding surfaces require choosing a repository or starting a task there. Existing chats remain in their original service. Find searches saved links and project entries, not every historical conversation or full conversation contents. Grok support opens the website; GrokBot automation is not integrated yet. The robot's camera is a visual design element and does not capture your webcam or screen.

## Browser extension

In Chrome or Edge, open Extensions, enable Developer mode, choose Load unpacked, and select `browser-extension`. On an official conversation page, open Orbit Chat Saver and save the title/link. Export the collection, then use Orbit Preferences → Import saved work. The extension uses only active-tab metadata, local storage, and downloads. It has no background scraping, host permissions, or credential access. Transfer is currently explicit export/import, not live sync. Extension installation/testing remains manual.

## Validation

```powershell
pnpm build
pnpm test
```

The initial browser build passed TypeScript and production bundling, and URL-validation/search tests. End-to-end browser checks are documented in `VALIDATION.md`. Native testing, installer signing, polished Blender/GLB modeling, full-history connectors, and direct extension sync are future work.
