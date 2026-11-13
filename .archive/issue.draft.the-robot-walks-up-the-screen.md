---
issue: draft
title: The robot walks up the screen after it is moved
state: done
opened: 2026-11-13
closed: 2026-11-13
github:
owner: file
arkitype: [04]
prerequisites: []
---

# The robot walks up the screen

## What

Reported from use: "the orbit moves around too much … it jumps a moment after I drag it."

Move the window once and it climbs the screen by 64 physical pixels roughly twice a second, for
ever, until it reaches the top. Measured on the reporter's machine (2560x1440, work area
2560x1360, scale factor 2, the 3D robot switched off):

```
  moved to y=700 -> 700 -> 636 -> 572 -> 508 -> 444 -> 380 -> 316 -> 252 ...
```

An unrelated window moved at the same moment stayed where it was put, so it was Orbit, not the
window manager. Disabling the placement effect stopped it. It reproduces on `main`.

## Why it happened

Three facts meeting:

```yaml
asked_for_an_impossible_size:
  what: >
    With the 3D robot off and the compact layout in force, the collapsed window works out at
    205 - 42 = 163 logical pixels tall. `tauri.conf.json` sets minHeight to 180, so the window
    is never allowed to be 163 and the request can never be satisfied.
outer_size_counts_what_set_size_does_not:
  what: >
    GTK keeps an invisible resize border around a decorations:false window. `outerSize()` counts
    it and `setSize()` does not, so this window reports 212 logical pixels tall while it is
    really 180, and `outerPosition()` sits 32 logical pixels above what X reports. A window given
    exactly the size it already has still reports back a different one.
the_pass_had_no_fixed_point:
  what: >
    The placement effect compared `outerSize()` against the height it wanted, so the comparison
    never came out equal. Every pass re-issued setSize, the window manager answered by shifting
    the window by the difference, that fired `onMoved`, and `onMoved` schedules the next pass
    250ms later. A loop with no exit.
```

The 250ms debounce on `onMoved` is why it reads as "a moment after I drag it" rather than as a
smooth slide.

## The fix

```yaml
never_ask_for_less_than_the_window_allows:
  what: the collapsed height is clamped to WINDOW_MIN, which is paired with tauri.conf.json
settle_on_what_was_asked_for:
  what: >
    the pass now records the size it requested and skips setSize when that has not changed,
    instead of asking `outerSize()` whether the window obeyed. A window that cannot take the size
    it was given still reaches a fixed point.
a_pass_that_changes_nothing_touches_nothing:
  what: no setPosition and no setSize when the window is already where and how it should be
```

## Ruled out

- **Trusting `outerSize()` / `outerPosition()` to agree with the screen.** They do not, on GTK,
  by exactly the invisible border. Anything that loops until the window reports an expected
  geometry will spin. The 240ms convergence poll in the shrink path is left in place because it
  only waits, but nothing may depend on it finishing.
- **Widening the `onMoved` tolerance** past 2px to swallow the drift. It would have hidden this
  one and left the loop in place for the next discrepancy to find.

## Also fixed here, secondary

The vertical clamp demanded that the robot's whole 185px stage fit inside the work area, while the
sides let it slide to the window's edge and hang past the screen's. `place()` now takes `keep`:
how much of the stage has to stay inside. Note that this is **latent on a window manager that
keeps windows inside the work area by itself** — the WM clamps first, so the old rule could not
fire there. It fires wherever an interactive drag is allowed past the edge.

## Done when

Move the window and it stays where it was put. Confirmed live, three positions, four seconds of
watching each: still, still, still.

## Not confirmed

Opening and closing the panel was not driven, on this machine: synthetic pointer and key events do
not reach the window (it takes no focus, and Tauri's drag region swallows clicks). The open and
close paths are untouched by this change, and the window was observed resizing correctly from the
config's 510x270 to the computed 330x180 at startup.
