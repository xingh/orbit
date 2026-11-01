---
issue: 35
title: "Orbit Feature : start chat on a project"
state: open
opened: 2026-11-01
closed:
github: https://github.com/xingh/orbit/issues/35
owner: file
arkitype: [03, 04]
prerequisites: []
---

# Start a chat inside a project, from its row

## What

As raised:

> In the project list, clicking a project opens it there. Each project row also gets a plus sign or
> chat icon that starts a new chat inside that project.

Today a project row opens the project at the provider. Starting a chat *in* that project means
opening it and then clicking New chat there — Orbit knows which project it is and drops the user
one step short.

## What it needs

A per-provider URL that opens a composer already scoped to a project. The row already holds
everything the URL needs — provider and project id — and `src/providers.mjs` is where the shape
belongs, beside `validateChatUrl`, so the window and the extension agree on it.

The two shapes to confirm are `https://claude.ai/project/<uuid>` and ChatGPT's gizmo URL; whether
either opens a composer directly, or only the project page, is the whole of the question. **It can
only be confirmed signed in**, which puts the verification in the same bucket as #11.

## Ruled out

- **Sending the first message.** Principle 5: Orbit fills a composer and never submits. This opens
  a composer in a project; it does not start a conversation.
- **Creating a project at the provider.** Orbit indexes; it does not manage the provider's own
  objects. Creating one is how an index starts writing upstream, and that is a different decision.

## Note

Pairs with #33, which is the same action aimed at a *virtual* project — once a row can be several
providers' projects at once (#34), "start a chat here" has to ask which one, or pick by rule.

## Done when

A project row carries a new-chat control that opens a composer in that project at its provider,
with nothing submitted.
