"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Check, ChevronRight, CircleHelp, Crosshair, Expand, Flag, Globe2, Heart, Loader2, Pause, Play, Radio, RefreshCw, Rocket, ShieldCheck, Trophy, Volume2, VolumeX, X } from "lucide-react";
import { CanvasHandle, Flight, GameCanvas } from "@/components/game/game-canvas";
import { INPUT, MAX_FRAMES } from "@/lib/game/engine";
type Entry = { name: string; score: number; frames: number; rank: number; isYou: number };
type Board = { entries: Entry[]; stats: { flights: number; pilots: number; record: number }; personal: { best: number; flights: number }; updatedAt: number };
type Run = { id: string; token: string; seed: number };
type Pending = { run: Run; flight: Flight };
type Phase = "ready" | "playing" | "paused" | "over";
const number = (n: number) => n.toLocaleString("en-US");
const time = (frames: number) => `${Math.floor(frames / 60 / 60)}:${String(Math.floor(frames / 60) % 60).padStart(2, "0")}`;
async function api<T>(path: string, body?: unknown) {
  const response = await fetch(path, { method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store", ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Could not connect. Try again.");
  return data;
}
function ShipMark({ size = 25 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 3 28 28 16 21 4 28Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>; }
export default function Home() {
  const [phase, setPhase] = useState<Phase>("ready"), [name, setName] = useState(""), [period, setPeriod] = useState("all");
  const [board, setBoard] = useState<Board | null>(null), [boardError, setBoardError] = useState(""), [boardLoading, setBoardLoading] = useState(true);
  const [launching, setLaunching] = useState(false), [error, setError] = useState(""), [practice, setPractice] = useState(false);
  const [hud, setHud] = useState({ score: 0, lives: 3, frame: 0, hits: 0 }), [result, setResult] = useState<Flight | null>(null);
  const [saving, setSaving] = useState(false), [saved, setSaved] = useState(false), [saveError, setSaveError] = useState("");
  const [pending, setPending] = useState<Pending | null>(null), [sound, setSound] = useState(false), [help, setHelp] = useState(false);
  const [deviceBest, setDeviceBest] = useState(0), [shareNotice, setShareNotice] = useState("");
  const canvas = useRef<CanvasHandle>(null), arena = useRef<HTMLDivElement>(null), run = useRef<Run | null>(null), phaseRef = useRef<Phase>("ready");
  const saveInFlight = useRef(false), boardRequest = useRef(0), mounted = useRef(true), practiceRef = useRef(false);
  const setGamePhase = (next: Phase) => { phaseRef.current = next; setPhase(next); };
  const refresh = useCallback(async (quiet = false) => {
    const requestId = ++boardRequest.current;
    if (!quiet) setBoardLoading(true);
    try {
      const data = await api<Board>(`/api/leaderboard?period=${period}`);
      if (mounted.current && requestId === boardRequest.current) { setBoard(data); setBoardError(""); }
    } catch (e) { if (mounted.current && requestId === boardRequest.current) setBoardError(e instanceof Error ? e.message : "Leaderboard unavailable."); }
    finally { if (mounted.current && requestId === boardRequest.current) setBoardLoading(false); }
  }, [period]);
  useEffect(() => { mounted.current = true; void refresh(); const timer = setInterval(() => { if (!document.hidden) void refresh(true); }, 30000); return () => { clearInterval(timer); mounted.current = false; }; }, [refresh]);
  useEffect(() => {
    try {
      setName(localStorage.getItem("orbital-name") || ""); setDeviceBest(Number(localStorage.getItem("orbital-best")) || 0);
      const cached = sessionStorage.getItem("orbital-pending");
      if (cached) { const p: Pending = JSON.parse(cached); setPending(p); setResult(p.flight); setPractice(false); setSaveError("A flight is waiting to be saved. Retry to send it to the leaderboard."); setGamePhase("over"); }
    } catch { /* Private mode can disable storage; gameplay still works. */ }
  }, []);
  useEffect(() => {
    if (!help) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector('[role="dialog"]');
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setHelp(false); }
      if (event.key === "Tab") {
        const buttons = dialog?.querySelectorAll<HTMLElement>('button, a[href], input');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [help]);
  async function saveFlight(value: Pending) {
    if (saveInFlight.current) return;
    saveInFlight.current = true; setSaving(true); setSaveError("");
    try {
      const data = await api<{ score: number; hits: number }>("/api/runs/finish", { id: value.run.id, token: value.run.token, frames: value.flight.frames, controls: value.flight.controls });
      if (data.score !== value.flight.score) setResult({ ...value.flight, score: data.score, hits: data.hits });
      setSaved(true); setPending(null);
      try { sessionStorage.removeItem("orbital-pending"); } catch { /* optional */ }
      void refresh(true);
    } catch (e) { setSaveError(e instanceof Error ? e.message : "Score not saved. Retry when you’re online."); }
    finally { saveInFlight.current = false; setSaving(false); }
  }
  function endFlight(flight: Flight) {
    setResult(flight); setGamePhase("over");
    try { const best = Math.max(Number(localStorage.getItem("orbital-best")) || 0, flight.score); localStorage.setItem("orbital-best", String(best)); setDeviceBest(best); } catch { setDeviceBest(b => Math.max(b, flight.score)); }
    if (!practiceRef.current && run.current) {
      const value = { run: run.current, flight }; setPending(value);
      try { sessionStorage.setItem("orbital-pending", JSON.stringify(value)); } catch { /* Keep in memory when storage is blocked. */ }
      void saveFlight(value);
    }
  }
  async function launch(isPractice: boolean) {
    if (launching) return;
    setError(""); setLaunching(true);
    try {
      if (!/^[\p{L}\p{N} _.-]{2,18}$/u.test(name.trim())) throw new Error("Choose a pilot name: 2–18 letters or numbers. Spaces, dots, dashes, and underscores work too.");
      const current: Run | null = isPractice ? null : await api<Run>("/api/runs", { name: name.trim() });
      run.current = current; practiceRef.current = isPractice; setPractice(isPractice); setSaved(false); setSaveError(""); setResult(null); setPending(null);
      setHud({ score: 0, lives: 3, frame: 0, hits: 0 }); setGamePhase("playing");
      try { localStorage.setItem("orbital-name", name.trim()); } catch { /* optional */ }
      canvas.current?.start(current?.seed ?? crypto.getRandomValues(new Uint32Array(1))[0]);
      (document.querySelector(".game-canvas") as HTMLCanvasElement | null)?.focus({ preventScroll: true });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not launch. Try practice mode."); }
    finally { setLaunching(false); }
  }
  function togglePause() {
    const next = phaseRef.current === "playing" ? "paused" : phaseRef.current === "paused" ? "playing" : null;
    if (!next) return;
    canvas.current?.pause(next === "paused"); setGamePhase(next);
    if (next === "playing") (document.querySelector(".game-canvas") as HTMLCanvasElement | null)?.focus({ preventScroll: true });
  }
  function openHelp() {
    if (phaseRef.current === "playing") togglePause();
    setHelp(true);
  }
  function backToHangar() {
    canvas.current?.clear(); setGamePhase("ready"); setResult(null); setError("");
  }
  async function share() {
    const url = window.location.origin;
    try { await navigator.clipboard.writeText(url); setShareNotice("Game link copied"); }
    catch { setShareNotice(url); }
    setTimeout(() => setShareNotice(""), 5000);
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (arena.current?.requestFullscreen) await arena.current.requestFullscreen(); else setError("Fullscreen is unavailable in this browser. Try rotating your phone."); }
    catch { setError("Fullscreen is unavailable here. You can still play in the window."); }
  }
  const active = phase === "playing" || phase === "paused";
  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="Asteroids home"><span className="brand-mark"><ShipMark /></span><span>ASTEROIDS<span className="brand-sub">ORBITAL ARCADE</span></span></a>
      <nav aria-label="Main navigation"><a className="nav-active" href="#play"><span className="nav-dot" />Play</a><a href="#leaderboard">Leaderboard</a><button onClick={openHelp}>How to play <ArrowUpRight size={13} /></button></nav>
      <a href="https://github.com/SRoy2024/Asteroids" target="_blank" rel="noreferrer" className="source-link">Built by Soham Roy <ArrowUpRight size={14} /></a>
    </header>
    <section className="page-heading"><div><div className="eyebrow"><span /> THE CLASSIC, BACK IN ORBIT</div><h1>Small ship. <span>Big universe.</span></h1><p>Dodge the chaos. Break some rocks. Leave your name among the stars.</p></div><div className="heading-stamp"><Globe2 size={19} /><span>ONE SKY.<br />EVERY PILOT.</span></div></section>
    <div className="arcade-layout">
      <section className="play-column" id="play" aria-label="Play Asteroids">
        <div className="arena-frame" ref={arena}>
          <div className="arena-toolbar"><div className="toolbar-label"><span className="live-dot" />{active ? practice ? "PRACTICE FLIGHT" : "RANKED FLIGHT" : "FLIGHT DECK"}<span className="toolbar-divider">/</span><span className="muted">SECTOR 01</span></div><div className="toolbar-actions"><button aria-label={sound ? "Mute sound" : "Enable sound for next flight"} title={sound ? "Mute" : "Sound on next flight"} onClick={() => setSound(!sound)}>{sound ? <Volume2 size={16} /> : <VolumeX size={16} />}</button>{active && <button aria-label={phase === "paused" ? "Resume game" : "Pause game"} onClick={togglePause}>{phase === "paused" ? <Play size={16} /> : <Pause size={16} />}</button>}<button aria-label="Toggle fullscreen" onClick={fullscreen}><Expand size={16} /></button></div></div>
          <div className="playfield">
            <GameCanvas ref={canvas} onEnd={endFlight} onTick={setHud} onPause={togglePause} sound={sound} />
            {active && <div className="game-hud" aria-label="Flight status"><div><small>SCORE</small><strong>{String(hud.score).padStart(6, "0")}</strong></div><div className="hud-right"><span className="lives" aria-label={`${hud.lives} lives`}>{[0, 1, 2].map(i => <Heart key={i} size={15} className={i < hud.lives ? "alive" : "lost"} />)}</span><span className="timer">{time(MAX_FRAMES - hud.frame)}</span></div></div>}
            {phase === "ready" && <div className="launch-panel"><div className="mission-label"><span className="tiny-star">✳</span> YOUR NEXT HIGH SCORE STARTS HERE</div><h2>Space is calling.<br /><span>Answer with lasers.</span></h2><p>Three lives. Two minutes.<br />How long can you own the orbit?</p><form onSubmit={e => { e.preventDefault(); void launch(false); }}><label htmlFor="pilot-name">PILOT CALLSIGN</label><div className="pilot-input"><ShipMark size={16} /><input id="pilot-name" autoComplete="nickname" placeholder="Enter your pilot name" minLength={2} maxLength={18} value={name} onChange={e => setName(e.target.value)} disabled={launching} /></div><button className="primary-button launch-button" disabled={launching}>{launching ? <Loader2 className="spin" size={17} /> : <Rocket size={17} />} {launching ? "Preparing flight…" : "Launch ranked flight"}<ArrowUpRight size={18} /></button></form><button className="practice-link" disabled={launching} onClick={() => void launch(true)}>Just exploring? Play practice <ArrowRight size={13} /></button><div className="launch-note"><ShieldCheck size={12} /> Free to play. No account needed.</div></div>}
            {phase === "paused" && <div className="center-overlay"><div className="overlay-card"><span className="overlay-icon"><Pause size={22} /></span><div className="eyebrow">TAKE A BREATHER</div><h2>Holding orbit.</h2><p>Your flight is paused. The stars can wait.</p><button className="primary-button" onClick={togglePause}><Play size={16} /> Resume flight</button><button className="text-button" onClick={() => canvas.current?.end()}><Flag size={13} /> End flight &amp; {practice ? "view score" : "save score"}</button></div></div>}
            {phase === "over" && result && <div className="center-overlay"><div className="overlay-card results-card"><span className="overlay-icon"><Trophy size={23} /></span><div className="eyebrow">{practice ? "PRACTICE COMPLETE" : "FLIGHT COMPLETE"}</div><h2>{result.score > 0 ? "Nicely flown, pilot." : "Back to the stars?"}</h2><div className="result-score">{number(result.score)}<span>POINTS</span></div><div className="result-stats"><span><strong>{time(result.frames)}</strong>Flight time</span><span><strong>{result.hits}</strong>Rocks hit</span><span><strong>{result.shotsFired ? Math.round(result.hits / result.shotsFired * 100) : 0}%</strong>Accuracy</span></div><div className={`save-status ${saveError ? "error" : ""}`} role="status">{practice ? "Practice flight · not submitted to the leaderboard" : saving ? <><Loader2 size={13} className="spin" /> Verifying & saving your flight…</> : saved ? <><Check size={14} /> Score saved{result.score === 0 ? " · score points to enter the rankings" : " to the global leaderboard"}</> : saveError}</div>{pending && !saving && <button className="primary-button" onClick={() => void saveFlight(pending)}><RefreshCw size={15} /> Retry saving score</button>}<button className={pending ? "text-button" : "primary-button"} disabled={saving || !!pending} onClick={backToHangar}><Rocket size={16} /> Fly again <ArrowUpRight size={16} /></button>{pending && !saving && <button className="text-button discard" onClick={() => { setPending(null); try { sessionStorage.removeItem("orbital-pending"); } catch {} backToHangar(); }}>Discard unsaved flight</button>}</div></div>}
            {phase === "ready" && <><span className="canvas-coordinate coord-top">1280 × 720 / DEEP SPACE</span><span className="canvas-coordinate coord-bottom">YOUR ORBIT AWAITS ↗</span></>}
          </div>
          <div className="arena-bottom"><span><span className="live-dot" />{practice && active ? "Practice · scores stay on this device" : "Solo flight. Global competition."}</span><button onClick={openHelp}><CircleHelp size={13} /> Flight manual</button></div>
        <div className="touch-controls" aria-label="Touch game controls">{[{ bit: INPUT.LEFT, label: "Turn left", icon: <ArrowLeft size={20} /> }, { bit: INPUT.RIGHT, label: "Turn right", icon: <ArrowRight size={20} /> }, { bit: INPUT.THRUST, label: "Thrust", icon: <ArrowUp size={20} /> }, { bit: INPUT.REVERSE, label: "Reverse", icon: <ArrowDown size={20} /> }, { bit: INPUT.FIRE, label: "Fire", icon: <Crosshair size={22} /> }].map(c => <button key={c.bit} disabled={!active || phase === "paused"} aria-label={c.label} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); canvas.current?.input(c.bit, true); }} onPointerUp={() => canvas.current?.input(c.bit, false)} onPointerCancel={() => canvas.current?.input(c.bit, false)} onLostPointerCapture={() => canvas.current?.input(c.bit, false)}>{c.icon}<small>{c.label}</small></button>)}</div>
        </div>
        {error && <div className="inline-error" role="alert">{error}</div>}
        <div className="controls-strip"><div className="control-group"><span className="key-cluster"><kbd>W</kbd><span><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span></span><span>Move &amp; steer<small>or arrow keys</small></span></div><div className="control-group"><kbd className="space-key">SPACE</kbd><span>Fire away<small>hold to keep shooting</small></span></div><div className="control-group"><kbd>P</kbd><span>Pause<small>catch your breath</small></span></div><button className="manual-link" onClick={openHelp}>All controls <ArrowUpRight size={14} /></button></div>
        <div className="mission-cards"><article><span className="card-number">01</span><Crosshair size={20} /><h3>Break it down.</h3><p>Big rocks become smaller rocks. Smaller rocks mean bigger points.</p><span className="score-legend">20 <ChevronRight size={10} /> 50 <ChevronRight size={10} /> 100 PTS</span></article><article><span className="card-number">02</span><Heart size={20} /><h3>Make three lives count.</h3><p>Stay moving. Wrap around the screen. A fresh shield buys you a moment.</p><span className="card-foot">TWO-MINUTE FLIGHTS</span></article><article><span className="card-number">03</span><Trophy size={20} /><h3>Leave your mark.</h3><p>Every ranked flight is verified. Your best one earns its place in orbit.</p><span className="card-foot">ONE BEST PER PILOT</span></article></div>
      </section>
      <aside className="leaderboard" id="leaderboard"><div className="board-header"><span className="eyebrow"><Trophy size={14} /> THE HALL OF ORBIT</span><button aria-label="Refresh leaderboard" onClick={() => void refresh()} disabled={boardLoading}><RefreshCw size={14} className={boardLoading ? "spin" : ""} /></button></div><div className="board-title"><h2>Leaderboard</h2><span className={`live-badge ${boardError ? "offline" : ""}`}><span />{boardError ? "OFFLINE" : board ? "LIVE" : "CONNECTING"}</span></div><p className="board-description">Good pilots survive. Great ones get remembered.</p><div className="board-tabs" role="tablist" aria-label="Leaderboard period"><button role="tab" aria-selected={period === "all"} onClick={() => setPeriod("all")}>All time</button><button role="tab" aria-selected={period === "week"} onClick={() => setPeriod("week")}>This week</button></div><div className="table-heading"><span>RANK / PILOT</span><span>SCORE</span></div>
        <div className="board-list" aria-live="polite">{boardLoading ? <div className="board-empty"><Loader2 size={23} className="spin" /><strong>Finding the stars…</strong><p>Connecting to the global leaderboard.</p></div> : boardError ? <div className="board-empty"><Radio size={25} /><strong>Signal interrupted.</strong><p>{boardError}</p><button className="text-button" onClick={() => void refresh()}>Try again <RefreshCw size={12} /></button></div> : board?.entries.length ? board.entries.map(entry => <div key={entry.rank} className={`score-row rank-${entry.rank} ${entry.isYou ? "your-row" : ""}`}><span className="rank">{entry.rank === 1 ? <Trophy size={17} /> : String(entry.rank).padStart(2, "0")}</span><span className="pilot-avatar">{entry.name.slice(0, 1).toUpperCase()}</span><span className="pilot-info"><strong>{entry.name}{entry.isYou ? <em>YOU</em> : null}</strong><small>{time(entry.frames)} flight</small></span><span className="pilot-score">{number(entry.score)}</span></div>) : <div className="board-empty"><span className="empty-orbit"><Trophy size={26} /></span><strong>The sky is unclaimed.</strong><p>{period === "week" ? "No ranked scores in the last seven days." : "No records yet. Your first flight could be the one to beat."}</p><a href="#pilot-name" onClick={() => document.getElementById("pilot-name")?.focus()}>Be the first pilot <ArrowUpRight size={13} /></a></div>}</div>
        <div className="personal-best"><span className="best-icon"><ShipMark size={22} /></span><div><span>YOUR PERSONAL BEST</span><strong>{number(board?.personal.best ?? 0)} <small>PTS</small></strong></div><ArrowUpRight size={17} /></div><div className="board-meta"><ShieldCheck size={13} /><span>Replay-verified scores.<br />Best flight per browser. Names aren’t unique.</span></div><div className="board-summary"><div><strong>{board ? number(board.stats.pilots) : "—"}</strong><span>PILOTS</span></div><div><strong>{board ? number(board.stats.flights) : "—"}</strong><span>FLIGHTS</span></div><div><strong>{board ? number(board.stats.record) : "—"}</strong><span>TOP SCORE</span></div></div><div className="challenge-card"><div className="challenge-heading"><Globe2 size={18} /><span>BETTER WITH A RIVAL.</span></div><p>A little friendly competition<br />goes a long way in space.</p><button onClick={() => void share()}>Challenge a friend <ArrowUpRight size={15} /></button>{shareNotice && <span className="share-notice" role="status">{shareNotice}</span>}</div>
      </aside>
    </div>
    <footer><span><ShipMark size={15} /> A classic reimagined by <a href="https://github.com/SRoy2024">Soham Roy</a>.</span><span>{deviceBest > 0 ? `Device best · ${number(deviceBest)} pts` : "Made for the love of the game."}<span className="footer-star">✳</span></span></footer>
    {help && <div className="modal-scrim" onClick={() => setHelp(false)}><section className="manual-modal" role="dialog" aria-modal="true" aria-labelledby="manual-title" onClick={e => e.stopPropagation()}><button className="modal-close" aria-label="Close flight manual" autoFocus onClick={() => setHelp(false)}><X size={19} /></button><div className="eyebrow">THE FLIGHT MANUAL</div><h2 id="manual-title">A quick pre-flight check.</h2><p>Rotate with <kbd>A</kbd> <kbd>D</kbd> or ← →. Thrust with <kbd>W</kbd> or ↑; reverse with <kbd>S</kbd> or ↓. Hold <kbd>SPACE</kbd> to shoot. Use <kbd>P</kbd> or Esc to pause.</p><p>On a phone, use the touch buttons below the arena. Turning your phone sideways gives you more room.</p><div className="manual-rules"><div><Heart size={18} /><span><strong>Three lives, 120 seconds.</strong> The screen wraps. After a hit, your shield lasts 2.5 seconds.</span></div><div><Crosshair size={18} /><span><strong>Big: 20 · Medium: 50 · Small: 100.</strong> Larger asteroids split into two. Clear the fragments for more points.</span></div><div><ShieldCheck size={18} /><span><strong>Ranked flights are verified.</strong> The server replays your controls. Ties favor the shorter flight, then the earlier score.</span></div></div><p className="manual-fine">Your pilot identity uses a cookie in this browser. Clearing cookies or switching devices creates a new pilot. Callsigns are public and aren’t reserved. Practice scores stay on your device. This is solo play with a shared leaderboard.</p><button className="primary-button" onClick={() => setHelp(false)}>Ready for orbit <ArrowUpRight size={16} /></button></section></div>}
  </main>;
}
