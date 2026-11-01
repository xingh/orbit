---
issue: 36
title: "Orbit Feature: Local area scanning (Craigslist/Nextdoor scan list + crawler)"
state: open
opened: 2026-11-01
closed:
github: https://github.com/xingh/orbit/issues/36
owner: file
arkitype: []
prerequisites: []
---

# Local area scanning — raised on Orbit, and probably not Orbit

## What was raised

A Craigslist/Nextdoor scanning stack, already built and running outside this repository: a
`scanlist.yaml` of metros, verified Craigslist subdomains and neighbourhoods, a status grid in
`communities.xlsx`, and a polite `httpx`+`selectolax` crawler writing SQLite and CSV. The stated
principle:

> We learn people via their browser, so learn their areas the same way; each person wants local
> things monitored (Craigslist, Nextdoor, etc.).

A test scan returned live listings. None of it lives here.

## Why this file says "probably not Orbit"

The shared premise is real — *the browser is where someone's context is* — and it is the premise
Orbit is built on. But what the two do with it does not overlap:

| | Orbit | This |
| --- | --- | --- |
| Reads | the user's own chat lists, through the session already in their browser | public listing sites, by crawling |
| Holds | titles, links, the user's notes | scraped listings, geography, ACS/Census data |
| Runs | when the user clicks Import | on a schedule, unattended |
| Scope | two AI providers' conversations | metros, neighbourhoods, categories, keywords |

Orbit's principles do not forbid this so much as describe a different program. Principle 2 says
the index holds titles and links rather than content; principle 4 keeps the service on loopback
behind a paired browser; nothing in the roadmap's "Not planned, deliberately" anticipated a
crawler because a crawler was never in the frame. Folding it in would widen what Orbit is from
"an index of your own conversations" to "a monitoring product", and that is a decision, not a
feature.

The honest reading is that this belongs to **intelcraft**, which is where it already runs.

## What could legitimately connect them, later

If local scanning stays its own program, there is still a seam worth naming: its output is
**links with titles**, which is exactly the shape Orbit already stores. A scanner that posted
findings to the companion service would be a *provider* in Orbit's existing sense rather than a
new kind of thing — the same `POST /chats` shape, the same token-and-caller gate, no crawler in
this repository at all.

That is a much smaller idea than the one raised, and it is the only version that does not change
what Orbit is.

## The decision this needs

```yaml
- id: scanner-in-orbit-or-beside-it
  question: >
    Does Orbit grow a scheduled crawler, or does the scanner stay its own program and, at most,
    post what it finds into Orbit as entries?
  needed_for: whether this issue stays open here at all
  note: >
    Not a technical question. It decides whether Orbit is an index of the user's own
    conversations, or a monitoring product with an index attached.
```

## Recommendation

Move it to its own repository, keep this file as the record of why, and open a small issue here
only if the "post findings as entries" seam is wanted. Not scheduled on the roadmap until that is
decided — it is listed there as raised and held, deliberately, rather than queued.

---

## As raised, verbatim

Kept here because `manage sync` replaced the issue body on GitHub with this file, and GitHub does
not retain a body from before its first edit. **This capture is itself truncated** — it was read
with a character limit and cut off mid-list. The full text is in the Todoist task it was synced
from, and the work it describes is on the box at `/workspace/craigslist-scan/`.

> Orbit Feature — local area scanning for intelcraft (Rahul Singh).
>
> **Principle:** We learn people via their browser, so learn their areas the same way; each person
> wants local things monitored (Craigslist, Nextdoor, etc.).
>
> **What shipped on the box (2026-11-01 America/New_York):**
> - `/workspace/craigslist-scan/scanlist.yaml` — metro priority, verified CL subdomains/subareas,
>   wealthy neighborhoods with ZIP + ACS/QuickFacts/Census Reporter source links, categories,
>   keywords
> - `/workspace/craigslist-scan/communities.xlsx` — Status Grid (COMPLETE=light blue, ACTIVE=green,
>   PENDING=orange, SKIPPED/CANCELLED=light red + legend) + Metros + Communities (`run` Y/N;
>   scanner reads run=Y)
> - `/workspace/craigslist-scan/scanner.py` — httpx+selectolax polite scanner (robots + rate
>   limit), SQLite+CSV out; updates Status Grid; skips SKIPPED/CANCELLED
> - `/workspace/craigslist-scan/README.md`
> - Test scan: 5 DC `cpg` searches; McLean/nva `query=AI` returned 3 live listings into
>   `results.sqlite` / `results.csv`
>
> **Metros (priority):** DC → Virginia Beach (norfolk) → Baltimore → NYC → Richmond → Chicago →
> SF Bay → LA → San Diego → Honolulu/Maui/Kauai (all hawaii via honolulu.craigslist.org subareas
> oah/…  *[capture ends here]*
