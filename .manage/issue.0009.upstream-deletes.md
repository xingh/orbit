---
issue: 9
title: A chat deleted or archived at the provider should not linger forever
state: in-progress
opened: 2026-10-23
closed:
github: https://github.com/xingh/orbit/issues/9
owner: file
arkitype: [02, 03, 04]
prerequisites: []
---

# Upstream deletes and archives

## What

Delete a project or conversation at the provider and it stayed in Orbit permanently; its link 404s
when clicked. Archive it and the same was true — archived Claude projects are skipped *at scan
time*, so one archived after import just lingered.

On the live workspace, 2026-11-01: 2 of 30 Claude projects no longer existed upstream.

## What now happens, and the shape that makes it safe

A scanner may declare `sweeps: { provider, type }`. After its batches are sent, the extension posts
one more request — `{ items: [], sweep: { provider, type, ids } }` — carrying every id in the list
it just read. The service removes its other entries of that provider and kind, and reports
`removed`. A chat that was filed under a project the sweep removed has its `projectId` cleared, so
the index keeps its invariant.

The danger this had to survive is unchanged, and is still the reason for most of the design:

> **Never reconcile on a partial sweep.** A 403 from one organization, a dropped page, a 429, an
> expired token — any of these make a list look empty or short. Deleting what is "missing" from
> such a sweep removes hundreds of good entries and reports success.

Four things stand between a short read and that:

1. **Scope.** A sweep names one provider and one kind. It can never reach another provider's
   entries, a chat, or anything saved by hand for a provider that was not swept.
2. **A sweep must carry ids.** An empty list is refused outright — that is the shape a failed read
   takes, never a real empty list.
3. **A ceiling.** The service refuses a sweep that would remove more than a third of what it can
   see for that pair, unless the pair holds 8 entries or fewer. The refusal is returned as
   `refused`, surfaced as a problem in the popup, and nothing is written.
4. **Only the project lists sweep.** Both come back in a single short read. The chat lists are
   walked by `offset` over a list the provider orders by *recency*: a chat updated mid-walk shifts
   pages and is simply never seen, so sweeping on that would delete conversations that still exist.

## Ruled out, and why

- **Tombstones, `missingSince`, and a greyed "no longer at Claude" row.** This was the design here
  until 2026-11-01, and it was superseded by the owner: "make sure that the user sees what's there,
  not what was there, so deleted / archived are not to be worried about in orbit." An entry whose
  link 404s is worse than no entry. Recorded as `mirror-not-archive` in
  `.arkitype/03-software.md`.
- **Waiting for `issue.0006.per-item-storage.md`.** Tombstones needed per-item rows. Removal does
  not, so this no longer waits.
- **Treating an empty list as "everything was deleted."** Rule 2. That is the specific shape of the
  catastrophe.
- **Deleting on absence from a chat list.** Rule 4, and the reason is the paging, not caution.

## What is left

- [x] Projects deleted or archived upstream are removed by an import.
- [x] A short read is refused whole, and says so.
- [ ] Chats. Needs a chat list that can be read completely — either a cursor the provider
      guarantees, or two consecutive sweeps that agree before either is applied.
- [x] Verified against the owner's live data, 2026-11-01: `kb/tekt.skills` and
      `observe.gather.report` removed, 1140 -> 1138 entries, 30 -> 28 Claude projects,
      matching claude.ai exactly. All eight workspace integrity checks still pass, so the
      two chats those projects held were unfiled rather than left dangling.

## Done when

A project deleted upstream is gone from Orbit after an import, a deliberately shortened list
removes nothing and reports why, and the same holds for conversations.
