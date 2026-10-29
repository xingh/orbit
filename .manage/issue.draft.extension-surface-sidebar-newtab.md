---
issue: draft
title: Extension surface — Humble-style sidebar vs Orbit new-tab Find
state: open
opened: 2026-10-29
closed:
github:
owner: file
arkitype: [03, 04]
prerequisites: [issue.0007.workspace-api.md, issue.0010.extension-search.md]
---

# Extension surface after Humble: sidebar, new tab, or both?

## What Humble does (reviewed)

Humble's browser product is a **sidebar beside every page** ([humbleai.com/browser](https://humbleai.com/browser/)):

- Sticky notes / tasks linked to the current URL (LinkedIn, Gmail, docs, AI chats).
- Icon goes green when the page already has related Humble items.
- Same gesture to link a ChatGPT/Claude/Gemini chat to a *task or person* — stores a **link**, not the transcript.
- Find scoped to this page, this site, or everything.
- Value prop is CRM/work context everywhere; AI chat linking is one use case among many.

Orbit's extension today is a **toolbar popup**: pair, save this chat, import titles/links. Find lives in the desktop companion. Issue 10 already asks for search/start in the popup once a read route exists (#7).

## Recommendation

| Surface | Verdict | Why |
| --- | --- | --- |
| **Popup Find (#10)** | **Ship first** | Same place people already save; smallest read-API consumer; no new chrome permission story. |
| **Optional new-tab Orbit home** | **Yes — second** | Best fit for "search across your orbit + most frequent chats." A blank tab is an intentional find moment; Humble does not own this. |
| **Side panel (Humble-like)** | **Later, provider-scoped** | Useful on Claude/ChatGPT/Grok for "related to this chat / save / project siblings." Do **not** become a every-page notes/CRM sidebar — that is Humble/Konotree territory and fights the floating companion. |

### Why new tab beats copying Humble's sidebar for Orbit

1. Orbit's primary object is the **index of chats/projects**, not notes-on-arbitrary-URLs. New tab = search the index. Sidebar-on-every-page = sticky context for the open URL — Humble's product.
2. Frequent / recent / pinned chats need **horizontal room** (dense list like Find in 04-interface). A new tab can match desktop density; a narrow side panel fights it.
3. New tab works even when you are not already on a provider page — the moment you are hunting "where was that thread."
4. Desktop companion stays the always-on robot; new tab is the browser-native Find. Two surfaces, one read API.

### What the new tab should show (v1)

```yaml
new_tab:
  optional: true          # preference; do not force-replace without an off switch
  when_orbit_up:
    - search box → workspace-api query (issue 10 shape)
    - most frequent chats (open/save count or recency-weighted)
    - recent + pinned
    - provider filter
    - one click opens the provider URL in this browser
    - new chat shortcuts (providers.js URLs)
  when_orbit_down:
    - loud status (principle 6)
    - last cached frequent/recent titles+links if we choose to cache; never message bodies
  never:
    - message content, embeddings, or a second cloud account
```

"Most frequent" needs a cheap local signal after #6 (open events and/or save bumps). Until then, **recent + pinned** is enough and still useful.

### What a later side panel should be (not Humble)

```yaml
side_panel:
  hosts: [claude.ai, chatgpt.com, grok.com]   # not the whole web
  shows:
    - save / update this chat (today's popup job)
    - project siblings and related index hits for this URL
    - jump to new-tab Find or desktop Find
  does_not:
    - notes on LinkedIn/Gmail/CRM
    - green-badge for arbitrary sites
    - task/person graph
```

Chrome `sidePanel` API is fine for MV3; keep Firefox path as popup + new tab if side panel support lags.

## Steal from Humble (shape only)

- **Link, don't copy chat bodies** — already Orbit principle 2; keep saying it in the UI.
- **Affordance when this page is already known** — badge or status on provider tabs when the URL is in the index (after read API). Do not require a full sidebar for that.
- **Same gesture everywhere you care about** — for Orbit that is provider pages + new tab + popup, not the entire web.

## Ruled out

- Replacing the desktop companion with a sidebar-only product.
- Humble-style every-page notes/tasks/CRM in the Orbit extension.
- Shipping side panel or new tab **before** workspace-api read (#7) and popup Find (#10).
- A mandatory new-tab takeover with no disable.

## Suggested issue split when syncing

1. Keep #10 as popup Find + start chat.
2. File `extension-new-tab-find` — optional chrome_url_overrides newtab; frequent/recent; depends on #7/#10.
3. File `extension-provider-sidepanel` — optional; provider hosts only; after new tab proves the read UX.

## Done when

This draft is accepted or amended in ROADMAP, and the chosen surfaces are filed as issues (or explicitly declined). Until sync, treat popup Find → optional new tab → provider side panel as the order of attack.
