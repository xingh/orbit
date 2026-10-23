---
issue: 9
title: A chat deleted or archived at the provider should not linger forever
state: open
opened: 2026-10-23
closed:
github: https://github.com/xingh/orbit/issues/9
arkitype: [02, 03, 04]
prerequisites: [issue.0006.per-item-storage.md]
---

# Upstream deletes and archives

## What

Delete a conversation at the provider and it stays in Orbit permanently; its link 404s when
clicked. Archive it and the same is true. The import is purely additive and never reconciles.
Archived Claude projects are skipped *at scan time*, so one archived after import just lingers.

## The dangerous part

The obvious implementation is the data-loss bug waiting to happen:

> **Never reconcile on a partial sweep.** A 403 from one organization, a dropped page, a 429, an
> expired token — any of these make a list look empty or short. Deleting what is "missing" from
> such a sweep removes hundreds of good entries and reports success.

So:

1. A scanner must be able to assert *this list was walked to the end, completely* — a positive
   signal, not the absence of an error.
2. Even then, absentees are **marked, not deleted**: a `missingSince` date, shown greyed as "no
   longer at Claude", removable in bulk by the user.
3. The same marking and tombstone mechanism is what a shared or remote workspace needs to
   propagate a delete, so it is worth building once and properly.

## Why it matters

Beyond tidiness: a stale index that silently 404s teaches the user not to trust Find, which is the
feature.

## Ruled out

Deleting on absence. Also ruled out: treating an empty list as "everything was deleted" — that is
the specific shape of the catastrophe.

## Done when

A conversation deleted upstream is marked after a complete sweep, a deliberately failed sweep marks
nothing, and the user can clear all marked entries in one action.
