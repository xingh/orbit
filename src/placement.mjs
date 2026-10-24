// Where the window goes so the robot stays where the user left it and the panel opens into the room
// the work area actually has. Logical pixels throughout; `area` is the monitor's work area, so the
// taskbar or Dock is already excluded.
const clamp = (value, low, high) => Math.max(low, Math.min(value, Math.max(low, high)));

// The robot's on-screen anchor — horizontal centre and top of its stage — from the window as laid out now.
export function anchorOf({ x, y, width, height, stage, shift = 0, above = false }) {
  return { cx: x + width / 2 + shift, top: above ? y + height - stage : y };
}

// `reach` is half the robot's width: the robot may slide sideways inside the window, but never past its edge.
export function place({ anchor, width, height, stage, expanded, area, reach = width / 2 }) {
  const { left, top, right, bottom } = area;
  const below = bottom - anchor.top, overhead = anchor.top + stage - top;
  const above = expanded && below < height && overhead > below;
  const y = Math.round(clamp(above ? anchor.top + stage - height : anchor.top, top, bottom - height));
  const x = Math.round(clamp(anchor.cx - width / 2, left, right - width));
  const limit = Math.max(0, width / 2 - reach);
  const shift = Math.round(clamp(anchor.cx - (x + width / 2), -limit, limit));
  return { x, y, above, shift };
}
