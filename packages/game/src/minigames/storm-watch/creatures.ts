// Storm Watch creatures, built in code from three.js primitives (no downloaded model), toon shaded and
// outlined like Luma. The firefly (go) is the one from Lantern Watch. Here: the cricket (no-go), the owl in
// the hollow (its hoot is the sound-only go cue) and the birds that cross the clearing during the storm.
//
// Go and no-go differ in shape, brightness and colour at once, so neither colour vision nor one feature alone
// carries the signal: the firefly is round, upright and glows gold; the cricket is long, low, dark indigo,
// with tall bent legs and long antennae, and does not glow.
import {
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  type DataTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { outline } from "../bridge-wait/luma";

export interface Cricket {
  root: Group;
  antennae: Group[];
}

export function buildCricket(grad: DataTexture, outlineMat: MeshBasicMaterial): Cricket {
  const toon = (c: number) => new MeshToonMaterial({ color: new Color(c), gradientMap: grad });
  const sphere = new SphereGeometry(1, 20, 14);
  const shell = toon(0x40327e);
  const shellDark = toon(0x2c2160);
  const belly = toon(0xb9a8ea);
  const root = new Group();
  const g = new Group(); // faces +x, turned a little toward the camera
  g.rotation.y = -0.45;
  root.add(g);

  const body = new Mesh(sphere, shell);
  body.scale.set(0.3, 0.17, 0.18);
  outline(body, outlineMat, 1.1);
  const under = new Mesh(sphere, belly);
  under.scale.set(0.24, 0.09, 0.14);
  under.position.set(0.01, -0.085, 0);
  const wing = new Mesh(sphere, shellDark);
  wing.scale.set(0.24, 0.085, 0.15);
  wing.position.set(-0.07, 0.085, 0);
  const head = new Mesh(sphere, shell);
  head.scale.setScalar(0.155);
  head.position.set(0.29, 0.05, 0);
  outline(head, outlineMat, 1.12);
  g.add(body, under, wing, head);

  const white = new MeshBasicMaterial({ color: 0xf2f5ff });
  const pupil = new MeshBasicMaterial({ color: 0x1b1436 });
  for (const s of [-1, 1]) {
    const eye = new Mesh(sphere, white);
    eye.scale.setScalar(0.058);
    eye.position.set(0.36, 0.1, s * 0.09);
    const p = new Mesh(sphere, pupil);
    p.scale.setScalar(0.032);
    p.position.set(0.4, 0.1, s * 0.105);
    g.add(eye, p);
  }

  // Long antennae swept back over the body.
  const antennae: Group[] = [];
  for (const s of [-1, 1]) {
    const a = new Group();
    a.position.set(0.34, 0.17, s * 0.05);
    const curve = new CatmullRomCurve3([new Vector3(0, 0, 0), new Vector3(-0.04, 0.2, s * 0.03), new Vector3(-0.22, 0.34, s * 0.06), new Vector3(-0.46, 0.36, s * 0.08)]);
    a.add(new Mesh(new TubeGeometry(curve, 12, 0.013, 5, false), shellDark));
    antennae.push(a);
    g.add(a);
  }

  // Big hind legs: the knee stands well above the back, the signature cricket shape.
  const shin = new CylinderGeometry(0.022, 0.018, 0.46, 6);
  for (const s of [-1, 1]) {
    const thigh = new Mesh(sphere, shell);
    thigh.scale.set(0.075, 0.2, 0.065);
    thigh.position.set(-0.16, 0.1, s * 0.17);
    thigh.rotation.z = 0.35;
    outline(thigh, outlineMat, 1.14);
    const lower = new Mesh(shin, shellDark);
    lower.position.set(-0.31, 0.06, s * 0.19);
    lower.rotation.z = -0.5;
    g.add(thigh, lower);
    for (const fx of [0.05, 0.2]) {
      const front = new Mesh(new CylinderGeometry(0.016, 0.014, 0.2, 5), shellDark);
      front.position.set(fx, -0.15, s * 0.12);
      front.rotation.z = fx > 0.1 ? -0.35 : 0.2;
      g.add(front);
    }
  }
  return { root, antennae };
}

export interface Owl {
  root: Group;
  /** Squash pivot at the feet: breathing and the happy wiggle. */
  body: Group;
  /** Closed-eye arcs (asleep) and open eyes (awake): exactly one set is visible. */
  asleep: Group;
  awake: Group;
  wings: Group[];
  tufts: Mesh[];
}

export function buildOwl(grad: DataTexture, outlineMat: MeshBasicMaterial): Owl {
  const toon = (c: number) => new MeshToonMaterial({ color: new Color(c), gradientMap: grad });
  const sphere = new SphereGeometry(1, 24, 16);
  const feather = toon(0xa56d4c);
  const featherDark = toon(0x80503a);
  const cream = toon(0xf7e3bd);
  const root = new Group();
  const body = new Group();
  root.add(body);

  const torso = new Mesh(sphere, feather);
  torso.scale.set(0.34, 0.39, 0.3);
  torso.position.y = 0.39;
  outline(torso, outlineMat, 1.07);
  const chest = new Mesh(sphere, cream);
  chest.scale.set(0.23, 0.24, 0.12);
  chest.position.set(0, 0.28, 0.215);
  body.add(torso, chest);
  for (const [x, y] of [
    [-0.08, 0.3],
    [0.08, 0.3],
    [0, 0.2],
  ] as const) {
    const speck = new Mesh(sphere, featherDark);
    speck.scale.set(0.035, 0.022, 0.012);
    speck.position.set(x, y, 0.33);
    body.add(speck);
  }

  // Face: two pale discs.
  const faceMat = toon(0xfff3da);
  for (const s of [-1, 1]) {
    const disc = new Mesh(sphere, faceMat);
    disc.scale.set(0.15, 0.15, 0.06);
    disc.position.set(s * 0.125, 0.54, 0.225);
    body.add(disc);
  }
  const lidMat = new MeshBasicMaterial({ color: 0x3a2440 });
  const asleep = new Group();
  const awake = new Group();
  const iris = new MeshBasicMaterial({ color: 0xffcf4a });
  const pupil = new MeshBasicMaterial({ color: 0x1b1436 });
  const white = new MeshBasicMaterial({ color: 0xffffff });
  for (const s of [-1, 1]) {
    const lid = new Mesh(new TorusGeometry(0.07, 0.016, 6, 16, Math.PI), lidMat);
    lid.rotation.z = Math.PI;
    lid.position.set(s * 0.125, 0.555, 0.292);
    asleep.add(lid);
    const i = new Mesh(sphere, iris);
    i.scale.set(0.1, 0.1, 0.03);
    i.position.set(s * 0.125, 0.545, 0.285);
    const p = new Mesh(sphere, pupil);
    p.scale.set(0.058, 0.058, 0.02);
    p.position.set(s * 0.125, 0.545, 0.31);
    const hi = new Mesh(sphere, white);
    hi.scale.setScalar(0.02);
    hi.position.set(s * 0.125 + 0.025, 0.575, 0.325);
    awake.add(i, p, hi);
  }
  awake.visible = false;
  body.add(asleep, awake);

  const beak = new Mesh(new ConeGeometry(0.045, 0.1, 8), toon(0xf5a13d));
  beak.rotation.x = Math.PI;
  beak.position.set(0, 0.46, 0.31);
  body.add(beak);

  const tufts: Mesh[] = [];
  const wings: Group[] = [];
  for (const s of [-1, 1]) {
    const tuft = new Mesh(new ConeGeometry(0.075, 0.2, 8), featherDark);
    tuft.position.set(s * 0.21, 0.78, 0.04);
    tuft.rotation.z = -s * 0.45;
    outline(tuft, outlineMat, 1.16);
    tufts.push(tuft);
    body.add(tuft);

    const pivot = new Group();
    pivot.position.set(s * 0.3, 0.52, 0.03);
    const w = new Mesh(sphere, featherDark);
    w.scale.set(0.09, 0.25, 0.2);
    w.position.set(s * 0.03, -0.2, 0.02);
    outline(w, outlineMat, 1.1);
    pivot.add(w);
    wings.push(pivot);
    body.add(pivot);

    const foot = new Mesh(sphere, toon(0xf5a13d));
    foot.scale.set(0.07, 0.04, 0.09);
    foot.position.set(s * 0.11, 0.03, 0.2);
    body.add(foot);
  }
  return { root, body, asleep, awake, wings, tufts };
}

export interface Bird {
  root: Group;
  wings: Group[];
}

export const BIRD_COLORS = [0xff8fa3, 0x7fd0ff, 0xffd166, 0xb9a3ff, 0x7fe0b0, 0xffa66b] as const;

/** A round storybook bird that faces +x; the wings flap around the x axis. */
export function buildBird(grad: DataTexture, outlineMat: MeshBasicMaterial, color: number): Bird {
  const toon = (c: number) => new MeshToonMaterial({ color: new Color(c), gradientMap: grad });
  const sphere = new SphereGeometry(1, 18, 12);
  const main = toon(color);
  const root = new Group();
  const body = new Mesh(sphere, main);
  body.scale.set(0.3, 0.23, 0.22);
  outline(body, outlineMat, 1.09);
  const belly = new Mesh(sphere, toon(0xfff1d6));
  belly.scale.set(0.22, 0.14, 0.17);
  belly.position.set(0.03, -0.09, 0);
  const head = new Mesh(sphere, main);
  head.scale.setScalar(0.17);
  head.position.set(0.25, 0.13, 0);
  outline(head, outlineMat, 1.11);
  const beak = new Mesh(new ConeGeometry(0.055, 0.14, 8), toon(0xf5a13d));
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.45, 0.11, 0);
  const tail = new Mesh(sphere, main);
  tail.scale.set(0.2, 0.045, 0.12);
  tail.position.set(-0.36, 0.06, 0);
  tail.rotation.z = -0.35;
  outline(tail, outlineMat, 1.12);
  root.add(body, belly, head, beak, tail);
  const white = new MeshBasicMaterial({ color: 0xffffff });
  const pupil = new MeshBasicMaterial({ color: 0x1b1436 });
  for (const s of [-1, 1]) {
    const eye = new Mesh(sphere, white);
    eye.scale.setScalar(0.05);
    eye.position.set(0.32, 0.18, s * 0.12);
    const p = new Mesh(sphere, pupil);
    p.scale.setScalar(0.028);
    p.position.set(0.355, 0.18, s * 0.135);
    root.add(eye, p);
  }
  const wings: Group[] = [];
  for (const s of [-1, 1]) {
    const pivot = new Group();
    pivot.position.set(-0.02, 0.1, s * 0.14);
    const w = new Mesh(sphere, main);
    w.scale.set(0.2, 0.035, 0.3);
    w.position.set(-0.03, 0, s * 0.27);
    outline(w, outlineMat, 1.1);
    pivot.add(w);
    wings.push(pivot);
    root.add(pivot);
  }
  return { root, wings };
}
