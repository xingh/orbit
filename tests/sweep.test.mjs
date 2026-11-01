import test from 'node:test';
import assert from 'node:assert/strict';

// orbit.js reaches for the extension APIs as it loads, and the sweep is the one thing in it worth
// testing: it has to arrive after the last batch, carry every id of the whole list, and be absent
// for a scanner that does not claim a complete list.
globalThis.browser = { storage: { local: { get: async () => ({}), set: async () => {}, remove: async () => {} } } };
const { sendInBatches } = await import('../browser-extension/orbit.js');

/** Records every POST body and answers with counts Orbit would return. */
function recorder(reply = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(JSON.parse(init.body));
    return {
      ok: true,
      status: 200,
      json: async () => ({ added: 0, skipped: 0, linked: 0, renamed: 0, removed: 0, ...reply }),
    };
  };
  return calls;
}

const items = Array.from({ length: 5 }, (_, n) => ({ id: `p${n}` }));

test('a sweep is sent once, after the batches, naming every id in the list', async () => {
  const calls = recorder({ removed: 2 });
  const result = await sendInBatches(1, 't', items, 2, undefined, { provider: 'claude', type: 'project' });

  // Three batches of two, then the sweep.
  assert.equal(calls.length, 4);
  assert.deepEqual(calls.slice(0, 3).map(c => c.items.length), [2, 2, 1]);
  assert.equal(calls.slice(0, 3).every(c => c.sweep === undefined), true);
  assert.deepEqual(calls[3], {
    items: [],
    sweep: { provider: 'claude', type: 'project', ids: ['p0', 'p1', 'p2', 'p3', 'p4'] },
  });
  assert.equal(result.removed, 2);
});

test('a scanner with no sweep never asks Orbit to remove anything', async () => {
  const calls = recorder();
  const result = await sendInBatches(1, 't', items, 2);
  assert.equal(calls.length, 3);
  assert.equal(calls.every(c => c.sweep === undefined), true);
  assert.deepEqual([result.removed, result.refused], [0, null]);
});

test('a refused sweep is handed back rather than thrown away', async () => {
  recorder({ removed: 0, refused: 'that looks like a short read.' });
  const result = await sendInBatches(1, 't', items, 100, undefined, { provider: 'chatgpt', type: 'project' });
  assert.equal(result.refused, 'that looks like a short read.');
  assert.equal(result.removed, 0);
});

test('renames are totalled across batches', async () => {
  recorder({ renamed: 3 });
  const result = await sendInBatches(1, 't', items, 2);
  assert.equal(result.renamed, 9);
});
