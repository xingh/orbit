---
issue: 20
title: Grok beyond opening the website — backlog, potential
state: open
opened: 2026-10-23
closed:
github: https://github.com/xingh/orbit/issues/20
owner: file
arkitype: [03, 04]
prerequisites: []
---

# Grok beyond opening the website

## What

A potential provider extension, held in the backlog. It is not scheduled: the focus is ChatGPT and
Claude.

Grok already opens from New chat behind the **Show Grok** setting, and its links validate. It
cannot be imported: no list endpoint is known (`.knowledge/provider.web.endpoints.md`, Grok). This
is the entry for the rest of it — Grok conversations in the history import and saved from the
extension like Claude and ChatGPT chats.

## Why it matters

Without import, Grok chats exist in Orbit only if saved one at a time, so Find is blind to most of
them. It matters only to someone who uses Grok heavily, which is why it waits.

## Ruled out

- An xAI API key or the xAI API. Principle 1.
- A Grok bot, or anything that acts inside Grok for the user. Principle 5; dropped in conversation.
- Building an importer against a guessed endpoint. Principle 6.
- Scheduling it ahead of the ChatGPT and Claude work.

## Done when

A list endpoint has been observed from the user's own session and recorded, the scanner reads it
with the same loud failures as the others, and Grok chats import with working links.
