"use client";
import { useEffect, useRef } from "react";

type SDK = {
  init(): Promise<void>;
  game: { loadingStart(): void; loadingStop(): void; gameplayStart(): void; gameplayStop(): void };
};
let initialized: Promise<void> | undefined;
let sdk: SDK | undefined;
let reported = false;
const playing = new Set<symbol>();
function report() {
  if (!sdk || reported === (playing.size > 0)) return;
  reported = playing.size > 0;
  try { if (reported) sdk.game.gameplayStart(); else sdk.game.gameplayStop(); }
  catch { /* Portal telemetry must never interrupt a flight. */ }
}
function initialize() {
  if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("platform") !== "crazygames") return;
  if (!initialized) initialized = (async () => {
    const script = document.createElement("script");
    script.src = "https://sdk.crazygames.com/crazygames-sdk-v3.js";
    script.async = true;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Portal SDK timed out")), 10000);
      script.onload = () => { clearTimeout(timeout); resolve(); };
      script.onerror = () => { clearTimeout(timeout); reject(new Error("Portal SDK unavailable")); };
      document.head.appendChild(script);
    });
    const portal = (window as Window & { CrazyGames?: { SDK: SDK } }).CrazyGames?.SDK;
    if (!portal) throw new Error("Portal SDK not found");
    await portal.init();
    portal.game.loadingStart();
    // The React UI and both canvas engines are already loaded at this point.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    portal.game.loadingStop();
    sdk = portal;
    report();
  })().catch(error => { console.warn("CrazyGames integration:", error instanceof Error ? error.message : "unavailable"); });
}

// Reports actual play, pause, death and menu transitions from either engine.
// Each mounted engine owns its flag, so one menu cannot stop another engine.
export function usePortalGameplay(active: boolean) {
  const source = useRef(Symbol("gameplay"));
  useEffect(() => {
    initialize();
    const key = source.current;
    if (active) playing.add(key); else playing.delete(key);
    report();
    return () => { playing.delete(key); report(); };
  }, [active]);
}
