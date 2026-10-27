"use client";
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, Crosshair, Globe2, Loader2, LogOut, Radio, Rocket, Shield, Trophy, Users, Zap } from 'lucide-react';
import { ArcadeDeck, ArcadeNotice } from "@/components/arcade-trim";
import { addPlayer, ARENA_H, ARENA_W, arenaStep, COLORS, makeWorld, PublicPlayer, snapshot, Snapshot } from '@/lib/arena/engine';
import { usePortalGameplay } from "@/lib/crazygames";
type Session = { id: string; token: string; room: string };
type Score = { rank: number; name: string; score: number; kills: number; isYou: number };
async function request<T>(url: string, data?: unknown): Promise<T> {
  const res = await fetch(url, { method: data ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
    ...(data ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}), signal: AbortSignal.timeout(6000) });
  const value = await res.json() as T & { error?: string };
  if (!res.ok) throw new Error(value.error ?? 'Signal lost. Trying again…');
  return value;
}
function drawShip(ctx: CanvasRenderingContext2D, p: PublicPlayer, own: boolean, now: number) {
  const color = COLORS[p.color];
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (p.trail.length > 1) {
    ctx.beginPath(); p.trail.forEach((t, i) => i ? ctx.lineTo(t.x, t.y) : ctx.moveTo(t.x, t.y));
    ctx.strokeStyle = color; ctx.lineWidth = 11; ctx.shadowColor = color; ctx.shadowBlur = 13; ctx.globalAlpha = .65; ctx.stroke();
    ctx.shadowBlur = 0; ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.globalAlpha = .65; ctx.stroke(); ctx.globalAlpha = 1;
  }
  ctx.translate(p.x, p.y); ctx.rotate(p.angle);
  if (p.boost && p.energy >= 10) { ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 20; ctx.beginPath(); ctx.moveTo(-15, -6); ctx.lineTo(-36, 0); ctx.lineTo(-15, 6); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(21, 0); ctx.lineTo(-12, -12); ctx.lineTo(-7, 0); ctx.lineTo(-12, 12); ctx.closePath();
  ctx.fillStyle = '#0b1025'; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.shadowColor = color; ctx.shadowBlur = 13; ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
  if (now < p.shieldUntil) { ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.setLineDash([3, 5]); ctx.strokeStyle = color + '88'; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.restore(); ctx.save(); ctx.font = '10px ui-monospace, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = own ? '#fff' : '#aeb5d6'; ctx.fillText(`${p.bot ? 'BOT · ' : ''}${p.name}${own ? ' · YOU' : ''}`, p.x, p.y - 37); ctx.restore();
}
export function NeonArena({ practice, name, setName }: { practice: boolean; name: string; setName: (name: string) => void }) {
  const [session, setSession] = useState<Session | null>(null), [world, setWorld] = useState<Snapshot | null>(null);
  const [code, setCode] = useState(''), [color, setColor] = useState(0), [joining, setJoining] = useState(false), [error, setError] = useState('');
  const [connection, setConnection] = useState(''), [latency, setLatency] = useState(0), [copied, setCopied] = useState(false);
  const [scores, setScores] = useState<Score[]>([]), [boardError, setBoardError] = useState(''), [period, setPeriod] = useState('all');
  const canvas = useRef<HTMLCanvasElement>(null), current = useRef<Snapshot | null>(null), active = useRef<Session | null>(null);
  const input = useRef({ angle: 0, boost: false }), keys = useRef(new Set<string>()), sequence = useRef(0);
  const camera = useRef({ x: ARENA_W / 2, y: ARENA_H / 2, scale: 1 }), received = useRef(0), previous = useRef<Snapshot | null>(null);
  const mounted = useRef(true), touchStart = useRef<{ x: number; y: number } | null>(null);
  const self = world?.players.find(p => p.id === session?.id), dead = !!self && !self.alive;
  usePortalGameplay(!!session && !!self?.alive);
  const standings = world?.players.filter(p => p.alive).sort((a, b) => b.energy - a.energy || b.kills - a.kills) ?? [];
  const boardVersion = `${session?.id ?? ''}:${dead}`;
  useEffect(() => { current.current = world; }, [world]);
  useEffect(() => {
    mounted.current = true;
    if (practice) return;
    let disposed = false;
    const load = async () => {
      try { const data = await request<{ entries: Score[] }>(`/api/arena/leaderboard?period=${period}`); if (!disposed) { setScores(data.entries); setBoardError(''); } }
      catch { if (!disposed) setBoardError('Leaderboard signal unavailable. Try again shortly.'); }
    };
    void load(); const timer = setInterval(() => void load(), 20000);
    return () => { disposed = true; clearInterval(timer); };
  }, [practice, period, boardVersion]);
  useEffect(() => {
    return () => {
      mounted.current = false;
      const s = active.current;
      if (s && s.room !== 'PRACTICE') void fetch('/api/arena/leave', { method: 'POST', credentials: 'same-origin', keepalive: true,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }).catch(() => {});
      active.current = null;
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    let disposed = false, timer: ReturnType<typeof setTimeout> | undefined;
    const heldInput = () => {
      const k = keys.current;
      const x = Number(k.has('arrowright') || k.has('d')) - Number(k.has('arrowleft') || k.has('a'));
      const y = Number(k.has('arrowdown') || k.has('s')) - Number(k.has('arrowup') || k.has('w'));
      if (x || y) input.current.angle = Math.atan2(y, x);
      return { angle: input.current.angle, turn: 0, boost: input.current.boost || k.has(' ') };
    };
    if (practice) {
      const now = Date.now(), w = makeWorld(crypto.getRandomValues(new Uint32Array(1))[0], now);
      const hero = addPlayer(w, { id: session.id, pilot: 'local', tokenHash: '', name: name.trim(), color }, now);
      input.current.angle = hero.angle;
      for (let i = 0; i < 4; i++) addPlayer(w, { id: `bot-${i}`, pilot: 'bot', tokenHash: '', name: ['VEGA', 'NOVA', 'ECHO', 'ION'][i], color: (color + i + 1) % 6, bot: true }, now);
      const tick = () => {
        if (disposed || !hero.alive) return;
        const control = heldInput(); hero.target = control.angle; hero.boost = control.boost; hero.lastSeen = w.time;
        for (const bot of w.players.filter(p => p.bot && !p.alive && w.time - p.ended > 3000)) {
          w.players = w.players.filter(p => p.id !== bot.id);
          addPlayer(w, { id: bot.id, pilot: 'bot', tokenHash: '', name: bot.name, color: bot.color, bot: true }, w.time);
        }
        arenaStep(w); const next = structuredClone(snapshot(w, 'PRACTICE', session.id));
        previous.current = current.current; current.current = next; received.current = performance.now(); setWorld(next);
        timer = setTimeout(tick, 50);
      };
      tick(); setConnection('OFFLINE · 4 BOTS');
    } else {
      const poll = async () => {
        const started = performance.now();
        try {
          const data = await request<{ world: Snapshot }>('/api/arena/sync', { ...session, seq: sequence.current++, ...heldInput() });
          if (disposed) return;
          previous.current = current.current; current.current = data.world; received.current = performance.now();
          setWorld(data.world); setLatency(Math.round(performance.now() - started)); setConnection('CONNECTED'); setError('');
          const you = data.world.players.find(p => p.id === session.id);
          if (!you || !you.alive) { if (!you) setError('This session expired. Leave the room and rejoin.'); return; }
        } catch (e) { if (!disposed) { setConnection('RECONNECTING'); setError(e instanceof Error ? e.message : 'Signal lost. Trying again…'); } }
        if (!disposed) timer = setTimeout(poll, Math.max(160, 300 - (performance.now() - started)));
      };
      timer = setTimeout(poll, 300);
    }
    return () => { disposed = true; if (timer) clearTimeout(timer); };
  }, [session, practice]);
  useEffect(() => {
    const el = canvas.current!, ctx = el.getContext('2d')!;
    let raf = 0;
    const down = (e: KeyboardEvent) => {
      if (!active.current || (e.target instanceof HTMLElement && /INPUT|BUTTON|TEXTAREA/.test(e.target.tagName))) return;
      const key = e.key.toLowerCase();
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) { e.preventDefault(); keys.current.add(key); }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => { keys.current.clear(); input.current.boost = false; };
    function draw(now: number) {
      const box = el.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(box.width * dpr), height = Math.round(box.height * dpr);
      if (el.width !== width || el.height !== height) { el.width = width; el.height = height; }
      ctx.setTransform(dpr,0,0,dpr,0,0); ctx.fillStyle = '#080b1b'; ctx.fillRect(0,0,box.width,box.height);
      const s = current.current, hero = s?.players.find(p => p.id === active.current?.id);
      const targetX = hero?.x ?? ARENA_W / 2, targetY = hero?.y ?? ARENA_H / 2;
      camera.current.x += (targetX - camera.current.x) * .12; camera.current.y += (targetY - camera.current.y) * .12;
      const scale = Math.min(1.15, Math.max(.55, box.width / 1000)); camera.current.scale = scale;
      ctx.save(); ctx.translate(box.width / 2, box.height / 2); ctx.scale(scale, scale); ctx.translate(-camera.current.x, -camera.current.y);
      const left = camera.current.x - box.width / scale / 2, top = camera.current.y - box.height / scale / 2;
      ctx.lineWidth = 1 / scale; ctx.strokeStyle = '#303c6a45';
      ctx.beginPath();
      for (let x = Math.floor(left / 60) * 60; x < left + box.width / scale; x += 60) { ctx.moveTo(x, top); ctx.lineTo(x, top + box.height / scale); }
      for (let y = Math.floor(top / 60) * 60; y < top + box.height / scale; y += 60) { ctx.moveTo(left, y); ctx.lineTo(left + box.width / scale, y); }
      ctx.stroke(); ctx.strokeStyle = '#ff3d72'; ctx.lineWidth = 4; ctx.shadowColor = '#ff3d72'; ctx.shadowBlur = 15; ctx.strokeRect(0, 0, ARENA_W, ARENA_H); ctx.shadowBlur = 0;
      if (s) {
        for (const orb of s.orbs) {
          if (orb.x < left - 15 || orb.x > left + box.width / scale + 15 || orb.y < top - 15 || orb.y > top + box.height / scale + 15) continue;
          ctx.fillStyle = COLORS[orb.color]; ctx.shadowColor = COLORS[orb.color]; ctx.shadowBlur = 9;
          ctx.beginPath(); ctx.arc(orb.x, orb.y, 2 + Math.min(orb.value, 8) * .4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0;
        const fraction = Math.min(1, Math.max(0, (now - received.current) / (practice ? 50 : 300)));
        for (const p of s.players) {
          if (!p.alive) continue;
          const old = previous.current?.players.find(q => q.id === p.id && q.alive);
          const rendered = old ? { ...p, x: old.x + (p.x - old.x) * fraction, y: old.y + (p.y - old.y) * fraction,
            angle: old.angle + Math.atan2(Math.sin(p.angle - old.angle), Math.cos(p.angle - old.angle)) * fraction } : p;
          drawShip(ctx, rendered, p.id === hero?.id, s.time);
        }
      } else {
        const t = now / 1000;
        for (let i = 0; i < 70; i++) {
          const x = ARENA_W / 2 - 550 + (i * 137 % 1100), y = ARENA_H / 2 - 340 + (i * 199 % 680);
          ctx.fillStyle = COLORS[i % 6]; ctx.shadowColor = COLORS[i % 6]; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(x,y,2.5,0,Math.PI*2);ctx.fill();
        }
        ctx.shadowBlur = 0;
        for (let n = 0; n < 3; n++) {
          const points = Array.from({ length: 55 }, (_, i) => ({ x: 1300 + n * 100 + Math.cos(t * .12 + n + i * .027) * (210 + n * 55), y: 760 + Math.sin(t * .12 + n + i * .027) * (155 + n * 35) }));
          drawShip(ctx, { ...points[0], id: String(n), name: '', color: n, angle: t * .12 + n + Math.PI/2, target: 0, turn:0, boost:false, energy:100, kills:0, trail:points, alive:true, joined:0, ended:0, cause:'', shieldUntil:0, bot:false }, false, Date.now());
        }
      }
      ctx.restore();
      if (hero?.alive && s) {
        const mw = 117, mh = 78, mx = box.width - mw - 15, my = box.height - mh - 15;
        ctx.fillStyle = '#070a1de0';ctx.fillRect(mx,my,mw,mh);ctx.strokeStyle='#a477ff77';ctx.strokeRect(mx,my,mw,mh);
        for (const p of s.players.filter(p => p.alive)) {ctx.fillStyle=COLORS[p.color];ctx.beginPath();ctx.arc(mx+p.x/ARENA_W*mw,my+p.y/ARENA_H*mh,p.id===hero.id?3:2,0,Math.PI*2);ctx.fill();}
      }
      raf = requestAnimationFrame(draw);
    }
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);raf=requestAnimationFrame(draw);
    return () => {cancelAnimationFrame(raf);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);};
  }, [practice]);
  async function join(newRoom = false) {
    if (joining) return;
    setJoining(true); setError('');
    try {
      if (!/^[\p{L}\p{N} _.-]{2,18}$/u.test(name.trim())) throw new Error('Choose a callsign: 2–18 letters or numbers.');
      let next: Session;
      if (practice) { next = { id: 'practice-you', token: '', room: 'PRACTICE' }; setWorld(null); current.current = null; }
      else {
        const data = await request<Session & { world: Snapshot }>('/api/arena/join', { name: name.trim(), color, room: newRoom ? '' : code.trim().toUpperCase(), newRoom });
        next = { id: data.id, token: data.token, room: data.room }; setWorld(data.world); current.current = data.world;
        input.current.angle = data.world.players.find(p => p.id === data.id)?.angle ?? 0; received.current = performance.now();
      }
      previous.current = null; active.current = next; sequence.current = 0; setSession(next); setConnection(practice ? 'OFFLINE · 4 BOTS' : 'CONNECTING');
      try { localStorage.setItem('orbital-name', name.trim()); } catch {}
      canvas.current?.focus({ preventScroll: true });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not join this room.'); }
    finally { setJoining(false); }
  }
  async function leave() {
    const s = active.current; active.current = null; setSession(null); setWorld(null); current.current = null; previous.current = null; keys.current.clear(); input.current.boost = false; setError('');
    if (s && !practice) { try { await request('/api/arena/leave', s); } catch { if (!dead) setError('Your connection was lost. The previous pilot will leave automatically after ten seconds.'); } }
  }
  function steer(clientX: number, clientY: number, relative = false) {
    const rect = canvas.current!.getBoundingClientRect(), hero = current.current?.players.find(p => p.id === active.current?.id);
    if (!hero?.alive) return;
    if (relative && touchStart.current) {
      const dx = clientX - touchStart.current.x, dy = clientY - touchStart.current.y;
      if (dx * dx + dy * dy > 50) input.current.angle = Math.atan2(dy,dx);
    } else {
      const x = (clientX - rect.left - rect.width/2) / camera.current.scale + camera.current.x;
      const y = (clientY - rect.top - rect.height/2) / camera.current.scale + camera.current.y;
      input.current.angle = Math.atan2(y-hero.y,x-hero.x);
    }
  }
  async function copyCode() { if (!session) return; try { await navigator.clipboard.writeText(session.room); setCopied(true);setTimeout(()=>setCopied(false),2500); } catch { setError(`Room code: ${session.room}. Share it with your friend.`); } }
  return <div className="io-layout">
    <section className="io-main" id="play" aria-label="Neon arena">
      <div className="io-frame"><span className="frame-label-sticker" aria-hidden="true">{practice ? "CPU ONLY" : "2P LINK"}</span><span className="cabinet-screw screw-tl" aria-hidden="true"/><span className="cabinet-screw screw-tr" aria-hidden="true"/><div className="io-toolbar"><span><i />{practice ? 'TRAINING SIMULATION' : session ? `ROOM ${session.room}` : 'MULTIPLAYER ARENA'}<small>{practice ? 'LOCAL' : '8 PILOTS / ROOM'}</small></span><span className="io-connection">{session && <><Radio size={11}/>{connection}{!practice && latency > 0 ? ` · ${latency}ms` : ''}</>}{session && <button onClick={() => void leave()} aria-label="Leave arena"><LogOut size={15}/></button>}</span></div>
        <div className={`io-playfield ${session ? 'is-active' : ''}`}>
          <canvas ref={canvas} className="io-canvas" tabIndex={0} aria-label="Neon trail arena. Steer with mouse, WASD, arrows, or drag on touch. Hold Space to boost."
            onPointerDown={e=>{canvas.current?.focus({preventScroll:true});if(e.pointerType==='touch'){touchStart.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}steer(e.clientX,e.clientY);}}
            onPointerMove={e=>{if(e.pointerType!=='touch'||e.buttons)steer(e.clientX,e.clientY,e.pointerType==='touch');}}
            onPointerUp={()=>{touchStart.current=null;}} onPointerCancel={()=>{touchStart.current=null;}} />
          {!session && <div className="io-launch"><span className="insert-credit" aria-hidden="true">✦ INSERT COIN ✦<small>JUST KIDDING. IT’S FREE.</small></span><div className="eyebrow"><span className="neon-spark">✦</span>{practice ? 'TRAINING CARTRIDGE LOADED' : 'LIVE LINK / TRAIL WARFARE'}</div><h2>{practice ? <>PRACTICE.<br/><span>CAUSE TROUBLE.</span></> : <>PLAYER ONE.<br/><span>MAKE A MESS.</span></>}</h2><p>Collect energy. Build a longer trail.<br/>Cut off rivals. Don’t hit theirs.</p><form onSubmit={e=>{e.preventDefault();void join();}}><label htmlFor="arena-name">YOUR CALLSIGN</label><input id="arena-name" value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your pilot name" maxLength={18} autoComplete="nickname" disabled={joining}/><div className="ship-colors" role="group" aria-label="Ship color">{COLORS.map((c,i)=><button type="button" key={c} aria-label={`Ship color ${['Cyan','Violet','Pink','Blue','Magenta','Red'][i]}`} aria-pressed={color===i} style={{'--ship-color':c} as React.CSSProperties} onClick={()=>setColor(i)}>{color===i?<Check size={12}/>:null}</button>)}</div>{!practice&&<div className="io-room-input"><input aria-label="Room code, optional" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Room code (optional)" maxLength={6}/><Users size={14}/></div>}<button className="primary-button io-join" disabled={joining}>{joining?<Loader2 size={16} className="spin"/>:practice?<Crosshair size={16}/>:<Rocket size={16}/>} {joining?'Connecting…':practice?'START PRACTICE':code?'Join room':'START GAME'}<ArrowUpRight size={17}/></button></form>{!practice&&<button className="io-create" disabled={joining} onClick={()=>void join(true)}>Create a room for friends <ArrowUpRight size={12}/></button>}<span className="io-footnote"><Shield size={11}/>{practice?'Offline · four labelled bots · no ranked score':'Public rooms · live rivals · no login'}</span></div>}
          {session && self && <><div className="io-hud"><div><small>ENERGY</small><strong>{Math.floor(self.energy).toLocaleString()}</strong></div><div><small>ELIMINATIONS</small><strong>{self.kills}</strong></div><div><small>{practice?'BOT RIVALS':'PILOTS ALIVE'}</small><strong>{practice?standings.filter(p=>p.bot).length:world?.population}</strong></div></div>{self.alive&&<span className="io-live-note">{world && world.time < self.shieldUntil ? 'SPAWN SHIELD ACTIVE' : self.energy<10?'COLLECT 10 ENERGY TO BOOST':'HOLD SPACE TO BOOST · COSTS ENERGY'}</span>}</>}
          {session && dead && <div className="io-death"><div><span className="eyebrow">{practice?'TRAINING FLIGHT COMPLETE':'SIGNAL ENDED'}</span><h2>One more orbit?</h2><p>{self.cause}</p><strong>{Math.floor(self.energy).toLocaleString()} <small>ENERGY</small></strong><span>{self.kills} eliminations · {practice?'practice scores stay local':'score recorded by the server'}</span><button className="primary-button" onClick={()=>void leave()}>Back to hangar <ArrowUpRight size={16}/></button></div></div>}
          {!session&&<span className="io-coordinate">NEON SECTOR / 2400 × 1600</span>}
        </div><div className="io-statusbar"><span><i/>{practice?'Practice arena · local bots':'Snake.io-inspired trails · real shared rooms'}</span>{session&&!practice?<button onClick={()=>void copyCode()}>{copied?<Check size={12}/>:<Copy size={12}/>}Room {session.room}</button>:<span>{practice?'NO CONNECTION REQUIRED':'SERVER-CHECKED GAMEPLAY'}</span>}</div>
        {session && !dead && <div className="io-mobile-controls"><span>Drag anywhere to steer</span><button aria-label="Boost" onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);input.current.boost=true;}} onPointerUp={()=>{input.current.boost=false;}} onPointerCancel={()=>{input.current.boost=false;}} onLostPointerCapture={()=>{input.current.boost=false;}}><Zap size={18}/>BOOST</button></div>}
      </div>{error&&<div className="inline-error" role="status">{error}</div>}
      <ArcadeDeck practice={practice} />
      <div className="io-controls"><span><Crosshair size={16}/><b>MOUSE / WASD</b> to steer</span><span><kbd>SPACE</kbd> boost</span><span><Shield size={15}/> 3s spawn shield</span></div>
      <div className="mission-cards io-rules"><article><span className="card-number">01 / ABSORB</span><Zap size={20}/><h3>Feed the trail.</h3><p>Collect scattered energy. Your ship’s trail grows with every pickup.</p><span className="card-foot">MORE ENERGY. MORE REACH.</span></article><article><span className="card-number">02 / OUTPLAY</span><Crosshair size={20}/><h3>Make the cut.</h3><p>Force rivals into your trail. Their wreckage becomes energy to collect.</p><span className="card-foot">YOUR HEAD IS THE WEAK SPOT.</span></article><article><span className="card-number">03 / ESCAPE</span><Zap size={20}/><h3>Burn bright.</h3><p>Boost to escape or cut ahead. It spends energy, so pick your moment.</p><span className="card-foot">10 ENERGY UNLOCKS BOOST.</span></article></div>
    </section>
    <aside className="io-sidebar" id="leaderboard" aria-label="Arena leaderboards"><div className="io-side-panel"><div className="eyebrow"><Users size={13}/>{practice?'SIMULATION ROSTER':'LIVE ROOM RANKING'}</div><h2>{session?'1UP / CONTENDERS':'PLAYER SELECT'}</h2><p className="io-side-copy">{practice?'Four computer pilots. The same arena rules. No global score submission.':session?'Energy decides the order. Everyone here shares your room.':'Enter a public arena or create a room and share its six-character code.'}</p>{session?<div className="io-roster">{standings.map((p,i)=><div key={p.id}><span className="io-place">{String(i+1).padStart(2,'0')}</span><span className="io-pilot-dot" style={{background:COLORS[p.color],boxShadow:`0 0 10px ${COLORS[p.color]}77`}}/><span>{p.name}<small>{p.bot?'BOT':p.id===session.id?'YOU':'PLAYER'}</small></span><strong>{Math.floor(p.energy)}</strong></div>)}{!standings.length&&<p>No active pilots.</p>}</div>:<div className="io-lobby-visual"><Globe2 size={45}/><span>{practice?'TRAIN SOLO. FLY SHARPER.':'ONE ROOM. EIGHT ORBITS.'}</span></div>}{session&&!practice&&<button className="io-share-room" onClick={()=>void copyCode()}><span>INVITE CODE<strong>{session.room}</strong></span>{copied?<Check size={17}/>:<Copy size={17}/>}</button>}<div className="io-match-note"><Shield size={14}/>{practice?'Bots are labelled and stay in practice.':'Movement, growth and collisions are checked on the server.'}</div></div>
      {!practice&&<div className="io-side-panel io-records"><div className="eyebrow"><Trophy size={13}/> ARENA RECORDS</div><h2>HI-SCORE CLUB</h2><div className="board-tabs" role="tablist" aria-label="Arena record period"><button role="tab" aria-selected={period==='all'} onClick={()=>setPeriod('all')}>All time</button><button role="tab" aria-selected={period==='week'} onClick={()=>setPeriod('week')}>This week</button></div>{boardError?<p className="io-side-copy">{boardError}</p>:scores.length?<div className="io-roster">{scores.map(s=><div key={s.rank}><span className="io-place">{s.rank}</span><span>{s.name}<small>{s.kills} eliminations{s.isYou?' · YOU':''}</small></span><strong>{s.score}</strong></div>)}</div>:<div className="io-record-empty"><Trophy size={26}/><strong>Set the first record.</strong><p>Finish a multiplayer flight with energy to enter the rankings.</p></div>}<p className="io-record-fine">Best energy per browser pilot. Classic scores have their own leaderboard.</p></div>}
      <div className="io-side-tip"><Zap size={18}/><span><strong>Keep your head clear.</strong>Your trail is safe to cross. Other players’ trails and the red boundary are not.</span></div><ArcadeNotice />
    </aside>
  </div>;
}
