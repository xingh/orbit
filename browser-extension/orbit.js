// Talking to the Orbit companion service. Shared by the popup and the background scan.
export const api = globalThis.browser ?? globalThis.chrome;

// Orbit binds the first free port in this list, so the extension probes the same range.
const PORTS = [41479, 41480, 41481, 41482, 41483];
// A match pattern's host cannot carry a port, and a port-less one covers every port on the host.
export const ORBIT_ORIGINS = ['http://127.0.0.1/*'];
const PROBE_MS = 600;

export async function stored(keys) {
  return api.storage.local.get(keys);
}

/** Finds the port Orbit is listening on, preferring the one that answered last time. */
export async function findOrbit() {
  const { port: last } = await stored('port');
  const order = last ? [last, ...PORTS.filter(port => port !== last)] : PORTS;
  for (const port of order) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(PROBE_MS) });
      if (response.ok && (await response.json())?.orbit === true) {
        await api.storage.local.set({ port });
        return port;
      }
    } catch { /* Nothing listening on this port. */ }
  }
  return null;
}

/**
 * Posts conversations to Orbit. Throws with a readable reason; a 401 also clears the stored token
 * so the popup asks to pair again.
 */
export async function sendChats(port, token, items) {
  const response = await fetch(`http://127.0.0.1:${port}/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ items }),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401) {
    await api.storage.local.remove('token');
    throw Error('Orbit no longer recognises this browser. Pair it again.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Error(body.error || 'Orbit could not save those chats.');
  }
  return response.json();
}

/** Orbit's workspace has a 2 MB ceiling, so a long history goes over in batches. */
export async function sendInBatches(port, token, items, size, onBatch) {
  let added = 0;
  let skipped = 0;
  // Entries Orbit already had, which this pass filed under a project for the first time.
  let linked = 0;
  for (let at = 0; at < items.length; at += size) {
    const result = await sendChats(port, token, items.slice(at, at + size));
    added += result.added ?? 0;
    skipped += result.skipped ?? 0;
    linked += result.linked ?? 0;
    onBatch?.({ added, skipped, linked, sent: Math.min(at + size, items.length) });
  }
  return { added, skipped, linked };
}
