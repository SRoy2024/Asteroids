// The same fixed-step arena rules run on the server and in bot practice.
export const ARENA_W = 2400, ARENA_H = 1600, TICK_MS = 50, ROOM_LIMIT = 8;
export const COLORS = ['#31d9ff', '#a477ff', '#ff3d72', '#407bff', '#ef5dff', '#ff534a'];
export type Point = { x: number; y: number };
export type Orb = Point & { id: number; value: number; color: number };
export type ArenaPlayer = Point & {
  id: string; pilot: string; tokenHash: string; name: string; color: number; angle: number; target: number;
  turn: number; boost: boolean; energy: number; kills: number; trail: Point[]; alive: boolean;
  joined: number; lastSeen: number; ended: number; cause: string; shieldUntil: number; seq: number; bot: boolean;
};
export type World = { time: number; random: number; nextOrb: number; players: ArenaPlayer[]; orbs: Orb[]; tick: number };
export type PublicPlayer = Omit<ArenaPlayer, 'pilot' | 'tokenHash' | 'lastSeen' | 'seq'>;
export type Snapshot = { room: string; time: number; tick: number; players: PublicPlayer[]; orbs: Orb[]; population: number };
function random(w: World) { w.random = (Math.imul(w.random, 1664525) + 1013904223) >>> 0; return w.random / 4294967296; }
export function makeWorld(seed: number, now: number): World {
  const w: World = { time: Math.floor(now / TICK_MS) * TICK_MS, random: seed >>> 0, nextOrb: 1, players: [], orbs: [], tick: 0 };
  while (w.orbs.length < 180) addOrb(w);
  return w;
}
function addOrb(w: World, point?: Point, value?: number, color?: number) {
  w.orbs.push({ x: point?.x ?? 60 + random(w) * (ARENA_W - 120), y: point?.y ?? 60 + random(w) * (ARENA_H - 120),
    value: value ?? 2 + Math.floor(random(w) * 4), color: color ?? Math.floor(random(w) * COLORS.length), id: w.nextOrb++ });
}
export function addPlayer(w: World, input: { id: string; pilot: string; tokenHash: string; name: string; color: number; bot?: boolean }, now: number) {
  let x = ARENA_W / 2, y = ARENA_H / 2, a = 0;
  for (let attempt = 0; attempt < 40; attempt++) {
    x = 170 + random(w) * (ARENA_W - 340); y = 170 + random(w) * (ARENA_H - 340); a = random(w) * Math.PI * 2;
    if (w.players.every(p => !p.alive || p.trail.every(t => (x - t.x) ** 2 + (y - t.y) ** 2 > 260 ** 2))) break;
  }
  const p: ArenaPlayer = { ...input, bot: !!input.bot, x, y, angle: a, target: a, turn: 0, boost: false,
    energy: 0, kills: 0, trail: [], alive: true, joined: now, lastSeen: now, ended: 0, cause: '', shieldUntil: now + 3000, seq: -1 };
  for (let i = 0; i < 14; i++) p.trail.push({ x: x - Math.cos(a) * i * 5, y: y - Math.sin(a) * i * 5 });
  w.players.push(p); return p;
}
export function eliminate(w: World, p: ArenaPlayer, cause: string, now: number, killer?: ArenaPlayer) {
  if (!p.alive) return;
  p.alive = false; p.ended = now; p.cause = cause; p.boost = false;
  if (killer?.alive) killer.kills++;
  for (let i = 0; i < p.trail.length; i += 4) addOrb(w, p.trail[i], 4, p.color);
  if (w.orbs.length > 340) w.orbs.splice(0, w.orbs.length - 340);
}
function angleDifference(a: number, b: number) { return Math.atan2(Math.sin(a - b), Math.cos(a - b)); }
export function arenaStep(w: World) {
  w.time += TICK_MS; w.tick++;
  const live = w.players.filter(p => p.alive);
  for (const p of live) {
    if (p.bot) {
      p.lastSeen = w.time;
      if (w.tick % 8 === 0) {
        let nearest: Orb | undefined, distance = Infinity;
        for (const o of w.orbs) { const d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2; if (d < distance) { nearest = o; distance = d; } }
        p.target = nearest ? Math.atan2(nearest.y - p.y, nearest.x - p.x) : p.angle + .2;
        if (p.x < 160 || p.x > ARENA_W - 160 || p.y < 160 || p.y > ARENA_H - 160) p.target = Math.atan2(ARENA_H / 2 - p.y, ARENA_W / 2 - p.x);
      }
    }
    if (p.turn) p.target = p.angle + p.turn * .7;
    const difference = angleDifference(p.target, p.angle);
    p.angle += Math.max(-.15, Math.min(.15, difference));
    const boosting = p.boost && p.energy >= 10;
    const speed = boosting ? 210 : 130;
    const old = { x: p.x, y: p.y };
    p.x += Math.cos(p.angle) * speed * .05; p.y += Math.sin(p.angle) * speed * .05;
    // Insert multiple points when boosting, retaining roughly five-pixel spacing.
    const steps = Math.ceil(speed * .05 / 5);
    for (let i = 1; i <= steps; i++) p.trail.unshift({ x: old.x + (p.x - old.x) * i / steps, y: old.y + (p.y - old.y) * i / steps });
    const maxPoints = Math.min(150, 14 + Math.floor(p.energy / 4));
    if (p.trail.length > maxPoints) p.trail.length = maxPoints;
    if (boosting && w.tick % 4 === 0) { p.energy--; addOrb(w, p.trail[p.trail.length - 1], 1, p.color); }
    for (let i = w.orbs.length - 1; i >= 0; i--) {
      const orb = w.orbs[i];
      if ((orb.x - p.x) ** 2 + (orb.y - p.y) ** 2 < 21 ** 2) { p.energy += orb.value; w.orbs.splice(i, 1); }
    }
  }
  // Decide deaths from one simultaneous world snapshot; iteration order cannot save a colliding head.
  const deaths: { p: ArenaPlayer; cause: string; killer?: ArenaPlayer }[] = [];
  for (const p of live) {
    if (p.x < 13 || p.x > ARENA_W - 13 || p.y < 13 || p.y > ARENA_H - 13) { deaths.push({ p, cause: 'You reached the arena boundary.' }); continue; }
    if (w.time < p.shieldUntil) continue;
    for (const other of live) {
      if (other.id === p.id || w.time < other.shieldUntil) continue;
      if (other.trail.some(t => (t.x - p.x) ** 2 + (t.y - p.y) ** 2 < 15 ** 2)) { deaths.push({ p, cause: `You hit ${other.name}’s trail.`, killer: other }); break; }
    }
  }
  for (const d of deaths) eliminate(w, d.p, d.cause, w.time, d.killer);
  while (w.orbs.length < 180) addOrb(w);
  if (w.orbs.length > 340) w.orbs.splice(0, w.orbs.length - 340);
}
export function advanceWorld(w: World, now: number) {
  for (const p of w.players) if (p.alive && !p.bot && now - p.lastSeen > 10000) eliminate(w, p, 'Your connection timed out.', now);
  w.players = w.players.filter(p => p.alive || now - p.ended < 60000);
  const dead = w.players.filter(p => !p.alive);
  if (dead.length > 48) { const keep = new Set(dead.slice(-48).map(p => p.id)); w.players = w.players.filter(p => p.alive || keep.has(p.id)); }
  // Idle rooms do not simulate unbounded catch-up on the next request.
  if (now - w.time > 2000) w.time = Math.floor((now - 2000) / TICK_MS) * TICK_MS;
  while (w.time + TICK_MS <= now) arenaStep(w);
}
export function snapshot(w: World, room: string, self: string): Snapshot {
  return { room, time: w.time, tick: w.tick, population: w.players.filter(p => p.alive).length,
    orbs: w.orbs, players: w.players.filter(p => p.alive || p.id === self).map(p => {
      const { pilot: _pilot, tokenHash: _token, lastSeen: _last, seq: _seq, ...visible } = p;
      return visible;
    }) };
}
