---
issue: 32
title: "Orbit Feature: After clicking find for folder or thread , the cursor should automatically be on the input to filter the moment the person starts typing"
state: open
opened: 2026-11-01
closed:
github: https://github.com/xingh/orbit/issues/32
owner: file
arkitype: [04]
prerequisites: []
---

# The filter has focus the moment the panel opens

## What

Open Find, or Projects, and the search box is there but not focused. Typing goes nowhere until the
box is clicked. As raised:

> After clicking find for folder or thread, the cursor should automatically be on the input to
> filter the moment the person starts typing.

Orbit is opened to find one thing among a thousand — 1138 entries on the owner's own workspace.
Every open costs an extra click before the first keystroke lands.

## Where it is

`src/App.tsx`. The create modal already does the right thing (`autoFocus` on its name field); the
Find and Projects panels do not. The panel is rendered on view change rather than mounted fresh,
so an `autoFocus` attribute alone may not fire on every open — focus belongs in an effect keyed on
the view becoming `find` or `projects`.

## Worth getting right

- **Returning to a panel should not wipe what was typed.** Focus the input and leave its value
  alone; select-all is the friendlier default if a filter is already there, so the next keystroke
  replaces it without an explicit clear.
- **Not on the global shortcut alone.** The shortcut shows the window; if the panel is collapsed
  there is no input to focus, and stealing focus into a hidden field is worse than nothing.
- **Keyboard only.** No scroll, no layout shift — the panel is already placed by #4.

## Done when

Opening Find or Projects, by pill or by shortcut, puts the caret in the filter box; typing filters
immediately; and an existing filter is selected rather than cleared or appended to.

---

Raised from Todoist task `6hv8jgGgMf433qF2`, synced to GitHub as #32.
