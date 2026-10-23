---
issue: 10
title: Search Orbit, and start a chat, from the extension popup
state: open
opened: 2026-10-23
closed:
github: https://github.com/xingh/orbit/issues/10
arkitype: [03, 04]
prerequisites: [issue.0007.workspace-api.md]
---

# Find and start from the browser

## What

The popup can save and import. It cannot search what you have saved, browse projects, or start a
new chat. All three belong there — the browser is where the conversations are.

## Why the read half is the interesting half

The companion service is **write-only**: `GET /health`, `GET /pair`, `POST /chats`. Searching from
the extension means a read route, which is the first time Orbit's contents flow *outward* to a
browser. Behind the same token-and-caller gate, with the same loopback binding, that is defensible
— but it is a deliberate widening and should be reviewed as one, not slipped in.

Starting a new chat is trivial by comparison: the provider URLs are already in `providers.js`, and
it is a link.

## Ruled out

Giving the extension the whole workspace to filter locally. A query route that returns matches
keeps the amount of data leaving the app proportional to what was asked for.

## Done when

The popup searches saved chats and projects, filters by provider, opens one, and starts a new chat
in any provider — with the read route refused to a web-page caller and without a token.
