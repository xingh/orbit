# 04 — Interface

Window behaviour, views, and the extension popup. Sizes, colours and fonts come from the
`SITE PROFILE` in `00`.

## Window

```yaml
states:
  collapsed: robot stage, with the pill appearing on hover or keyboard focus (native only)
  expanded:  robot stage + pill + panel
sizing:
  rule: >
    The open widget stays inside SITE PROFILE.window.footprint of the monitor's work area, holding
    the design proportions until it no longer fits, then clamped to `minimum`. It scales DOWN from
    the design size, never up.
  ratio: min(1, sqrt(workArea.w * workArea.h * footprint / (design.w * design.h)))
  compact_below: SITE PROFILE.window.compact_below_width — a tighter layout, not a smaller font alone
  collapsed_height: design.collapsed, or 205 when compact, less the stage height given back when
                    the robot is off
  placement: >
    Anchored on the robot (src/placement.mjs), so opening and closing never moves it. The panel
    opens below when it fits, above when it does not and there is more room overhead — the pill then
    sits between panel and robot. Near a side edge the window stays inside the work area and the
    robot slides toward the edge within it, so in a corner the panel opens diagonally away. Chosen
    when the panel opens or closes, never while it is in use.
  measured: 330x529 logical open (20.0% of a 1280x680 work area) and 330x205 collapsed
dragging: from the robot or any empty part of the open panel; a click under 5px still toggles
double_click: >
  on the robot, hides Orbit to the tray — only when a tray exists, so it can never strand the
  window. A single click on a collapsed robot waits 220ms to tell the two apart; an open one
  closes at once.
chrome: no decorations, transparent, always on top, absent from the taskbar
shortcuts:
  global: SITE PROFILE.window.shortcut toggles visibility, also in the tray menu
  in_window: SITE PROFILE.window.search_shortcut focuses Find; Escape closes
tray_menu: [Show/Hide, Preferences, Pair a browser, Quit]
tray_double_click: >
  Windows only — opens robot, pill and panel on Find, with the menu moved to the right button.
  macOS keeps its menu-on-click convention; a Linux AppIndicator tray reports no clicks at all.
```

## Views

```yaml
views:
  new:      { purpose: launch a provider, shows: importable and web providers as cards }
  find:     { purpose: search saved work, shows: one-line rows, filters by provider, pinned first }
  projects: { purpose: list projects, detail: folder, actions, and the chats filed under it }
  settings: { purpose: preferences, see below }
row_density:
  rule: >
    One line per entry. The same screen area that shows 10 threads in Claude or ChatGPT must show
    about as many here; an early build showed four.
project_detail_actions: [Add related chat, Open project, Open coding tool (code providers only)]
preferences:
  - { id: grok,       control: switch, label: Show Grok }
  - { id: robot,      control: switch, label: 3D robot }
  - { id: backup,     control: button, label: Workspace backup }
  - { id: import,     control: button, label: Import saved work }
  - { id: extension,  control: button, label: Pair a browser, shows: service state and paired browsers }
  - { id: unpair,     control: button, label: Forget paired browsers }
notices: one toast, naming what happened — "Saved 3 chats from your browser",
         "Filed 7 chats under their projects"
accessibility:
  - every switch is role=switch with aria-checked
  - the robot has an aria-label; the flat mark is aria-hidden behind the labelled button
  - prefers-reduced-motion stops the robot's idle motion and all animation
  - a WebGL failure falls back to a visible mark, never a blank area
```

## The robot

```yaml
robot:
  implementation: procedural Three.js geometry — a prototype stand-in, replaceable by a GLB
  loading: lazy, in its own chunk; when the toggle is off Three.js is never fetched or parsed
  prop_surface: "{ active }" only — deliberately thin
  flat_state: the SITE PROFILE mark, and the stage gives its height back to the window
  intent: >
    To become a humanoid assembled from a declarative genome — a JSON configuration of colour,
    shape and feature, with parts reacting to specific values. The thin prop surface and the lazy
    module boundary are what keep that swap cheap. Nothing else in the app should reach into it.
    See .manage/issue.0017.robot-genome.md
```

## Browser extension popup

```yaml
controls:
  - { id: status,      shows: whether Orbit is running, and on which port }
  - { id: connect,     label: Allow Orbit access, when: the host permission is not yet granted }
  - { id: pair,        label: Pair with Orbit, when: unpaired and the pairing window is open }
  - { id: title,       control: text, purpose: the name to save the current tab under }
  - { id: save,        label: Save this chat }
  - { id: import,      label: Import existing chats and projects }
  - { id: progress,    shows: per-list progress, and "Filed N under their projects" }
  - { id: report,      label: Copy import report, with a textarea fallback when the clipboard is refused }
queueing: >
  with Orbit closed, a save waits in the extension and is sent the next time the popup opens with
  Orbit running
icons: distinct from the desktop icon, so the browser's own extension list is unambiguous

open_decisions:
  - id: launcher-scope
    question: Do Claude Code and Codex return to the launcher, and when?
    status: deliberately cut; the gate and adapters exist and are tested
    see: .manage/issue.0005.code-tools-in-launcher.md
  - id: find-in-extension
    question: Searching and starting chats from the popup
    see: .manage/issue.0010.extension-search.md
  - id: restore-position
    question: Where does the window reappear after being hidden?
    see: .manage/issue.0012.window-restore-position.md
```
