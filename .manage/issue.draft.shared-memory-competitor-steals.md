---
issue: draft
title: Steal index-side features from ChatGPT/Claude shared-memory apps
state: open
opened: 2026-10-29
closed:
github:
owner: file
arkitype: [02, 03, 04]
prerequisites: [issue.0006.per-item-storage.md, issue.0007.workspace-api.md, issue.0011.prime-composer.md, issue.0014.shared-workspaces.md]
---

# Shared-memory competitors → Orbit feature steals

Reviewed 2026-10-29. Sources: [Memocore](https://memocore.ai/), [HeyBrain](https://heybrain.io/platform/ai-memory), [SharedMemory](https://sharedmemory.ai/), [Memava](https://memava.com/), [GBrain](https://gbrain.io/memory/features/every-assistant). Sync to GitHub issues later; this file is the intake.

These products sell **one memory every AI can read/write** (usually MCP + cloud vault). Orbit is **not** that product. Orbit stays an index of titles, links, dates, projects, and the user's own notes — principles 1–2. Konotree (and tekt) cover shared knowledge content. The steals below are UX and collaboration patterns that strengthen Orbit *as an index companion*, without becoming a memory server.

## What they do (compressed)

| Product | Hook | Mechanism Orbit must not copy |
| --- | --- | --- |
| Memocore | Switch ChatGPT↔Claude without re-explaining; team projects; public followable projects | Cloud memos injected into chats via MCP |
| HeyBrain | Same answer in every tool, with **citations** and permission boundaries | RAG over Drive/Notion into the model |
| SharedMemory | Company brain → answer + confidence + procedures | Knowledge graph over Slack/docs/agents |
| Memava | Vault of markdown; per-AI member; **tap to approve**; author/undo history | MCP read/write of note content; mail/calendar agent |
| GBrain | One folder of notes, Read vs Full per AI, correct once → every AI updated | Semantic memory MCP shared across assistants |

## Steal — proposed Orbit features

Split later into numbered issues when syncing. Each maps to an existing roadmap neighbour where possible.

### A. Cross-provider continuity (Memocore / GBrain / HeyBrain)

1. **Same work, both providers.** Surface Claude + ChatGPT entries that share a project (or a user-chosen link) as one "work thread" in Find — still two links, one card. Rules out merging transcripts.
2. **Continue in the other provider.** From a saved chat, open the *other* provider's new chat with the composer primed from the **Orbit note / project blurb** (issue 11), never from message bodies.
3. **Correct the index once.** Rename, re-project, or annotate locally; every view and (later) shared workspace sees it. Upstream title refresh stays issue 8.

### B. Project as the social unit (Memocore / SharedMemory)

4. **Project activity strip.** On a project: recent saves, who added them (local user or shared member), last opened — titles only. Feeds issue 14's "index of what the team is working on".
5. **Structured project fields (light).** Optional status / owner / next-step on the project itself (not chat content). Steal Memocore's "tables" idea as three fields, not a spreadsheet product.
6. **Followable / joinable project index.** Team space first (issue 14 fork #1). Public "follow this orbit project" stays backlog until membership works; do not build federation early.

### C. Citation-shaped navigation (HeyBrain)

7. **Why this hit.** Find results show match basis: title, note, project name — and one-click open the provider URL. Steal "open the citation"; the citation *is* the chat link.
8. **Pick up where I left off.** Recents per provider + "open items" filtered by project field or note tag (`open` / `parked` / `decision`), not by parsing chat text.

### D. Note types as cheap memory (Memocore decisions / SharedMemory procedures)

9. **Typed notes on entries.** Tags or a small enum on the user's note: `decision`, `open`, `context`, `parked`. Search and project filters use them. The note remains user-authored text; Orbit never extracts decisions from the transcript.
10. **Decision with reason.** Template when saving: "Decided X because Y" into the note field — a prompt in the UI, not model-generated memory.

### E. Shared workspace permissions (HeyBrain / GBrain / Memava)

11. **Viewer vs editor** on a shared orbit (issue 14): viewers see titles/links; editors can add/save/annotate. Per-person overlay for pins and private notes (already called out in 02-database / issue 14).
12. **Per-member attribution.** Who saved or last touched an index row; activity is human (and which browser/extension), never "which model wrote the memory".
13. **Access record (optional, later).** When a shared member opens or searches, log requester + entry id locally on the server — useful for teams, still no message content.

### F. Trust and export (Memava / GBrain / principles 3 & 5)

14. **Export the index.** Markdown or CSV of titles, urls, projects, notes, dates — "files you can open". Aligns with never locked in; still not a vault of chat bodies.
15. **Tap language on prime.** Keep principle 5; borrow Memava's clarity: Orbit prepares the composer and **waits** — never sends. Marketing and in-app copy should say that out loud.
16. **Duplicate / conflict nudge.** If two providers have near-identical titles under one project, offer "same work?" linking — SharedMemory's conflict idea, applied to the index only.

### G. Onboarding and briefs (Memocore / Memava)

17. **Team open-work brief.** For a shared workspace: "what the team saved this week" as a local/server list of titles — the safe half of Memocore's new-hire story.
18. **Morning recents.** Single-user: chats saved or opened since yesterday, by project. No LLM summary.

## Ruled out (do not file as Orbit features)

- MCP memory server, cloud memo injection, or any path that feeds chat/document bodies into a model through Orbit.
- API keys, BYO model keys, or Orbit calling inference (principle 1).
- Storing or searching message content, attachments, or provider "memory" dumps (principle 2).
- Becoming Konotree/tekt: RAG, Drive/Notion connectors, knowledge graphs over file contents.
- Auto-send, mail/calendar agents, or acting as the user (principle 5 / Memava's chief-of-staff lane).
- Confidence scores and "procedures" generated from company corpora — wrong product.

## Suggested issue split when syncing

| Steal # | Likely GitHub issue neighbour |
| --- | --- |
| 1–3, 7–8, 15 | Find UX + issue 11 (prime) |
| 4–6, 11–13, 17 | issue 14 (shared workspaces) |
| 9–10, 16, 18 | storage/API after issue 6–7 |
| 14 | small independent export issue |

## Done when

This draft has been split into filed issues (or explicitly rejected lines moved to ROADMAP "Not planned"), `./manage sync` has been run for each, and ROADMAP points at the survivors. Until then, treat this file as the single source for the competitor pass.
