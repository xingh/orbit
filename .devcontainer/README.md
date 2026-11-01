# Orbit devcontainer

What a developer needs to build Orbit, run it, and verify a change — without installing a Tauri
toolchain on their own machine, and matching what CI builds on (Ubuntu 24.04, Node 22, Rust
stable).

## Opening it

VS Code with the Dev Containers extension: **Reopen in Container**. Or `devcontainer up
--workspace-folder .` with the CLI, or a GitHub Codespace.

The first build compiles the Rust dependency graph and takes a while. After that, the cargo
registry, the `src-tauri/target` directory and the pnpm store live in named volumes, so a rebuild
of the container does not repeat it.

## It has a desktop, because Orbit is a window

Orbit is not a web page, so there is a real X session at **http://localhost:6080** (password
`vscode`). `pnpm tauri dev` opens the widget there. `DISPLAY` already points at it, so nothing
needs exporting.

That is also what makes a change checkable without a monitor:

```sh
xwininfo -root -tree | grep Orbit          # find the window
xdotool search --name '^Orbit$'            # drive it
xwd -id <id> -out shot.xwd                 # capture it
```

`docs/screenshots/capture/capture.py` uses the same stack on its own `Xvfb` display and needs
nothing extra.

## What is installed, and why

| | |
| --- | --- |
| `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`, `xdg-utils` | Tauri's Linux prerequisites — the same list `.github/workflows/ci.yml` installs |
| Node 22, pnpm, Rust stable with rustfmt and clippy | the toolchains the checks use |
| Firefox, from Mozilla's APT repository | the extension and the capture script are driven through Marionette. Ubuntu's own `firefox` package is a snap stub, which cannot run in a container |
| `xvfb`, `x11-apps`, `x11-utils`, `xdotool`, `wmctrl` | running and inspecting the window headlessly |
| `sqlite3`, `python3-pil` | reading the workspace, and the capture script's image assembly |
| `gh` | `.manage/manage` syncs issue files to GitHub through it |

## Ports

| Port | What |
| --- | --- |
| 1420 | Vite dev server (`strictPort`, so it has to be this one) |
| 6080 | the desktop, over noVNC |
| 41479–41483 | the companion service. It binds the first free one, and the extension probes the same range |

## The checks

```sh
pnpm build && pnpm test && cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
.manage/manage status
```

## What it deliberately does not do

- **No signing keys, tokens or accounts.** `TAURI_SIGNING_PRIVATE_KEY` belongs to the release
  workflow; `gh` is installed but not authenticated; the companion service generates its own
  pairing token on first run.
- **No browser profile.** Pairing the extension needs a real browser with a real session on
  claude.ai or chatgpt.com. That is the owner's machine, not this image — see
  `.arkitype/agent.local.md` for what can and cannot be verified without it.
- **No cross-compilation.** Windows and macOS bundles are built by `.github/workflows/release.yml`
  on their own runners.
