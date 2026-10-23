// A stand-in for Tauri's bridge, so the real built bundle renders its NATIVE layout in a browser.
// Nothing in the app is modified or aware of this: `isTauri()` only looks for this global, and the
// @tauri-apps/api functions route every call through `invoke`.
(function () {
  const WORKSPACE = window.__ORBIT_WORKSPACE__;
  const SCALE = 2;
  // The reporter's own display: 2560x1440 at scale 2, work area 2560x1360 physical.
  const monitor = {
    name: 'demo',
    scaleFactor: SCALE,
    position: { x: 0, y: 0 },
    size: { width: 2560, height: 1440 },
    workArea: { position: { x: 0, y: 0 }, size: { width: 2560, height: 1360 } },
  };
  let next = 1;
  const answers = {
    load_data: () => JSON.stringify(WORKSPACE),
    save_data: () => undefined,
    capabilities: () => ({ os: 'linux', shortcut: true, shortcut_label: 'Ctrl + Shift + Space' }),
    service_info: () => ({
      port: 41479, pairing_seconds: 0,
      paired: [{ origin: 'browser:firefox', label: 'Firefox' }, { origin: 'browser:chrome', label: 'Chrome' }],
    }),
    'plugin:event|listen': () => next++,
    'plugin:event|unlisten': () => undefined,
    'plugin:window|current_monitor': () => monitor,
    'plugin:window|primary_monitor': () => monitor,
    'plugin:window|scale_factor': () => SCALE,
    'plugin:window|outer_position': () => ({ x: 120, y: 120 }),
    'plugin:window|inner_size': () => ({ width: window.innerWidth * SCALE, height: window.innerHeight * SCALE }),
    'plugin:window|outer_size': () => ({ width: window.innerWidth * SCALE, height: window.innerHeight * SCALE }),
  };
  window.isTauri = true;          // what isTauri() actually looks at
  window.__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: 'main' },
      currentWebview: { label: 'main', windowLabel: 'main' },
    },
    transformCallback(callback) {
      const id = next++;
      window[`_${id}`] = callback;
      return id;
    },
    unregisterCallback(id) { delete window[`_${id}`]; },
    convertFileSrc(path) { return path; },
    invoke(cmd) {
      const answer = answers[cmd];
      // Everything else — set_size, set_position, start_dragging, open_url — is a no-op here.
      return Promise.resolve(answer ? answer() : undefined);
    },
  };
  // Firefox will not make a window narrower than about 500 css px, and the widget's compact
  // layout appears below 430. So the viewport is reported as the real widget's size instead, and
  // the root is pinned to it — the app's own layout is driven by that size, so what renders is
  // what the desktop window renders.
  const VIEW = { width: 330, height: 529 };
  for (const [axis, value] of [['innerWidth', VIEW.width], ['innerHeight', VIEW.height]]) {
    try {
      Object.defineProperty(window, axis, { get: () => value, configurable: true });
    } catch (error) {
      console.warn(`could not pin ${axis}`, error);
    }
  }
  // The desktop behind the widget. The real window is transparent, so without this the captures
  // would sit on the browser's white.
  const style = document.createElement('style');
  style.textContent = `html,body{background:#0d1317!important;margin:0}
    html:has(.native),body:has(.native){background:#0d1317!important}
    .app.native{width:${VIEW.width}px!important;height:${VIEW.height}px!important}`;
  document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  if (document.head) document.head.appendChild(style);
})();
