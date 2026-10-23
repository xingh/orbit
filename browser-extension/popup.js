// Saves the current conversation into Orbit's loopback companion service, and starts a one-off
// import of everything already in your history. Works unchanged in Chrome, Edge and Firefox.
import { api, ORBIT_ORIGINS, findOrbit, sendChats, stored } from './orbit.js';
import { SCAN_ORIGINS } from './providers.js';

const el = id => document.querySelector(`#${id}`);
const [title, message, statusText, dot, queueHint, progress, diagnostics] =
  ['title', 'message', 'status-text', 'dot', 'queue', 'progress', 'diagnostics'].map(el);
const [saveButton, pairButton, connectButton, importButton, reportButton] =
  ['save', 'pair', 'connect', 'import', 'report'].map(el);

let current = null; // The saveable conversation in the active tab, if any.
let port = null;    // Where Orbit answered.
let token = null;   // Pairing token, once this browser is paired.
let polling = null;

/**
 * Mirrors the provider rules in `src/providers.mjs`; Orbit validates again before saving.
 * Web chats only: Claude Code and Codex are local coding tools, launched from Orbit itself.
 */
function conversation(tab) {
  const url = new URL(tab.url);
  const provider =
    url.hostname === 'claude.ai' ? 'claude'
    : url.hostname === 'chatgpt.com' ? 'chatgpt'
    : url.hostname === 'grok.com' ? 'grok'
    : null;
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !provider) {
    throw Error('Open a conversation on Claude, ChatGPT or Grok first.');
  }
  if (url.pathname.startsWith('/code') || url.pathname.startsWith('/codex')) {
    throw Error('Orbit saves web chats. Claude Code and Codex are launched from Orbit itself.');
  }
  return { url: url.href, provider, hostname: url.hostname };
}

function setStatus(text, state) {
  statusText.textContent = text;
  dot.className = `dot ${state}`;
}

async function queued() {
  const { queue = [] } = await stored('queue');
  return queue;
}

async function setQueue(queue) {
  await api.storage.local.set({ queue });
  showQueue(queue.length);
}

function showQueue(count) {
  queueHint.hidden = count === 0;
  queueHint.textContent = count === 1
    ? '1 chat is waiting for Orbit. It will be sent when Orbit is running.'
    : `${count} chats are waiting for Orbit. They will be sent when Orbit is running.`;
}

/** Sends anything that was saved while Orbit was closed. */
async function flush() {
  const waiting = await queued();
  if (!waiting.length || !token || !port) return;
  try {
    await sendChats(port, token, waiting);
    await setQueue([]);
    message.textContent = waiting.length === 1
      ? 'Sent the chat that was waiting for Orbit.'
      : `Sent ${waiting.length} chats that were waiting for Orbit.`;
  } catch { /* Left in the queue for the next attempt. */ }
}

async function hold(item) {
  const waiting = await queued();
  if (!waiting.some(entry => entry.url === item.url)) waiting.push(item);
  await setQueue(waiting);
}

/** The report a person can paste back when an import does not do what they expected. */
function reportText(state) {
  const lines = [
    `Orbit import ${new Date(state.at ?? Date.now()).toISOString()}`,
    `added ${state.added ?? 0}, already saved ${state.skipped ?? 0}, filed ${state.linked ?? 0}`,
  ];
  if (state.error) lines.push(`stopped: ${state.error}`);
  for (const problem of state.problems ?? []) lines.push(`problem: ${problem}`);
  for (const { scanner, requests } of state.trace ?? []) {
    lines.push(`[${scanner}]`);
    for (const request of requests) {
      lines.push(`  ${request.status} ${request.url} -> ${request.held}`);
    }
  }
  return lines.join('\n');
}

function renderImport(state) {
  if (!state) return;
  progress.hidden = false;
  if (state.running) {
    const sent = state.sent ? `, ${state.sent} sent` : '';
    progress.textContent = `Reading ${state.provider}: ${state.found} found${sent}…`;
    importButton.disabled = true;
    reportButton.hidden = true;
    return;
  }
  importButton.disabled = false;
  if (polling) { clearInterval(polling); polling = null; }
  if (state.error) {
    progress.textContent = `Import stopped: ${state.error}`;
  } else {
    const problems = state.problems?.length ? ` ${state.problems.join(' ')}` : '';
    const filed = state.linked ? ` Filed ${state.linked} under their projects.` : '';
    progress.textContent =
      `Imported ${state.added} chats and projects, ${state.skipped} already saved.${filed}${problems}`;
  }
  // Offered only when something went wrong, since that is when the detail is worth having.
  reportButton.hidden = !(state.error || state.problems?.length);
  reportButton.dataset.report = reportText(state);
}

function watchImport() {
  if (polling) clearInterval(polling);
  polling = setInterval(async () => renderImport((await stored('import')).import), 600);
}

async function connect() {
  const saved = await stored(['token', 'queue']);
  token = saved.token ?? null;
  showQueue((saved.queue ?? []).length);

  // Optional permissions are asked for from a click, in both browsers.
  if (!(await api.permissions.contains({ origins: ORBIT_ORIGINS }))) {
    setStatus('Orbit needs your permission to reach this computer.', 'warn');
    connectButton.hidden = false;
    return;
  }
  connectButton.hidden = true;

  port = await findOrbit();
  if (!port) {
    setStatus('Orbit is not running. Saves wait here until it is.', 'warn');
    return;
  }
  if (!token) {
    setStatus('Orbit is running, but this browser is not paired yet.', 'warn');
    pairButton.hidden = false;
    return;
  }
  pairButton.hidden = true;
  importButton.hidden = false;
  setStatus('Connected to Orbit.', 'ok');
  renderImport((await stored('import')).import);
  await flush();
}

connectButton.addEventListener('click', async () => {
  try {
    if (!(await api.permissions.request({ origins: ORBIT_ORIGINS }))) {
      message.textContent = 'Without that permission the extension cannot reach Orbit.';
      return;
    }
    message.textContent = '';
    await connect();
  } catch (failure) {
    message.textContent = `Could not ask for that permission: ${failure.message}`;
  }
});

pairButton.addEventListener('click', async () => {
  pairButton.disabled = true;
  try {
    const response = await fetch(`http://127.0.0.1:${port}/pair`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(body.error || 'Orbit refused to pair.');
    token = body.token;
    await api.storage.local.set({ token });
    pairButton.hidden = true;
    importButton.hidden = false;
    message.textContent = 'Paired with Orbit.';
    setStatus('Connected to Orbit.', 'ok');
    await flush();
  } catch (failure) {
    message.textContent = failure.message || 'Could not pair with Orbit.';
  } finally {
    pairButton.disabled = false;
  }
});

importButton.addEventListener('click', async () => {
  try {
    // Asked for only when it is used, so the permission prompt has an obvious reason.
    if (!(await api.permissions.request({ origins: SCAN_ORIGINS }))) {
      message.textContent = 'Orbit needs access to your chat lists to import them.';
      return;
    }
    message.textContent = '';
    importButton.disabled = true;
    progress.hidden = false;
    progress.textContent = 'Starting…';
    await api.runtime.sendMessage({ type: 'import' });
    watchImport();
  } catch (failure) {
    importButton.disabled = false;
    message.textContent = `Could not start the import: ${failure.message}`;
  }
});

reportButton.addEventListener('click', async () => {
  const text = reportButton.dataset.report ?? '';
  try {
    await navigator.clipboard.writeText(text);
    message.textContent = 'Import report copied.';
  } catch {
    // Clipboard access can be refused; showing the text is just as good.
    diagnostics.hidden = false;
    diagnostics.value = text;
    diagnostics.select();
    message.textContent = 'Copy the report below.';
  }
});

saveButton.addEventListener('click', async () => {
  if (!current || !title.value.trim()) return;
  saveButton.disabled = true;
  const item = {
    id: crypto.randomUUID(),
    type: 'chat',
    title: title.value.trim(),
    url: current.url,
    provider: current.provider,
    note: '',
    updated: Date.now(),
  };
  try {
    if (!port) throw Error('Orbit is not running, so this chat is waiting here.');
    if (!token) throw Error('This browser is not paired with Orbit yet, so this chat is waiting here.');
    const { added, skipped } = await sendChats(port, token, [item]);
    message.textContent = added ? 'Saved to Orbit.'
      : skipped ? 'Orbit already has this chat.'
      : 'Orbit did not accept this chat.';
  } catch (failure) {
    // Nothing is lost either way: the chat stays queued until a save succeeds.
    await hold(item);
    message.textContent = failure.message;
  } finally {
    saveButton.disabled = false;
  }
});

try {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  current = conversation(tab);
  title.value = tab.title || 'Saved conversation';
  el('service').textContent = `${current.hostname} · Only the title and link are saved.`;
} catch (failure) {
  saveButton.disabled = true;
  title.disabled = true;
  message.textContent = failure.message || 'This page cannot be saved.';
}

await connect();
