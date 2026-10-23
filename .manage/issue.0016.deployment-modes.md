---
issue: 16
title: Deployment modes — basic (local SQLite) and advanced (Postgres, hosted)
state: open
opened: 2026-10-23
closed:
github: https://github.com/xingh/orbit/issues/16
owner: file
arkitype: [01, 02]
prerequisites: [issue.0007.workspace-api.md]
---

# Deployment modes

## What

Two tiers, named plainly. **Basic** is local SQLite and stays complete on its own. **Advanced** is
Postgres-backed and hosted, and is where anything needing a server lives.

```yaml
basic:
  storage: SQLite in the user's app data
  reach: loopback only, paired browsers on the same machine
  status: built
  note: >
    This mode must never become a trial version of the others. No embeddings, no model keys, no
    background services — literal search over titles and notes, and that is enough.
advanced_compose:
  shape: >
    A docker-compose.yml anyone can copy and paste: the service image + the web app, pointed at a
    database it brings up itself or at one that already exists.
  storage: Postgres
  reach: whatever network the operator puts it on
advanced_paas:
  shape: one-click deploy to Vercel / Railway / Fly and similar
  storage: a managed Postgres — Supabase is the obvious candidate
  note: >
    Supabase brings auth and row-level security, which is most of what a shared workspace needs,
    and pgvector, which opens semantic search (see below).
```

The arkitype method already frames infrastructure as exactly this pair — "Mode A local Docker
Compose" and "Mode B existing hosted endpoints" — so `01-infrastructure.md` should grow both
specifications rather than describing only the desktop.

## Why it matters

It is the path from "an app on my machine" to "a thing other people can run", and it is what makes
shared workspaces and a mobile client reachable without hosting anything on the owner's behalf.
One-click deploy also means the owner never holds someone else's data.

## Vector search — advanced only

Semantic search belongs to the Postgres tier and nowhere else.

```yaml
why_not_in_basic:
  extension_exists: >
    SQLite can do vector search — sqlite-vec is the current extension for it. So the storage side
    is not the obstacle.
  the_actual_obstacle: >
    Embeddings need an embedding model. That means either an API key, which knowledge principle 1
    forbids Orbit from asking for, or a local runtime such as Ollama, which is a multi-gigabyte
    dependency for a 20 MB companion app. Neither belongs in the mode whose promise is "it just
    works on your machine".
  decision: 2026-10-23 — basic mode stays literal search. Not a limitation to fix later.
in_advanced:
  storage: pgvector, available in Supabase and in any Postgres the operator brings
  embedding_provider: an operator-configured deployment setting, not a prompt the end user sees
  ceiling: >
    Orbit stores titles, notes and links, never message content (principle 2), so embeddings are
    over a title and a sentence of context. "the thing about robot camera rings" finding a chat
    called "panoramic lens array" is a real improvement over substring matching. It is NOT search
    over conversations and must never be described as such.
```

## Ruled out

- **Making the hosted mode the default or the recommended one.** Local-first is the reason to
  trust Orbit (knowledge principle 3). Basic is the product; advanced is a choice.
- **Vector search, model keys or a bundled local model in basic mode.** See above.

## Done when

Backlogged — this is an idea captured deliberately, not scheduled work. The next concrete step is
`issue.0007.workspace-api.md`, without which none of these modes can share a client.
