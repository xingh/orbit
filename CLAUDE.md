# Orbit — working conventions

A Tauri 2 desktop companion that launches AI chat sites and keeps a local, searchable index of
saved conversations and projects. React/TypeScript in `src/`, Rust in `src-tauri/`, an MV3 browser
extension in `browser-extension/`.

## Read these first

This repository keeps its own context, in the Arkitype layout
([method](https://github.com/xingh/arkitype)). GitHub issues are intake and tracking **for other
people**; these folders are the project's memory, and they travel with the checkout.

| Folder | What belongs there |
| --- | --- |
| `.knowledge/` | What is true regardless of what is built. Principles, vocabulary, hard-won reference material. Start with `orbit.principles.md`. |
| `.arkitype/` | How Orbit is constituted, in layers: `00` identity and profile, `01` infrastructure, `02` database, `03` software, `04` interface, plus `agent.local.md` — what was actually verified and what was not. |
| `.manage/` | What is to be done. One file per GitHub issue, named `issue.NNNN.slug.md`. `ROADMAP.md` holds the sequence. Conventions in `.manage/README.md`. |
| `.archive/` | What was done, and superseded material kept for the record. |

Before changing behaviour, check `.knowledge/orbit.principles.md`. Several of those rules exist
because breaking them already cost us something, and the reason is written down so you can judge
whether it still applies rather than rediscovering it.

## Intake

New work goes in `.manage/` as an issue file before it is built — `./manage new <number|draft>
<slug>` — and moves to `.archive/` when it is done: `./manage done <number>`. Record what a
decision **rules out**, not only what it chose; otherwise the next person helpfully puts it back.

## Checks

```sh
pnpm build && pnpm test && cargo test --manifest-path src-tauri/Cargo.toml
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
./manage status
```

## Two traps that have already bitten

- `"resizable": false` in `tauri.conf.json` makes every programmatic `setSize` a silent no-op.
  It must stay `true`.
- The window and the companion service write the same storage. A writer must keep what it has not
  seen; a blind full-workspace write loses imported entries with no error anywhere.

## House style

Match the surrounding code: dense, few comments, and a comment explains *why* rather than what.
Fail loudly with a message naming what moved — these integrations sit on undocumented endpoints
that change without notice, and a silent zero is a bug.
