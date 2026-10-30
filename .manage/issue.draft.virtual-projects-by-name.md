---
issue: draft
title: Virtual projects — same name across agents (.inbox, rd/tekt, …)
state: open
opened: 2026-10-29
closed:
github:
owner: file
arkitype: [02, 03, 04]
prerequisites: [issue.0006.per-item-storage.md, issue.0007.workspace-api.md]
---

# Virtual projects by shared naming convention

## What

When the same **project path/name** exists in different agents (Claude project, ChatGPT
project, later code-tool spaces), Orbit shows one **virtual project** that unions the chats
(and native project rows) filed under that name — e.g. all `.inbox` folders across agents,
or all `rd/tekt/arkitype`.

The upstream objects stay separate (one link per provider). The virtual project is a **view**
over the index, keyed by a normalized name — not a merged transcript and not a new SaaS project.

This is how the **organizer skill** (align people’s agents to one slash-separated naming
convention: `.inbox`, `.projects`, `rd/…`, `gtm/…`, `kb/…`, …) pays off inside Orbit: once
names match, virtual projects just work.

```text
Claude  .inbox  ─┐
ChatGPT .inbox  ─┼─►  Virtual project ".inbox"  →  all chats under those project ids
Grok    .inbox  ─┘         (titles + links only)
```

## Why it matters

People already organize the same work in parallel tools. Without a virtual layer, Orbit’s
Projects view is provider-siloed even when titles match. With it, “open .inbox” means every
inbox thread across agents — the order problem Orbit is for — and a team that shares the
organizer convention sees the same virtual shelves (especially once #14 joins orbits).

## Normalization (first cut)

```yaml
canonical_key:
  rules:
    - trim
    - lowercase
    - collapse internal whitespace to single spaces then to '-' OR prefer slash paths as-is
    - no spaces around '/'
    - preserve leading-dot control projects (.inbox, .projects, .areas, .reference, .archive)
  source_of_name:
    - preferred: upstream project title from import (Claude/ChatGPT project name)
    - fallback: Orbit project item title the chat is filed under
    - optional later: explicit alias map if two spellings must merge without renaming upstream
  non_goals:
    - fuzzy merge of "Inbox" vs ".inbox" without an alias — organizer skill keeps names aligned;
      Orbit should not invent merges that undo the convention
```

Align with the naming standard already used in the ChatGPT/Claude organizer plans: lowercase
slash-separated paths; leading-dot control projects preserved.

## Data shape

Today a chat has `projectId` pointing at one Orbit project row (itself provider-scoped). Virtual
projects need either:

1. **Derived view** — group project rows (and their chats) whose `canonical_key(title)` matches;
   UI opens a virtual detail that lists members by provider; or
2. **Alias table** — `canonical_key → [project_item_ids]` for explicit joins when titles differ.

Start with (1). Add (2) only when the organizer cannot rename upstream.

Shared vs overlay (#14 / 02-database): the canonical key is shared identity for the *shelf*;
per-person pin/note on the virtual shelf stays overlay.

## UX

- Projects list can toggle **By tool** (today) vs **Virtual** (grouped by canonical key).
- Virtual detail: sections or filters per provider; each row still opens that agent’s URL.
- Find: query hits chats under any member project of the virtual key.
- New-tab / extension Find (#10 / new-tab draft): same virtual shelves — “`.inbox` across agents”.
- Organizer skill (external): remains the writer of upstream names; Orbit consumes the result.

## Team / multi-agent

Once people join an orbit (#14) and share the naming convention, virtual `.inbox` is the shared
shelf of everyone’s inbox-classified chats (still titles/links; each opens in *their* session).
Access requests apply to member projects as today.

## Ruled out

- Creating a real project inside Claude/ChatGPT from Orbit (Orbit does not act as the user on
  providers beyond open/prime — principle 5).
- Merging or syncing message content across agents.
- Auto-fuzzy renaming that fights the organizer skill (“Inbox” ≈ “.inbox” without an alias).
- Sticky notes on arbitrary URLs (Linkwarden / Konotree) — virtual projects are chat/project
  index shelves only.

## Related

- Cross-provider “same work” cards in `issue.draft.shared-memory-competitor-steals.md` (A.1) —
  thread-level; this draft is **project-level** shelves.
- Extension new-tab Find — should list virtual projects once this exists.
- Organizer skill / Auto.Organizer plans — produce the naming; Orbit displays the alignment.

## Done when

- Two imported projects with the same canonical name on different providers appear as one
  virtual project listing chats from both.
- `.inbox` (and other leading-dot controls) work as virtual shelves without special-casing
  beyond normalization.
- Split into a filed issue when syncing; alias table only if a real dual-spelling case appears.
