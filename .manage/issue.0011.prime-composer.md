---
issue: 11
title: Send a prompt to a found chat — prime the composer, never submit
state: open
opened: 2026-10-23
closed:
github: https://github.com/xingh/orbit/issues/11
owner: file
arkitype: [03, 04]
prerequisites: []
---

# Prime a chat from Orbit

## What

From a found entry in Orbit, open that conversation with a prompt already typed into its composer.
Orbit does not press send.

```yaml
new_chat:
  how: a URL parameter — claude.ai/new?q=... and chatgpt.com/?q=...
  cost: nothing; no extension involved
  status: unverified here, undocumented upstream. One manual click settles each.
existing_thread:
  how: >
    the extension opens or focuses the tab, waits for the composer, and inserts the text. Both
    composers are contenteditable rich-text editors, so this is an input event the editor accepts,
    not setting .value.
  already_in_place: host permissions for both sites, the `scripting` permission, and background.js
                    already opens a provider tab inactive and closes it again for the import fallback
ui: >
  in Find, the row you have landed on takes the prompt inline — Ctrl+K, type to find the chat,
  then `>` and the text. No modal.
```

## Why it matters

It turns Orbit from a bookmark list into somewhere you start work. The tab opens **inactive**, so
the answer is waiting when you switch to it — "queue a question at a chat and come back" is the
actual feature.

## Ruled out

**Submitting.** Decided 2026-10-23: *"lets not prime the chat directly from the widget and hit run,
maybe if it primes it and stays put that could be useful."* See knowledge principle 5 for the
reasoning — quota, the wrong window, and the fact that the send control is the most redesign-prone
part of the page. This also makes the feature *navigation* rather than automation, with the same
mental model for a new chat and an existing one.

**Doing it without a browser.** That means calling model APIs, which means API keys and a bill.
Knowledge principle 1.

## Two rules that make it tolerable

- **Degrade, never guess.** If the composer cannot be found after a redesign, do not click
  something else — report it. "It's typed, press Enter" is a fine failure.
- **Never clobber a draft.** If the composer already has text, stop.

## Done when

A prompt typed in Find lands in the right composer, unsent, in both providers, in a tab that was
already open and in one that was not; and a deliberately wrong selector reports rather than acts.
