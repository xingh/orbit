# Orbit — principles

The rules Orbit is not allowed to break. Each one has a reason; an agent or a person changing
Orbit should be able to read the reason and decide whether the rule still applies, rather than
rediscovering the constraint by breaking something.

## 1. The user's subscription, never an API bill

Orbit never asks for an API key and never calls a model API. It opens the official site, or the
official local tool, signed in as the user already is.

*Why:* the product's whole value is that it costs nothing beyond what the user already pays. The
moment a key is involved, Orbit owns a bill and a secret, and it becomes a different product.

*Consequence:* anything Orbit "does" inside a provider must happen in the user's own browser
session. There is no headless path. Features that need one are not available at any price.

## 2. Titles and links, never message content

Orbit stores a conversation's title, its id, its link, its dates, and the user's own note. It never
reads, requests or stores the body of a conversation.

*Why:* this is what keeps the blast radius of a leak, a sync bug or a shared workspace small. A
leaked Orbit entry exposes the fact that a conversation exists and what it is called. A leaked
transcript exposes everything.

*Consequence:* the import report records response **field names only, never values**, so the
diagnostic the user is invited to paste into an issue cannot carry their content.

*Consequence:* a shared workspace is an index of what people are working on, not shared content.
A provider link only opens for whoever owns that session, so sharing an entry grants no access.

## 3. Local by default, and local stays sufficient

Everything lives in the user's own app data. No account, no cloud, no telemetry. A remote server
may be chosen later, but Orbit without one is a complete product, not a trial.

*Why:* it is the reason to trust it, and it is the reason it works on a plane.

## 4. Loopback and a paired browser, nothing wider

The companion service binds `127.0.0.1` only. Every write needs the pairing token **and** a
browser-extension caller. A web page that discovers the port can do nothing.

*Why:* the service exists so an extension can reach the app. Any wider reach is unearned.

*Consequence:* this model does not survive being exposed to a network. A remote server is a
different program with per-user credentials and TLS, not a flag on this one. See
`.manage/issue.0014.shared-workspaces.md`.

## 5. Orbit does not act as the user without being asked

Orbit may open a page, and may fill in a composer. It does not submit on the user's behalf.

*Why:* submitting spends a message from the user's quota, in a window they may not be looking at,
in a conversation they may not have chosen. And the send control is the part of a provider's page
most likely to move, so automating it is both the riskiest and the most fragile half.

*Decided:* 2026-10-23, in conversation. "lets not prime the chat directly from the widget and hit
run, maybe if it primes it and stays put that could be useful".

## 6. Degrade loudly

When Orbit cannot do something, it says which thing and why, and leaves the user somewhere useful.
A silent zero is a bug. An import that reads nothing reports that it read nothing. A provider page
whose composer cannot be found leaves the text in the composer unsent and says so.

*Why:* these integrations are built on endpoints and DOM that the providers change without notice.
The only sustainable posture is to fail in a way that tells the user — and the next maintainer —
exactly what moved.

## 7. The window and the service share storage, so neither may overwrite blindly

Both the UI and the companion service write the same workspace. A writer keeps what it has not
seen rather than replacing the whole of it.

*Why:* learned the hard way. A full-workspace write from the window silently dropped entries the
service had just imported, and a later batch re-added one of them without its project. Nothing
errored. See `.archive/` for the fix, and principle 6 for why it was so hard to notice.
