---
issue: 15
title: Mobile client — read-only PWA over the server API, able to start chats
state: open
opened: 2026-10-23
closed:
github: https://github.com/xingh/orbit/issues/15
arkitype: [01, 03, 04]
prerequisites: [issue.0007.workspace-api.md, issue.0014.shared-workspaces.md]
---

# Mobile client

## What

A standalone mobile experience, PWA first, that is **read-only** against the server API and can
**start chats**. Nothing else.

```yaml
can:
  - search and browse the workspace: chats, projects, filters, pinned
  - open a saved conversation in the phone's browser, where the user is signed in
  - start a new chat with any provider, optionally with a prompt already typed (see
    issue.0011.prime-composer.md — the ?q= path needs no extension and works on a phone)
cannot:
  - save, edit, pin, delete, or file anything
  - import history
scope_note: >
  Read-only is a deliberate decision, not a first-release limitation. It keeps the device
  credential harmless if a phone is lost, keeps the mobile build small, and means no merge or
  conflict story is needed for a second writer.
```

## Why read-only is the right line

Capture genuinely does not work on a phone. A full history import needs same-origin access to the
providers' own list endpoints, which only an extension — or a signed-in tab it can script — can
give, and neither exists on iOS or Android. Rather than build a weaker, different capture path
there, mobile consumes what the desktop captured.

That also makes the product easy to describe: **the desktop writes, the phone reads, both start
chats.**

## Dependency, not an afterthought

A phone cannot reach `127.0.0.1` on a computer. Mobile presupposes a reachable server, so the
desktop has to be set up first and the workspace has to live somewhere the phone can get to —
`issue.0014.shared-workspaces.md`, and one of the hosted modes in
`issue.0016.deployment-modes.md`. A responsive layout is the easy part.

## Pairing

QR is the right gesture, and it extends what exists: Orbit already has a 60-second pairing window
and a token.

```yaml
qr_payload: { server: https://..., token: <short-lived>, scope: read, expires: <timestamp> }
rules:
  - single-use, short-lived; exchanged immediately for a device credential
  - the device credential is READ scope only, and revocable on its own, so a lost phone does not
    mean re-pairing every browser
  - never encode a loopback address — a phone cannot reach it, and a QR that silently cannot work
    is worse than no QR
  - the device appears in Preferences beside the paired browsers, with its own Forget
```

## Ruled out

- **Writing from the phone.** Decided 2026-10-23: *"the mobile app should be read only, from the
  web server based API, and it should be able to start chats"*.
- **Capture on mobile** — share targets on Android, Shortcuts on iOS. Both are possible and both
  were considered; they are out of scope because they re-introduce a second writer for marginal
  benefit. Revisit only if read-only proves frustrating in use.
- **Native first.** The stack already renders in a browser; a PWA tests the idea far cheaper.
- **The floating robot.** It does not survive on a phone. Mobile is the Find/Projects panel as a
  normal page, and the 3D robot defaults off there — it is a constant GPU draw on a battery.

## Done when

A phone pairs by QR against a reachable server, searches the workspace, opens a saved chat, starts
a new one, cannot write anything, and can be forgotten from Preferences.
