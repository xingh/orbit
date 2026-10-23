---
issue: 13
title: Confirm why 21 of 34 Claude projects import
state: open
opened: 2026-10-23
closed:
github: https://github.com/xingh/orbit/issues/13
owner: file
arkitype: [03]
prerequisites: []
---

# 21 of 34

## What

`/api/organizations/{org}/projects` returned 34 rows on the live account and 21 were imported. The
13 skipped are presumed archived — the scanner drops a row carrying `archived_at` or `is_archived`.
Neither field has been confirmed to exist on these rows.

## Why it matters small, but it matters

If the guess is wrong, 13 real projects are being silently dropped, which is exactly the kind of
quiet partial success that principle 6 exists to prevent.

## How to settle it

Already in place: the import report now records the **field names** of each response's first row
(never values). One import, one **Copy import report**, and the question is answered without
touching anyone's account.

## Done when

Either the archive fields are confirmed present — in which case record it in
`.knowledge/provider.web.endpoints.md` and close this — or the skip condition is corrected and all
34 arrive.
