---
issue: 6
title: Per-item storage with timestamps and tombstones
state: open
opened: 2026-10-23
closed:
github: https://github.com/xingh/orbit/issues/6
owner: file
arkitype: [02]
prerequisites: []
---

# Per-item storage

## What

Replace the single-JSON-document workspace (`workspace` table, `id = 1`) with per-item rows
carrying `updated`, plus a tombstone table. One-way migration, versioned backup written first.

## Why it matters

This is the prerequisite for most of the roadmap, and it is already costing us:

- A blob cannot say *when one item changed*, so two writers cannot merge. The window and the
  companion service already share this storage, and a full-workspace write from the window
  silently dropped imported entries until it was patched to keep what it had not seen. The patch
  works; the shape is still wrong.
- A blob cannot carry a tombstone, so an upstream delete has nowhere to be recorded.
- The 2 MB ceiling is close. The live workspace holds 1081 entries.

Everything else — upstream renames, upstream deletes, a shared workspace, a second client — needs
per-item identity and a changed-at time. Build it once, properly.

## Shape

```yaml
items:      [id PK, type, title, provider, url, folder, note, pinned, updated, project_id,
             title_edited_by_user, missing_since, origin]
tombstones: [id PK, deleted_at, reason]
settings:   [key PK, value]
indexes:    [provider, type, project_id, updated]
```

`title_edited_by_user` and `missing_since` are there for the rename and delete work; adding the
columns now costs nothing and avoids a second migration.

## Ruled out

A CRDT. The data is small, rarely edited and mostly additive — per-item last-write-wins on
`updated` plus tombstones is sufficient and is a fraction of the complexity.

## Done when

The app reads and writes rows, the migration runs once from the JSON document with a backup, and
the existing 1081 entries survive it intact with their project links.
