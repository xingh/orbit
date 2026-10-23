---
issue: 5
title: Support Claude Code and Codex sessions in the extension and history import
state: open
opened: 2026-10-19
closed:
github: https://github.com/xingh/orbit/issues/5
arkitype: [03, 04]
prerequisites: []
---

# Claude Code and Codex in the launcher

## What

The launcher shows web chat only (`kind == web`). The native subscription gate and the terminal
adapters for Claude Code and Codex are built and unit-tested but not offered in the UI.

## Why it matters

They were cut deliberately while the browser extension and the history import settled, so that one
unfinished thing was being debugged at a time. The code is not dead — a project saved with a coding
tool still keeps its **Open coding tool** button.

## Ruled out

Nothing yet. The question is sequencing, not design.

## Done when

The launcher offers them again, the import knows what a local coding session is, and the gate's
behaviour (API-key sign-in refused, signed-out refused, anything unclear refused) is exercised on
a machine with both tools installed.
