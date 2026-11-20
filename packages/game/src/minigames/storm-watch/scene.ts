// Storm Watch in 3D (three.js), in the same storybook look as Lantern Watch: toon shading, dark outlines,
// Luma and the Lantern Watch firefly. Browser only: imported lazily by mount.ts.
//
// The clearing: one big tree with four leaf perches and an owl asleep in its hollow. A firefly on a perch is
// "go", a cricket is "no-go", and the owl's hoot is the sound-only "go" (tap the owl): nothing on screen
// changes when it hoots, so only listening can catch it. One block is a calm night; in the other a storm
// rolls in (clouds, rain, wind) and birds and lightning distract.
//
// Timing: one requestAnimationFrame loop. Each callback first calls runner.frame(ts); when a stimulus is due the
// runner calls onStimulusOnset inside that call, which places the creature at full size, and the same callback
// then renders, so the creature is on screen in the frame the runner timestamps. Responses come from a native
// pointerdown listener (event.timeStamp, never click). Everything else here is decoration and never feeds the
// measurement: nothing is allocated per trial (birds, flights and particles are pooled).
import {
  Color,
  DataTexture,
  DirectionalLight,
  Fog,
  HemisphereLight,
  type Material,
  type Mesh,
  NearestFilter,
  PerspectiveCamera,
  PointLight,
  type PointsMaterial,
  type Float32BufferAttribute,
  RedFormat,
  Scene,
  Sprite,
  SpriteMaterial,
  AdditiveBlending,
  Vector3,
  WebGLRenderer,
  type Group,
} from "three";
import { isPrimaryPointer } from "../../pointer";
import { buildLuma, makeOutlineMaterial, type LumaRig } from "../bridge-wait/luma";
import { Particles } from "../bridge-wait/scene";
import { buildFirefly } from "../lantern-watch/props";
import { StormWatchAudio } from "./audio";
import { BIRD_COLORS, buildBird, buildCricket, buildOwl, type Bird } from "./creatures";
import { buildForest, OWL_CENTRE, OWL_FEET, type Forest } from "./forest";
import { mulberry32 } from "./logic";
import { StormWatchRunner, type RunState } from "./runner";
import { STRINGS } from "./strings";
import type { BlockKind, StormWatchResult, TrialType } from "./types";
import { buildUi } from "./ui";

export interface SceneOptions {
  seed?: number;
  trialsPerBlock?: number;
  stimulusMs?: number;
  skipPractice?: boolean;
  onComplete?: (result: StormWatchResult) => void;
}

const FLIGHT_MS = 620;
const FIREFLY_SCALE = 1.85;
const CRICKET_SCALE = 1.28;
const LIGHT_ON = 3.4;
/** World radius of a tap target (perch leaf, owl). On screen it is never smaller than MIN_HIT_PX. */
const HIT_RADIUS = 0.62;
const MIN_HIT_PX = 36;
const VIEW_DIR = new Vector3(0, 0.12, 1).normalize();

// Luma and the jar stump: front left in landscape; in portrait they stand side by side in front of the tree,
// nearer the camera, so they fill the lower part of a tall screen and never reach up to a perch.
const LUMA_LANDSCAPE = new Vector3(-2.75, 0, 2.3);
const LUMA_PORTRAIT = new Vector3(-0.72, 0, 6.2);
const JAR_LANDSCAPE = new Vector3(-1.5, 0, 2.85);
const JAR_PORTRAIT = new Vector3(0.78, 0, 6.5);

const CALM_FOG = new Color(0x8e68b4);
const STORM_FOG = new Color(0x4a5484);
const CALM_SKYLIGHT = new Color(0xc4ccff);
const STORM_SKYLIGHT = new Color(0x9fb0e6);

const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

type LumaMode = "idle" | "wave" | "talk" | "hop" | "celebrate" | "rest";

interface ActiveStimulus {
  type: TrialType;
  /** World centre of the thing to tap (a perch, or the owl for a hoot). */
  target: Vector3;
  start: number;
  practice: boolean;
  responded: boolean;
}

interface BirdFlight {
  bird: Bird;
  active: boolean;
  dir: number;
  speed: number;
  y: number;
  phase: number;
  delay: number;
}

export function createStormWatchScene(parent: HTMLElement, opts: SceneOptions = {}): { destroy: () => void } {
  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const owner = Math.random().toString(36).slice(2);
  parent.dataset.swOwner = owner;
  const seed = opts.seed ?? 1042;
  const blockKinds: BlockKind[] = (seed & 1) === 1 ? ["storm", "calm"] : ["calm", "storm"]; // same rule as buildSchedule
  const rnd = mulberry32(seed ^ 0x5eed);

  const ui = buildUi(parent);
  const audio = new StormWatchAudio();

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (err) {
    audio.close();
    ui.destroy();
    throw err;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  // Above the sky layers, below the UI layer (the last child of the root).
  ui.root.insertBefore(canvas, ui.root.lastElementChild);

  const scene = new Scene();
  const fog = new Fog(CALM_FOG.getHex(), 26, 75);
  scene.fog = fog;
  // near 0.5 / far 160: enough depth precision that close surfaces never flicker.
  const camera = new PerspectiveCamera(38, 1, 0.5, 160);

  const grad = new DataTexture(new Uint8Array([95, 165, 220, 255]), 4, 1, RedFormat);
  grad.minFilter = grad.magFilter = NearestFilter;
  grad.needsUpdate = true;
  const outlineMat = makeOutlineMaterial();

  const hemi = new HemisphereLight(CALM_SKYLIGHT.getHex(), 0x4a3a6e, 2.1);
  scene.add(hemi);
  const moonLight = new DirectionalLight(0xfff0dc, 2.2);
  moonLight.position.set(7, 10, 8);
  scene.add(moonLight);
  const rim = new DirectionalLight(0xff9ec8, 0.8);
  rim.position.set(-8, 4, -6);
  scene.add(rim);

  const forest: Forest = buildForest(scene, grad, outlineMat);
  const perches = forest.perches;
  const station = forest.station;

  const luma: LumaRig = buildLuma(grad, outlineMat);
  luma.root.scale.setScalar(0.92);
  scene.add(luma.root);
  const lumaPos = LUMA_LANDSCAPE.clone();

  const owl = buildOwl(grad, outlineMat);
  owl.root.position.copy(OWL_FEET);
  owl.root.scale.setScalar(1.02);
  scene.add(owl.root);

  const firefly = buildFirefly(outlineMat, forest.glow);
  firefly.root.visible = false;
  scene.add(firefly.root);
  const cricket = buildCricket(grad, outlineMat);
  cricket.root.visible = false;
  scene.add(cricket.root);
  const perchLight = new PointLight(0xffc457, 0, 5, 2);
  scene.add(perchLight);

  // The little light that flies from the owl to the jar after a caught hoot.
  const noteMat = new SpriteMaterial({ map: forest.glow, color: 0xffc86b, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false });
  const note = new Sprite(noteMat);
  note.scale.setScalar(0.55);
  note.visible = false;
  scene.add(note);

  const birds: BirdFlight[] = BIRD_COLORS.map((c, k) => {
    const bird = buildBird(grad, outlineMat, c);
    bird.root.visible = false;
    bird.root.scale.setScalar(1.15);
    scene.add(bird.root);
    return { bird, active: false, dir: 1, speed: 0, y: 0, phase: k * 1.9, delay: 0 };
  });

  const sparkles = new Particles(220, 0.2, forest.glow);
  const fireworks = new Particles(800, 0.6, forest.glow);
  scene.add(sparkles.points, fireworks.points);
  const SPARK = [new Color(0xffffff), new Color(0xfff0a8), new Color(0xfff27a)];
  const RISE = [new Color(0xe6ff8a), new Color(0xfff27a), new Color(0xffffff)];
  const FIRE = [new Color(0xffd66b), new Color(0xfff27a), new Color(0x8ff0d8), new Color(0xffb05a), new Color(0xd2ff8a)];
  const WHITE = new Color(0xffffff);

  // ---- visual state (never used for measurement) ----
  let mode: LumaMode = "wave";
  let modeStart = 0;
  let state: RunState = "intro";
  let active: ActiveStimulus | null = null;
  let flight: { from: Vector3; start: number } | null = null;
  let noteFlight: { start: number } | null = null;
  let cricketLeave: { start: number; from: Vector3 } | null = null;
  let owlAwakeFrom = -1;
  let rehootAt = -1;
  let bubbleHideAt = -1;
  let blockIndex = -1;
  let firstTrialOfBlock = false;
  let stormTarget = 0;
  let storm = 0;
  let strike: { start: number; bolt: number; x: number } | null = null;
  let caught = 0;
  let jarGlow = 0;
  let lidOpen = 0;
  let decorTarget = 1;
  let decorLevel = 0;
  let nextFirework = 0;
  let nextRise = 0;
  let happyUntil = 0;
  let lastTs = 0;
  let raf = 0;
  let lost = false;
  let destroyed = false;
  let viewW = 1;
  let viewH = 1;

  const setMode = (m: LumaMode, ts: number) => {
    mode = m;
    modeStart = ts;
  };
  const jarMouth = (out: Vector3) => out.copy(station.root.position).add(station.mouth);
  const lumaHead = (out: Vector3) => out.set(lumaPos.x, lumaPos.y + 1.5, lumaPos.z);

  const hideStimulus = () => {
    if (!flight) firefly.root.visible = false;
    if (!cricketLeave) cricket.root.visible = false;
    perchLight.intensity = 0;
    active = null;
    rehootAt = -1;
    parent.dataset.stim = "";
  };

  // Birds fly behind the tree, never in front of it: the leaves and the trunk hide them for a moment, and
  // they can never cover a perch, the owl, Luma or the jar. They distract; they must not block a target.
  const launchBirds = (ts: number) => {
    const dir = rnd() < 0.5 ? 1 : -1;
    const base = 1.1 + rnd() * 0.6;
    let n = 0;
    for (const b of birds) {
      if (b.active || n >= 3) continue;
      b.active = true;
      b.dir = dir;
      b.speed = 6.2 + rnd() * 1.4;
      b.y = base + n * 0.62;
      b.delay = ts + n * 170;
      b.bird.root.position.set(-dir * (10.5 + n * 0.8), b.y, -2.4 - n * 0.45);
      b.bird.root.scale.setScalar(1.6);
      b.bird.root.rotation.y = dir > 0 ? 0 : Math.PI;
      b.bird.root.visible = true;
      n++;
    }
  };

  const tmp = new Vector3();
  const lightning = (ts: number) => {
    audio.thunder();
    const bolt = Math.floor(rnd() * forest.bolts.length) % forest.bolts.length;
    tmp.copy((forest.bolts[bolt] as Mesh).position).project(camera);
    strike = { start: ts, bolt, x: clamp01((tmp.x + 1) / 2) };
  };

  const runner = new StormWatchRunner(
    {
      onStateChange(st) {
        if (destroyed) return;
        state = st;
        parent.dataset.phase = st;
        const ts = lastTs;
        switch (st) {
          case "practice-intro":
            ui.say(STRINGS.practiceIntro, STRINGS.practiceIntroSub);
            decorTarget = 0;
            setMode("talk", ts);
            audio.babble(1200);
            break;
          case "practice-trial-isi":
            ui.say(null);
            setMode("idle", ts);
            break;
          case "practice-trial-stimulus": {
            const type = runner.getCurrentTrial()?.type;
            if (type === "go") {
              ui.say(runner.getLastPracticeOutcome() === null ? STRINGS.practiceGo1 : STRINGS.practiceGo2, STRINGS.goldenFireflyTip);
              audio.babble(800);
            } else if (type === "nogo") {
              ui.say(STRINGS.practiceNogo, STRINGS.shadowCricketTip);
              audio.babble(800);
            } else if (type === "go_audio") {
              // No babble here: the hoot must be heard. It repeats once while the instruction is up.
              ui.say(STRINGS.practiceAudio, STRINGS.owlTip);
              rehootAt = ts + 1700;
            }
            setMode("talk", ts);
            break;
          }
          case "practice-trial-feedback": {
            const o = runner.getLastPracticeOutcome();
            if (o === "hit") ui.say(STRINGS.feedbackHit);
            else if (o === "correct_reject") ui.say(STRINGS.feedbackNogoSuccess);
            else if (o === "commission") ui.say(STRINGS.feedbackNogoFail);
            else if (o === "omission") ui.say(STRINGS.feedbackOmission);
            else ui.say(null);
            if (o === "hit" || o === "correct_reject") setMode("hop", ts);
            break;
          }
          case "between":
            ui.say(STRINGS.betweenBlocks);
            stormTarget = 0;
            audio.stopRain();
            decorTarget = 1;
            setMode("rest", ts);
            audio.babble(1000);
            break;
          case "block-intro": {
            blockIndex += 1;
            const kind = blockKinds[blockIndex] ?? "calm";
            parent.dataset.block = kind;
            ui.say(kind === "storm" ? STRINGS.stormBlockIntro : STRINGS.calmBlockIntro);
            stormTarget = kind === "storm" ? 1 : 0;
            if (kind === "storm") audio.startRain();
            else audio.stopRain();
            decorTarget = 0;
            firstTrialOfBlock = true;
            setMode("hop", ts);
            audio.babble(1400);
            break;
          }
          case "trial-isi":
            // The block instruction stays a moment into the first wait (no stimulus yet), then goes well before it.
            if (firstTrialOfBlock) bubbleHideAt = ts + 700;
            else ui.say(null);
            firstTrialOfBlock = false;
            if (mode !== "hop") setMode("idle", ts);
            break;
          case "celebration":
            ui.say(STRINGS.celebration);
            stormTarget = 0;
            audio.stopRain();
            audio.catchSuccess();
            decorTarget = 1;
            nextFirework = ts + 300;
            nextRise = ts + 500;
            setMode("celebrate", ts);
            break;
          default:
            break;
        }
      },
      onStimulusOnset(trial, isPractice) {
        if (destroyed) return;
        // Inside runner.frame(ts): drawn by the render call of this same callback, at full size.
        const ts = lastTs;
        if (trial.type === "go_audio") {
          // Sound only. The owl does not move, light up or open its eyes until it has been tapped.
          audio.owlHoot();
          active = { type: trial.type, target: OWL_CENTRE, start: ts, practice: isPractice, responded: false };
        } else {
          const perch = perches[trial.treeLocation % perches.length] as (typeof perches)[number];
          const c = perch.centre;
          if (trial.type === "go") {
            flight = null;
            firefly.root.position.set(c.x, c.y - 0.02, c.z + 0.1);
            firefly.root.scale.setScalar(FIREFLY_SCALE);
            firefly.root.visible = true;
            perchLight.position.set(c.x, c.y + 0.1, c.z + 0.9);
            perchLight.intensity = LIGHT_ON;
          } else {
            cricketLeave = null;
            cricket.root.position.set(c.x - 0.02, c.y - 0.02, c.z + 0.12);
            cricket.root.scale.setScalar(CRICKET_SCALE);
            cricket.root.visible = true;
          }
          active = { type: trial.type, target: c, start: ts, practice: isPractice, responded: false };
        }
        parent.dataset.stim = trial.type;
      },
      onStimulusEnd() {
        if (destroyed) return;
        hideStimulus();
      },
      onDistractorTrigger(trial) {
        if (destroyed) return;
        const d = trial.distractorType ?? "bird";
        if (d === "bird" || d === "both") launchBirds(lastTs);
        if (d === "thunder" || d === "both") lightning(lastTs);
      },
      onHit() {
        if (destroyed || !active) return;
        audio.catchSuccess(); // the same chime for every catch
        active.responded = true;
        if (active.type === "go") {
          sparkles.spawn(tmp.copy(active.target).setZ(active.target.z + 0.3), 18, SPARK, 1.8, 600, -1.5);
          flight = { from: firefly.root.position.clone(), start: lastTs };
          perchLight.intensity = 0;
        } else {
          owlAwakeFrom = lastTs;
          noteFlight = { start: lastTs };
          sparkles.spawn(tmp.copy(OWL_CENTRE).setZ(OWL_CENTRE.z + 0.4), 14, SPARK, 1.6, 600, -1.5);
        }
      },
      onCommission() {
        if (destroyed || !active) return;
        // No sound and no mark: the cricket simply hops off its leaf.
        active.responded = true;
        cricketLeave = { start: lastTs, from: cricket.root.position.clone() };
      },
      onTapFeedback(x, y) {
        if (destroyed) return;
        audio.tap();
        ui.ripple(x, y);
      },
      onComplete(res) {
        if (destroyed) return;
        opts.onComplete?.(res);
      },
    },
    { seed: opts.seed, trialsPerBlock: opts.trialsPerBlock, stimulusMs: opts.stimulusMs, skipPractice: opts.skipPractice },
  );
  parent.dataset.phase = "intro";
  ui.title(STRINGS.title);
  ui.say(STRINGS.readyQuestion, STRINGS.readySubtext);
  ui.play(true);

  // ---- screen geometry: hit test, hand, dataset for end-to-end checks ----
  const edge = new Vector3();
  const toScreen = (world: Vector3): { x: number; y: number; r: number } => {
    tmp.copy(world).project(camera);
    const x = ((tmp.x + 1) / 2) * viewW;
    const y = ((1 - tmp.y) / 2) * viewH;
    edge.copy(world).setX(world.x + HIT_RADIUS).project(camera);
    const r = Math.max(MIN_HIT_PX, Math.abs(((edge.x + 1) / 2) * viewW - x));
    return { x, y, r };
  };
  const updateTargets = () => {
    const all = [...perches.map((p) => p.centre), OWL_CENTRE].map((c) => toScreen(c));
    parent.dataset.targets = all.map((s) => `${s.x.toFixed(0)},${s.y.toFixed(0)},${s.r.toFixed(0)}`).join(";");
  };

  const onDown = (e: PointerEvent) => {
    if (!isPrimaryPointer(e)) return; // a second finger is not a response
    audio.unlock(); // inside the gesture: required by iOS Safari
    const rect = ui.root.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (runner.state === "intro") {
      // Only the Start button leaves the start screen.
      if (ui.playHit(e.clientX, e.clientY)) {
        ui.play(false);
        ui.title(null);
        ui.ripple(x, y);
        runner.start(e.timeStamp);
      }
      return;
    }
    let onTarget = false;
    if (active) {
      const s = toScreen(active.target);
      onTarget = Math.hypot(x - s.x, y - s.y) <= s.r;
    }
    runner.pointerDown(e.timeStamp, x, y, onTarget);
  };
  const noMenu = (e: Event) => e.preventDefault();
  ui.root.addEventListener("pointerdown", onDown);
  ui.root.addEventListener("contextmenu", noMenu);

  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
  };
  const onRestored = () => {
    lost = false;
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  const target = new Vector3();
  let camBase = new Vector3();
  const fit = () => {
    const w = Math.max(1, ui.root.clientWidth);
    const h = Math.max(1, ui.root.clientHeight);
    viewW = w;
    viewH = h;
    const aspect = w / h;
    const portrait = aspect < 1;
    lumaPos.copy(portrait ? LUMA_PORTRAIT : LUMA_LANDSCAPE);
    station.root.position.copy(portrait ? JAR_PORTRAIT : JAR_LANDSCAPE);
    camera.fov = portrait ? 50 : 38;
    const tanH = Math.tan((camera.fov * Math.PI) / 360);
    // Wide enough for all four perches (and Luma in landscape), tall enough for the tree.
    const halfW = portrait ? 2.68 : 4.35;
    const halfH = portrait ? 3.6 : 2.95;
    const d = Math.max(7.2, halfW / (tanH * aspect), halfH / tanH);
    camera.aspect = aspect;
    target.set(0, portrait ? 1.2 : 1.5, 0.6);
    camera.position.copy(target).addScaledVector(VIEW_DIR, d);
    camBase = camera.position.clone();
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    fog.near = d + 14;
    fog.far = d + 70;
    renderer.setSize(w, h, false);
    updateTargets();
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(ui.root);

  const poseLuma = (ts: number) => {
    const t = ts - modeStart;
    let lift = 0;
    let sy = 1;
    let sx = 1;
    let flap = 0;
    let armL = 0;
    let armR = 0;
    let talking = false;
    if ((mode === "hop" || mode === "celebrate") && !reduced) {
      const period = mode === "celebrate" ? 720 : 620;
      const p = (t % period) / period;
      const air = p < 0.6 ? p / 0.6 : -1;
      if (air >= 0) {
        lift = (mode === "celebrate" ? 0.5 : 0.28) * 4 * air * (1 - air);
        const s = Math.sin(Math.PI * air);
        sy = 1 + 0.16 * s;
        sx = 1 - 0.08 * s;
      } else {
        const q = (p - 0.6) / 0.4;
        const sq = Math.sin(q * Math.PI) * 0.2;
        sy = 1 - sq;
        sx = 1 + sq * 0.7;
      }
      armL = armR = mode === "celebrate" ? 1.6 + Math.sin(ts * 0.012) * 0.3 : 0.8;
      flap = Math.sin(ts * 0.05) * 0.5;
      if (mode === "hop" && t > 1250) setMode("idle", ts);
    } else {
      sy = 1 + 0.018 * Math.sin(ts * 0.0032);
      sx = 1 - 0.009 * Math.sin(ts * 0.0032);
      if (mode === "celebrate" || mode === "hop") armL = armR = 1.4;
      if (mode === "wave") {
        armR = 2.1 + (reduced ? 0 : Math.sin(ts * 0.011) * 0.45);
        if (!reduced) flap = Math.sin(ts * 0.004) * 0.12;
      }
      if (mode === "talk") {
        talking = t < 1600;
        lift = talking && !reduced ? Math.abs(Math.sin(ts * 0.0105)) * 0.05 : 0;
        armL = armR = talking ? 0.35 + Math.sin(ts * 0.007) * 0.2 : 0;
      }
      if (mode === "rest") {
        sy = 1 + 0.03 * Math.sin(ts * 0.0016);
        sx = 1 - 0.015 * Math.sin(ts * 0.0016);
      }
    }
    // A small happy lift when a light reaches the jar (identical every time).
    if (ts < happyUntil && !reduced) {
      const k = 1 - (happyUntil - ts) / 420;
      lift += 0.16 * Math.sin(Math.PI * k);
      armL = armR = Math.max(armL, 1.2 * Math.sin(Math.PI * k));
    }
    luma.root.position.set(lumaPos.x, lumaPos.y + lift, lumaPos.z);
    luma.root.rotation.y = 0.42; // turned toward the tree
    luma.squash.scale.set(sx, sy, sx);
    (luma.arms[0] as Group).rotation.z = -armL;
    (luma.arms[1] as Group).rotation.z = armR;
    (luma.wings[0] as Group).rotation.y = flap;
    (luma.wings[1] as Group).rotation.y = -flap;
    for (const a of luma.antennae) a.rotation.z = Math.sin(ts * 0.004 + a.position.x * 9) * 0.05 - lift * 0.4;
    luma.mouth.visible = talking;
    luma.smile.visible = !talking;
    if (talking) luma.mouth.scale.set(0.075, 0.025 + 0.045 * Math.abs(Math.sin(ts * 0.021)), 0.03);
    const blink = ts % 3400 < 120 ? 0.12 : 1;
    let eyeY = mode === "rest" ? Math.min(blink, 0.45) : blink;
    if (ts < happyUntil || mode === "celebrate") eyeY = Math.min(eyeY, 0.55);
    for (const e of luma.eyes) e.scale.y = eyeY;
    forest.shadow.position.set(lumaPos.x, 0.035, lumaPos.z + 0.05);
    forest.shadow.scale.setScalar(1.3 * (1 - Math.min(lift, 0.6) * 0.6));
  };

  const landInJar = (ts: number, at: Vector3) => {
    caught += 1;
    sparkles.spawn(at, 20, SPARK, 1.9, 700, -2.0);
    happyUntil = ts + 420;
  };

  const head = new Vector3();
  const mouth = new Vector3();
  const frame = (ts: number) => {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    if (lost) return;
    const dt = lastTs ? Math.min(ts - lastTs, 50) : 16;
    lastTs = ts;

    // 1. Measurement state machine. May place a stimulus for this very frame.
    runner.frame(ts);

    // 2. Visuals.
    if (bubbleHideAt >= 0 && ts >= bubbleHideAt) {
      bubbleHideAt = -1;
      if (state === "trial-isi" || state === "trial-stimulus") ui.say(null);
    }
    if (rehootAt >= 0 && ts >= rehootAt) {
      rehootAt = -1;
      if (active?.type === "go_audio" && active.practice && !active.responded) audio.owlHoot();
    }

    // Weather: one level, 0 calm to 1 storm, eased over about two seconds.
    storm += (stormTarget - storm) * Math.min(1, dt / 800);
    if (Math.abs(stormTarget - storm) < 0.002) storm = stormTarget;
    const s = storm;
    ui.storm(s);
    fog.color.copy(CALM_FOG).lerp(STORM_FOG, s);
    hemi.color.copy(CALM_SKYLIGHT).lerp(STORM_SKYLIGHT, s);
    let flash = 0;
    if (strike) {
      const t = ts - strike.start;
      // Two quick pulses, then a slow fade: at most two flashes in a second.
      if (reduced) flash = t < 700 ? 0.45 * Math.sin((Math.PI * t) / 700) : 0;
      else if (t < 60) flash = t / 60;
      else if (t < 140) flash = mix(1, 0.3, (t - 60) / 80);
      else if (t < 200) flash = mix(0.3, 0.9, (t - 140) / 60);
      else flash = 0.9 * Math.pow(1 - clamp01((t - 200) / 700), 2);
      const bolt = forest.bolts[strike.bolt] as Mesh;
      const showBolt = !reduced && t < 280;
      bolt.visible = showBolt;
      forest.boltMat.opacity = showBolt ? Math.min(1, flash * 1.2) : 0;
      ui.flash(flash * 0.85, strike.x);
      if (t >= 900) {
        strike = null;
        bolt.visible = false;
        ui.flash(0);
      }
    }
    hemi.intensity = mix(2.1, 1.55, s) + flash * 1.0;
    moonLight.intensity = mix(2.2, 1.0, s) + flash * 0.9;
    rim.intensity = mix(0.8, 0.25, s);
    forest.moon.opacity = 1 - 0.9 * s;
    forest.moonHalo.opacity = 0.42 * (1 - s);
    forest.stars.opacity = 0.85 * (1 - 0.92 * s);
    forest.fairClouds.opacity = 0.55 * (1 - s);
    const cloudIn = easeInOut(s);
    for (const c of forest.clouds) {
      c.root.visible = s > 0.01;
      if (!c.root.visible) continue;
      c.root.position.lerpVectors(c.away, c.home, cloudIn);
      if (!reduced) c.root.position.x += Math.sin(ts * 0.00012 + c.phase) * 1.4;
      c.mat.opacity = cloudIn;
    }
    const rain = forest.rain;
    rain.a.visible = rain.b.visible = s > 0.02;
    if (rain.a.visible) {
      rain.mat.opacity = s * 0.42;
      const off = ((ts * (reduced ? 0.003 : 0.0105)) % rain.span + rain.span) % rain.span;
      rain.a.position.set(rain.slant * off, -off, 0);
      rain.b.position.set(rain.slant * (off - rain.span), rain.span - off, 0);
    }
    if (!reduced) {
      const amp = 0.006 + 0.024 * s;
      forest.sway.forEach((g, k) => {
        g.rotation.z = Math.sin(ts * 0.0011 + k * 1.3) * amp + Math.sin(ts * 0.0027 + k) * amp * 0.4;
      });
    }

    // Birds crossing the clearing (storm block only: launched by the runner's distractor hook).
    for (const b of birds) {
      if (!b.active || ts < b.delay) continue;
      const r = b.bird.root;
      r.position.x += b.dir * b.speed * (dt / 1000);
      r.position.y = b.y + Math.sin(ts * 0.0042 + b.phase) * 0.16;
      r.rotation.z = Math.cos(ts * 0.0042 + b.phase) * 0.09;
      const beat = Math.sin(ts * 0.021 + b.phase);
      (b.bird.wings[0] as Group).rotation.x = 0.25 + beat * 0.85;
      (b.bird.wings[1] as Group).rotation.x = -0.25 - beat * 0.85;
      if (Math.abs(r.position.x) > 11.5) {
        b.active = false;
        r.visible = false;
      }
    }

    // The creature on its perch. Full size from the first frame; the settle afterwards is only a small overshoot.
    if (active && active.type !== "go_audio") {
      const pop = reduced ? 1 : 1 + 0.12 * (1 - easeOut((ts - active.start) / 180));
      if (active.type === "go" && !flight) {
        firefly.root.scale.setScalar(FIREFLY_SCALE * pop);
        if (!reduced) firefly.root.position.y = active.target.y - 0.02 + Math.sin(ts * 0.009) * 0.045;
      } else if (active.type === "nogo" && !cricketLeave) {
        cricket.root.scale.setScalar(CRICKET_SCALE * pop);
      }
    }
    const wingBeat = reduced ? 0.3 : Math.sin(ts * 0.08) * 0.6;
    for (const [k, w] of firefly.wings.entries()) w.rotation.y = (k ? -1 : 1) * wingBeat;
    if (cricket.root.visible && !reduced) {
      cricket.antennae.forEach((a, k) => {
        a.rotation.z = Math.sin(ts * 0.006 + k * 1.4) * 0.09;
      });
    }
    if (cricketLeave) {
      const k = clamp01((ts - cricketLeave.start) / 300);
      cricket.root.position.set(cricketLeave.from.x + 1.1 * k, cricketLeave.from.y + 1.3 * k * (1 - k) * 2 - 0.4 * k * k, cricketLeave.from.z);
      cricket.root.scale.setScalar(CRICKET_SCALE * (1 - 0.75 * easeInOut(k)));
      if (k >= 1) {
        cricketLeave = null;
        cricket.root.visible = false;
      }
    }

    if (flight) {
      const k = Math.min((ts - flight.start) / FLIGHT_MS, 1);
      const e = easeInOut(k);
      jarMouth(mouth);
      firefly.root.position.lerpVectors(flight.from, mouth, e);
      firefly.root.position.y += Math.sin(Math.PI * k) * 0.8;
      firefly.root.scale.setScalar(FIREFLY_SCALE * (1 - 0.6 * e));
      if (k >= 1) {
        flight = null;
        firefly.root.visible = false;
        landInJar(ts, mouth);
      }
    }
    if (noteFlight) {
      const k = Math.min((ts - noteFlight.start) / FLIGHT_MS, 1);
      const e = easeInOut(k);
      jarMouth(mouth);
      note.visible = true;
      note.position.lerpVectors(OWL_CENTRE, mouth, e);
      note.position.y += Math.sin(Math.PI * k) * 0.7;
      note.position.z += 0.5;
      note.scale.setScalar(0.6 * (1 - 0.45 * e));
      if (k >= 1) {
        noteFlight = null;
        note.visible = false;
        landInJar(ts, mouth);
      }
    }

    // The owl: asleep and still (slow breathing only) until a caught hoot wakes it for a moment.
    const awakeT = owlAwakeFrom >= 0 ? (ts - owlAwakeFrom) / 1300 : -1;
    const isAwake = awakeT >= 0 && awakeT < 1;
    owl.asleep.visible = !isAwake;
    owl.awake.visible = isAwake;
    const breath = reduced ? 0 : Math.sin(ts * 0.0017) * 0.02;
    owl.body.scale.set(1 - breath * 0.5, 1 + breath, 1 - breath * 0.5);
    if (isAwake && !reduced) {
      const fade = 1 - awakeT;
      owl.body.rotation.z = Math.sin(awakeT * Math.PI * 5) * 0.12 * fade;
      const flap = Math.abs(Math.sin(awakeT * Math.PI * 4)) * 0.7 * fade;
      (owl.wings[0] as Group).rotation.z = -flap;
      (owl.wings[1] as Group).rotation.z = flap;
    } else {
      owl.body.rotation.z = 0;
      (owl.wings[0] as Group).rotation.z = 0;
      (owl.wings[1] as Group).rotation.z = 0;
      if (awakeT >= 1) owlAwakeFrom = -1;
    }

    poseLuma(ts);

    // The jar: a little brighter with every light, never a number.
    const glowWant = caught === 0 ? 0 : Math.min(0.35 + caught * 0.03, 0.95);
    jarGlow += (glowWant - jarGlow) * Math.min(1, dt / 300);
    station.glow.opacity = jarGlow * (reduced ? 1 : 0.9 + 0.1 * Math.sin(ts * 0.004));
    station.glowSprite.scale.setScalar(0.8 + Math.min(caught, 40) * 0.018);
    const lit = Math.min(caught, station.motes.length);
    station.motes.forEach((m, k) => {
      m.visible = k < lit;
      if (m.visible && !reduced) m.position.y = 0.1 + ((k * 0.37) % 1) * 0.28 + Math.sin(ts * 0.003 + k * 2.1) * 0.03;
    });

    // Decorative fireflies: only outside the measured trial loop.
    decorLevel += (decorTarget - decorLevel) * Math.min(1, dt / 350);
    const ffMat = forest.fireflies.material as PointsMaterial;
    ffMat.opacity = decorLevel * 0.95 * (1 - 0.7 * s);
    forest.fireflies.visible = decorLevel > 0.01;
    if (forest.fireflies.visible && !reduced) {
      const attr = forest.fireflies.geometry.getAttribute("position") as Float32BufferAttribute;
      const b = forest.fireflyBase;
      for (let i = 0; i < b.length / 3; i++) {
        attr.setXYZ(
          i,
          (b[i * 3] as number) + Math.sin(ts * 0.0006 + i) * 0.5,
          (b[i * 3 + 1] as number) + Math.sin(ts * 0.0011 + i * 2.1) * 0.3,
          (b[i * 3 + 2] as number) + Math.cos(ts * 0.0007 + i * 1.3) * 0.4,
        );
      }
      attr.needsUpdate = true;
    }

    // The end: the cork lifts and the caught lights drift back up into the night.
    const ending = state === "celebration" || state === "done";
    lidOpen += ((ending ? 1 : 0) - lidOpen) * Math.min(1, dt / 380);
    // The cork hops off in an arc and comes to rest on the grass beside the stump.
    station.lid.position.set(0.66 * lidOpen, 0.58 - 0.9 * lidOpen + 0.75 * Math.sin(Math.PI * lidOpen), 0.12 * lidOpen);
    station.lid.rotation.z = -1.75 * lidOpen;
    if (ending && !reduced) {
      if (ts >= nextRise) {
        nextRise = ts + 110;
        jarMouth(mouth);
        sparkles.spawn(mouth, 2, RISE, 0.5, 2600, 1.1);
      }
      if (ts >= nextFirework) {
        nextFirework = ts + 560 + Math.random() * 320;
        for (let b = 0; b < 2; b++) {
          tmp.set((Math.random() - 0.5) * 9, 3.6 + Math.random() * 1.4, -2.5 - Math.random() * 2);
          const c = FIRE[Math.floor(Math.random() * FIRE.length)] as Color;
          fireworks.spawn(tmp, 40, [c, c, WHITE], 4.0, 1500, -0.9, true);
        }
      }
    }
    sparkles.update(dt);
    fireworks.update(dt);

    // Gentle camera drift only on the start, break and end screens.
    const drift = !reduced && (state === "intro" || state === "between" || ending);
    const wantX = drift ? camBase.x + Math.sin(ts * 0.00025) * 0.3 : camBase.x;
    if (Math.abs(camera.position.x - wantX) > 0.0005) {
      camera.position.x = drift ? wantX : camBase.x + (camera.position.x - camBase.x) * 0.9;
      if (!drift && Math.abs(camera.position.x - camBase.x) < 0.001) camera.position.x = camBase.x;
      camera.lookAt(target);
      camera.updateMatrixWorld();
      updateTargets();
    }

    // Practice hand on the thing to tap (never on a cricket); bubble above Luma.
    if (active && active.practice && active.type !== "nogo" && !active.responded) {
      const p = toScreen(active.target);
      ui.hand(true, p.x, p.y + p.r * 0.62); // fingertip under the creature, not on its face
    } else ui.hand(false);
    if (viewW >= viewH) {
      // Landscape: the bubble sits on the grass in front of the tree, right of the jar, clear of every perch.
      head.copy(station.root.position).setX(station.root.position.x + 0.62).setY(0.5).project(camera);
      ui.place(((head.x + 1) / 2) * viewW + 14, viewH - 26, "side");
    } else {
      // Portrait: a caption over the crown of the tree, above the top perches.
      const top = toScreen((perches[1] as (typeof perches)[number]).centre);
      ui.place(viewW / 2, top.y - top.r - 10, "top");
    }

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  return {
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      ui.root.removeEventListener("pointerdown", onDown);
      ui.root.removeEventListener("contextmenu", noMenu);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      audio.close();
      const mats = new Set<Material>();
      scene.traverse((o) => {
        const m = o as Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = (m as { material?: Material | Material[] }).material;
        if (Array.isArray(mat)) mat.forEach((x) => mats.add(x));
        else if (mat) mats.add(mat);
      });
      mats.forEach((m) => {
        (m as { map?: { dispose(): void } | null }).map?.dispose();
        m.dispose();
      });
      grad.dispose();
      forest.glow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      ui.destroy();
      // React StrictMode mounts twice in development: only the instance that wrote the dataset last clears it.
      if (parent.dataset.swOwner === owner) {
        delete parent.dataset.phase;
        delete parent.dataset.stim;
        delete parent.dataset.block;
        delete parent.dataset.targets;
        delete parent.dataset.swOwner;
      }
    },
  };
}
