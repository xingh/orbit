---
issue: 8
title: A chat renamed at the provider should update in Orbit
state: done
opened: 2026-10-23
closed:
github: https://github.com/xingh/orbit/issues/8
owner: file
arkitype: [02, 03]
prerequisites: []
---

# Upstream renames

## What

Rename a conversation or a project at the provider and Orbit kept the old title forever. A
re-import reported it as `skipped` and changed nothing.

Measured on the live workspace on 2026-11-01, before the fix: **28 of 64 projects** carried a name
the provider no longer used — 10 of 30 on Claude, 18 of 34 on ChatGPT. Nothing was wrong with the
import; it simply had no rule for this.

## What now happens

`merge_chats` compares the incoming title with the stored one and takes the incoming one. The
result is reported separately from `skipped`, as `renamed`, and the popup says so: "Renamed 28."

This is the owner's decision of 2026-11-01, recorded as `mirror-not-archive` in
`.arkitype/03-software.md`: the index shows what is at the provider now, not what was there.

## Ruled out, and why

- **Waiting for `title_edited_by_user`.** This file used to argue that overwriting a title needs a
  flag distinguishing "the user renamed it" from "the provider renamed it", and that the flag
  belonged to `issue.0006.per-item-storage.md`. That held the fix behind a storage migration for a
  distinction nothing can yet create: **Orbit has no way to edit a saved title.** The create modal
  types one, and `note` is the field for the user's own words. So the flag would always be unset,
  and the rule it guards would always say "refresh".
- **Keeping a hand-typed title for an entry the provider also lists.** A chat saved through the
  modal does carry a title the user typed, and an import of that same chat now replaces it. That is
  the cost of mirroring, it was asked for, and `note` survives untouched. Revisit when editing a
  title in Orbit exists — then this needs the flag after all, and `prerequisites` gets
  `issue.0006` back.

## Done when

- [x] A project renamed upstream shows its new title after an import.
- [x] A re-import of an unchanged list reports 0 renamed, not N.
- [x] Verified against the owner's live data, 2026-11-01: **498 titles refreshed** — 470 chats
      and all 28 projects. `title` was the only field that changed on any entry.

## Note on chats

The same rule applies to chats and needs nothing extra, since renames ride the normal batches.
It is the *sweep* that is restricted to projects — see `issue.0009.upstream-deletes.md`.
