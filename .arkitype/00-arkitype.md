# 00 — Arkitype: identity and profile

The only file here that is specific to Orbit. Layers `01`–`04` consume these values by reference.

```yaml
SITE PROFILE:
  name: Orbit
  product_name: Orbit
  identifier: md.tekt.orbit
  version: 0.1.0
  publisher: Tekt
  repository: https://github.com/xingh/orbit
  tagline: A tiny robot on your desktop that starts, finds and organises your AI chats.
  purpose: >
    A floating desktop companion that launches AI chat sites signed in as the user already is, and
    keeps a local, searchable index of the conversations and projects they care about.
  audience: people with paid Claude/ChatGPT subscriptions whose conversations are scattered
  category: Productivity

  brand:
    accent: "#9be6d5"        # --cyan
    background: "#10171c"
    muted: "#8d9da6"
    hairline: "#ffffff13"
    display_font: Manrope
    body_font: DM Sans
    mark: "◉"           # the flat robot glyph
    icon: src-tauri/icons/128x128@2x.png

  providers:
    - { id: claude,      name: Claude,      mark: C,  color: "#dfaa88", url: "https://claude.ai/new",        kind: web }
    - { id: chatgpt,     name: ChatGPT,     mark: G,  color: "#8fceb7", url: "https://chatgpt.com/",         kind: web }
    - { id: grok,        name: Grok,        mark: X,  color: "#ccd4dc", url: "https://grok.com/",            kind: web }
    - { id: codex,       name: Codex,       mark: ">", color: "#a7bded", url: "https://chatgpt.com/codex",   kind: code }
    - { id: claude-code, name: Claude Code, mark: "/>", color: "#e2b791", url: "https://claude.ai/code",     kind: code }
  provider_hosts:
    claude: [claude.ai]
    chatgpt: [chatgpt.com, chat.openai.com]
    grok: [grok.com]
    codex: [chatgpt.com]
    claude-code: [claude.ai]

  importable_providers: [claude, chatgpt]      # the two with reachable list endpoints
  launcher_shows: web                          # kind == web only; see open_decisions in 04

  feature_toggles:
    grok:    { default: false, effect: "adds Grok to the launcher" }
    robot:   { default: true,  effect: "3D robot; off loads a flat mark and never fetches Three.js" }
    compact: { default: false, effect: "derived from window width, not user-set" }

  service:
    bind: 127.0.0.1
    ports: [41479, 41480, 41481, 41482, 41483]   # first free wins
    pairing_window_seconds: 60
    max_body_bytes: 262144
    workspace_limit_bytes: 2000000

  window:
    design: { width: 510, height: 820, collapsed: 270 }
    footprint: 0.2            # share of the monitor work area the open widget may occupy
    minimum: { width: 330, height: 430 }
    compact_below_width: 430
    robot_stage: { normal: 185, tight: 126, flat: 84 }
    shortcut: "Ctrl/Cmd + Shift + Space"
    search_shortcut: "Ctrl/Cmd + K"

  storage_location:
    linux: ~/.local/share/md.tekt.orbit/orbit.sqlite
    macos: ~/Library/Application Support/md.tekt.orbit/orbit.sqlite
    windows: "%APPDATA%\\md.tekt.orbit\\orbit.sqlite"

  constellation:
    role: standalone
    planned: >
      A chosen remote server, with other people's workspaces joinable. Nothing about the current
      build assumes it. See .manage/issue.0014.shared-workspaces.md
```

## Open decisions

```yaml
open_decisions:
  - id: product-surface
    question: Is the desktop widget the product, or one client of a service?
    leaning: >
      One client. A web/mobile client and a chosen server are both wanted, which means the
      workspace API has to exist independently of Tauri. Nothing is committed yet.
    affects: [01, 02, 03]
  - id: naming-of-a-shared-space
    question: What is a joined workspace called to the user — an orbit, a space, a workspace?
    note: "\"join my orbit\" is the phrase the product owner reaches for; the code says workspace."
```
