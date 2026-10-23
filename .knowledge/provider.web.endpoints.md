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
  link: https://claude.ai/chat/{uuid}
projects:
  path: /api/organizations/{org_uuid}/projects?limit=100&offset=0
  status: observed
  shape: array(34) on the live account
  caveat: >
    34 rows arrived, 21 imported. The other 13 carried an archive flag and were skipped. Which
    field (archived_at vs is_archived) is unconfirmed; the import report now names row field
    names, so the next run settles it. Tracked in .manage/issue.0013.claude-projects-count.md
  link: https://claude.ai/project/{uuid}
project_link_on_a_chat:
  fields_tried: [project_uuid, project_id, project.uuid, project.id]
  status: guess
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
  link: https://chatgpt.com/c/{id}
projects:
  path: /backend-api/gizmos/snorlax/sidebar
  fallback: /backend-api/gizmos/bootstrap
  status: observed (returns data), shape partly guess
  shape: { items, cursor }
  note: >
    CURSOR-PAGED, not offset-paged. Calling it once is why an early import found exactly 5
    projects and stopped. The cursor parameter name is still a guess; if wrong, the walk ends
    safely on a repeated page rather than looping.
  accepts_only: ids beginning "g-p-" — a custom GPT is not a project
project_link_on_a_chat:
  fields_tried: [gizmo_id, conversation_origin.gizmo_id, conversation_origin.id]
  status: guess
  rule: only counts when the value starts "g-p-"
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
