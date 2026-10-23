#!/usr/bin/env python3
"""Capture the Orbit widget's real UI and assemble the README animation.

Runs the built bundle in Firefox on a virtual display, with Tauri's bridge stubbed (see stub.js)
so the NATIVE widget layout renders rather than the browser page. Drives it through Marionette —
Firefox's own automation protocol, length-prefixed JSON over a socket — so no synthetic input is
sent to the real desktop and the whole run is repeatable.

    pnpm build && python3 docs/screenshots/capture/capture.py [--real] [--keep]

--real uses the live workspace from SQLite instead of the demo one. Only for looking at locally:
the demo data exists because a README is published and Orbit stores conversation titles.
"""
import argparse, base64, functools, io, json, os, pathlib, shutil, signal, socket, subprocess, sys, time

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DIST = ROOT / 'dist'
OUT = HERE.parent
WIDTH = 330          # the compact width the widget actually uses on a 1280x680 work area
TALLEST = 529        # the open widget's height; shorter states are cropped, not resized
DPR = 2              # captured at 2x, downscaled for crispness
DISPLAY = ':99'
PORT = 8731
MARIONETTE = 2829


class Marionette:
    """Minimal Marionette client: `<length>:<json>` frames, [type, id, command, params]."""

    def __init__(self, port):
        self.sock, self.next_id = None, 1
        for _ in range(200):
            try:
                self.sock = socket.create_connection(('127.0.0.1', port), timeout=60)
                break
            except OSError:
                time.sleep(0.3)
        if not self.sock:
            log = pathlib.Path(os.environ.get('TMPDIR', '/tmp')) / 'orbit-shot-firefox.log'
            tail = log.read_text()[-1500:] if log.exists() else '(no log)'
            raise RuntimeError(f'Firefox never opened its Marionette port.\n{tail}')
        self.buffer = b''
        self._read()                       # the server's hello
        self.send('WebDriver:NewSession', {})

    def _read(self):
        while b':' not in self.buffer:
            self.buffer += self.sock.recv(65536)
        length, _, rest = self.buffer.partition(b':')
        need = int(length)
        while len(rest) < need:
            rest += self.sock.recv(65536)
        self.buffer = rest[need:]
        return json.loads(rest[:need])

    def send(self, command, params=None):
        message = json.dumps([0, self.next_id, command, params or {}]).encode()
        self.next_id += 1
        self.sock.sendall(str(len(message)).encode() + b':' + message)
        while True:
            reply = self._read()
            if reply[0] == 1:
                if reply[2]:
                    raise RuntimeError(f'{command}: {reply[2]}')
                return reply[3]

    def script(self, source, *args):
        return self.send('WebDriver:ExecuteScript',
                         {'script': source, 'args': list(args), 'newSandbox': False})['value']

    def element(self, selector):
        found = self.send('WebDriver:FindElement', {'using': 'css selector', 'value': selector})
        return next(iter(found['value'].values()))

    def shot(self, selector=None):
        request = {'full': False, 'hash': False}
        if selector:
            request['id'] = self.element(selector)
        return base64.b64decode(self.send('WebDriver:TakeScreenshot', request)['value'])

    def content_height(self):
        """The bottom of the widget's own content. Everything below it is transparent desktop."""
        return self.script("""
          const parts = [...document.querySelectorAll('.robot-stage, .pill, .panel')];
          return Math.ceil(Math.max(...parts.map(p => p.getBoundingClientRect().bottom)));
        """)


def real_workspace():
    import sqlite3
    db = pathlib.Path.home() / '.local/share/md.tekt.orbit/orbit.sqlite'
    copy = pathlib.Path(os.environ.get('TMPDIR', '/tmp')) / 'orbit-shot-copy.sqlite'
    shutil.copy(db, copy)
    with sqlite3.connect(copy) as conn:
        raw = conn.execute('SELECT json FROM workspace WHERE id = 1').fetchone()[0]
    copy.unlink()
    return json.loads(raw)


def build_harness(workspace):
    """Write dist/harness.html — the built index with the bridge stub injected ahead of the app."""
    index = (DIST / 'index.html').read_text()
    marker = '<script type="module"'
    if marker not in index:
        sys.exit('dist/index.html has no module script — run pnpm build first')
    (DIST / 'harness-stub.js').write_text(stub_source(workspace))
    harness = index.replace(marker, '<script src="./harness-stub.js"></script>\n    ' + marker, 1)
    (DIST / 'harness.html').write_text(harness)


def stub_source(workspace):
    return ('window.__ORBIT_WORKSPACE__ = ' + json.dumps(workspace, separators=(',', ':')) + ';\n'
            + (HERE / 'stub.js').read_text())


# name, caption, and the script that puts the UI in that state.
STEPS = [
    ('01-resting', 'Resting: the robot and its pill', ''),
    ('02-find', '1081 saved chats and projects', """
      document.querySelector('.robot-button').click();
      document.querySelector('.pill button[aria-label="Find"]').click();
    """),
    ('03-search', 'Search by title', """
      const input = document.querySelector('.search-box input');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, 'tauri');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    """),
    ('04-filter', 'Filter by tool', """
      const input = document.querySelector('.search-box input');
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      [...document.querySelectorAll('.filters button')].find(b => b.textContent === 'Claude').click();
    """),
    ('05-projects', 'Projects', """
      [...document.querySelectorAll('.filters button')].find(b => b.textContent === 'All tools').click();
      document.querySelector('.pill button[aria-label="Projects"]').click();
    """),
    ('06-project', 'A project and the chats filed under it', """
      document.querySelectorAll('.result-row .result-main')[2].click();
    """),
    ('07-new', 'Start a chat', """
      document.querySelector('.project-detail .text-button').click();
      document.querySelector('.pill button[aria-label="New chat"]').click();
    """),
    ('08-preferences', 'Preferences', """
      [...document.querySelectorAll('.panel-footer button')].find(b => b.textContent === 'Settings').click();
    """),
    ('09-flat-expanded', 'The 3D robot turned off', """
      document.querySelector('button[aria-label="3D robot"]').click();
    """),
    ('10-flat-find', 'Flat mode gives the panel its height back', """
      document.querySelector('.pill button[aria-label="Find"]').click();
    """),
    ('11-flat-resting', 'Resting, without the renderer', """
      document.querySelector('.robot-button').click();
    """),
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--real', action='store_true', help='use the live SQLite workspace')
    parser.add_argument('--keep', action='store_true', help='keep the per-frame PNGs')
    parser.add_argument('--out', default=None, help='directory for the output (default docs/screenshots)')
    args = parser.parse_args()

    sys.path.insert(0, str(HERE))
    import workspace as workspace_module
    data = real_workspace() if args.real else workspace_module.build()
    print(f'{len(data["items"])} entries ({"live" if args.real else "demo"})')

    out = pathlib.Path(args.out) if args.out else OUT
    frames_dir = out / ('frames-real' if args.real else 'frames')
    frames_dir.mkdir(parents=True, exist_ok=True)
    build_harness(data)

    server = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT)], cwd=DIST,
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    # Firefox refuses to make a normal window narrower than about 500 css px, which is wider than
    # the compact layout the widget uses, so the harness pins the viewport the app sees instead.
    # The display only has to be ROOMIER than the widget: an element taller than the viewport is
    # scrolled into view before it is captured, which silently crops the top off the robot.
    screen = f'{600 * DPR}x{(TALLEST + 160) * DPR}x24'
    xvfb = subprocess.Popen(['Xvfb', DISPLAY, '-screen', '0', screen, '-nolisten', 'tcp'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    profile = pathlib.Path(os.environ.get('TMPDIR', '/tmp')) / 'orbit-shot-profile'
    shutil.rmtree(profile, ignore_errors=True)
    profile.mkdir(parents=True)
    (profile / 'user.js').write_text('\n'.join(f'user_pref({k}, {v});' for k, v in [
        ('"marionette.port"', MARIONETTE),
        ('"layout.css.devPixelsPerPx"', f'"{DPR}"'),
        ('"webgl.force-enabled"', 'true'),
        ('"webgl.disabled"', 'false'),
        ('"gfx.webrender.software"', 'true'),
        ('"browser.shell.checkDefaultBrowser"', 'false'),
        ('"browser.startup.homepage_override.mstone"', '"ignore"'),
        ('"datareporting.policy.dataSubmissionEnabled"', 'false'),
        ('"toolkit.telemetry.enabled"', 'false'),
        ('"browser.aboutwelcome.enabled"', 'false'),
        ('"browser.sessionstore.resume_from_crash"', 'false'),
        ('"dom.disable_beforeunload"', 'true'),
    ]))
    env = {**os.environ, 'DISPLAY': DISPLAY, 'MOZ_ENABLE_WAYLAND': '0'}
    log = pathlib.Path(os.environ.get('TMPDIR', '/tmp')) / 'orbit-shot-firefox.log'
    firefox = subprocess.Popen(['firefox', '--kiosk', '--marionette', '--no-remote', '--new-instance',
                                '--profile', str(profile), 'about:blank'],
                               env=env, stdout=log.open('wb'), stderr=subprocess.STDOUT)
    shots = []
    try:
        time.sleep(2)
        client = Marionette(MARIONETTE)
        client.send('WebDriver:Navigate', {'url': f'http://127.0.0.1:{PORT}/harness.html'})
        for _ in range(80):
            if client.script("return !!document.querySelector('.app.native');"):
                break
            time.sleep(0.25)
        else:
            raise RuntimeError('the native layout never appeared — is the stub reaching isTauri()?')
        root = client.script("""
          const node = document.querySelector('.app.native');
          const box = node.getBoundingClientRect();
          return [Math.round(box.width), Math.round(box.height), window.innerWidth,
                  node.classList.contains('compact')];
        """)
        real_viewport = client.script('return [window.visualViewport.width, window.visualViewport.height];')
        print(f'  widget {root[0]}x{root[1]} css px in a {real_viewport[0]:.0f}x{real_viewport[1]:.0f} '
              f'window, app sees {root[2]}, compact={root[3]}, captured at {DPR}x')
        if real_viewport[1] < TALLEST:
            raise RuntimeError(f'the window is {real_viewport[1]:.0f}px tall but the widget is '
                               f'{TALLEST}px; it would be scrolled and cropped')
        if root[0] != WIDTH or not root[3]:
            raise RuntimeError(f'widget is {root[0]}px wide, compact={root[3]} — expected '
                               f'{WIDTH}px and the compact layout')
        time.sleep(5.0)                                  # let the robot's first frames render
        for name, caption, script in STEPS:
            if script.strip():
                client.script(script)
                time.sleep(1.2)
            time.sleep(1.4)
            height = client.content_height()
            png = frames_dir / f'{name}.png'
            png.write_bytes(crop(client.shot('.app.native'), height))
            shots.append((png, caption, height))
            print(f'  {name:18} {height:>4}px  {caption}')
        notices = client.script("return [...document.querySelectorAll('.toast')].map(t => t.textContent);")
        if notices:
            print(f'  ! toast visible during capture: {notices}')
    finally:
        for process in (firefox, xvfb, server):
            process.send_signal(signal.SIGTERM)
        for process in (firefox, xvfb, server):
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
        for leftover in ('harness.html', 'harness-stub.js'):
            (DIST / leftover).unlink(missing_ok=True)

    animate(shots, out / ('demo-real.gif' if args.real else 'demo.gif'))
    for name in ('01-resting', '02-find', '06-project', '11-flat-resting'):
        source = frames_dir / f'{name}.png'
        if source.exists() and not args.real:
            still(source, out / f'{name.split("-", 1)[1]}.png')
    if not args.keep:
        shutil.rmtree(frames_dir, ignore_errors=True)
    print(f'wrote {out}')


def crop(png_bytes, css_height):
    """Trim the transparent desktop below the widget. The capture is DPR times the CSS size."""
    Image = pillow()
    image = Image.open(io.BytesIO(png_bytes))
    return to_png(image.crop((0, 0, image.width, min(image.height, css_height * DPR))))


def to_png(image):
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    return buffer.getvalue()


def pillow():
    from PIL import Image
    return Image


def still(source, target, width=360):
    Image = pillow()
    image = Image.open(source).convert('RGB')
    image = image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)
    image.save(target, optimize=True)


def animate(shots, target, width=360, hold=1900, tail=2600):
    """One canvas as tall as the tallest state. The widget is top-anchored, as the window is."""
    Image = pillow()
    frames = []
    opened = [(Image.open(p).convert('RGB'), caption) for p, caption, _ in shots]
    scale = width / opened[0][0].width
    sized = [(im.resize((width, round(im.height * scale)), Image.LANCZOS), caption)
             for im, caption in opened]
    canvas_h = max(im.height for im, _ in sized)
    for image, _ in sized:
        canvas = Image.new('RGB', (width, canvas_h), (13, 19, 23))
        canvas.paste(image, (0, 0))
        frames.append(canvas)
    durations = [hold] * len(frames)
    durations[-1] = tail
    first, *rest = [f.convert('P', palette=Image.ADAPTIVE, colors=128) for f in frames]
    first.save(target, save_all=True, append_images=rest, duration=durations, loop=0,
               optimize=True, disposal=2)
    size = target.stat().st_size / 1024
    print(f'{target.name}: {len(frames)} frames, {width}x{canvas_h}, {size:.0f} KB')


if __name__ == '__main__':
    main()
