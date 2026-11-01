---
issue: 33
title: "Orbit Feature - assign tasks / start chats in the right project across accounts"
state: open
opened: 2026-11-01
closed:
github: https://github.com/xingh/orbit/issues/33
owner: file
arkitype: [03, 04]
prerequisites: [issue.0031.accounts-and-chat-types.md, issue.0035.new-chat-from-a-project-row.md]
---

# Start the work where it belongs, across accounts and tools

## What

As raised:

> From Orbit, assign a task or start a new chat in ChatGPT, Claude, and later Devin, Lovable, etc.,
> directly in the right project. Todoist task registration can come later as a feature.

#35 is the single-provider version: a new-chat control on a project row. This is that control
once there is more than one account (#31) and once a row can stand for several providers' projects
at once (#34) — at which point "start a chat here" has to answer **which one**.

## The question this issue exists to settle

A virtual project `.inbox` may be a Claude project, a ChatGPT project, and later others. Starting
a chat in it is ambiguous, and the ways out are not equal:

```yaml
ask:        a small picker on the row. Honest, one extra click, never wrong.
last_used:  start where that virtual project was last used. Fast, and silently wrong
            the first time it guesses.
preferred:  a per-virtual-project default the user sets once. Needs a place to set it.
```

Worth deciding before either is built, because the picker is cheap and a wrong default is the kind
of thing that gets noticed once and distrusted after.

## Scope, and what is deliberately later

- **Devin, Lovable and other tools** are named in the request as *later*. Each is a provider with a
  launch half and an import half, exactly like `issue.0019` and `issue.0020`, and neither half
  should be guessed at before an endpoint is observed.
- **Todoist task registration** is explicitly later by the request's own words. It is also the
  first time Orbit would **write to a third-party service**, which is a wider step than anything
  the service does today — see principle 4, and the `read-endpoint` decision in
  `.arkitype/03-software.md` for how the last widening was handled.

## Ruled out

- **Submitting the first prompt.** Principle 5, as for #35 and #11.
- **Orbit as a task manager.** The index holds titles, links and the user's own notes. "Assign a
  task" here means starting the work in the right place, not tracking it.

## Done when

From a project row — single or combined — a new chat opens in the chosen account's project, with
the ambiguity resolved by a decision that is written down rather than inferred.

---

Raised from Todoist task `6hvC25PjPgW3wRMR`, synced to GitHub as #33.
