// Shared by browser and verifier: no DOM, clock, or unseeded randomness.
export const WIDTH = 1280, HEIGHT = 720, FPS = 60, MAX_FRAMES = FPS * 120;
export const INPUT = { LEFT: 1, RIGHT: 2, THRUST: 4, REVERSE: 8, FIRE: 16 } as const;
export type Body = { x: number; y: number; vx: number; vy: number; radius: number; angle: number; id: number };
export type GameEvent = { x: number; y: number; kind: "rock" | "ship" };
export type GameState = {
  seed: number; random: number; frame: number; score: number; lives: number; hits: number;
  shotsFired: number; shield: number; cooldown: number; spawn: number; nextId: number;
  ship: Body; rocks: Body[]; bullets: (Body & { ttl: number })[]; events: GameEvent[]; ended: boolean;
};
export function createGame(seed: number): GameState {
  return { seed, random: seed >>> 0, frame: 0, score: 0, lives: 3, hits: 0, shotsFired: 0,
    shield: 120, cooldown: 0, spawn: 1, nextId: 1,
    ship: { x: WIDTH / 2, y: HEIGHT / 2, vx: 0, vy: 0, radius: 16, angle: -Math.PI / 2, id: 0 },
    rocks: [], bullets: [], events: [], ended: false };
}
function random(s: GameState) {
  s.random = (Math.imul(s.random, 1664525) + 1013904223) >>> 0;
  return s.random / 4294967296;
}
function wrap(n: number, length: number, margin = 0) {
  return ((n + margin) % (length + 2 * margin) + length + 2 * margin) % (length + 2 * margin) - margin;
}
function collide(a: Body, b: Body) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= (a.radius + b.radius) ** 2; }
function spawnRock(s: GameState) {
  const edge = Math.floor(random(s) * 4), along = random(s);
  const x = edge === 0 ? -60 : edge === 1 ? WIDTH + 60 : along * WIDTH;
  const y = edge === 2 ? -60 : edge === 3 ? HEIGHT + 60 : along * HEIGHT;
  const angle = Math.atan2(HEIGHT / 2 - y, WIDTH / 2 - x) + (random(s) - .5) * 1.3;
  const speed = 65 + random(s) * 65 + Math.floor(s.frame / 1800) * 20;
  s.rocks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    radius: (1 + Math.floor(random(s) * 3)) * 20, angle: random(s) * Math.PI * 2, id: s.nextId++ });
}
export function step(s: GameState, input: number): void {
  if (s.ended) return;
  s.events = []; s.frame++; s.shield = Math.max(0, s.shield - 1); s.cooldown--;
  const p = s.ship;
  p.angle += (((input & INPUT.RIGHT) ? 1 : 0) - ((input & INPUT.LEFT) ? 1 : 0)) * (5 * Math.PI / 3) / FPS;
  const move = ((input & INPUT.THRUST) ? 1 : 0) - ((input & INPUT.REVERSE) ? .6 : 0);
  p.vx = Math.cos(p.angle) * 240 * move; p.vy = Math.sin(p.angle) * 240 * move;
  p.x = wrap(p.x + p.vx / FPS, WIDTH); p.y = wrap(p.y + p.vy / FPS, HEIGHT);
  if ((input & INPUT.FIRE) && s.cooldown <= 0) {
    s.cooldown = 18; s.shotsFired++;
    s.bullets.push({ x: p.x + Math.cos(p.angle) * 22, y: p.y + Math.sin(p.angle) * 22,
      vx: Math.cos(p.angle) * 500, vy: Math.sin(p.angle) * 500, radius: 4,
      angle: p.angle, ttl: 100, id: s.nextId++ });
  }
  if (--s.spawn <= 0 && s.rocks.length < 60) { spawnRock(s); s.spawn = Math.max(25, 48 - Math.floor(s.frame / 1800) * 6); }
  for (const rock of s.rocks) {
    rock.x = wrap(rock.x + rock.vx / FPS, WIDTH, 65); rock.y = wrap(rock.y + rock.vy / FPS, HEIGHT, 65); rock.angle += .003;
  }
  for (const bullet of s.bullets) { bullet.x += bullet.vx / FPS; bullet.y += bullet.vy / FPS; bullet.ttl--; }
  const deadRocks = new Set<number>(), deadBullets = new Set<number>(), children: Body[] = [];
  for (const bullet of s.bullets) for (const rock of s.rocks) {
    if (deadRocks.has(rock.id) || !collide(rock, bullet)) continue;
    deadRocks.add(rock.id); deadBullets.add(bullet.id);
    s.score += rock.radius === 60 ? 20 : rock.radius === 40 ? 50 : 100; s.hits++;
    s.events.push({ x: rock.x, y: rock.y, kind: "rock" });
    if (rock.radius > 20) {
      const offset = .35 + random(s) * .52;
      for (const sign of [-1, 1]) {
        const a = offset * sign;
        children.push({ ...rock, radius: rock.radius - 20, id: s.nextId++,
          vx: (rock.vx * Math.cos(a) - rock.vy * Math.sin(a)) * 1.2,
          vy: (rock.vx * Math.sin(a) + rock.vy * Math.cos(a)) * 1.2 });
      }
    }
    break;
  }
  s.rocks = s.rocks.filter(r => !deadRocks.has(r.id)).concat(children);
  s.bullets = s.bullets.filter(b => !deadBullets.has(b.id) && b.ttl > 0 && b.x > -10 && b.x < WIDTH + 10 && b.y > -10 && b.y < HEIGHT + 10);
  if (s.shield === 0 && s.rocks.some(r => collide(r, p))) {
    s.events.push({ x: p.x, y: p.y, kind: "ship" }); s.lives--; s.shield = 150;
    p.x = WIDTH / 2; p.y = HEIGHT / 2; p.angle = -Math.PI / 2;
  }
  s.ended = s.lives <= 0 || s.frame >= MAX_FRAMES;
}
