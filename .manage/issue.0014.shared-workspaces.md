---
issue: 14
title: A chosen server, and workspaces other people can join
state: open
opened: 2026-10-23
closed:
github: https://github.com/xingh/orbit/issues/14
owner: file
arkitype: [01, 02, 03]
prerequisites: [issue.0006.per-item-storage.md, issue.0007.workspace-api.md]
---

# Shared workspaces

## What

Let a user point Orbit at a server instead of local storage, and let other people join that
workspace — "join my orbit".

Once people can join, the product shape is:

1. **Shared thread search** — Find runs across the joined index (titles, notes, projects, links),
   so a team sees what everyone has saved without anyone reading anyone else's chat body.
2. **Request to share more** — if a hit is outside your visibility, or you need a deeper note /
   project slice, Orbit files an **access request** to the owner or a workspace admin. They
   approve a wider index share (or decline). Orbit never brokers message content.
3. **Same API locally and centrally** — a machine-local bot/index API (with an MCP facade) talks
   to local coding agents; the central deployment is that API with membership, for multi-user.
   Detail: `issue.draft.orbit-index-mcp.md`.

## The fork to settle first

Two different products were described in the same breath:

1. **A team space.** One workspace, several members; membership is the unit. Much simpler.
2. **Federation.** Two workspaces, one subscribing to the other; subscription is the unit. Needs
   identity, trust and a merge policy.

Recommendation: build (1), and let (2) be "join a second workspace and switch between them".
Shared thread search and access requests belong to (1). "Follow someone else's public orbit"
without membership is (2) and waits.

## What makes it coherent

An item currently mixes two kinds of fact: what the conversation *is* (provider, uuid, url,
upstream title) and what it is *to you* (note, pin, project, local folder). Single-user that is
harmless. The moment two people have both saved the same claude.ai chat the ids collide — which is
what you want, since the id is derived from the conversation — but then *whose note wins* has no
answer. Split the shared object from the per-person overlay. See the `shared-vs-overlay` open
decision in `.arkitype/02-database.md`.

Visibility is then a third axis: which shared objects a member may see. Default invite can be
project-scoped or whole-workspace; "share more" widens that grant.

## Shared thread search

- Query the shared index the same way Find queries local: title, note, project, provider, typed
  note tags when those exist.
- A result opens **in the viewer's own provider session**. If they are not logged into that
  account, the link fails for them — that is correct and must stay loud (principle 6).
- Ranking can prefer projects you share membership on, then the rest of the workspace you can see.
- No semantic search over chat transcripts. Ever.

## Request to share more

When search or browse shows a redacted / out-of-scope stub, or the user explicitly asks for a
project they cannot see:

```text
member → request { target: project|entry|workspace-slice, reason }
owner/admin → approve (grant ACL) | deny | ask for clarification
member → search/browse updates; no content payload was transferred beyond index fields
```

**"More" means more of the index** (projects, entries, richer owner notes marked shareable), not
transcripts. If someone needs the actual conversation, they need an invite on the provider side or
a paste outside Orbit — Orbit can only remind them of that.

Steal the *shape* from HeyBrain's permission boundaries and Memava's per-file locks; keep the
payload at titles/links/notes.

## Why the blast radius is small, and must stay small

A provider link only opens for whoever owns that session. Sharing an Orbit entry shares a title and
a link that nobody else can follow. So a shared orbit is an **index of what a team is working on**,
not shared content — genuinely useful, and safe. The moment the extension starts sending message
content, that stops being true. See knowledge principle 2.

Access requests inherit that: approving a request only expands which index rows you can see.

## Ruled out

Binding the existing companion service to a wider address. Its model is loopback + one static
token + an extension caller: off-box the caller check means nothing, the token is a single shared
secret with no revocation, and there is no TLS. Remote is a separate mode with per-user
credentials, not a bind-address flag.

For a first pass, reach a self-hosted instance over a private network (a tailnet or similar) rather
than a forwarded port, so authentication is not load-bearing on day one.

Also ruled out here: using shared search as a back door to message bodies, or auto-approving
access requests from any joiner.

## Done when

Two machines, two identities, one workspace; an entry saved on one appears on the other; a delete
propagates as a tombstone; and revoking a member's access actually stops them reading.

Stretch (same issue or a child when syncing): shared Find returns another member's visible entry;
an access request for a hidden project is approved and the next search includes it.

Document/file inventory from the SaaS spider (`issue.draft.saas-spider-sync.md`) uses the same
membership and access-request rules once a team cloud copy exists — still names/metadata in the
shared index, bytes in the chosen sync store.
