# Manage

What is to be done, and the state of it, kept in the repository so the project's context travels
with the source code. GitHub is where work is taken in and tracked **for other people**; this
folder is where it stays readable to whoever — or whatever — opens the checkout next.

`ROADMAP.md` is never archived. Everything else here moves to `.archive/` when it is done.

## Naming

```
issue.NNNN.slug.md              a filed GitHub issue; NNNN is its number, zero-padded to four
issue.draft.slug.md             agreed work with no GitHub issue yet; renamed once it is filed
YYYY.MM.DD.topic.plan.md        a plan or session summary that is not a single issue
ROADMAP.md                      sequence and dependencies; never archived
```

The number is the join to GitHub. `issue.0005.code-tools-in-launcher.md` is
`https://github.com/xingh/orbit/issues/5`, and the issue body should link back to the file rather
than restate it: the issue has a lifecycle, the file has the thinking, and the thinking outlives
the ticket.

## Front matter

Every issue file starts with the fields that mirror the GitHub issue, plus the layer it touches:

```yaml
---
issue: 5                 # number, or `draft`
title: ...
state: open              # open | in-progress | done
opened: 2026-10-19
closed:                  # filled in when it moves to .archive/
github: https://github.com/xingh/orbit/issues/5
arkitype: [03, 04]       # which layers it changes
prerequisites: []        # other files here that must land first
---
```

Then, in prose: what is wrong or wanted, why it matters, what has been ruled out and why, and how
anyone would know it is done. **Record what a decision rules out** — otherwise the next person
helpfully puts it back.

## Lifecycle

```
intake (GitHub, or a conversation)
  -> .manage/issue.NNNN.slug.md        state: open
  -> state: in-progress                while it is being built
  -> ./manage done <number>            moves it to .archive/, stamps `closed:`
```

Use `./manage` for the mechanics:

```sh
./manage status              # repository health, and what is open here
./manage new 7 some-slug     # start an issue file from the template (or: new draft some-slug)
./manage done 4              # close it out and move it to .archive/
./manage archive "message"   # snapshot everything but ROADMAP.md into .archive/.manage.<stamp>/
./manage clean [--dry-run]   # temporary files and caches
```

## Related

- `.knowledge/` — what is true regardless of what is built
- `.arkitype/` — how Orbit is constituted, in layers
- `.archive/` — what was done
