# Ubuntu 24.04 to match what CI builds on, so a failure here is a failure there.
FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# 1. Tauri's own Linux prerequisites — the same list .github/workflows/ci.yml installs, plus the
#    build toolchain and libsoup/javascriptcore that webkit2gtk links against.
# 2. The GUI verification stack. Orbit is a desktop app: `xvfb` gives it a display, `x11-apps`
#    provides xwd for captures, and xdotool drives it. docs/screenshots/capture/capture.py needs
#    all three, and so does anyone checking a layout change without a monitor.
# 3. sqlite3 to read the workspace, and Pillow for the capture script's image assembly.
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      build-essential curl file wget pkg-config \
      libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev \
      libssl-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev \
      patchelf xdg-utils \
      xvfb x11-apps x11-utils xdotool wmctrl \
      sqlite3 python3-pil python3-venv \
 && rm -rf /var/lib/apt/lists/*

# Firefox drives the extension and the screenshot capture through Marionette. Ubuntu's own
# `firefox` package is a snap stub, which cannot run in a container, so it comes from Mozilla's
# APT repository instead — and is pinned above the snap stub so an upgrade cannot swap it back.
RUN install -d -m 0755 /etc/apt/keyrings \
 && wget -qO- https://packages.mozilla.org/apt/repo-signing-key.gpg > /etc/apt/keyrings/packages.mozilla.org.asc \
 && echo "deb [signed-by=/etc/apt/keyrings/packages.mozilla.org.asc] https://packages.mozilla.org/apt mozilla main" \
      > /etc/apt/sources.list.d/mozilla.list \
 && printf 'Package: *\nPin: origin packages.mozilla.org\nPin-Priority: 1000\n' \
      > /etc/apt/preferences.d/mozilla \
 && apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends firefox \
 && rm -rf /var/lib/apt/lists/*

# Cargo's registry and the build directory are what make a rebuild slow; devcontainer.json mounts
# a named volume over each. CARGO_HOME is left to the rust feature, which puts it in
# /usr/local/cargo — setting it here would only be overridden, and the mount would miss.
