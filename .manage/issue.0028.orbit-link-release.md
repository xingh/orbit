---
issue: 28
title: "Orbit Link: name the browser extension and attach it to every release"
state: in-progress
opened: 2026-10-31
closed:
github: https://github.com/xingh/orbit/issues/28
owner: file
arkitype: [01, 04]
prerequisites: []
---

# Orbit Link: name the browser extension and attach it to every release

## What

The browser extension was "Orbit Chat Saver" and lived only in the source tree. A release had the
app installers and nothing for the browser, so someone who is not a developer could install Orbit
but had no way to get the extension it depends on for saving and importing chats.

- Name it **Orbit Link** (owner's choice) everywhere: manifest, popup, the app's pairing hints,
  README. The Firefox add-on ID becomes `link@orbit.tekt.md`.
- The Release workflow attaches `Orbit-Link-<extension version>.zip` to the GitHub Release after
  the installers are published, and the release notes say how to load it in Chrome and Edge.

## Ruled out, and why

- **Keeping the old name or ID for compatibility.** Nobody outside internal testing has installed
  it, so a clean rename costs nothing now and would cost a store migration later. The Firefox ID
  is fixed once it is listed on AMO, which is why it changes now.
- **Importing "chat-saver exports".** The app's import now names only Orbit backups; there are no
  outside exports to stay compatible with.
- **Store listings and a signed Firefox `.xpi`.** They need the owner's Chrome Web Store, Edge
  Add-ons and AMO accounts. Until then Chrome and Edge load the zip unpacked, and Firefox stays a
  temporary add-on, outside the Chrome/Edge scope.

## Done when

A pushed `v*` tag produces a release with `Orbit-Link-*.zip` alongside the five installers, and
that zip, unzipped and loaded unpacked in Chrome, shows as Orbit Link.
