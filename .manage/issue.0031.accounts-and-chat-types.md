---
issue: 31
title: "Orbit Feature - organize by account and chat type"
state: open
opened: 2026-11-01
closed:
github: https://github.com/xingh/orbit/issues/31
owner: file
arkitype: [02, 03, 04]
prerequisites: [issue.0006.per-item-storage.md]
---

# One index across accounts, and across kinds of chat

## What

As raised:

> so if im logged in with one account vs. another, it can index both in one place so I can find
> them quickly

An entry currently knows its `provider` — `claude`, `chatgpt` — and nothing about **which account
it came from**. Two ChatGPT accounts, or a personal Claude workspace beside a team one, merge into
one undifferentiated list, and there is no way to filter to "my work ChatGPT" or to tell two
same-named projects apart.

## This is already half-true and invisible

The Claude import reads **every organization the session belongs to**, chat-capable first, and
keeps whatever answers — that fix is what stopped imports reporting "signed-out". So entries from
two Claude organizations are already landing in one index with nothing recording which is which.
On the owner's own account one organization is a Console org that serves no chats, which hides the
problem; an account with two real workspaces would show it immediately.

## What it needs

- An `account` on an entry — stable, and **not** an email address. The organization uuid for
  Claude, the account id from `/api/auth/session` for ChatGPT. Principle 2 is about message
  content, but an index that quietly accumulates email addresses is still worth avoiding.
- A display name for it, read from the provider once and stored beside the id, since a uuid is not
  something anyone recognizes in a filter.
- The provider filter in Find and Projects gains accounts under each provider.

Both halves want per-item rows, so this sits behind #6.

## "Chat type"

The second half of the title. Entries are `chat` or `project`; the kinds worth telling apart are
finer — a Claude Code session, a Codex session, a web chat, later a Devin or Lovable thread. #5
already holds the Claude Code and Codex half of that, and its import story is unbuilt. Worth
keeping these together only as far as the field goes: one `account`, one honest `kind`, both set
at import, and the UI reads whichever it needs.

## Ruled out

- **Separate workspaces per account.** The whole request is one place to look. The index stays
  single; the account is a facet of an entry, not a partition of the database.
- **Storing credentials or emails per account.** Orbit never holds a provider credential
  (principle 1), and the session already in the browser is what reads the lists.

## Done when

An entry records which account it came from, Find and Projects can filter by it, and two accounts
on the same provider are distinguishable in the list without opening anything.

---

Raised from Todoist task `6hv8fj6cRFMc54c2`, synced to GitHub as #31.
