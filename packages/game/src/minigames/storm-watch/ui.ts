import { insideRect } from "../../pointer";
// DOM layer around the 3D canvas, in the same look as Lantern Watch and Bridge Wait: Luma's speech bubble, the
// round play button and the practice hand. Storm Watch adds the sky behind the canvas (a calm night that
// cross-fades to a storm sky, and a soft flash for lightning), the title on the start screen and a small tap
// ripple. Pointer events pass through (pointer-events: none); the game root takes every pointerdown.
const CSS = `
.sw-root{position:relative;width:100%;height:100%;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;
background:linear-gradient(180deg,#0a0f2e 0%,#141a52 11%,#2a2a7a 20%,#6a4a9c 27%,#c06c98 32%,#f0a184 36%,#f0a184 100%)}
.sw-sky{position:absolute;inset:0;opacity:0;pointer-events:none;will-change:opacity}
.sw-sky.storm{background:linear-gradient(180deg,#070a1c 0%,#10153a 14%,#1f2650 25%,#333d6b 34%,#3a4470 100%)}
.sw-sky.flash{background:radial-gradient(ellipse 90% 60% at var(--fx,50%) 12%,#f4f7ff 0%,#b9c8ff 38%,rgba(120,140,255,0) 78%)}
.sw-root>canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.sw-ui{position:absolute;inset:0;pointer-events:none;font-family:var(--font-nunito),ui-rounded,"SF Pro Rounded","Arial Rounded MT Bold","Nunito","Varela Round",system-ui,sans-serif}
.sw-title{position:absolute;left:0;right:0;top:clamp(18px,6vh,56px);text-align:center;color:#f7f3e8;
font-family:var(--font-storybook),var(--font-nunito),ui-rounded,"Arial Rounded MT Bold",system-ui,sans-serif;font-weight:700;letter-spacing:-.02em;
font-size:clamp(40px,8.5vw,92px);line-height:1;text-shadow:0 4px 0 #1d1640,0 12px 34px rgba(8,6,36,.6);
opacity:0;transform:translateY(-14px);transition:opacity .35s ease-out,transform .5s cubic-bezier(.16,1,.3,1)}
.sw-title.on{opacity:1;transform:none}
.sw-title i{font-style:normal;color:#f5b841}
.sw-anchor{position:absolute;left:0;top:0;will-change:transform}
.sw-bubble{position:relative;transform:translate(-50%,-100%) scale(.6);transform-origin:50% 100%;opacity:0;
width:max-content;max-width:min(84vw,500px);box-sizing:border-box;padding:15px 24px;border-radius:26px;
background:#fffdf7;color:#2a1f5c;font-size:clamp(18px,2.6vw,26px);line-height:1.28;font-weight:800;text-align:center;
box-shadow:0 5px 0 #d9cff5,0 14px 30px rgba(12,8,48,.38);transition:opacity .16s ease-out,transform .3s cubic-bezier(.16,1,.3,1)}
.sw-bubble.on{opacity:1;transform:translate(-50%,-100%) scale(1)}
.sw-sub{display:block;margin-top:5px;font-size:.66em;font-weight:800;letter-spacing:.04em;color:#6a5f9a}
.sw-sub:empty{display:none}
.sw-tail{position:absolute;bottom:-15px;width:0;height:0;border-left:13px solid transparent;border-right:13px solid transparent;border-top:17px solid #fffdf7;transform:translateX(-50%)}
.sw-anchor.top .sw-tail{display:none}
.sw-anchor.side .sw-bubble{transform:translate(0,-50%) scale(.6);transform-origin:0 50%}
.sw-anchor.side .sw-bubble.on{transform:translate(0,-50%) scale(1)}
.sw-anchor.side .sw-tail{left:-15px!important;top:50%;bottom:auto;border-top:13px solid transparent;border-bottom:13px solid transparent;border-right:17px solid #fffdf7;border-left:0;transform:translateY(-50%)}
.sw-play{position:absolute;left:50%;top:64%;width:128px;height:128px;margin:-64px 0 0 -64px;border-radius:50%;
background:radial-gradient(circle at 35% 30%,#7ff0e1,#2fbfae 60%,#1f9e95);box-shadow:0 7px 0 #167a73,0 16px 30px rgba(12,8,48,.4),inset 0 -6px 0 rgba(0,0,0,.08);
border:6px solid #fffdf7;transition:transform .25s cubic-bezier(.16,1,.3,1),opacity .2s ease-out}
.sw-play::after{content:"";position:absolute;left:50%;top:50%;margin:-26px 0 0 -16px;border-left:44px solid #fffdf7;border-top:26px solid transparent;border-bottom:26px solid transparent;filter:drop-shadow(0 3px 0 rgba(22,122,115,.6))}
.sw-play::before{content:"";position:absolute;inset:-18px;border-radius:50%;border:5px solid rgba(255,253,247,.55);animation:sw-ring 1.8s ease-out infinite}
.sw-play.off{opacity:0;transform:scale(.4)}
@media (orientation: portrait){.sw-play{top:88%;left:74%}}
@keyframes sw-ring{0%{transform:scale(.85);opacity:.9}100%{transform:scale(1.3);opacity:0}}
.sw-hand{position:absolute;left:0;top:0;width:96px;height:118px;opacity:0;transition:opacity .2s ease-out;will-change:transform}
.sw-hand.on{opacity:1}
.sw-hand.on svg{animation:sw-press .9s cubic-bezier(.16,1,.3,1) infinite}
.sw-hand .sw-rip{position:absolute;left:30px;top:2px;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:5px solid #fffdf7;opacity:0}
.sw-hand.on .sw-rip{animation:sw-rip .9s ease-out infinite}
@keyframes sw-press{0%{transform:translate(14px,26px)}45%{transform:translate(0,0) scale(.94)}60%{transform:translate(0,0) scale(.94)}100%{transform:translate(14px,26px)}}
@keyframes sw-rip{0%,40%{transform:scale(.3);opacity:0}50%{opacity:.9}100%{transform:scale(1.5);opacity:0}}
.sw-tap{position:absolute;left:0;top:0;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;border:4px solid rgba(255,253,247,.85);opacity:0;pointer-events:none}
.sw-tap.go{animation:sw-tap .42s cubic-bezier(.16,1,.3,1)}
@keyframes sw-tap{0%{opacity:.85;scale:.35}100%{opacity:0;scale:1.1}}
@media (prefers-reduced-motion: reduce){.sw-play::before{animation:none}.sw-hand.on svg{animation:none}.sw-hand.on .sw-rip{animation:none;opacity:.8}.sw-tap.go{animation:none}}
`;

// Original cartoon glove hand pointing up; the fingertip is at (30px, 2px) of the box. Same drawing as Bridge Wait.
const HAND_SVG = `<svg viewBox="0 0 96 118" width="96" height="118" aria-hidden="true">
<g fill="#fffdf7" stroke="#2a1f5c" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
<path d="M20 50 V14 a10 10 0 0 1 20 0 V46"/>
<path d="M40 44 a9 9 0 0 1 18 0 v6 a9 9 0 0 1 18 0 v6 a8 8 0 0 1 16 2 v22 c0 20 -14 34 -34 34 h-8 c-14 0 -22 -6 -30 -16 L6 82 c-5 -7 -2 -14 4 -16 c5 -2 10 0 14 5 l-4 -21 z"/>
</g></svg>`;

export interface Ui {
  root: HTMLDivElement;
  /** Luma's bubble: one instruction, with an optional short reminder line under it. null hides it. */
  say: (text: string | null, sub?: string) => void;
  /** Place the bubble (CSS pixels). "above": centred over the point, tail down. "top": the same without a tail
   * (a caption). "side": to the right of the point, tail pointing left; y is then the bubble's bottom edge. */
  place: (x: number, y: number, mode?: "above" | "top" | "side") => void;
  /** The game's name on the start screen. Two words: the second is drawn in lantern yellow. */
  title: (text: string | null) => void;
  play: (on: boolean) => void;
  /** True when the point (client pixels) is on the visible Start button. */
  playHit: (clientX: number, clientY: number) => boolean;
  /** The practice hand taps the given point. */
  hand: (on: boolean, x?: number, y?: number) => void;
  /** 0 = calm night sky, 1 = storm sky. */
  storm: (level: number) => void;
  /** Lightning: brightness 0..1 of the flash in the sky, centred at x (0..1 of the width). */
  flash: (level: number, x?: number) => void;
  /** A small ring where the child tapped: the same for every tap, right or wrong. */
  ripple: (x: number, y: number) => void;
  destroy: () => void;
}

export function buildUi(parent: HTMLElement): Ui {
  const style = document.createElement("style");
  style.textContent = CSS;
  const root = document.createElement("div");
  root.className = "sw-root";
  const skyStorm = document.createElement("div");
  skyStorm.className = "sw-sky storm";
  const skyFlash = document.createElement("div");
  skyFlash.className = "sw-sky flash";
  const layer = document.createElement("div");
  layer.className = "sw-ui";
  const title = document.createElement("div");
  title.className = "sw-title";
  const anchor = document.createElement("div");
  anchor.className = "sw-anchor";
  const bubble = document.createElement("div");
  bubble.className = "sw-bubble";
  const text = document.createElement("span");
  const sub = document.createElement("span");
  sub.className = "sw-sub";
  const tail = document.createElement("div");
  tail.className = "sw-tail";
  bubble.append(text, sub, tail);
  anchor.append(bubble);
  const play = document.createElement("div");
  play.className = "sw-play off";
  const hand = document.createElement("div");
  hand.className = "sw-hand";
  hand.innerHTML = `<div class="sw-rip"></div>${HAND_SVG}`;
  const taps: HTMLDivElement[] = [];
  for (let k = 0; k < 3; k++) {
    const t = document.createElement("div");
    t.className = "sw-tap";
    taps.push(t);
  }
  layer.append(title, anchor, play, hand, ...taps);
  // Sky layers first: the canvas (prepended later by the scene, transparent where there is sky) is moved
  // above them by the scene, and the UI stays on top.
  root.append(skyStorm, skyFlash, layer);
  parent.append(style, root);

  let w = 0;
  let shown = false;
  let lastStorm = -1;
  let lastFlash = -1;
  let tapIndex = 0;
  return {
    root,
    say(t, s) {
      if (t === null) {
        bubble.classList.remove("on");
        return;
      }
      text.textContent = t;
      sub.textContent = s ?? "";
      bubble.classList.add("on");
      w = 0;
    },
    place(x, y, mode = "above") {
      if (!w) w = bubble.offsetWidth;
      const vw = root.clientWidth;
      anchor.classList.toggle("side", mode === "side");
      anchor.classList.toggle("top", mode === "top");
      if (mode === "side") {
        const h = bubble.offsetHeight;
        const left = Math.min(Math.max(x, 12), Math.max(12, vw - w - 12));
        anchor.style.transform = `translate(${left.toFixed(1)}px, ${(y - h / 2).toFixed(1)}px)`;
        return;
      }
      const half = w / 2;
      const cx = Math.min(Math.max(x, half + 12), vw - half - 12);
      anchor.style.transform = `translate(${cx.toFixed(1)}px, ${Math.max(y, bubble.offsetHeight + 8).toFixed(1)}px)`;
      const tailX = Math.min(Math.max(x - cx + half, 30), w - 30);
      tail.style.left = `${tailX.toFixed(1)}px`;
    },
    title(t) {
      if (t === null) {
        title.classList.remove("on");
        return;
      }
      const [first, ...rest] = t.split(" ");
      title.textContent = `${first ?? ""} `;
      const accent = document.createElement("i");
      accent.textContent = rest.join(" ");
      title.append(accent);
      title.classList.add("on");
    },
    play(on) {
      shown = on;
      play.classList.toggle("off", !on);
    },
    playHit(x, y) {
      return shown && insideRect(x, y, play.getBoundingClientRect());
    },
    hand(on, x = 0, y = 0) {
      hand.classList.toggle("on", on);
      // The fingertip (30, 2) lands on the point.
      if (on) hand.style.transform = `translate(${(x - 30).toFixed(1)}px, ${(y - 2).toFixed(1)}px)`;
    },
    storm(level) {
      const v = Math.round(level * 100) / 100;
      if (v === lastStorm) return;
      lastStorm = v;
      skyStorm.style.opacity = String(v);
    },
    flash(level, x) {
      const v = Math.round(level * 50) / 50;
      if (x !== undefined) skyFlash.style.setProperty("--fx", `${(x * 100).toFixed(0)}%`);
      if (v === lastFlash) return;
      lastFlash = v;
      skyFlash.style.opacity = String(v);
    },
    ripple(x, y) {
      const t = taps[tapIndex] as HTMLDivElement;
      tapIndex = (tapIndex + 1) % taps.length;
      t.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      t.classList.remove("go");
      void t.offsetWidth; // restart the animation
      t.classList.add("go");
    },
    destroy() {
      root.remove();
      style.remove();
    },
  };
}
