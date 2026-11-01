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
- [x] Why 21 of 34 Claude projects imported — the rows carry `archived_at`; `.archive/issue.0013`
- [x] The index mirrors the provider: a renamed project is renamed here, and one that is gone or
      archived is removed — #8 and #9, under the `mirror-not-archive` decision. Confirmed on live
      data: 498 titles refreshed, 2 projects removed
- [x] The extension is Orbit Link, attached to every release as a zip — `.archive/issue.0028`

## In progress

- [ ] `issue.0004.responsive-window.md` — shipped: 20% footprint, compact layout, dense list, lazy
      optional 3D robot. Left: the pill only on hover, double-click to the tray, tray double-click
      to open, and a panel that opens where there is room

## Next

Focus: ChatGPT and Claude. Two tiers: first what can be built **and verified** without the owner
at the keyboard, then what needs the owner — their account, their data, or a decision. Within a
tier, each item is placed where it makes the next one worth more. Priority labels on the GitHub
issues mirror this list.

### Without the owner

1. **P0** `issue.0004.responsive-window.md` — finish it; it is daily use, and the placement it
   settles is what #12 remembers
2. **P0** `issue.0012.window-restore-position.md` — remember the robot's position, validated
   against the monitor layout on every show
3. **P0** `issue.0006.per-item-storage.md` — unblocks #7 and #14, and the 2 MB blob is nearly
   full. Migration proven on a synthetic workspace of the live one's size. No longer blocks #8 or
   #9: both landed without it
4. **P1** `issue.0009.upstream-deletes.md` — the chat half only. Projects are done; a chat list
   walked by `offset` over a recency-ordered list cannot be swept without deleting conversations
   that still exist, so this needs a cursor the provider guarantees, or two consecutive sweeps
   that agree before either applies
5. **P1** `issue.0007.workspace-api.md` — one interface, IPC and HTTP; the browser preview finally
   sees the real workspace
6. **P1** `issue.0010.extension-search.md` — the first read route, on top of #7
7. **P2** `issue.0017.robot-genome.md` — independent; built here, but the look needs the owner's
   eye before it lands
8. **P1** `issue.draft.install-page.md` — Orbit serves the install instructions at `GET /`, for the
   browser reading them. Finishes what #28 starts: the zip exists, this is how anyone finds out
   what to do with it. Verifiable with curl, no owner needed

### Needs the owner

9. Not an issue: run the #6 migration on the live workspace. #8 and #9 have now been confirmed
    against a real re-import, so only the migration still needs the owner's own data
10. **P3** `issue.0011.prime-composer.md` — `?q=` and both composers can only be confirmed signed in
11. **P3** `issue.0014.shared-workspaces.md` — needs the `shared-vs-overlay` decision and a chosen
    server; then `issue.0016.deployment-modes.md`, then `issue.0015.mobile-client.md`
12. **P3** `issue.0005.code-tools-in-launcher.md` — held by decision; needs a machine with both
    tools signed in

### Dependencies

```
issue.0006.per-item-storage.md          rows + updated; the 2 MB blob is nearly full
        |
issue.0007.workspace-api.md             one API, consumed by the desktop itself
        |
        +-- issue.0010.extension-search.md        find and start from the popup
        +-- issue.0014.shared-workspaces.md       a chosen server, then membership
                    |
                    +-- issue.0015.mobile-client.md     read-only PWA, QR pairing
                    +-- issue.0016.deployment-modes.md  compose / PaaS / Postgres · backlog
```

## Backlog — potential providers

Not scheduled. Each is a launch half that is small and an import half blocked on an endpoint nobody
has observed yet.

- [ ] **P3** `issue.0019.perplexity-provider.md` — Perplexity in New chat; import only once a list endpoint is known
- [ ] **P3** `issue.0020.grok-import.md` — Grok already opens; import and extension saves need a list endpoint

## Longer-lived

- [ ] Database upgrades and versioned backups — a prerequisite for the storage migration
- [ ] Edit saved chats and re-link moved project folders
- [ ] Signed installers, so there is no first-launch warning

## Intake (split / sync later)

- [ ] `issue.draft.shared-memory-competitor-steals.md` — index-side UX stolen from
      Memocore / HeyBrain / SharedMemory / Memava / GBrain. Not an MCP memory product;
      sync into Find, prime (#11), shared workspaces (#14), and export issues when ready.
- [ ] `issue.draft.orbit-index-mcp.md` — local bot API + MCP over the **index**; same surface
      centrally for multi-user search and access requests (depends on #7 / #14).
- [ ] `issue.draft.saas-spider-sync.md` — MCP↔disk file sync first, then document
      names/metadata via computer-use (tekt.observer-style) or purpose-built shadow-DB
      connectors; local copy and/or team cloud copy.
- [ ] `issue.draft.extension-surface-sidebar-newtab.md` — order chats/projects in tools you
      already use: popup Find (#10) → optional new-tab search + frequent chats → provider-only
      side panel later. Sticky notes on links = Linkwarden in Konotree, not Orbit.
- [ ] `issue.draft.virtual-projects-by-name.md` — virtual shelves by shared name (`.inbox`,
      `rd/…`) across Claude/ChatGPT/etc.; organizer skill aligns naming, Orbit unions the index.

## Not planned, deliberately

- Message content, ever. The index holds titles, links and the user's own notes —
  `.knowledge/orbit.principles.md`, principle 2.
- API keys, ever. Principle 1.
- Submitting a prompt on the user's behalf. Principle 5.
- Becoming a shared-memory / RAG vault for ChatGPT and Claude (Konotree's lane). See the
  draft above for what was reviewed and ruled out.
