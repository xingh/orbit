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
