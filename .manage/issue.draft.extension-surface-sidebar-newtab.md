---
issue: draft
title: Extension surface — new-tab Find for chats/projects (not sticky notes on links)
state: open
opened: 2026-10-29
closed:
github:
owner: file
arkitype: [03, 04]
prerequisites: [issue.0007.workspace-api.md, issue.0010.extension-search.md]
---

# Extension surface: bring order to chats and projects you already use

## Audience (locked)

Orbit is for people who need **order over chats and projects inside the AI tools they already
pay for** (Claude, ChatGPT, Grok, and later code tools). Save, find, file under projects, open
again — titles and links only.

**Not** sticky notes on arbitrary links. That job is **Linkwarden inside a Konotree config**. Do
not recreate it in the Orbit extension, sidebar, or new tab.

Humble's browser product ([humbleai.com/browser](https://humbleai.com/browser/)) was reviewed as a
contrast: sidebar beside every page for notes/tasks/CRM, with AI-chat linking as one use case.
Useful reference for "link not body"; wrong product shape for Orbit.

## Recommendation

| Surface | Verdict | Why |
| --- | --- | --- |
| **Popup Find (#10)** | **Ship first** | Same place people already save a chat; smallest read-API consumer. |
| **Optional new-tab Orbit home** | **Yes — second** | Search across your orbit + most frequent / recent / pinned chats and projects. Blank tab = "bring order" moment without sitting on a provider page. |
| **Side panel** | **Later, provider-only** | On Claude/ChatGPT/Grok: save this chat, project siblings, jump to Find. Never a web-wide notes rail. |

### Why new tab fits this audience

1. The object is the **chat/project index**, not bookmarks-with-notes (Linkwarden/Konotree).
2. Frequent and project-filed threads need dense list room — new tab matches Find in 04-interface.
3. Works when you are hunting a thread and are not already inside a provider tab.
4. Desktop companion stays the always-on robot; new tab is browser-native Find over the same index.

### New tab v1

```yaml
new_tab:
  purpose: order and reopen chats/projects you already use
  optional: true
  shows:
    - search → workspace-api (issue 10 shape)
    - most frequent chats (open/save signal after #6; until then recent + pinned)
    - projects and chats filed under them
    - provider filter
    - open provider URL / new chat shortcuts
  when_orbit_down: loud status (principle 6); optional cached titles+links only
  never:
    - sticky notes on arbitrary URLs
    - Linkwarden-style bookmark collections
    - message bodies, embeddings, a second cloud account for notes
```

### Provider side panel later (still not Linkwarden)

```yaml
side_panel:
  hosts: [claude.ai, chatgpt.com, grok.com]
  shows: [save this chat, project siblings, open Find]
  does_not: [notes on any URL, green-badge for the open web, task/person graphs]
```

## Ruled out

- Sticky notes / annotations on links — **Linkwarden + Konotree**, not Orbit.
- Humble-style every-page sidebar for CRM or general web context.
- Replacing the desktop companion with extension-only UX.
- Shipping new tab or side panel before workspace-api read (#7) and popup Find (#10).
- Mandatory new-tab takeover with no disable.

## Suggested issue split when syncing

1. Keep #10 as popup Find + start chat (provider chats/projects only).
2. File `extension-new-tab-find` — optional newtab; frequent/recent/projects; depends on #7/#10.
3. File `extension-provider-sidepanel` — optional; provider hosts only; after new tab.

## Done when

Positioning above is reflected in filed issues (or declined surfaces). Popup Find → optional new
tab → provider side panel remains the order of attack.
