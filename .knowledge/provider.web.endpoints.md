# Provider web endpoints — what is known

Orbit's history import calls the endpoints each provider's own sidebar calls, through the session
already in the user's browser. These are **internal and undocumented**. They change without notice.
This note records what has actually been observed, so a future failure can be compared against a
baseline instead of re-guessed.

Status vocabulary: `observed` — seen to work against a live account on this machine.
`documented` — described in public open-source clients. `guess` — pattern-matched, never confirmed.

## Claude (`claude.ai`)

```yaml
organizations:
  path: /api/organizations
  status: observed
  note: >
    Returns several organizations for a normal account — a Console/API one beside the claude.ai
    one. Only some serve a chat list; the others answer 403. Taking the first row with a uuid is
    the trap that made the first import fail with "signed-out". Orbit tries every organization,
    chat-capable (capabilities includes "chat") first, and keeps whatever answers.
  corroboration: https://github.com/st1vms/unofficial-claude-api/issues/23
chats:
  path: /api/organizations/{org_uuid}/chat_conversations?limit=100&offset={n}
  status: observed
  shape: a bare JSON array per page
  observed_run: offset 0,100,200,300,400 -> 100,100,100,100,37 = 437 conversations
  observed_run_2: 2026-10-28, offset 0..400 -> 100,100,100,100,47 = 447 conversations
  caveat: >
    The rows are not all the same shape. Some pages arrive with the keys in insertion order
    (uuid, name, summary, ...) and others alphabetically, carrying extra ones
    (current_leaf_message_uuid, platform, project). The import report prints only a row's first
    14 keys, so on an alphabetical page "uuid" sorts last and falls off the end, and the row
    reads as though it has no id. It has one. Do not take a short key list for a missing field.
  link: https://claude.ai/chat/{uuid}
projects:
  path: /api/organizations/{org_uuid}/projects?limit=100&offset=0
  status: observed
  shape: array(34) on 2026-10-19, array(43) on 2026-10-28
  settled: >
    The rows do carry archived_at, next to an archiver field — read off the trace of the
    2026-10-28 run. 13 rows were skipped on both runs (34 -> 21, then 43 -> 30), so the nine
    projects added in between were all unarchived. The archive guess was right; issue 13 closed.
  link: https://claude.ai/project/{uuid}
project_link_on_a_chat:
  fields_tried: [project_uuid, project_id, project.uuid, project.id]
  status: observed
  note: >
    Chat rows carry project_uuid; an alphabetical page carries project as well. 411 of 448 Claude
    chats were filed under a project on 2026-10-28, and no link pointed at a project that had not
    also been imported.
```

## ChatGPT (`chatgpt.com`)

```yaml
session:
  path: /api/auth/session
  status: observed
  yields: accessToken, sent as Authorization: Bearer
chats:
  path: /backend-api/conversations?offset={n}&limit=100&order=updated
  status: observed
  shape: { items, total, limit, offset }
  note: limit is capped at 100. 429 is a real risk on a large account; pace the walk.
  observed_run: 7 pages -> 618 conversations
  observed_run_2: 2026-10-28, offset 0..600 -> 623 conversations
  link: https://chatgpt.com/c/{id}
projects:
  path: /backend-api/gizmos/snorlax/sidebar
  fallback: /backend-api/gizmos/bootstrap
  status: observed (returns data), shape partly guess
  shape: { items, cursor }
  note: >
    CURSOR-PAGED, not offset-paged. Calling it once is why an early import found exactly 5
    projects and stopped.
  observed_run: >
    2026-10-28: ?cursor={opaque} walked 7 pages to the end and stored 34 projects, against 5 when
    only the first page was read. The parameter name is confirmed by the walk itself — every page
    came back with a different cursor and the last came back without one.
  accepts_only: ids beginning "g-p-" — a custom GPT is not a project
project_link_on_a_chat:
  fields_tried: [gizmo_id, conversation_origin.gizmo_id, conversation_origin.id]
  status: observed
  rule: only counts when the value starts "g-p-"
  note: >
    Conversation rows carry gizmo_id. 406 of 623 ChatGPT chats were filed under a project on
    2026-10-28.
```

## Grok

No list endpoint is known. Grok is launchable but not importable.

## How this was learned

Not by reading a spec — there isn't one. The sequence that worked:

1. Run the import from the extension, which records a trace of every request, its status, and the
   **field names** of the first row it held (never values — see principle 2).
2. Read that trace back out of the extension's own `storage.local`, and the result out of Orbit's
   SQLite, instead of trusting the summary on screen.
3. Compare. "ChatGPT projects: one call, response held `items|cursor`, 5 rows stored" is the whole
   diagnosis of a cursor-paging bug, and it needs no access to anyone's account.

This is why the trace exists and why **Copy import report** is in the popup. Keep both.

## Deliberately not done

Reading the browser's cookie store to call these endpoints directly from a script, in order to
settle the `guess` entries above. It would work, and it is the obvious shortcut. It was declined:
it is credential exfiltration by shape, whatever the intent, and the same answers arrive safely
from the trace of a real run. Leave the guesses marked as guesses instead.
