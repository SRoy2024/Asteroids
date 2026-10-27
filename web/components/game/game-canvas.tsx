"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Body, createGame, FPS, GameState, HEIGHT, INPUT, step, WIDTH } from "@/lib/game/engine";
import type { ControlEvent } from "@/lib/game/replay";
export type Flight = { score: number; frames: number; hits: number; shotsFired: number; controls: ControlEvent[] };
export type CanvasHandle = { start: (seed: number) => void; pause: (paused: boolean) => void; end: () => void; input: (bit: number, held: boolean) => void; clear: () => void };
const keyBits: Record<string, number> = { ArrowLeft: 1, a: 1, ArrowRight: 2, d: 2, ArrowUp: 4, w: 4, ArrowDown: 8, s: 8, " ": 16 };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
function rockPath(ctx: CanvasRenderingContext2D, rock: Body, time: number) {
  ctx.save(); ctx.translate(rock.x, rock.y); ctx.rotate(rock.angle + time);
  ctx.beginPath();
  for (let i = 0; i < 11; i++) {
    const a = i / 11 * Math.PI * 2, radius = rock.radius * (.77 + .23 * Math.abs(Math.sin(rock.id * 17 + i * 4)));
    const x = Math.cos(a) * radius, y = Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fillStyle = "#251f1a"; ctx.fill();
  ctx.strokeStyle = "#b9a188"; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-rock.radius * .25, -rock.radius * .4); ctx.lineTo(rock.radius * .1, -rock.radius * .15); ctx.lineTo(rock.radius * .3, -rock.radius * .3);
  ctx.strokeStyle = "#6b5947"; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
}
function shipPath(ctx: CanvasRenderingContext2D, p: Body, thrust: boolean, time: number, shield = false) {
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
  if (thrust) {
    ctx.beginPath(); ctx.moveTo(-15, -7); ctx.lineTo(-34 - Math.sin(time * 38) * 9, 0); ctx.lineTo(-15, 7);
    ctx.fillStyle = "#c8f99b"; ctx.shadowColor = "#b9ff83"; ctx.shadowBlur = 18; ctx.fill(); ctx.shadowBlur = 0;
  }
  ctx.beginPath(); ctx.moveTo(23, 0); ctx.lineTo(-15, -14); ctx.lineTo(-9, 0); ctx.lineTo(-15, 14); ctx.closePath();
  ctx.fillStyle = "#182c22"; ctx.strokeStyle = "#d1ffad"; ctx.lineWidth = 2.2;
  ctx.shadowColor = "#b9ff83"; ctx.shadowBlur = 15; ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
  if (shield) { ctx.beginPath(); ctx.arc(0, 0, 33, 0, Math.PI * 2); ctx.strokeStyle = "#c9f99a65"; ctx.lineWidth = 1; ctx.setLineDash([3, 6]); ctx.stroke(); }
  ctx.restore();
}
export const GameCanvas = forwardRef<CanvasHandle, { onEnd: (flight: Flight) => void; onTick: (s: { score: number; lives: number; frame: number; hits: number }) => void; onPause: () => void; sound: boolean }>(function GameCanvas({ onEnd, onTick, onPause, sound }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null), state = useRef<GameState | null>(null);
  const active = useRef(false), paused = useRef(false), keys = useRef(new Set<string>()), touch = useRef(0);
  const controls = useRef<ControlEvent[]>([]), lastInput = useRef(-1), particles = useRef<Particle[]>([]);
  const callbacks = useRef({ onEnd, onTick, onPause, sound });
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => { callbacks.current = { onEnd, onTick, onPause, sound }; }, [onEnd, onTick, onPause, sound]);
  function finish() {
    const s = state.current;
    if (!s || !active.current) return;
    if (s.frame === 0) { controls.current.push([0, 0]); step(s, 0); }
    active.current = false; keys.current.clear(); touch.current = 0;
    callbacks.current.onEnd({ score: s.score, frames: s.frame, hits: s.hits, shotsFired: s.shotsFired, controls: controls.current.slice() });
  }
  useImperativeHandle(ref, () => ({
    start(seed) {
      state.current = createGame(seed); controls.current = []; lastInput.current = -1; particles.current = [];
      paused.current = false; keys.current.clear(); touch.current = 0; active.current = true;
      if (callbacks.current.sound) { audio.current ??= new AudioContext(); void audio.current.resume(); }
    },
    pause(value) { paused.current = value; keys.current.clear(); touch.current = 0; },
    end: finish,
    input(bit, held) { touch.current = held ? touch.current | bit : touch.current & ~bit; },
    clear() { state.current = null; active.current = false; },
  }));
  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext("2d")!;
    let raf = 0, previous = 0, accumulator = 0;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function beep(frequency: number, duration: number, volume: number) {
      if (!callbacks.current.sound || !audio.current || audio.current.state !== "running") return;
      const osc = audio.current.createOscillator(), gain = audio.current.createGain();
      osc.type = "triangle"; osc.frequency.setValueAtTime(frequency, audio.current.currentTime);
      osc.frequency.exponentialRampToValueAtTime(frequency * .35, audio.current.currentTime + duration);
      gain.gain.setValueAtTime(volume, audio.current.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.current.currentTime + duration);
      osc.connect(gain); gain.connect(audio.current.destination); osc.start(); osc.stop(audio.current.currentTime + duration);
    }
    function inputMask() { let mask = touch.current; for (const key of keys.current) mask |= keyBits[key] ?? 0; return mask; }
    function render(now: number) {
      const dt = previous ? Math.min((now - previous) / 1000, .1) : 0;
      previous = now;
      const s = state.current;
      if (active.current && !paused.current && s) {
        accumulator += dt;
        while (accumulator >= 1 / FPS && active.current) {
          const mask = inputMask();
          if (mask !== lastInput.current) { controls.current.push([s.frame, mask]); lastInput.current = mask; }
          const shots = s.shotsFired;
          step(s, mask); accumulator -= 1 / FPS;
          if (shots !== s.shotsFired) beep(650, .07, .018);
          for (const event of s.events) {
            beep(event.kind === "rock" ? 130 : 60, .18, .035);
            if (!reduced) for (let i = 0; i < 14; i++) {
              const a = Math.random() * Math.PI * 2, velocity = 35 + Math.random() * 160;
              particles.current.push({ x: event.x, y: event.y, vx: Math.cos(a) * velocity, vy: Math.sin(a) * velocity, life: .7, color: event.kind === "ship" ? "#c9f99a" : "#e6af7c" });
            }
          }
          if (s.frame % 6 === 0 || s.ended) callbacks.current.onTick({ score: s.score, lives: s.lives, frame: s.frame, hits: s.hits });
          if (s.ended) finish();
        }
      } else accumulator = 0;
      ctx.fillStyle = "#101713"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      const glow = ctx.createRadialGradient(WIDTH * .55, HEIGHT * .52, 0, WIDTH * .55, HEIGHT * .52, 640);
      glow.addColorStop(0, "#21352560"); glow.addColorStop(1, "#10171300"); ctx.fillStyle = glow; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      for (let i = 0; i < 150; i++) {
        const x = ((i * 739 + 19) % WIDTH), y = ((i * 419 + 83) % HEIGHT);
        ctx.fillStyle = i % 8 === 0 ? "#a8b5a9" : "#627168";
        ctx.globalAlpha = reduced ? .6 : .3 + Math.abs(Math.sin(i + now / 3200)) * .5;
        ctx.fillRect(x, y, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#78928013"; ctx.lineWidth = 1;
      for (const radius of [145, 280, 425, 565]) { ctx.beginPath(); ctx.ellipse(WIDTH / 2, HEIGHT / 2, radius, radius * .8, -.25, 0, Math.PI * 2); ctx.stroke(); }
      if (s) {
        for (const r of s.rocks) rockPath(ctx, r, 0);
        ctx.strokeStyle = "#ddffbd"; ctx.lineWidth = 3;
        for (const b of s.bullets) {
          ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx / 75, b.y - b.vy / 75); ctx.stroke();
        }
        if (s.lives > 0 && (s.shield === 0 || s.frame % 12 < 9)) shipPath(ctx, s.ship, !!(inputMask() & INPUT.THRUST) && active.current && !paused.current, now / 1000, s.shield > 0);
      } else {
        const t = reduced ? 0 : now / 1000;
        const positions = [[180, 148, 57], [1060, 190, 68], [941, 560, 42], [278, 559, 34], [781, 95, 22], [1128, 410, 23], [439, 195, 21]];
        positions.forEach(([x, y, r], i) => rockPath(ctx, { x: x + Math.sin(t * .2 + i) * 13, y: y + Math.cos(t * .14 + i) * 12, radius: r, id: i + 1, angle: i, vx: 0, vy: 0 }, reduced ? 0 : t * .035));
        ctx.save(); ctx.translate(870, 352); ctx.rotate(-.48);
        const trail = ctx.createLinearGradient(-240, 0, 0, 0); trail.addColorStop(0, "#b8e99a00"); trail.addColorStop(1, "#b8e99a45");
        ctx.fillStyle = trail; ctx.beginPath(); ctx.moveTo(-250, -2); ctx.lineTo(-10, -13); ctx.lineTo(-10, 13); ctx.closePath(); ctx.fill(); ctx.restore();
        shipPath(ctx, { x: 870, y: 352, angle: -.48, radius: 20, id: 0, vx: 0, vy: 0 }, true, t);
      }
      particles.current = particles.current.filter(p => p.life > 0);
      for (const p of particles.current) {
        if (!paused.current) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
        ctx.globalAlpha = Math.max(0, p.life / .7); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3);
      }
      ctx.globalAlpha = 1; raf = requestAnimationFrame(render);
    }
    const down = (e: KeyboardEvent) => {
      if (!active.current || (e.target instanceof HTMLElement && /INPUT|TEXTAREA|BUTTON/.test(e.target.tagName))) return;
      if (e.key === "Escape" || e.key.toLowerCase() === "p") { e.preventDefault(); if (!e.repeat) callbacks.current.onPause(); return; }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (keyBits[key]) { e.preventDefault(); keys.current.add(key); }
    };
    const up = (e: KeyboardEvent) => { keys.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key); };
    const blur = () => { keys.current.clear(); touch.current = 0; if (active.current && !paused.current) callbacks.current.onPause(); };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("blur", blur); document.addEventListener("visibilitychange", visibility);
    raf = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("blur", blur); document.removeEventListener("visibilitychange", visibility); void audio.current?.close(); audio.current = null; };
  }, []);
  return <canvas ref={canvas} width={WIDTH} height={HEIGHT} className="game-canvas" aria-label="Asteroids playfield. Use arrows or WASD to steer, space to fire, P to pause." tabIndex={0} />;
});
