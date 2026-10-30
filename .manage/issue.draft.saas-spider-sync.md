---
issue: draft
title: SaaS spider — file sync first, then document metadata, to local or team cloud
state: open
opened: 2026-10-29
closed:
github:
owner: file
arkitype: [01, 02, 03]
prerequisites: [issue.0006.per-item-storage.md, issue.0007.workspace-api.md, issue.draft.orbit-index-mcp.md, issue.0014.shared-workspaces.md]
---

# SaaS spider and sync (MCP ↔ disk, then document index)

## What

Part of Orbit wires **syncs from remote systems to disk and back**. Remotes include MCP-connected
tools and SaaS that only yield inventory through a signed-in browser session (computer use /
tekt.observer-style flows), plus purpose-built sync tools that land rows in a **shadow database**.

An **arkitype-style spider** reverse-engineers and registers connectors for each surface that must
be connected, then runs syncs into:

- a **local copy** on the machine, and/or
- a **shared cloud copy** for a team (advanced / shared-workspace deployment).

Sequence — start narrow:

```text
1. File sync          bytes on disk ↔ remote file stores / MCP file tools
2. Document sync      names + metadata only (arkitype inventory of "what exists")
3. Connector catalog  spider discovers/registers more SaaS; same sync pipeline
```

Chat import today is the prototype of (2) for Claude/ChatGPT: titles, ids, links, dates — never
bodies. Document sync generalises that pattern to files and SaaS objects.

## Why it matters

Shared thread search and local bots (#14, index MCP) only see what Orbit already indexed. Teams
also need the **files and named documents** sitting in SaaS — many of which have no clean list API
and only appear inside a logged-in UI. Without a spider + sync path, Orbit stays a chat bookmark
list while the real work lives elsewhere. File sync first proves disk round-trip; document sync
proves inventory-at-scale without becoming a content vault.

## Connector kinds

```yaml
connectors:
  mcp_bridge:
    how: >
      MCP tools that read/write files or list resources. Orbit (or the local bot API) calls them
      with the user's already-authenticated agent host — Orbit still holds no model API keys.
    sync: file bytes and/or resource metadata → local path or shadow rows
  computer_use_observer:
    how: >
      tekt.observer-style (or equivalent) computer-use flow: drive the official SaaS UI in the
      user's session, spider what is visible, emit structured inventory. Same spirit as chat
      import — session-bound, no Orbit-held SaaS API key required when the UI is the only door.
    sync: document names + metadata first; file download only when the connector declares a
          file-sync capability and the user opted that path in
  purpose_built_shadow:
    how: >
      Small sync binaries/adapters written for one SaaS or protocol. They write into a shadow
      database (rows Orbit can merge), not into the JSON workspace blob.
    sync: idempotent upserts keyed by remote id; tombstones on delete
```

The spider's job is to **detect what exists** in a connected SaaS (projects, drives, folders,
named docs), map it into arkitype-shaped inventory, and schedule the right connector. It does not
need to understand every product deeply on day one — file + document metadata is enough to start
connecting "everything that needs connecting."

## Shadow database

Purpose-built and observer connectors land in a **shadow store** beside the chat index:

- Remote id, connector id, kind (`file` | `document` | …), name/title, url or local path,
  content hash or etag when file-syncing, parent/folder, updated, tombstone.
- Merge rules mirror chat import: keep what you have not seen; never blind full-replace
  (principle 7).
- Chat `Item` rows stay the conversation index; shadow rows are the SaaS/file inventory. Find and
  shared search may union them later under one UI.

Local file sync materialises blobs under a user-chosen sync root (or app-data default). Team cloud
copy is the advanced deployment's object/store + the same metadata schema — not a second
product.

## Sync targets

| Target | Mode | Notes |
| --- | --- | --- |
| Local copy | Basic (desktop) | Default. Works offline once synced. |
| Shared cloud copy | Advanced + membership (#14, #16) | Team sees the same inventory; ACL + access requests apply to document rows the same way as chat entries. |

MCP ↔ disk ↔ back is bidirectional for **files** the user opted to sync. Document sync is
primarily pull of names/metadata; push of metadata edits (rename notes in Orbit) is a later pass.

## Phased delivery

1. **File sync MVP** — one MCP file-capable tool or one local folder mirror; round-trip; conflict
   policy (ours/theirs/ask); visible sync status in the UI.
2. **Document sync MVP** — inventory of names + metadata from one SaaS via computer-use observer
   *or* one purpose-built connector into shadow DB; Find can list them; open link in browser
   session.
3. **Spider registry** — arkitype connector descriptors (how to detect, what fields, sync class);
   add connectors without rewriting the core.
4. **Team cloud** — same shadow schema on the chosen server; shared search + request-to-share-more
   over document rows.

## Ruled out

- Treating document sync as licence to store **file bodies or chat transcripts** in the shared
  index by default. File bytes live in the sync root / object store the user chose; the index
  holds names and metadata (principle 2 generalised).
- Orbit holding SaaS or model API keys to scrape on a headless schedule (principle 1). Computer-use
  and user-session MCP are the default doors; purpose-built tools may use user-supplied credentials
  *in that tool*, not as secrets Orbit centralises — open decision if a connector vault is ever
  needed.
- Widening the loopback companion into a network spider controller (principle 4). Observer runs
  as an explicit local agent flow; central orchestration is the advanced server.
- Boiling the ocean: no "connect everything" before file sync and one document connector work.

## Open decisions

- Does computer-use observation live inside Orbit, as a tekt.observer handoff, or as a pluggable
  runner Orbit only schedules?
- Is the shadow DB SQLite tables in the same file (after #6) or a sibling DB?
- For team cloud file bytes: whose object store, and does Orbit ever proxy content or only
  metadata + signed URLs?

## Done when

- File sync: a chosen remote file set mirrors to a local folder and back through MCP or a
  purpose-built adapter, with sync status and no silent overwrite of unseen local changes.
- Document sync: at least one SaaS inventory (names + metadata) appears in Orbit Find from
  observer or shadow-DB connector, without storing document bodies in the index.
- Draft split into filed issues (file-sync, document-sync, spider registry, team copy) and synced
  when ready.
