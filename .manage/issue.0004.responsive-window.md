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

## Done when

Committed, and confirmed on a second display size. Remaining unverified: the rendered result was
never seen at the new sizes, because driving the GUI was declined — see `.arkitype/agent.local.md`.
