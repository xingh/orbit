// Where the window goes so the robot stays where the user left it and the panel opens into the room
// the work area actually has. Logical pixels throughout; `area` is the monitor's work area, so the
// taskbar or Dock is already excluded.
const clamp = (value, low, high) => Math.max(low, Math.min(value, Math.max(low, high)));

// The robot's on-screen anchor — horizontal centre and top of its stage — from the window as laid out now.
export function anchorOf({ x, y, width, height, stage, shift = 0, above = false }) {
  return { cx: x + width / 2 + shift, top: above ? y + height - stage : y };
}

// `reach` is how far the robot may come to the window's edge as it slides sideways inside it.
export function place({ anchor, width, height, minHeight = height, stage, expanded, area, reach = width / 2 }) {
  const { left, top, right, bottom } = area;
  const limit = Math.max(0, width / 2 - reach);
  if (!expanded) {
    // Closed, only the robot has to stay on screen. Where the pill would land behind the Dock or
    // taskbar it moves above the robot instead, and the window moves up so the robot does not.
    const x = Math.round(clamp(anchor.cx - width / 2, left - limit, right - width + limit));
    const robot = clamp(anchor.top, top, bottom - stage), above = robot + height > bottom;
    const y = Math.round(above ? robot + stage - height : robot);
    return { x, y, above, shift: Math.round(anchor.cx - (x + width / 2)), height };
  }
  const below = bottom - anchor.top, overhead = anchor.top + stage - top;
  const fits = below >= height || overhead >= height;
  const above = below < height && overhead > below;
  // Where neither side has room, a shorter panel (it scrolls) beats moving the robot.
  const tall = fits ? height : Math.round(clamp(Math.max(below, overhead), minHeight, height));
  const y = Math.round(clamp(above ? anchor.top + stage - tall : anchor.top, top, bottom - tall));
  const x = Math.round(clamp(anchor.cx - width / 2, left, right - width));
  const shift = Math.round(clamp(anchor.cx - (x + width / 2), -limit, limit));
  return { x, y, above, shift, height: tall };
}
