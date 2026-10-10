# Orbit

A small robot that floats on your desktop. Under it is a pill with three buttons:

- **New chat**: open Claude, ChatGPT, Codex or Claude Code with your own signed-in account.
- **Find**: search the conversation links you saved.
- **Projects**: keep a project's folder and related chats together, and open its coding tool.

Hover over the pill to see the labels, and click one to open its panel. Orbit works on Windows, macOS and Linux and never asks for API keys.

## Download

Get the latest installer from the [Releases page](https://github.com/xingh/orbit/releases/latest):

| Your computer | File to download |
| --- | --- |
| Windows 10 or 11 | `Orbit_…_x64-setup.exe` |
| Mac with Apple chip (M1 or newer) | `Orbit_…_aarch64.dmg` |
| Mac with Intel chip | `Orbit_…_x64.dmg` |
| Linux (any distro) | `Orbit_…_amd64.AppImage` |
| Ubuntu / Debian | `Orbit_…_amd64.deb` |

**First launch.** Until the builds are code-signed, your computer may warn you once:

- **Windows:** "Windows protected your PC" → **More info** → **Run anyway**.
- **Mac:** drag Orbit into Applications and open it. If macOS blocks it, go to **System Settings → Privacy & Security** and click **Open Anyway**.
- **Linux AppImage:** right-click → Properties → allow running as a program.

Bring Orbit back with **Ctrl + Shift + Space** (**Cmd + Shift + Space** on Mac), or from its tray / menu-bar icon.

## For maintainers: publishing a release

```sh
git tag v0.2.0
git push origin v0.2.0
```

The `Release` workflow builds Windows, macOS (Apple Silicon and Intel) and Linux installers and publishes them on the GitHub Release for that tag. The version number comes from the tag. Each pull request also builds unsigned installers as CI artifacts.

macOS signing and notarization switch on automatically once the repository has the `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` and `APPLE_TEAM_ID` secrets. Windows signing still needs a code-signing certificate.

---

## Development notes (early build 01)

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
