// Runs the history import. It lives here rather than in the popup because a popup is torn down the
// moment it loses focus, and a full scan takes longer than that.
//
// Each provider is read twice at most. The first attempt fetches from this page, which carries the
// host permission's cookies and is enough for most endpoints. If that finds nothing, the same scan
// runs again inside a tab on the provider, where the requests are same-origin with the signed-in
// session exactly as the site makes them. Whichever attempt finds something wins, every request is
// recorded, and one provider failing never costs another one's history.
import { api, findOrbit, sendInBatches, stored } from './orbit.js';
import { SCANNERS, asker, newContext } from './providers.js';

const BATCH = 100;
const REQUEST_MS = 20000;
const TAB_READY_MS = 20000;
let running = false;

async function report(state) {
  await api.storage.local.set({ import: { ...state, at: Date.now() } });
}

function parse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** A GET from this page: the extension's own origin, with the granted host permission's cookies. */
async function direct(url, headers) {
  const response = await fetch(url, {
    credentials: 'include',
    headers: { Accept: 'application/json', ...headers },
    signal: AbortSignal.timeout(REQUEST_MS),
  });
  return { status: response.status, data: parse(await response.text()) };
}

/** The same GET, run inside a tab on the provider, so it is same-origin with the live session. */
function inPage(tabId) {
  return async (url, headers) => {
    const [injected] = await api.scripting.executeScript({
      target: { tabId },
      args: [url, headers ?? {}],
      func: async (target, extra) => {
        try {
          const response = await fetch(target, {
            credentials: 'include',
            headers: { Accept: 'application/json', ...extra },
          });
          return { status: response.status, text: await response.text() };
        } catch (failure) {
          return { status: 0, text: '', failure: String(failure?.message ?? failure) };
        }
      },
    });
    const result = injected?.result;
    if (!result || result.status === 0) {
      throw Error(result?.failure || 'that page could not be reached.');
    }
    return { status: result.status, data: parse(result.text) };
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** A tab already on the provider, or a background one opened for the attempt and closed after. */
async function providerTab(scanner) {
  const open = await api.tabs.query({ url: scanner.origin });
  const usable = open.find(tab => typeof tab.id === 'number');
  if (usable) return { id: usable.id, opened: false };
  let created;
  try {
    created = await api.tabs.create({ url: scanner.home, active: false });
  } catch {
    return null;
  }
  if (typeof created?.id !== 'number') return null;
  for (let waited = 0; waited < TAB_READY_MS; waited += 400) {
    await sleep(400);
    const tab = await api.tabs.get(created.id).catch(() => null);
    if (!tab) return null;
    if (tab.status === 'complete') break;
  }
  return { id: created.id, opened: true };
}

/** Reads one provider list, falling back to the in-page attempt when this page finds nothing. */
async function scan(scanner, onProgress, context) {
  const trace = [];
  let found = [];
  let failure = null;
  try {
    found = await scanner.scan(asker(direct, trace, scanner.signIn), onProgress, context);
  } catch (error) {
    failure = error;
  }
  if (!found.length) {
    const tab = await providerTab(scanner);
    if (tab) {
      try {
        found = await scanner.scan(asker(inPage(tab.id), trace, scanner.signIn), onProgress, context);
        if (found.length) failure = null;
      } catch (error) {
        failure ??= error;
      } finally {
        if (tab.opened) await api.tabs.remove(tab.id).catch(() => {});
      }
    }
  }
  if (!found.length && failure) throw Object.assign(failure, { trace });
  return { found, trace };
}

async function runImport() {
  if (running) return;
  running = true;
  try {
    const port = await findOrbit();
    const { token } = await stored('token');
    if (!port) throw Error('Orbit is not running.');
    if (!token) throw Error('Pair this browser with Orbit first.');

    const granted = await api.permissions.contains({ origins: [...new Set(SCANNERS.map(s => s.origin))] });
    if (!granted) throw Error('Permission to read your chat lists was not granted.');

    let added = 0;
    let skipped = 0;
    let linked = 0;
    let renamed = 0;
    let removed = 0;
    const problems = [];
    const trace = [];
    // Shared across the lists of one import: a project list often knows which chats belong to it.
    const context = newContext();
    for (const scanner of SCANNERS) {
      const progress = extra =>
        report({ running: true, provider: scanner.label, added, skipped, linked, renamed, removed, ...extra });
      await progress({ found: 0 });
      try {
        const result = await scan(scanner, count => void progress({ found: count }), context);
        trace.push({ scanner: scanner.id, requests: result.trace });
        if (!result.found.length) {
          // A zero is never silent: it is the one thing that cannot be told apart from a bug.
          problems.push(`${scanner.label}: nothing came back to import.`);
          continue;
        }
        const sent = await sendInBatches(
          port,
          token,
          result.found,
          BATCH,
          batch =>
            void progress({
              found: result.found.length,
              sent: batch.sent,
              added: added + batch.added,
              skipped: skipped + batch.skipped,
              linked: linked + batch.linked,
              renamed: renamed + batch.renamed,
            }),
          scanner.sweeps,
        );
        added += sent.added;
        skipped += sent.skipped;
        linked += sent.linked;
        renamed += sent.renamed;
        removed += sent.removed;
        // A refused sweep is the one thing here the user has to hear about: the list read short,
        // so Orbit is still showing entries the provider may no longer have.
        if (sent.refused) problems.push(`${scanner.label}: ${sent.refused}`);
      } catch (failure) {
        trace.push({ scanner: scanner.id, requests: failure.trace ?? [] });
        problems.push(`${scanner.label}: ${failure.message}`);
      }
    }
    await report({ running: false, added, skipped, linked, renamed, removed, problems, trace });
  } catch (failure) {
    await report({ running: false, error: failure.message });
  } finally {
    running = false;
  }
}

api.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.type === 'import') {
    const already = running;
    void runImport();
    respond({ started: !already });
  }
  return false;
});
