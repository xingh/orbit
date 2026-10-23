# Agent capability record

Environment-local. Not part of the portable `00`–`04` set, and not assumed to hold for the next
agent or the next machine. It exists so whoever picks this up knows what was actually checked.

```yaml
extracting_agent:
  model: Claude Opus 5 (1M context)
  host: Claude Code CLI
  date: 2026-10-23
  working_directory: /home/anant/Projects/orbit

capabilities_used:
  shell: ran the full check suite, the dev build, and live HTTP against the running service
  file_tools: read and wrote the repository
  sqlite_via_python: read the live workspace and verified entry counts after each test
  gh_cli: read issues and the arkitype method repository
  xwd: captured the window as the user left it

capabilities_missing:
  - gap: no GUI automation
    compensation: >
      Clicking was declined on purpose — synthesising X11 input while the user is at the keyboard
      captured the wrong window once. Everything reachable only by clicking is marked unverified
      below rather than assumed.
    confidence_effect: interface behaviour in 04 is verified by build and unit test, not by use
  - gap: no second browser engine, no headless Chrome/Chromium
    compensation: Firefox only, driven by the user
    affects: the extension under Chrome's service worker versus Firefox's event page
  - gap: no access to the providers' documentation, because none exists
    compensation: >
      Endpoint shapes were learned from the trace of the user's own real import, plus public
      open-source clients. Reading the browser's cookie store to call the endpoints directly was
      declined — see the closing section of .knowledge/provider.web.endpoints.md.
    affects: the entries marked `guess` in that note
  - gap: Windows and macOS unavailable
    affects: tray, global shortcut, transparent window, folder picker, terminal launch, installers

verification_status:
  observed_running:
    - companion service: /health, CORS preflight, a save reaching SQLite and appearing live
    - rejection paths: no token (401), wrong token (401), web origin with the right token (403),
      GET /pair outside the window (403), a request with no Origin reaching the token gate
    - project import: a Claude project, a ChatGPT project and a chat in one request -> added 3,
      an unknown type rejected; re-posting the same links under new ids -> skipped 2
    - re-link: a loose chat gaining its project on a second import -> linked 1; a third run -> 0
    - refusals: a chat filed under a chat, and a project nested in a project, both dropped
    - the write-back race: reproduced by four rapid batches, then re-run clean after the fix
    - window sizing measured on a HiDPI display: 330x529 open, 20.0% of the work area
    - chat import against live accounts: 437 Claude + 618 ChatGPT conversations
    - workspace integrity after every test: 1081 entries, all probe data removed
  static_analysis_only:
    - the two project list endpoints' exact shapes (ChatGPT's returned data; its cursor parameter
      name is still a guess, and a wrong guess ends the walk safely rather than looping)
    - the in-page scripting.executeScript fallback, which has never run in a browser here
    - the Firefox host-permission prompt
    - Pair a browser as clicked from the UI — the logic is unit-tested, the button is not
    - the project detail view, its Open project button, and the 3D robot toggle as rendered
    - 21 of 34 Claude projects importing; the other 13 carried an archive flag, unconfirmed
  not_implemented:
    - Grok has no import scanner
    - full conversation-history search, local coding-session enumeration

test_counts:
  rust: 28
  node: 22
  note: tests/scanners.test.mjs covers multi-organization recovery, cursor paging to the end, a
        repeated cursor, chat-to-project linking, archived projects skipped, and every generated
        id and link satisfying the service's own rules

build_toolchain:
  observed: pnpm + Vite 6 + tsc, cargo, GitHub Actions, Claude Code as the implementing agent
  provenance: began as a prototype import (commit 58721e2) with a PRD v1.1 handoff

regeneration_requirements:
  - Rust stable and the Tauri 2 prerequisites for the target OS
  - Node 22+ and pnpm
  - a browser that loads an unpacked MV3 extension, for anything touching import or save
  - signed-in Claude and ChatGPT sessions to exercise the import at all
  - fallbacks: without a browser, the service can be driven directly over HTTP with the token from
    the `service` table; without provider sessions, the scanners can only be unit-tested

readme_deviations:
  - The method's extraction README targets a website with a server database. Orbit is a desktop app
    with local SQLite, so `02-database.md` specifies the local schema and the intended per-item
    schema as an open decision, rather than migrations and RLS.
  - No `.arkitype/assets/` screenshots were captured. The window could only be photographed in the
    state the user left it, and clicking was declined. `docs/screenshots/` already holds images of
    the earlier browser layout; 04 stands alone without them.
  - `.manage/` here holds one file per GitHub issue by number, rather than the method's
    ISSUES.md/PROJECT.md/TASKS.json set, because GitHub is the intake and this mirrors it. The
    naming convention is written down in `.manage/README.md`.
```
