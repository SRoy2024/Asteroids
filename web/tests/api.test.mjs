import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { createGame, step, INPUT } from '../lib/game/engine.ts';
import { sqlite } from './d1-test-env.mjs';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'cloudflare:workers') return { url: new URL('./d1-test-env.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('@/')) return { url: new URL('../' + specifier.slice(2) + '.ts', import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
} });
const { POST: start } = await import('../app/api/runs/route.ts');
const { POST: finish } = await import('../app/api/runs/finish/route.ts');
const { GET: leaderboard } = await import('../app/api/leaderboard/route.ts');
let cookie = '';
async function request(handler, path, data, headers = {}) {
  const response = await handler(new Request('https://arcade.test' + path, {
    method: data === undefined ? 'GET' : 'POST', headers: { ...(data !== undefined ? { 'Content-Type': 'application/json', Origin: 'https://arcade.test' } : {}), Cookie: cookie, ...headers }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  }));
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  return { status: response.status, data: await response.json(), cookie: setCookie };
}
test('API verifies actual replay, rejects tampering, saves once, and ranks in SQLite', async () => {
  mock.timers.enable({ apis: ['Date'], now: 1_800_000_000_000 });
  try {
    assert.equal((await request(start, '/api/runs', { name: '<script>' })).status, 400);
    assert.equal((await request(start, '/api/runs', { name: 'QA' }, { Origin: 'https://attacker.test' })).status, 403);
    assert.equal((await request(start, '/api/runs', { name: 'QA' }, { 'Content-Type': 'text/plain' })).status, 415);
    const started = await request(start, '/api/runs', { name: 'QA Pilot' });
    assert.equal(started.status, 201); assert.match(started.cookie, /HttpOnly/); assert.match(started.cookie, /Secure/);
    const run = started.data, state = createGame(run.seed), controls = []; let previous = -1;
    while (!state.ended) {
      const input = INPUT.FIRE | INPUT.THRUST | (state.frame % 400 < 250 ? INPUT.LEFT : INPUT.RIGHT);
      if (input !== previous) { controls.push([state.frame, input]); previous = input; }
      step(state, input);
    }
    const payload = { id: run.id, token: run.token, frames: state.frame, controls, score: 99999999 };
    assert.equal((await request(finish, '/api/runs/finish', { ...payload, token: 'wrong' })).status, 403);
    assert.equal((await request(finish, '/api/runs/finish', { ...payload, frames: 500 })).status, 400);
    assert.equal((await request(finish, '/api/runs/finish', { ...payload, frames: 30, controls: [[0, 0], [0, 31]] })).status, 400);
    const ownCookie = cookie; cookie = '';
    assert.equal((await request(finish, '/api/runs/finish', payload)).status, 401); cookie = ownCookie;
    mock.timers.tick(130000);
    const saved = await request(finish, '/api/runs/finish', payload);
    assert.equal(saved.status, 200); assert.equal(saved.data.score, state.score); assert.notEqual(saved.data.score, payload.score);
    const retry = await request(finish, '/api/runs/finish', { ...payload, frames: 1, controls: [] });
    assert.deepEqual(retry.data, saved.data);
    assert.equal(sqlite.prepare('SELECT count(*) AS count FROM runs WHERE finished_at IS NOT NULL').get().count, 1);
    const board = await request(leaderboard, '/api/leaderboard');
    assert.equal(board.status, 200); assert.equal(board.data.personal.best, state.score); assert.equal(board.data.stats.flights, 1);
    if (state.score > 0) { assert.equal(board.data.entries[0].name, 'QA Pilot'); assert.equal(board.data.entries[0].isYou, 1); }
    // Multiple flights from the same browser remain one leaderboard entry.
    const another = await request(start, '/api/runs', { name: 'QA Pilot 2' }); mock.timers.tick(1000);
    await request(finish, '/api/runs/finish', { ...another.data, frames: 1, controls: [] });
    const deduped = await request(leaderboard, '/api/leaderboard'); assert.equal(deduped.data.stats.flights, 2);
    assert.ok(deduped.data.entries.length <= 1);
    mock.timers.tick(8 * 86400000);
    const week = await request(leaderboard, '/api/leaderboard?period=week'); assert.equal(week.data.entries.length, 0); assert.equal(week.data.stats.flights, 0);
    assert.equal((await request(leaderboard, '/api/leaderboard')).data.stats.flights, 2);
    const expired = await request(start, '/api/runs', { name: 'Expired Pilot' }); mock.timers.tick(3600001);
    assert.equal((await request(finish, '/api/runs/finish', { ...expired.data, frames: 1, controls: [] })).status, 410);
    console.log(`Verified flight: ${state.score} points over ${state.frame} frames.`);
  } finally { mock.timers.reset(); }
});
