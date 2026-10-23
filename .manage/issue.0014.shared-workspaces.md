---
issue: 14
title: A chosen server, and workspaces other people can join
state: open
opened: 2026-10-23
closed:
github: https://github.com/xingh/orbit/issues/14
arkitype: [01, 02, 03]
prerequisites: [issue.0006.per-item-storage.md, issue.0007.workspace-api.md]
---

# Shared workspaces

## What

Let a user point Orbit at a server instead of local storage, and let other people join that
workspace — "join my orbit".

## The fork to settle first

Two different products were described in the same breath:

1. **A team space.** One workspace, several members; membership is the unit. Much simpler.
2. **Federation.** Two workspaces, one subscribing to the other; subscription is the unit. Needs
   identity, trust and a merge policy.

Recommendation: build (1), and let (2) be "join a second workspace and switch between them".

## What makes it coherent

An item currently mixes two kinds of fact: what the conversation *is* (provider, uuid, url,
upstream title) and what it is *to you* (note, pin, project, local folder). Single-user that is
harmless. The moment two people have both saved the same claude.ai chat the ids collide — which is
what you want, since the id is derived from the conversation — but then *whose note wins* has no
answer. Split the shared object from the per-person overlay. See the `shared-vs-overlay` open
decision in `.arkitype/02-database.md`.

## Why the blast radius is small, and must stay small

A provider link only opens for whoever owns that session. Sharing an Orbit entry shares a title and
a link that nobody else can follow. So a shared orbit is an **index of what a team is working on**,
not shared content — genuinely useful, and safe. The moment the extension starts sending message
content, that stops being true. See knowledge principle 2.

## Ruled out

Binding the existing companion service to a wider address. Its model is loopback + one static
token + an extension caller: off-box the caller check means nothing, the token is a single shared
secret with no revocation, and there is no TLS. Remote is a separate mode with per-user
credentials, not a bind-address flag.

For a first pass, reach a self-hosted instance over a private network (a tailnet or similar) rather
than a forwarded port, so authentication is not load-bearing on day one.

## Done when

Two machines, two identities, one workspace; an entry saved on one appears on the other; a delete
propagates as a tombstone; and revoking a member's access actually stops them reading.
