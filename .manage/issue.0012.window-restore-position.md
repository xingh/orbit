---
issue: 12
title: Reappear where it was, or centred — never somewhere arbitrary
state: open
opened: 2026-10-23
closed:
github: https://github.com/xingh/orbit/issues/12
arkitype: [04]
prerequisites: []
---

# Where the window comes back

## What

Hide Orbit with the shortcut or the tray, show it again, and it should be where you left it. If
there is no sane remembered place, it should open in the centre of the screen.

## What is actually missing

Within one session, `hide()`/`show()` keeps the position — the window manager holds it. Three gaps:

```yaml
across_restarts:
  problem: the position is never persisted, so every launch starts wherever the WM decides
  fix: store x/y with the workspace settings; restore on launch
no_fallback:
  problem: there is no "centre it" path at all — if a remembered position is unusable, nothing
           sensible happens
  fix: centre on the monitor holding the pointer when there is no valid remembered position
stale_position:
  problem: >
    after a resolution change, a monitor being unplugged, or a hidden window coming back on a
    different workspace, the old coordinates can be off-screen. The frontend clamps the position
    into the work area, but only when its resize effect runs.
  fix: validate the remembered position against the current monitor layout on every show, not only
       on mount, and centre when it does not fit
```

## Done when

Hide and show returns it to the same spot; quit and relaunch does too; and unplugging a display,
or a first run with nothing remembered, puts it in the middle of the screen rather than off its
edge.
