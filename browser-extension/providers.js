// Reading a provider's own conversation and project lists, through the endpoints its web app uses.
//
// These are internal endpoints: undocumented, unversioned and free to change without notice. Each
// scanner is therefore defensive about response shapes and fails with a message a person can act
// on, rather than assuming a schema. Only titles, ids and timestamps are read — never message
// content — and the request rides the session already in the browser, so no credential is handled
// here.
//
// A scanner never fetches for itself: it is handed an `ask` function by the caller, which is how
// the same scan can run from the background page or from inside a tab on the provider. Every
// request it makes is recorded, so a failed import can say exactly what came back.

/** ChatGPT rejects a limit above 100, so this is the largest page both services accept. */
const PAGE = 100;
/** A stop so a runaway or unexpected response cannot loop forever. */
const MAX_THREADS = 3000;
const MAX_PAGES = Math.ceil(MAX_THREADS / PAGE);
/** A short wait between pages, to stay gentle on the provider. */
const PAUSE_MS = 250;

export const SCAN_ORIGINS = ['https://claude.ai/*', 'https://chatgpt.com/*'];

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Keys these services have been seen to hold their lists under, most likely first. */
const LIST_KEYS = ['items', 'data', 'conversations', 'projects', 'results', 'chat_conversations'];

/**
 * Finds the list inside a response whose shape we do not control. Returns null when there is no
 * array to be found, which the caller turns into a message naming what did arrive.
 */
export function rowsOf(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;
  for (const key of LIST_KEYS) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  const nested = Object.values(payload)
    .find(value => Array.isArray(value) && value.every(entry => entry && typeof entry === 'object'));
  return nested ?? null;
}

function describe(payload) {
  if (payload === null || payload === undefined) return 'nothing';
  if (Array.isArray(payload)) return 'an empty list';
  if (typeof payload !== 'object') return typeof payload;
  const keys = Object.keys(payload);
  return keys.length ? keys.slice(0, 8).join(', ') : 'an empty object';
}

/**
 * What a response held, for the report a person can hand back when an import goes wrong. Field
 * *names* only, never a value: naming the keys of the first row is what a wrong mapping needs, and
 * it cannot carry anything someone wrote in a conversation.
 */
export function held(data) {
  const rows = rowsOf(data);
  const shape = Array.isArray(data)
    ? `array(${data.length})`
    : data === undefined
      ? 'not JSON'
      : data === null || typeof data !== 'object'
        ? String(data)
        : Object.keys(data).slice(0, 8).join('|') || 'empty object';
  const first = rows?.find(row => row && typeof row === 'object');
  return first ? `${shape} rows:{${Object.keys(first).slice(0, 14).join('|')}}` : shape;
}

/**
 * Turns a transport — one GET reported as `{ status, data }`, never throwing for an HTTP status —
 * into the `ask` a scanner uses. It records every request for the import report, and turns a status
 * into a sentence that says what to do about it.
 */
export function asker(transport, trace, signIn) {
  return async (url, headers) => {
    const { status, data } = await transport(url, headers);
    trace.push({ url: url.replace(/^https:\/\/[^/]+/, ''), status, held: held(data) });
    if (status === 401 || status === 403) throw Error(signIn);
    if (status === 429) throw Error('that service asked us to slow down. Try again in a minute.');
    if (status < 200 || status >= 300) throw Error(`that request came back as ${status}.`);
    if (data === undefined) throw Error('that request did not return JSON. Open the service and sign in.');
    return data;
  };
}

/**
 * The project a conversation row says it belongs to. Claude names it `project_uuid`; ChatGPT ties a
 * conversation to a project through the gizmo it was started in. Both have been spelt more than one
 * way, so every known name is tried and the first that holds a string wins.
 */
function projectReference(row) {
  const candidates = [
    row?.project_uuid,
    row?.project_id,
    row?.project?.uuid,
    row?.project?.id,
    row?.gizmo_id,
    row?.conversation_origin?.gizmo_id,
    row?.conversation_origin?.id,
  ];
  return candidates.find(value => typeof value === 'string' && value) ?? '';
}

/** Keys a project row has been seen to carry its own conversations under. */
const CONVERSATION_KEYS = ['conversations', 'recent_conversations', 'items'];

/**
 * Remembers which project a conversation belongs to when the *project* row is the one that says so,
 * rather than the conversation. The projects of each service are read before its chats, so by the
 * time a chat is mapped the answer is already here.
 */
function rememberLinks(context, projectId, row) {
  for (const key of CONVERSATION_KEYS) {
    const list = row?.[key] ?? row?.gizmo?.[key];
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const id = typeof entry === 'string' ? entry : (entry?.id ?? entry?.conversation_id);
      if (typeof id === 'string' && id) context.links.set(`chatgpt-${id}`, projectId);
    }
  }
}

/** A fresh set of cross-list findings for one import. */
export const newContext = () => ({ links: new Map() });

/** Accepts an ISO string or epoch seconds, which the two services use interchangeably. */
function toMillis(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value > 1e12 ? value : value * 1000);
  }
  const parsed = Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function title(value, fallback) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
}

/**
 * Walks an offset-paged list. It stops at the end of the list, at the safety cap, or as soon as a
 * page brings nothing new — an endpoint that ignores `offset` would otherwise repeat its first
 * page until the cap.
 */
async function pages(ask, url, map, onProgress, into, seen) {
  const joiner = url.includes('?') ? '&' : '?';
  for (let offset = 0; offset < MAX_THREADS; offset += PAGE) {
    const payload = await ask(`${url}${joiner}limit=${PAGE}&offset=${offset}`);
    const rows = rowsOf(payload);
    if (!rows) throw Error(`could not find a list in that response (it held: ${describe(payload)}).`);
    let fresh = 0;
    for (const row of rows) {
      const item = map(row);
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      into.push(item);
      fresh += 1;
    }
    onProgress(into.length);
    if (rows.length < PAGE || !fresh) break;
    await wait(PAUSE_MS);
  }
  return into;
}

/**
 * An account usually has more than one Claude organization — a Console one alongside the claude.ai
 * one — and only some of them will serve the chat list; the rest answer 403. Picking the first was
 * the bug behind "signed-out" imports. Chat-capable organizations are tried first, then the others,
 * and every one is tried, so a team workspace is picked up as well as a personal one.
 */
async function organisations(ask) {
  const rows = rowsOf(await ask('https://claude.ai/api/organizations')) ?? [];
  const all = rows
    .filter(row => typeof row?.uuid === 'string')
    .map(row => ({
      uuid: row.uuid,
      capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
    }));
  if (!all.length) throw Error('could not read your Claude account. Open claude.ai and try again.');
  const chatty = all.filter(entry => entry.capabilities.includes('chat'));
  const rest = all.filter(entry => !entry.capabilities.includes('chat'));
  return [...chatty, ...rest];
}

/**
 * Runs one read per organization and keeps whatever answers. A 403 from an organization that
 * cannot serve this list is expected, not a failure; only every organization refusing is.
 */
async function eachOrganisation(ask, onProgress, read) {
  const found = [];
  const seen = new Set();
  const refusals = [];
  for (const { uuid } of await organisations(ask)) {
    try {
      await read(uuid, found, seen);
      onProgress(found.length);
    } catch (failure) {
      refusals.push(failure);
    }
  }
  if (!found.length && refusals.length) throw refusals[0];
  return found;
}

function claudeChats(ask, onProgress, context = newContext()) {
  return eachOrganisation(ask, onProgress, (uuid, found, seen) =>
    pages(
      ask,
      `https://claude.ai/api/organizations/${uuid}/chat_conversations`,
      row => {
        if (typeof row?.uuid !== 'string') return null;
        const id = `claude-${row.uuid}`;
        const project = projectReference(row);
        return {
          id,
          type: 'chat',
          provider: 'claude',
          title: title(row.name ?? row.summary, 'Saved conversation'),
          url: `https://claude.ai/chat/${row.uuid}`,
          updated: toMillis(row.updated_at ?? row.created_at),
          // Orbit files a chat under the project it already belongs to in the service.
          projectId: project ? `claude-project-${project}` : (context.links.get(id) ?? ''),
        };
      },
      onProgress,
      found,
      seen,
    ),
  );
}

function claudeProjects(ask, onProgress, context = newContext()) {
  return eachOrganisation(ask, onProgress, (uuid, found, seen) =>
    pages(
      ask,
      `https://claude.ai/api/organizations/${uuid}/projects`,
      // Archived projects stay in the service rather than cluttering Orbit.
      row => {
        if (typeof row?.uuid !== 'string' || row.archived_at || row.is_archived) return null;
        const id = `claude-project-${row.uuid}`;
        rememberLinks(context, id, row);
        return {
          id,
          type: 'project',
          provider: 'claude',
          title: title(row.name, 'Project'),
          url: `https://claude.ai/project/${row.uuid}`,
          updated: toMillis(row.updated_at ?? row.created_at),
        };
      },
      onProgress,
      found,
      seen,
    ),
  );
}

/** ChatGPT's own list endpoints are signed with the token its web app holds for the session. */
async function chatgptHeaders(ask) {
  const session = await ask('https://chatgpt.com/api/auth/session');
  const token = session?.accessToken;
  if (!token) throw Error('open chatgpt.com, sign in, and try again.');
  return { Authorization: `Bearer ${token}` };
}

async function chatgptChats(ask, onProgress, context = newContext()) {
  const headers = await chatgptHeaders(ask);
  const signed = (url, extra) => ask(url, { ...headers, ...extra });
  return pages(
    signed,
    'https://chatgpt.com/backend-api/conversations?order=updated',
    row => {
      if (typeof row?.id !== 'string') return null;
      const id = `chatgpt-${row.id}`;
      const gizmo = projectReference(row);
      // Only a project gizmo files a chat; a custom GPT is not a project.
      const project = gizmo.startsWith('g-p-') ? `chatgpt-${gizmo}` : (context.links.get(id) ?? '');
      return {
        id,
        type: 'chat',
        provider: 'chatgpt',
        title: title(row.title, 'Saved conversation'),
        url: `https://chatgpt.com/c/${row.id}`,
        updated: toMillis(row.update_time ?? row.create_time),
        projectId: project,
      };
    },
    onProgress,
    [],
    new Set(),
  );
}

/**
 * ChatGPT projects are gizmos whose ids begin `g-p-`, listed by the same endpoint the sidebar uses.
 * No public source documents it, so more than one known path is tried and only `g-p-` ids are
 * accepted — a custom GPT is never mistaken for a project. If none of them answers, the import says
 * so instead of quietly skipping them.
 */
const PROJECT_PATHS = [
  'https://chatgpt.com/backend-api/gizmos/snorlax/sidebar',
  'https://chatgpt.com/backend-api/gizmos/bootstrap',
];

function chatgptProject(row) {
  const gizmo = row?.gizmo?.gizmo ?? row?.gizmo ?? row;
  const id = gizmo?.id ?? row?.id;
  if (typeof id !== 'string' || !id.startsWith('g-p-')) return null;
  return {
    id: `chatgpt-${id}`,
    type: 'project',
    provider: 'chatgpt',
    title: title(gizmo?.display?.name ?? gizmo?.name ?? row?.title, 'Project'),
    url: `https://chatgpt.com/g/${id}/project`,
    updated: toMillis(gizmo?.updated_at ?? row?.update_time ?? row?.updated_at),
  };
}

async function chatgptProjects(ask, onProgress, context = newContext()) {
  const headers = await chatgptHeaders(ask);
  const seen = new Set();
  const found = [];
  let refusal = null;
  for (const path of PROJECT_PATHS) {
    try {
      // This list is cursor-paged, not offset-paged: reading only the first page is why an earlier
      // import found five projects and stopped. A cursor that is missing, repeated, or brings
      // nothing new is the end of the list.
      let cursor = '';
      const used = new Set();
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const joiner = path.includes('?') ? '&' : '?';
        const payload = await ask(cursor ? `${path}${joiner}cursor=${encodeURIComponent(cursor)}` : path, headers);
        let fresh = 0;
        for (const row of rowsOf(payload) ?? []) {
          const item = chatgptProject(row);
          if (!item || seen.has(item.id)) continue;
          seen.add(item.id);
          found.push(item);
          fresh += 1;
          rememberLinks(context, item.id, row);
        }
        onProgress(found.length);
        cursor = typeof payload?.cursor === 'string' ? payload.cursor : '';
        if (!cursor || used.has(cursor) || !fresh) break;
        used.add(cursor);
        await wait(PAUSE_MS);
      }
      if (found.length) return found;
    } catch (failure) {
      refusal ??= failure;
    }
  }
  if (refusal) throw refusal;
  return found;
}

/**
 * Projects come before chats for each service, and Orbit saves them in that order, so a chat can be
 * filed under a project that is already there.
 *
 * `sweeps` says this list is complete enough to delete against: after it is sent, Orbit drops its
 * other entries of that provider and kind, so a project deleted or archived upstream stops showing.
 * Only the project lists carry it. Both come back in a single short read, while the chat lists are
 * walked by `offset` over a list the provider orders by *recency* — a chat updated mid-walk shifts
 * pages and is simply never seen, and sweeping on that would delete conversations that still exist.
 */
export const SCANNERS = [
  {
    id: 'claude-projects',
    sweeps: { provider: 'claude', type: 'project' },
    label: 'Claude projects',
    origin: 'https://claude.ai/*',
    home: 'https://claude.ai/projects',
    signIn: 'Open claude.ai, sign in, and try again.',
    scan: claudeProjects,
  },
  {
    id: 'claude-chats',
    label: 'Claude chats',
    origin: 'https://claude.ai/*',
    home: 'https://claude.ai/recents',
    signIn: 'Open claude.ai, sign in, and try again.',
    scan: claudeChats,
  },
  {
    id: 'chatgpt-projects',
    sweeps: { provider: 'chatgpt', type: 'project' },
    label: 'ChatGPT projects',
    origin: 'https://chatgpt.com/*',
    home: 'https://chatgpt.com/',
    signIn: 'Open chatgpt.com, sign in, and try again.',
    scan: chatgptProjects,
  },
  {
    id: 'chatgpt-chats',
    label: 'ChatGPT chats',
    origin: 'https://chatgpt.com/*',
    home: 'https://chatgpt.com/',
    signIn: 'Open chatgpt.com, sign in, and try again.',
    scan: chatgptChats,
  },
];
