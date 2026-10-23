# What a re-import must mean

The import is run repeatedly, by hand, against lists that change underneath it. These are the
semantics it has to honour. The mechanism lives in `.arkitype/03-software.md`; the rules are here
because they are judgements, not implementation details, and getting one wrong destroys data.

## Identity

Two entries are the same when they share an `id`, **or** they are the same kind of entry with the
same `url`.

Ids are derived from the provider's own identifier (`claude-chat-<uuid>`, `chatgpt-<gizmo>`), so a
conversation always collides with itself across runs, and `url` catches an entry saved by hand
before the import ever ran.

## A duplicate is not an error

Re-importing is the normal case and must be cheap, safe and silent. A duplicate is reported as
`skipped` and **nothing about the stored entry is changed**, with one exception.

## The exception: a missing link is filled in

If the stored entry is a chat with no project, and the arriving copy names a project that exists,
the link is written and reported as `linked`. Nothing else about the entry is touched.

*Why the exception exists:* without it, every chat imported before project support existed would
stay loose forever, because a duplicate was only ever counted and discarded. Re-import is the
repair path for data already saved — that is what makes it worth running twice.

*Why it is this narrow:* a link already in place is never moved. If the user filed a chat
somewhere deliberately, an import does not overrule them.

## A link is only ever kept when its target is real

A `projectId` survives only if that project is already in the workspace or arrives in the same
batch. A link to a chat, to a project inside a project, or to nothing at all is dropped and the
chat is saved loose. Hence: **each service's projects are read before its chats.**

## Upstream renames — not yet handled

A title changed at the provider does not reach a stored entry. This is a consequence of "nothing is
overwritten", and it is wrong, but the fix needs a distinction the data model does not have: *the
user renamed it* (keep) versus *the provider renamed it* (refresh). One flag per entry, set when the
user edits a title, plus "refresh when the flag is unset and the title differs".

Tracked in `.manage/issue.0008.upstream-renames.md`.

## Upstream deletes and archives — not yet handled, and the dangerous one

A conversation deleted at the provider stays in Orbit forever and its link 404s. The obvious fix is
the data-loss bug waiting to happen:

> **Never reconcile on a partial sweep.** A 403 from one organization, a dropped page, a 429, an
> expired token — any of these make a list look empty or short. Deleting what is "missing" from
> such a sweep removes hundreds of good entries and reports success.

So reconciliation requires the scanner to assert *this list was walked to the end, completely*, and
even then the absentees are **marked, not deleted** — a `missingSince` date, shown greyed as "no
longer at Claude", removable in bulk by the user. The same marking mechanism is what a shared or
remote workspace needs in order to propagate a delete, so it is worth building once, properly.

Tracked in `.manage/issue.0009.upstream-deletes.md`.
