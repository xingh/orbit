import test from 'node:test';
import assert from 'node:assert/strict';
import { anchorOf, place } from '../src/placement.mjs';

const area = { left: 0, top: 0, right: 1280, bottom: 680 };
const open = { width: 330, height: 529, stage: 126, expanded: true, reach: 83 };
const closed = { ...open, height: 205, expanded: false };
const at = (cx, top) => ({ cx, top });

test('opens below when there is room, leaving the robot where it was', () => {
  assert.deepEqual(place({ ...open, anchor: at(640, 100), area }), { x: 475, y: 100, above: false, shift: 0, height: 529 });
});

test('opens above near the bottom edge, with the robot still in place', () => {
  const p = place({ ...open, anchor: at(640, 500), area });
  assert.equal(p.above, true);
  assert.equal(p.y + 529 - 126, 500);
  assert.deepEqual(anchorOf({ ...p, width: 330, height: 529, stage: 126 }), at(640, 500));
});

test('collapsing after opening above puts the window back on the robot', () => {
  const opened = place({ ...open, anchor: at(640, 500), area });
  const anchor = anchorOf({ ...opened, width: 330, height: 529, stage: 126 });
  assert.deepEqual(place({ ...closed, anchor, area }), { x: 475, y: 421, above: true, shift: 0, height: 205 });
});

test('where neither side fits, the panel shrinks to the larger side and the robot stays put', () => {
  // macOS, 1600x1200 with the menu bar and Dock excluded; the robot dragged to the middle.
  const mac = { left: 0, top: 30, right: 1600, bottom: 1115 };
  const p = place({ width: 465, height: 747, minHeight: 430, stage: 185, expanded: true, reach: 70, anchor: at(796, 484), area: mac });
  assert.equal(p.above, true);
  assert.equal(p.height, 639);
  assert.equal(p.y + p.height - 185, 484);
});

test('the panel never shrinks below its minimum; then the robot gives way', () => {
  const p = place({ ...open, minHeight: 430, anchor: at(640, 250), area: { ...area, bottom: 600 } });
  assert.equal(p.height, 430);
  assert.ok(p.y >= 0 && p.y + 430 <= 600);
});

test('closed near the Dock, the pill moves above the robot and the robot is not pushed up', () => {
  const mac = { left: 0, top: 30, right: 1600, bottom: 1115 };
  const p = place({ width: 465, height: 270, stage: 185, expanded: false, reach: 70, anchor: at(792, 925), area: mac });
  assert.equal(p.above, true);
  assert.equal(p.y + 270 - 185, 925);
});

test('closed with room below, the pill stays under the robot', () => {
  const p = place({ ...closed, anchor: at(640, 300), area });
  assert.equal(p.above, false);
  assert.equal(p.y, 300);
});

test('closed, the robot can sit closer to a side edge than the window is wide', () => {
  const p = place({ ...closed, anchor: at(1250, 100), area });
  assert.equal(p.x + 165 + p.shift, 1250);
  assert.ok(p.x + 330 > 1280, 'transparent margin past the edge');
});

test('near the left edge the window stays on screen and the robot slides toward the edge', () => {
  const p = place({ ...open, anchor: at(100, 100), area });
  assert.equal(p.x, 0);
  assert.equal(p.x + 165 + p.shift, 100);
});

test('in the bottom-right corner the panel opens up and to the left', () => {
  const p = place({ ...open, anchor: at(1150, 500), area });
  assert.equal(p.above, true);
  assert.equal(p.x, 1280 - 330);
  assert.ok(p.shift > 0, 'robot sits right of the window centre');
  assert.equal(p.x + 165 + p.shift, 1150);
});

test('the robot never slides past the window edge', () => {
  const p = place({ ...open, anchor: at(10, 100), area });
  assert.equal(p.shift, -(165 - 83));
});

test('a monitor left of the primary, with negative coordinates', () => {
  const left = { left: -1280, top: 0, right: 0, bottom: 1024 };
  assert.deepEqual(place({ ...open, anchor: at(-640, 100), area: left }), { x: -805, y: 100, above: false, shift: 0, height: 529 });
  const edge = place({ ...open, anchor: at(-20, 100), area: left });
  assert.equal(edge.x, -330);
});

test('a work area that starts below a top bar is respected', () => {
  const p = place({ ...open, anchor: at(640, 10), area: { ...area, top: 32 } });
  assert.equal(p.y, 32);
});

test('the window padding is counted, so flipping the pill does not move the robot', () => {
  const mac = { left: 0, top: 30, right: 1600, bottom: 1160 };
  const anchor = anchorOf({ x: 551, y: 976, width: 480, height: 270, stage: 185, pad: 8 });
  const p = place({ width: 480, height: 270, stage: 185, expanded: false, reach: 70, pad: 8, anchor, area: mac });
  assert.equal(p.above, true);
  assert.equal(anchorOf({ ...p, width: 480, stage: 185, pad: 8 }).top, Math.min(anchor.top, 1160 - 185));
});
