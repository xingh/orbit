---
issue: 7
title: One workspace API, consumed by the desktop frontend itself
state: open
opened: 2026-10-23
closed:
github: https://github.com/xingh/orbit/issues/7
arkitype: [01, 03]
prerequisites: [issue.0006.per-item-storage.md]
---

# Workspace API

## What

Define the workspace's read and write operations once, as an HTTP API, and have the desktop
frontend use it locally instead of talking to Tauri IPC directly. Storage and events go behind one
interface with two implementations: Tauri IPC and HTTP.

## Why it matters

A web client, a phone client and a chosen remote server all need this. Writing it twice — once as
IPC, once as HTTP — guarantees the two drift, and the drift will be discovered as a bug on the
least-tested client.

It also pays for itself single-user, which is the test of whether planning for later is honest:
the browser preview (`pnpm dev`) currently uses `localStorage` and so cannot see the real
workspace at all.

## Ruled out

Widening the existing companion service to serve this. That service's security model is loopback
plus one static token plus an extension caller; it is write-only and deliberately narrow. A read
API is a separate surface.

## Done when

`storage.ts` has two implementations behind one interface, the desktop behaves identically on
either, and the browser preview reads the real workspace through the local service.
