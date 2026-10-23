# 02 — Database

SQLite, one file per user, created on first run at the path in the `SITE PROFILE`.

## Current schema (as built)

```yaml
pragmas: [journal_mode=WAL]

tables:
  workspace:
    columns:
      id:   { type: INTEGER, primary_key: true, note: "always 1" }
      json: { type: TEXT, not_null: true }
    note: >
      THE ENTIRE WORKSPACE IS ONE JSON DOCUMENT IN ONE ROW. See open_decisions — this is the
      single biggest constraint on everything planned.
  service:
    columns:
      id:    { type: INTEGER, primary_key: true, check: "id = 1" }
      token: { type: TEXT, not_null: true, note: "64 hex chars, generated on first run" }
  paired:
    columns:
      origin:    { type: TEXT, primary_key: true, note: "extension origin, or browser:<name> when headless" }
      label:     { type: TEXT, not_null: true, note: "Chrome / Firefox / Edge, for display" }
      paired_at: { type: INTEGER, not_null: true }

workspace_document:
  items: [Item]
  settings: { grok: bool, compact: bool, robot: bool }
  limit_bytes: 2000000      # a save beyond this is refused with an explanation, not truncated

Item:
  id:        { type: string, note: "deterministic for imports: claude-chat-<uuid>, chatgpt-<id>, chatgpt-<gizmo>" }
  type:      { enum: [chat, project] }
  title:     { type: string, max: 120 }
  provider:  { type: string, from: SITE PROFILE.providers }
  url:       { type: string, note: "validated against SITE PROFILE.provider_hosts; '' allowed for a project" }
  folder:    { type: string, note: "local path, projects only" }
  note:      { type: string, max: 240 }
  pinned:    { type: bool }
  updated:   { type: number, note: "epoch ms, set by whoever wrote it" }
  projectId: { type: string, optional: true, note: "chats only; must name an existing project or is dropped" }
```

## Validation on read

Every load passes through a sanitizer that drops anything malformed rather than trusting the file:
an item needs a string `id`/`title`/`provider`/`url` and a known `type`, and a chat's `url` must
validate against its provider's hosts. Missing scalars are defaulted (`folder`/`note` to `''`,
`pinned` to false, `updated` to 0, `robot` to **true** so an older workspace keeps its look).

## Open decisions

```yaml
open_decisions:
  - id: per-item-rows
    question: When does the single-JSON-row workspace become per-item rows?
    status: prerequisite for most of the roadmap
    why: >
      A blob cannot say when one item changed, cannot merge two writers, and cannot carry a
      tombstone. Every full-workspace write is a race against the companion service — one such
      race already lost imported entries silently. And the 2 MB ceiling is close: the live
      workspace holds 1081 entries today.
    intended_shape:
      items:
        columns: [id PK, type, title, provider, url, folder, note, pinned, updated, project_id,
                  title_edited_by_user, missing_since, origin]
        indexes: [provider, type, project_id, updated]
      tombstones:
        columns: [id PK, deleted_at, reason]
        note: needed for upstream deletes AND for propagating a delete to another client
      settings: { columns: [key PK, value] }
      migration: one-way from the JSON row, with a versioned backup written first
    see: .manage/issue.0006.per-item-storage.md
  - id: shared-vs-overlay
    question: Does an item stay one row when two people both saved the same conversation?
    leaning: >
      Split it. The conversation (provider, uuid, url, upstream title) is shared and collides by
      design; the relationship to it (note, pin, project, local folder) is per person. Without
      that split, "whose note wins" has no answer and a shared workspace cannot be coherent.
    affects: [03]
    see: .manage/issue.0014.shared-workspaces.md
  - id: backup-versioning
    question: Database upgrades and versioned backups — unbuilt, and a prerequisite for any migration.
```
