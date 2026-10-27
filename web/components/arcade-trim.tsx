import { Zap } from 'lucide-react';
export function PixelInvader() {
  return <svg viewBox="0 0 15 12" aria-hidden="true" className="pixel-invader"><path d="M3 0h2v2H3zm7 0h2v2h-2zM5 2h5v2H5zM3 3h2v2H3zm7 0h2v2h-2zM1 5h13v4H1zM0 7h2v4H0zm13 0h2v4h-2zM3 9h3v2H3zm6 0h3v2H9zM2 11h3v1H2zm8 0h3v1h-3z" fill="currentColor"/><path d="M4 5h2v2H4zm5 0h2v2H9z" fill="#09051a"/></svg>;
}
export function ArcadeMarquee() {
  return <section className="cabinet-marquee" aria-label="Asteroids arcade cabinet">
    <span className="cabinet-screw screw-tl" aria-hidden="true"/><span className="cabinet-screw screw-tr" aria-hidden="true"/>
    <div className="marquee-left" aria-hidden="true"><PixelInvader/><span>SECTOR / 0086</span><div className="led-bank"><i/><i/><i/><i/><i/></div><b>FREE PLAY</b></div>
    <div className="marquee-title"><span className="marquee-topline">✦ INTERGALACTIC AMUSEMENTS DEPT. ✦</span><h2 data-text="ASTEROIDS" aria-label="Asteroids">ASTERO<span className="bad-tube">I</span>DS<span className="marquee-tm">™</span></h2><div className="marquee-bottomline"><span>TRAIL WARS</span><b>✶</b><span>LASER CHAOS</span><b>✶</b><span>NO QUARTERS NEEDED</span></div></div>
    <div className="marquee-right" aria-hidden="true"><div className="repair-sticker">CAUTION<br/><strong>EXTREME<br/>SPACE NOISE</strong></div><span>DO NOT KICK THE MACHINE</span><Zap size={17}/></div>
    <span className="cabinet-screw screw-bl" aria-hidden="true"/><span className="cabinet-screw screw-br" aria-hidden="true"/>
  </section>;
}
export function ArcadeTicker() {
  const strip = '✦ FREE PLAY ✦ WATCH YOUR HEAD ✦ EAT ENERGY ✦ BURN THE BOOST ✦ CUT OFF YOUR RIVALS ✦ ONE MORE GAME ✦ ';
  return <div className="arcade-ticker" aria-hidden="true"><span>{strip}{strip}</span><b>CHANNEL / 03</b></div>;
}
export function ArcadeDeck({ practice }: { practice: boolean }) {
  return <div className="arcade-control-deck" aria-hidden="true"><div className="deck-joystick"><span className="joystick-base"/><span className="joystick-stem"/><span className="joystick-ball"/><b>1P / STEER</b></div><div className="deck-directions"><strong>↖ ↑ ↗</strong><span>W A S D / MOUSE</span><small>KEEP MOVING, SPACE CADET.</small></div><div className="deck-button-group"><span className="cab-button violet-button"/><span className="cab-button red-button"/><span className="cab-button blue-button"/><b>SPACE / BOOST</b></div><div className="coin-box"><span>INSERT COIN</span><i/><b>{practice ? 'TRAINING' : 'FREE PLAY'}</b></div><span className="deck-scratch">/// CONTROL PANEL REV. 86-B</span></div>;
}
export function ArcadeClutter() {
  return <div className="cabinet-clutter" aria-hidden="true"><span className="clutter-stamp">!!! NO REFUNDS !!!<small>THE VOID KEEPS YOUR COINS</small></span><span className="clutter-barcode">▌▐▌▌▐▐▌▐▌▌▐<small>SN / 0086-TR-L</small></span><span className="clutter-tape">★ BAD IDEAS.<br/><b>GREAT SCORES.</b></span><span className="clutter-circuit">╳ SPACE = BOOST ╳<small>DO NOT LICK THE CIRCUIT BOARD</small></span><span className="clutter-voltage"><i/><i/><i/><i/><i/><b>POWER / 12V</b></span></div>;
}
export function ArcadeNotice() {
  return <div className="arcade-notice" aria-hidden="true"><span className="notice-tape"/><div className="notice-header">UNAUTHORIZED TRANSMISSION / 86</div><div className="notice-poster"><span>THE VOID</span><b>EATS<br/>QUARTERS.</b><svg viewBox="0 0 240 150" fill="none"><path d="m21 113 25-62 49-24 46 10 35 34-8 42-26 20-77-3Z" fill="#170b2e" stroke="#e64d9a" strokeWidth="2"/><path d="m26 109 25-59 47-18 38 12 33 30-9 35-23 15-68-2Z" stroke="#29d5e7"/><path d="m58 69 15-7 15 12-9 17-20-4Zm44 6 17-11 16 7-2 17-20 5Z" fill="#bd298c" stroke="#f59acf"/><path d="m54 67 22-11 18 13m6 0 18-13 23 9M79 107l9-9 10 7 9-8 10 11M79 118l2-10m12 12 1-14m12 13 1-12" stroke="#37d9f4" strokeWidth="3"/><path d="m17 35 6-16 7 13 15 1-12 10 4 16-13-9-13 6 5-14-10-9ZM182 30l11 16 16-2-9 16 6 15-17-2-12 11 1-18-13-11 17-5Z" stroke="#cda248"/><path d="m172 112 18-13 10 7 17-15m-42 31 17-10 8 5 25-14M10 127l27 2 3 5 34 3m70 3 33-7 15 2 25-11M49 12l28 5 21-7 17 10m-13 121 23 3" stroke="#a86bcc"/><path d="m155 14 8-8m-3 19 16-2M9 82l12 3m192 0 17 3m-16 39 12 8m-79-7 3-12m-43-77 6 17-10 10" stroke="#ff66a7" strokeWidth="2"/></svg><i className="notice-graffiti">one more<br/>game?</i></div><div className="notice-footer">✦ KEEP THE NOISE ALIVE ✦</div></div>;
}
