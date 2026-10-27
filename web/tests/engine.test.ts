import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame, step, INPUT, MAX_FRAMES } from '../lib/game/engine.ts';
import { verifyReplay, type ControlEvent } from '../lib/game/replay.ts';

test('a browser recording replays to the same complete state', () => {
  const state = createGame(1234567), controls: ControlEvent[] = [];
  let previous = -1;
  while (!state.ended) {
    const input = INPUT.FIRE | (state.frame % 240 < 170 ? INPUT.THRUST : 0) | (state.frame % 400 < 220 ? INPUT.RIGHT : INPUT.LEFT);
    if (input !== previous) { controls.push([state.frame, input]); previous = input; }
    step(state, input);
  }
  const replayed = verifyReplay(1234567, state.frame, controls);
  assert.deepEqual(replayed, state);
  assert.ok(state.score > 0);
  assert.ok(state.frame <= MAX_FRAMES);
});

test('a bullet hits once, awards points, and creates two smaller fragments', () => {
  const s = createGame(1); s.spawn = 999; s.shield = 100;
  s.rocks.push({ x: 200, y: 200, vx: 0, vy: 0, radius: 60, id: 100, angle: 0 });
  for (let i = 0; i < 2; i++) s.bullets.push({ x: 200, y: 200, vx: 0, vy: 0, radius: 4, id: 200 + i, angle: 0, ttl: 10 });
  step(s, 0);
  assert.equal(s.score, 20); assert.equal(s.hits, 1);
  assert.equal(s.rocks.length, 2); assert.ok(s.rocks.every(r => r.radius === 40));
  assert.equal(s.bullets.length, 1);
});

test('the smallest asteroid awards 100 points without splitting', () => {
  const s = createGame(1); s.spawn = 999;
  s.rocks.push({ x: 200, y: 200, vx: 0, vy: 0, radius: 20, id: 100, angle: 0 });
  s.bullets.push({ x: 200, y: 200, vx: 0, vy: 0, radius: 4, id: 200, angle: 0, ttl: 10 });
  step(s, 0); assert.equal(s.score, 100); assert.equal(s.rocks.length, 0);
});

test('hit consumes one life, respawns, and provides temporary protection', () => {
  const s = createGame(1); s.spawn = 999; s.shield = 0;
  s.rocks.push({ ...s.ship, radius: 60, id: 100 });
  step(s, 0); assert.equal(s.lives, 2); assert.equal(s.shield, 150);
  step(s, 0); assert.equal(s.lives, 2);
});

test('ship wraps, fire cooldown applies, and ended games are immutable', () => {
  const s = createGame(5); s.ship.x = 1279; s.ship.angle = 0;
  step(s, INPUT.THRUST | INPUT.FIRE); assert.ok(s.ship.x < 10); assert.equal(s.shotsFired, 1);
  step(s, INPUT.FIRE); assert.equal(s.shotsFired, 1);
  s.frame = MAX_FRAMES - 1; step(s, 0); assert.equal(s.ended, true);
  const snapshot = structuredClone(s); step(s, 31); assert.deepEqual(s, snapshot);
});

test('malformed, out-of-order, oversized, and post-death recordings are rejected', () => {
  for (const frames of [0, -1, 1.5, MAX_FRAMES + 1, NaN, '60', null]) assert.throws(() => verifyReplay(1, frames, []));
  for (const controls of [[[0, 32]], [[0, -1]], [[0, 1], [0, 2]], [[3, 1], [2, 1]], [[60, 1]], [[-1, 0]], [[0, 0, 4]], [[1.1, 0]], {}, null]) assert.throws(() => verifyReplay(1, 60, controls));
  const s = createGame(1); while (!s.ended) step(s, 0);
  if (s.frame < MAX_FRAMES) assert.throws(() => verifyReplay(1, s.frame + 1, []));
});
