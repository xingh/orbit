---
issue: draft
title: Local bot API and MCP over the Orbit index (central multi-user later)
state: open
opened: 2026-10-29
closed:
github:
owner: file
arkitype: [01, 03, 04]
prerequisites: [issue.0007.workspace-api.md, issue.0014.shared-workspaces.md]
---

# Orbit index API + MCP (local bots, then central multi-user)

## What

Expose Orbit's **index** (search, save metadata, list projects, open/prime intents) as:

1. A **local machine bot API** on loopback — same trust model as today's companion (paired
   caller / token), consumed by local coding agents and automation.
2. An **MCP server** facade over that API so Claude Code, Cursor, Codex, and similar can
   *search and annotate the index* without Orbit calling any model API.
3. The **same surface on a central deployment** when a shared workspace is running — per-user
   credentials, membership, and ACLs from issue 14. Multi-user management is the central mode,
   not a wider bind of the desktop companion.

```text
Local (default)                         Central (chosen server)
┌─────────────────────┐                 ┌──────────────────────────┐
│ Orbit app + SQLite  │                 │ Workspace server         │
│ loopback bot API    │◄── MCP client   │ TLS + per-user auth      │
│ MCP stdio/HTTP local│   (Claude Code, │ MCP or HTTP for members  │
│ extension still     │    Cursor, …)   │ shared thread search     │
│ pairs for saves     │                 │ access-request tools     │
└─────────────────────┘                 └──────────────────────────┘
```

## Why it matters

Shared orbits only pay off if people and **their local bots** can find the same thread index.
MCP is how those bots already expect to talk to tools. Doing it as an index API keeps principle 1
(no Orbit-held model keys) and principle 2 (no message bodies). Centrally, the same contract is
how a team admin manages multi-user search and "request to share more" without a second product.

## Tools / endpoints (sketch)

Index only — titles, urls, ids, projects, user notes, visibility:

| Tool / route | Local | Central |
| --- | --- | --- |
| `search_threads` | own workspace | union of memberships + ACL |
| `get_entry` / `list_projects` | own | if visible |
| `save_entry` / `annotate` | own overlay | editor role |
| `open_or_prime` | hand off to desktop/extension (never submit) | same, on caller's machine |
| `request_access` | n/a or self | creates request on target project/entry |
| `list_access_requests` / `resolve_access_request` | n/a | owner/admin |

Ruled out as tools: `get_messages`, `recall_memory`, `embed`, anything that needs a provider API
key inside Orbit.

## Relationship to the existing companion

The current companion (`127.0.0.1`, pair token, extension-only writes) stays for **browser saves**.
Issue 7 already says not to widen that service into the workspace API. The bot/MCP layer should
consume **workspace-api** (issue 7), not become a second write path that races the blob.

Local MCP may speak stdio to one agent, or loopback HTTP to several — both are still on-box.
Central MCP is authenticated per user against the shared server.

## Ruled out

- MCP **memory vault** that injects documents/chat bodies into the model (Konotree / competitor
  lane). See `issue.draft.shared-memory-competitor-steals.md`.
- Orbit holding cloud LLM API keys or proxying completions (principle 1).
- Binding the desktop companion's pair-token service to LAN/WAN (principle 4 / issue 14).
- Agents submitting prompts through Orbit (principle 5). `open_or_prime` prepares only.

## Done when

- Locally: an MCP client can search the user's Orbit index and receive titles/links/notes; a save
  annotation round-trips into the app.
- Centrally (after 14): two users' agents search the shared visible index; one can file
  `request_access` and, after approval, see the newly granted threads.
- No tool returns message content; docs state that loudly.
