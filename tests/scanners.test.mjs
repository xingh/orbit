// The provider scanners against stand-in responses, including the shapes that broke a real import:
// an account whose first Claude organization answers 403, and a list endpoint that returns JSON
// without a list in it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SCANNERS, rowsOf, asker as makeAsker, held, newContext } from '../browser-extension/providers.js';

const scanner = id => SCANNERS.find(entry => entry.id === id);
const nothing = () => {};

/** Builds an `ask` over a routing table, mirroring what the background page does with statuses. */
function asker(routes) {
  const seen = [];
  const ask = async (url, headers) => {
    seen.push(url);
    // Longest prefix wins, so a specific list route beats the organizations route it sits under.
    const route = Object.keys(routes)
      .filter(key => url.startsWith(key))
      .sort((a, b) => b.length - a.length)[0];
    const answer = route ? routes[route] : { status: 404 };
    const { status = 200, body } = typeof answer === 'function' ? answer(url, headers) : answer;
    if (status === 401 || status === 403) throw Error('signed out.');
    if (status < 200 || status >= 300) throw Error(`that request came back as ${status}.`);
    return body;
  };
  ask.seen = seen;
  return ask;
}

const CHAT_ORG = '11111111-1111-1111-1111-111111111111';
const API_ORG = '22222222-2222-2222-2222-222222222222';
/** The organizations call answers; only one of the two organizations will serve a chat list. */
const twoOrganisations = {
  'https://claude.ai/api/organizations': {
    body: [
      { uuid: API_ORG, name: 'Console', capabilities: ['api'] },
      { uuid: CHAT_ORG, name: 'Personal', capabilities: ['chat', 'claude_pro'] },
    ],
  },
};

test('a Claude account whose first organization refuses the chat list still imports', async () => {
  const ask = asker({
    ...twoOrganisations,
    [`https://claude.ai/api/organizations/${API_ORG}/chat_conversations`]: { status: 403 },
    [`https://claude.ai/api/organizations/${CHAT_ORG}/chat_conversations`]: {
      body: [{ uuid: 'abc', name: 'Orbit architecture', updated_at: '2026-10-01T00:00:00Z' }],
    },
  });
  const found = await scanner('claude-chats').scan(ask, nothing);
  assert.deepEqual(found.map(item => item.url), ['https://claude.ai/chat/abc']);
  assert.equal(found[0].id, 'claude-abc');
  assert.equal(found[0].title, 'Orbit architecture');
  assert.equal(found[0].type, 'chat');
  // The chat-capable organization is asked first, so the usual account costs no wasted refusal.
  assert.ok(ask.seen[1].includes(CHAT_ORG), ask.seen[1]);
});

test('every Claude organization refusing is reported, not swallowed', async () => {
  const ask = asker({
    ...twoOrganisations,
    'https://claude.ai/api/organizations/': { status: 403 },
  });
  await assert.rejects(() => scanner('claude-chats').scan(ask, nothing), /signed out/);
});

test('chats from several Claude organizations are gathered together without repeats', async () => {
  const ask = asker({
    ...twoOrganisations,
    [`https://claude.ai/api/organizations/${CHAT_ORG}/chat_conversations`]: {
      body: [{ uuid: 'a', name: 'One' }, { uuid: 'shared', name: 'Shared' }],
    },
    [`https://claude.ai/api/organizations/${API_ORG}/chat_conversations`]: {
      body: [{ uuid: 'shared', name: 'Shared' }, { uuid: 'b', name: 'Two' }],
    },
  });
  const found = await scanner('claude-chats').scan(ask, nothing);
  assert.deepEqual(found.map(item => item.id), ['claude-a', 'claude-shared', 'claude-b']);
});

test('an endpoint that ignores offset is not paged forever', async () => {
  let calls = 0;
  const ask = asker({
    ...twoOrganisations,
    'https://claude.ai/api/organizations/': () => {
      calls += 1;
      // A full page every time, always the same rows: real paging would move on.
      return { body: Array.from({ length: 100 }, (_, index) => ({ uuid: `c${index}`, name: 'x' })) };
    },
  });
  const found = await scanner('claude-chats').scan(ask, nothing);
  assert.equal(found.length, 100);
  // One page per organization, plus the second page that proved there was nothing new.
  assert.ok(calls <= 4, `paged ${calls} times`);
});

test('a response with no list in it says what did arrive', async () => {
  const ask = asker({
    ...twoOrganisations,
    'https://claude.ai/api/organizations/': { body: { detail: 'nope', code: 7 } },
  });
  await assert.rejects(
    () => scanner('claude-chats').scan(ask, nothing),
    /could not find a list in that response \(it held: detail, code\)/,
  );
});

test('Claude projects become project entries and archived ones are left behind', async () => {
  const ask = asker({
    ...twoOrganisations,
    [`https://claude.ai/api/organizations/${CHAT_ORG}/projects`]: {
      body: [
        { uuid: 'p1', name: 'Orbit', updated_at: '2026-10-02T00:00:00Z' },
        { uuid: 'p2', name: 'Old', archived_at: '2026-01-01T00:00:00Z' },
      ],
    },
    [`https://claude.ai/api/organizations/${API_ORG}/projects`]: { status: 403 },
  });
  const found = await scanner('claude-projects').scan(ask, nothing);
  assert.deepEqual(found.map(item => [item.type, item.title, item.url]), [
    ['project', 'Orbit', 'https://claude.ai/project/p1'],
  ]);
});

test('ChatGPT chats are read with the session token from its own page', async () => {
  const seenHeaders = [];
  const ask = asker({
    'https://chatgpt.com/api/auth/session': { body: { accessToken: 'tok' } },
    'https://chatgpt.com/backend-api/conversations': (_url, headers) => {
      seenHeaders.push(headers);
      return { body: { items: [{ id: 'c1', title: 'Cover', update_time: 1760000000 }], total: 1 } };
    },
  });
  const found = await scanner('chatgpt-chats').scan(ask, nothing);
  assert.deepEqual(found.map(item => item.url), ['https://chatgpt.com/c/c1']);
  assert.equal(found[0].id, 'chatgpt-c1');
  assert.equal(seenHeaders[0].Authorization, 'Bearer tok');
  // Epoch seconds, not milliseconds, are what this endpoint sends.
  assert.equal(found[0].updated, 1760000000000);
});

test('a signed-out ChatGPT session asks the person to sign in', async () => {
  const ask = asker({ 'https://chatgpt.com/api/auth/session': { body: {} } });
  await assert.rejects(() => scanner('chatgpt-chats').scan(ask, nothing), /sign in/);
});

test('only ChatGPT gizmos that are projects are imported', async () => {
  const ask = asker({
    'https://chatgpt.com/api/auth/session': { body: { accessToken: 'tok' } },
    'https://chatgpt.com/backend-api/gizmos/snorlax/sidebar': {
      body: {
        items: [
          { gizmo: { id: 'g-p-123', display: { name: 'Intelcraft' } } },
          { gizmo: { id: 'g-abc', display: { name: 'A custom GPT' } } },
        ],
      },
    },
  });
  const found = await scanner('chatgpt-projects').scan(ask, nothing);
  assert.deepEqual(found.map(item => [item.title, item.url]), [
    ['Intelcraft', 'https://chatgpt.com/g/g-p-123/project'],
  ]);
});

test('every imported id and link is one the companion service will accept', async () => {
  const items = [
    ...(await scanner('claude-chats').scan(
      asker({
        ...twoOrganisations,
        'https://claude.ai/api/organizations/': {
          body: [{ uuid: '019b4e60-8a1f-4c2e-9d33-0cabe6a77d2e', name: 'A chat' }],
        },
      }),
      nothing,
    )),
    ...(await scanner('claude-projects').scan(
      asker({
        ...twoOrganisations,
        'https://claude.ai/api/organizations/': {
          body: [{ uuid: '019b4e60-8a1f-4c2e-9d33-0cabe6a77d2e', name: 'A project' }],
        },
      }),
      nothing,
    )),
  ];
  assert.ok(items.length);
  for (const item of items) {
    // Mirrors the id rule in src-tauri/src/service.rs: a rewritten id would import twice.
    assert.ok(item.id.length <= 64 && /^[A-Za-z0-9-]+$/.test(item.id), item.id);
    const url = new URL(item.url);
    assert.equal(url.protocol, 'https:');
    assert.equal(url.port, '');
    assert.ok(['claude.ai', 'chatgpt.com'].includes(url.hostname));
  }
});

test('an HTTP status becomes advice, and every request is recorded', async () => {
  const signIn = 'Open claude.ai, sign in, and try again.';
  const answers = { 401: /sign in, and try again/, 403: /sign in, and try again/, 429: /slow down/, 500: /came back as 500/ };
  for (const [status, expected] of Object.entries(answers)) {
    const trace = [];
    const ask = makeAsker(async () => ({ status: Number(status), data: {} }), trace, signIn);
    await assert.rejects(() => ask('https://claude.ai/api/organizations'), expected);
    assert.deepEqual(trace, [{ url: '/api/organizations', status: Number(status), held: 'empty object' }]);
  }
  // A page of HTML where JSON was expected is the shape a signed-out or challenged request takes.
  const trace = [];
  const html = makeAsker(async () => ({ status: 200, data: undefined }), trace, 'sign in');
  await assert.rejects(() => html('https://chatgpt.com/backend-api/conversations'), /did not return JSON/);
  assert.equal(trace[0].held, 'not JSON');
});

test('a report names the shape of what came back', () => {
  assert.equal(held({ items: [], total: 0 }), 'items|total');
  assert.equal(held([1, 2, 3]), 'array(3)');
  assert.equal(held(undefined), 'not JSON');
  assert.equal(held({}), 'empty object');
  assert.equal(held(null), 'null');
});

test('each service reads its projects before its chats', () => {
  // A chat can only be filed under a project the service already has.
  assert.deepEqual(SCANNERS.map(entry => entry.id), [
    'claude-projects', 'claude-chats', 'chatgpt-projects', 'chatgpt-chats',
  ]);
});

test('a Claude chat is filed under the project it belongs to', async () => {
  const ask = asker({
    ...twoOrganisations,
    'https://claude.ai/api/organizations/': {
      body: [
        { uuid: 'a', name: 'In a project', project_uuid: 'p1' },
        { uuid: 'b', name: 'Loose chat' },
        { uuid: 'c', name: 'Named the other way', project: { uuid: 'p2' } },
      ],
    },
  });
  const found = await scanner('claude-chats').scan(ask, nothing, newContext());
  assert.deepEqual(found.map(item => [item.id, item.projectId]), [
    ['claude-a', 'claude-project-p1'],
    ['claude-b', ''],
    ['claude-c', 'claude-project-p2'],
  ]);
});

test('a ChatGPT chat is filed under its project, and never under a custom GPT', async () => {
  const ask = asker({
    'https://chatgpt.com/api/auth/session': { body: { accessToken: 'tok' } },
    'https://chatgpt.com/backend-api/conversations': {
      body: {
        items: [
          { id: 'c1', title: 'In a project', gizmo_id: 'g-p-123' },
          { id: 'c2', title: 'Started in a GPT', gizmo_id: 'g-abc' },
          { id: 'c3', title: 'Loose chat' },
        ],
      },
    },
  });
  const found = await scanner('chatgpt-chats').scan(ask, nothing, newContext());
  assert.deepEqual(found.map(item => [item.id, item.projectId]), [
    ['chatgpt-c1', 'chatgpt-g-p-123'],
    ['chatgpt-c2', ''],
    ['chatgpt-c3', ''],
  ]);
});

test('every page of ChatGPT projects is read, not just the first', async () => {
  const pagesByCursor = {
    '': { items: [{ gizmo: { id: 'g-p-1', display: { name: 'One' } } }], cursor: 'next-1' },
    'next-1': { items: [{ gizmo: { id: 'g-p-2', display: { name: 'Two' } } }], cursor: 'next-2' },
    'next-2': { items: [{ gizmo: { id: 'g-p-3', display: { name: 'Three' } } }] },
  };
  const ask = asker({
    'https://chatgpt.com/api/auth/session': { body: { accessToken: 'tok' } },
    'https://chatgpt.com/backend-api/gizmos/snorlax/sidebar': url => ({
      body: pagesByCursor[new URL(url).searchParams.get('cursor') ?? ''],
    }),
  });
  const found = await scanner('chatgpt-projects').scan(ask, nothing, newContext());
  assert.deepEqual(found.map(item => item.title), ['One', 'Two', 'Three']);
});

test('a repeated cursor ends the list instead of looping', async () => {
  let calls = 0;
  const ask = asker({
    'https://chatgpt.com/api/auth/session': { body: { accessToken: 'tok' } },
    'https://chatgpt.com/backend-api/gizmos/snorlax/sidebar': () => {
      calls += 1;
      // An endpoint that ignores the cursor hands back the same page and the same cursor.
      return { body: { items: [{ gizmo: { id: 'g-p-1', display: { name: 'One' } } }], cursor: 'same' } };
    },
  });
  const found = await scanner('chatgpt-projects').scan(ask, nothing, newContext());
  assert.equal(found.length, 1);
  assert.ok(calls <= 2, `asked ${calls} times`);
});

test('a project that lists its own conversations files them', async () => {
  const context = newContext();
  const projects = asker({
    'https://chatgpt.com/api/auth/session': { body: { accessToken: 'tok' } },
    'https://chatgpt.com/backend-api/gizmos/snorlax/sidebar': {
      body: {
        items: [{
          gizmo: { id: 'g-p-9', display: { name: 'Intelcraft' } },
          conversations: [{ id: 'c9' }, { id: 'c10' }],
        }],
      },
    },
  });
  await scanner('chatgpt-projects').scan(projects, nothing, context);

  // The chat list itself says nothing about projects; the project list already did.
  const chats = asker({
    'https://chatgpt.com/api/auth/session': { body: { accessToken: 'tok' } },
    'https://chatgpt.com/backend-api/conversations': {
      body: { items: [{ id: 'c9', title: 'Nine' }, { id: 'c11', title: 'Eleven' }] },
    },
  });
  const found = await scanner('chatgpt-chats').scan(chats, nothing, context);
  assert.deepEqual(found.map(item => [item.id, item.projectId]), [
    ['chatgpt-c9', 'chatgpt-g-p-9'],
    ['chatgpt-c11', ''],
  ]);
});

test('a list is found wherever these services keep it', () => {
  assert.deepEqual(rowsOf([1]), [1]);
  assert.deepEqual(rowsOf({ items: [1] }), [1]);
  assert.deepEqual(rowsOf({ data: [2] }), [2]);
  assert.deepEqual(rowsOf({ conversations: [3] }), [3]);
  assert.deepEqual(rowsOf({ wrapped: [{ uuid: 'x' }] }), [{ uuid: 'x' }]);
  assert.equal(rowsOf({ detail: 'no' }), null);
  assert.equal(rowsOf(null), null);
});
