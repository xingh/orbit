---
issue: 4
title: Linux / * - in low res screens the bot is too bit ,and the panel takes up too much screen space
state: in-progress
opened: 2026-10-20
closed:
github: https://github.com/xingh/orbit/issues/4
owner: github
arkitype: [04]
prerequisites: []
---

# Responsive window

## What

The widget was hard-coded to 510x820 logical pixels. On a 1280x680 logical work area that is most
of the screen, and Preferences fell off the bottom edge entirely.

## Why it matters

A companion that covers the work is not a companion. This was reported from use, not guessed.

## State

Built, not committed. The open widget now stays inside 20% of the monitor's work area, scaling
down from the design size and clamped to a 330x430 minimum, with a tighter layout below 430px
wide and one-line list rows. Measured at 330x529 open — 20.0% of the work area — and 330x205
collapsed. The panel scrolls inside the window instead of overflowing it.

A 3D-robot toggle was added on top of this (2026-10-23): off, the stage collapses to a flat mark
and gives ~100px of height back, and Three.js is never fetched.

## Ruled out

`"resizable": false` in `tauri.conf.json`. It looks right for a fixed widget and it silently makes
every programmatic `setSize` a no-op — hours were lost to that. It must stay `true`.

## State, 2026-10-23 (second pass)

Built against the four acceptance criteria still open on the issue:

```yaml
pill_on_hover: built — native only, and keyboard focus shows it too; the browser preview keeps it
double_click_to_tray: >
  built — only when a tray exists. A collapsed robot's single click waits 220ms; an open robot
  closes at once, so the delay is only paid where a double-click is possible
tray_double_click: built for Windows; macOS opens its menu on click; Linux reports no tray clicks
positioned_in_real_estate: >
  built as placement anchored on the robot — src/placement.mjs, unit-tested for every edge, a
  corner, a top bar, and a monitor at negative coordinates
alfred_modal: not built — see Ruled out
```

Seen on Linux X11 (this VM, 3200x2400, one monitor), with the native debug build:

```yaml
verified:
  - resting shows the robot alone; hovering shows the pill
  - with room below, the panel opens below; near the bottom it opens above, pill between the two
  - closing either way returns the window to the exact robot position it opened from
  - double-click on the robot hides Orbit; the shortcut brings it back open
not_reachable_here:
  - tray double-click — a Linux AppIndicator tray reports no clicks; Windows only, needs a Windows run
  - the robot sliding toward a side edge — this window manager will not let a window sit partly off
    screen, so the 510-wide window reaches the edge before the robot needs to slide; unit-tested only
traps_found:
  - X11 window managers keep a window on screen by the size they last saw. Moving a tall window low
    and then shrinking it leaves it pushed up — in either order, because setSize has not landed when
    setPosition arrives. Shrink, wait until outerSize reports the new height, then move.
  - getCurrentWindow().hide() needs core:window:allow-hide in capabilities; without it the call is
    refused and nothing says so.
  - the rendered robot stage stretches to fill a collapsed window, so its offsetHeight is not the
    stage height; the layout's own STAGE figure is.  - the window started at the 820-point design height. On a 720-line screen KWin maximised it
    vertically, and a maximised window ignores every setSize after it — the widget filled the screen
    height in both states. It now starts collapsed (270) and is unmaximised before every resize.
second_display_size: >
  1280x720 (676-point work area): 330x205 collapsed, 330x527 open — 20.1% of the work area — where
  it was 330x676 in both states before the fix above. 3200x2400: 510x270 and 510x820.
```

## Ruled out (second pass)

A separate centred command window for Alfred-style use. The criterion was a "maybe", and a second
window means a second set of always-on-top, focus and dialog-parenting fixes on three platforms —
the ones that took a round of Windows and macOS testing to get right for one. Placement solves the
stated problem, a panel with nowhere to go, inside the window that already works.

## Done when

Committed, and confirmed on a second display size. Remaining unverified: the rendered result was
never seen at the new sizes, because driving the GUI was declined — see `.arkitype/agent.local.md`.
