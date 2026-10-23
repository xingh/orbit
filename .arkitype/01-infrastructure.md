# 01 — Infrastructure

Runtime, packaging and release. Product-specific values come from the `SITE PROFILE` in `00`.

```yaml
runtime:
  shell: Tauri 2 (Rust)
  frontend: React 18 + TypeScript, Vite 6
  renderer: Three.js (lazy-loaded; see the robot toggle in 00)
  icons: lucide-react
  package_manager: pnpm
  node: ">=22"
  rust: stable, edition 2021
  database: SQLite via rusqlite (bundled), WAL
  http: tiny_http 0.12 (companion service)

commands:
  install: pnpm install
  dev_desktop: pnpm tauri dev
  dev_browser: pnpm dev              # http://127.0.0.1:1420, localStorage instead of SQLite
  build_frontend: pnpm build         # tsc && vite build
  build_installers: pnpm tauri build
  test_frontend: pnpm test           # node --test tests/
  test_native: cargo test --manifest-path src-tauri/Cargo.toml
  format_check: cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
  full_check: pnpm build && pnpm test && cargo test --manifest-path src-tauri/Cargo.toml

window_shell:
  decorations: false
  transparent: true
  always_on_top: true
  skip_taskbar: true
  shadow: false
  accept_first_mouse: true
  resizable: true
  note: >
    resizable MUST stay true. With "resizable": false Tauri silently ignores every programmatic
    setSize, which defeats the responsive sizing in 04 with no error anywhere.
  csp: >
    default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:; font-src 'self';
    connect-src ipc: http://ipc.localhost http://127.0.0.1:1420 ws://127.0.0.1:1420;
    object-src 'none'; base-uri 'self'
  macos_private_api: true            # required for a transparent window

environment_variables:
  consumed: none
  scrubbed_from_children: [ANTHROPIC_API_KEY, OPENAI_API_KEY, and other API-key variables]
  note: a launched terminal must not inherit a key that would switch a tool off the user's plan

ci:
  file: .github/workflows/ci.yml
  runs: frontend build, node tests, cargo test, cargo fmt, unsigned installers as artifacts
release:
  file: .github/workflows/release.yml
  trigger: a pushed tag (git tag v0.2.0 && git push origin v0.2.0)
  version_source: the tag
  targets:
    - { os: windows, artifact: "Orbit_<v>_x64-setup.exe" }
    - { os: macos,   artifact: "Orbit_<v>_aarch64.dmg" }
    - { os: macos,   artifact: "Orbit_<v>_x64.dmg" }
    - { os: linux,   artifact: "Orbit_<v>_amd64.AppImage" }
    - { os: linux,   artifact: "Orbit_<v>_amd64.deb" }
  signing:
    macos: automatic once APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY,
           APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID exist as repository secrets
    windows: not set up; installers are unsigned and warn on first launch

browser_extension:
  location: browser-extension/
  manifest: 3
  loaded_unpacked: Chrome/Edge via Load unpacked; Firefox via Load Temporary Add-on
  note: >
    One folder serves both. Firefox sends no Origin header once the extension holds the host
    permission, so the service treats a missing Origin as a headless caller, not as a web page.

open_decisions:
  - id: remote-mode
    question: How is a chosen remote server run and reached?
    constraint: >
      The current service's security model is loopback + one static token + an extension caller.
      None of that survives exposure to a network. Remote is a separate binary or mode with
      per-user credentials and TLS, not a bind-address flag.
    leaning: reach a self-hosted instance over a private network (e.g. a tailnet) before
             attempting anything public
    affects: [03]
  - id: mobile-shell
    question: PWA or native for the phone?
    leaning: PWA first — the frontend is already a browser app
    see: .manage/issue.0015.mobile-client.md
```
