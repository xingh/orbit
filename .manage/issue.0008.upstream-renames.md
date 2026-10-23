---
issue: 8
title: A chat renamed at the provider should update in Orbit
state: open
opened: 2026-10-23
closed:
github: https://github.com/xingh/orbit/issues/8
arkitype: [02, 03]
prerequisites: [issue.0006.per-item-storage.md]
---

# Upstream renames

## What

Rename a conversation on claude.ai and Orbit keeps the old title forever. A re-import reports it as
`skipped` and changes nothing.

## Why it is not simply "overwrite the title"

"Nothing is overwritten" is what protects a title the user edited themselves. The fix needs a
distinction the data model does not have: *the user renamed it* (keep) versus *the provider renamed
it* (refresh). One flag per entry, set when a title is edited in Orbit, and the rule becomes
"refresh when the flag is unset and the title differs".

The `title_edited_by_user` column is already in the intended schema in
`issue.0006.per-item-storage.md` for this reason.

## Note

Editing a saved chat's title in Orbit is itself unbuilt — it is on the README roadmap as "Edit saved
chats and re-link moved project folders". Until it exists the flag is always unset, so the simple
behaviour (always refresh) is correct in the interim. Build the flag anyway; it costs nothing now
and avoids a migration later.

## Done when

A conversation renamed upstream shows its new title after an import, and a title edited in Orbit
survives one.
