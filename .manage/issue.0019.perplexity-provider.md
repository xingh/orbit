---
issue: 19
title: Perplexity as a provider — backlog, potential
state: open
opened: 2026-10-23
closed:
github: https://github.com/xingh/orbit/issues/19
owner: file
arkitype: [03, 04]
prerequisites: []
---

# Perplexity as a provider

## What

A potential provider, held in the backlog. It is not scheduled: the focus is ChatGPT and Claude.

Two halves, which can land separately:

```yaml
launch:
  want: Perplexity in New chat, opening its official site signed in as the user already is
  touches: [src/providers.mjs, src-tauri/src/providers.rs (OFFICIAL_HOSTS and per-provider hosts),
            URL validation tests, an opt-in setting like Show Grok]
  hosts: [perplexity.ai, www.perplexity.ai]   # guess — confirm which one thread links use
import:
  want: Perplexity threads and Spaces in the history import and the extension
  blocked_on: no list endpoint is known; it would be learned from the user's own session, the way
              Claude's and ChatGPT's were, and recorded in .knowledge/provider.web.endpoints.md first
```

## Why it matters

Raised as the next provider worth having once ChatGPT and Claude are solid, in place of deeper Grok
work. Launch alone is small and useful; import is where the cost and the fragility are.

## Ruled out

- A Perplexity API key or its developer API. Principle 1: the user's subscription, never an API bill.
- Reading thread content. Principle 2: titles and links only.
- Building an importer against a guessed endpoint. Principle 6: a silent zero is a bug.
- Scheduling it ahead of the ChatGPT and Claude work.

## Done when

Launch: Perplexity appears in New chat behind a setting, its links validate on both sides, and the
tests cover it. Import: only once a list endpoint has been observed and recorded, and the scanner
fails loudly when it moves.
