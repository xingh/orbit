---
issue: draft
title: Orbit serves a page that tells the browser reading it how to install Orbit Link
state: open
opened: 2026-10-31
closed:
github:
owner: file
arkitype: [01, 03]
prerequisites: []
---

# The install page Orbit already has a server for

## What

`GET /` on the companion service answers 404 today. It should answer with a small HTML page that
tells **the browser reading it** how to install Orbit Link, and where to get it from GitHub.

The page shows:

- **This browser's own location**, worked out from the `User-Agent`, as the first thing on the page.
- **Where to get it:** a link to the latest GitHub release's `Orbit-Link-<version>.zip`, and a note
  that a checkout can load `browser-extension/` directly. "Expanded" is the operative word — every
  browser here loads an *unzipped folder*, not the zip.
- **Pairing**, continued from there: Preferences → Pair a browser, then **Allow Orbit access** and
  **Pair with Orbit** in the popup.
- **Whether this browser is already paired**, so someone who arrives after pairing is told they are
  done rather than walked through it again.

The locations, which are the substance of the page:

| Browser | Where | Then |
| --- | --- | --- |
| Chrome | `chrome://extensions` | Developer mode → Load unpacked → the unzipped folder |
| Edge | `edge://extensions` | Developer mode → Load unpacked → the unzipped folder |
| Brave | `brave://extensions` | Developer mode → Load unpacked → the unzipped folder |
| Vivaldi | `vivaldi://extensions` | Developer mode → Load unpacked → the unzipped folder |
| Opera | `opera://extensions` | Developer mode → Load unpacked → the unzipped folder |
| Firefox | `about:debugging#/runtime/this-firefox` | Load Temporary Add-on → the folder's `manifest.json` |

## Why it matters

The extension is in no store, so every install is manual, and the one moment a person needs these
instructions is the moment Orbit is running and their browser is not connected to it. Orbit is
already serving HTTP at exactly that moment. The README has this, but the README is on GitHub and
they are not.

It also ends a smaller annoyance: Orbit binds the first free port of 41479–41483, so the address to
visit is not always the same. The page is reachable at whichever port Orbit actually took, and
Preferences can simply link to it.

## The trap this has to avoid

**A web page cannot link to `chrome://` or `about:` addresses.** Chrome refuses navigation to
`chrome://` from a page, and Firefox refuses `about:debugging` outright; an `<a href>` to either is
a dead click with no error message. The addresses must be rendered as selectable text with a copy
button, and the page must say "paste this in the address bar". Writing them as links is the obvious
thing to do and it silently does not work.

## Ruled out

- **Detecting the browser and installing for it.** No browser lets a page install an unpacked
  extension; that is the point of unpacked extensions. The page can only tell you where to go.
- **Serving the page only to a paired caller.** Nobody is paired when they need it. `GET /` is
  readable by any loopback caller, including a web page origin, which is safe precisely because the
  page carries no token and no workspace content — and it must stay that way.
- **Replacing the README section.** The README is how someone decides to install Orbit at all; this
  page is for someone who already did. Both say the same thing on purpose.

## Open question

Whether the service should also **serve the zip itself** from the running app, so installing needs
no internet at all. It is a better experience and it makes the local service a distributor of a
binary, with a version that can drift from the release. Not decided; GitHub is the source for now.

## Done when

- `http://127.0.0.1:<port>/` opened in Chrome and in Firefox each shows that browser's own steps
  first, with the address as copyable text rather than a link.
- An unrecognised browser gets the whole table rather than nothing — degrade loudly, principle 6.
- The GitHub link resolves to a release asset that exists.
- The page is asserted to contain no token: a test fetches it and greps the response.
- Preferences links to it, at the port Orbit actually bound.
