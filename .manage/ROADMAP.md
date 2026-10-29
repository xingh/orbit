# Orbit roadmap

Never archived. Sequence and dependencies; the detail is in the issue file each line names.

## Shipped

- [x] Floating robot widget with the New chat / Find / Projects pill
- [x] Native app for Windows, macOS and Linux, with installers on every tag
- [x] Subscription check before launching Claude Code / Codex (built; not offered in the UI — #5)
- [x] Save straight from Chrome, Edge and Firefox into the running app
- [x] Import existing Claude and ChatGPT web chats **and** projects in one pass
- [x] Chats filed under the projects they belong to, and a re-import that repairs entries already
      saved — `2026.10.23.import-links-and-responsiveness.plan.md`

## In the working tree, uncommitted

- [ ] `issue.0004.responsive-window.md` — 20% footprint, compact layout, dense list
- [ ] 3D robot optional and lazily loaded — same session plan

## Next, in dependency order

The first two unlock almost everything else, and both pay for themselves single-user. That is the
test of whether planning for later is honest.

```
issue.0006.per-item-storage.md          rows + updated + tombstones; the 2 MB blob is nearly full
        |
        +-- issue.0008.upstream-renames.md        refresh a title the provider changed
        +-- issue.0009.upstream-deletes.md        mark what is gone; never reconcile a partial sweep
        |
issue.0007.workspace-api.md             one API, consumed by the desktop itself
        |
        +-- issue.0010.extension-search.md        find and start from the popup
        +-- issue.0014.shared-workspaces.md       a chosen server, then membership
                    |
                    +-- issue.0015.mobile-client.md     read-only PWA, QR pairing
                    +-- issue.0016.deployment-modes.md  compose / PaaS / Postgres · backlog
```

Independent of all the above, and small:

- [ ] `issue.0011.prime-composer.md` — open a chat with the prompt already typed, never submitted
- [ ] `issue.0012.window-restore-position.md` — reappear where it was, or centred
- [ ] `issue.0013.claude-projects-count.md` — settle 21 of 34 from one import report
- [ ] `issue.0005.code-tools-in-launcher.md` — Claude Code and Codex back in the launcher

## Longer-lived

- [ ] `issue.0017.robot-genome.md` — the robot as a declarative, mutable genome
- [ ] Database upgrades and versioned backups — a prerequisite for the storage migration
- [ ] Edit saved chats and re-link moved project folders
- [ ] Signed installers, so there is no first-launch warning
- [ ] Optional Grok integration beyond opening the website (no list endpoint is known)

## Intake (split / sync later)

- [ ] `issue.draft.shared-memory-competitor-steals.md` — index-side UX stolen from
      Memocore / HeyBrain / SharedMemory / Memava / GBrain. Not an MCP memory product;
      sync into Find, prime (#11), shared workspaces (#14), and export issues when ready.
- [ ] `issue.draft.orbit-index-mcp.md` — local bot API + MCP over the **index**; same surface
      centrally for multi-user search and access requests (depends on #7 / #14).
- [ ] `issue.draft.saas-spider-sync.md` — MCP↔disk file sync first, then document
      names/metadata via computer-use (tekt.observer-style) or purpose-built shadow-DB
      connectors; local copy and/or team cloud copy.
- [ ] `issue.draft.extension-surface-sidebar-newtab.md` — after Humble review: ship popup
      Find (#10) first; optional new-tab Orbit search + frequent chats second; provider-only
      side panel later (not every-page CRM).

## Not planned, deliberately

- Message content, ever. The index holds titles, links and the user's own notes —
  `.knowledge/orbit.principles.md`, principle 2.
- API keys, ever. Principle 1.
- Submitting a prompt on the user's behalf. Principle 5.
- Becoming a shared-memory / RAG vault for ChatGPT and Claude (Konotree's lane). See the
  draft above for what was reviewed and ruled out.
