#!/usr/bin/env bash
# Everything a checkout needs before the first `pnpm tauri dev`, and a check that it worked.
# Run by postCreateCommand; safe to run again by hand.
set -euo pipefail

corepack enable
corepack prepare pnpm@latest --activate
pnpm install --frozen-lockfile

# The capture script wants Pillow. python3-pil is installed system-wide in the image; this only
# reports it, because a missing one is otherwise a traceback halfway through a screenshot run.
python3 -c 'import PIL; print(f"Pillow {PIL.__version__}")' || echo 'Pillow missing'

echo
echo 'Orbit devcontainer ready.'
printf '  %-22s %s\n' \
  'node'    "$(node -v)" \
  'pnpm'    "$(pnpm -v)" \
  'rustc'   "$(rustc --version | cut -d' ' -f2)" \
  'firefox' "$(firefox --version 2>/dev/null | cut -d' ' -f3)" \
  'gh'      "$(gh --version | head -1 | cut -d' ' -f3)"
echo
echo 'Desktop:  http://localhost:6080  (password: vscode) — the window opens there, not in a tab.'
echo 'Checks:   pnpm build && pnpm test && cargo test --manifest-path src-tauri/Cargo.toml'
echo 'Run it:   pnpm tauri dev'
