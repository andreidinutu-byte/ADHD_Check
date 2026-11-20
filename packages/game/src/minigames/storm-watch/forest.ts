// The Owl Tree clearing: one big storybook tree with four leaf perches and an owl hollow, a ring of night
// forest behind it, hills, moon and stars, plus everything the storm needs (clouds, rain, lightning bolts).
// Procedural, toon shaded and outlined like Lantern Watch (same gradient map, same outline hulls). The layout
// uses a fixed seed so every child sees the same clearing.
//
// No two surfaces share a plane: caps are inset and raised, decals float above the ground with depthWrite off,
// and every glow is an additive sprite that never writes depth. That is what keeps the scene free of z-fighting.
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  type DataTexture,
  DodecahedronGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  type Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { outline } from "../bridge-wait/luma";
import { glowTexture } from "../bridge-wait/world";
import { mulberry32 } from "./logic";

/** Centres of the four leaf perches (world units). The schedule's treeLocation is taken modulo this length. */
export const PERCH_SPOTS: readonly (readonly [number, number, number])[] = [
  [-1.95, 1.5, 0.55],
  [-1.2, 2.72, 0.45],
  [1.2, 2.72, 0.45],
  [1.95, 1.5, 0.55],
];
/** Where the owl's feet rest inside the hollow, and the centre of its body (tap target). */
export const OWL_FEET = new Vector3(0, 1.58, 0.52);
export const OWL_CENTRE = new Vector3(0, 1.98, 0.62);

export interface Perch {
  root: Group;
  centre: Vector3;
}

export interface Cloud {
  root: Group;
  mat: MeshToonMaterial;
  home: Vector3;
  away: Vector3;
  phase: number;
}

export interface Rain {
  a: Mesh;
  b: Mesh;
  mat: MeshBasicMaterial;
  /** Height of the rain box: the two copies are one box apart along the fall direction. */
  span: number;
  slant: number;
}

export interface JarStation {
  root: Group;
  glow: SpriteMaterial;
  glowSprite: Sprite;
  motes: Sprite[];
  lid: Group;
  /** Local position of the jar mouth (caught lights fly here). */
  mouth: Vector3;
}

export interface Forest {
  glow: CanvasTexture;
  perches: Perch[];
  /** Canopy clusters that sway in the wind (pivot at the crown of the trunk). */
  sway: Group[];
  clouds: Cloud[];
  fairClouds: MeshBasicMaterial;
  rain: Rain;
  bolts: Mesh[];
  boltMat: MeshBasicMaterial;
  moon: MeshBasicMaterial;
  moonHalo: SpriteMaterial;
  stars: PointsMaterial;
  shadow: Mesh;
  fireflies: Points;
  fireflyBase: Float32Array;
  station: JarStation;
}

function shadowTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(16,10,44,0.5)");
    r.addColorStop(0.6, "rgba(16,10,44,0.26)");
    r.addColorStop(1, "rgba(16,10,44,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  }
  return new CanvasTexture(c);
}

/** A jagged lightning bolt as a flat strip in the XY plane, top at y = 0, about 11 units tall. */
function boltGeometry(seed: number): BufferGeometry {
  const rnd = mulberry32(seed);
  const pos: number[] = [];
  const idx: number[] = [];
  const strip = (pts: [number, number][], w0: number, w1: number) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k] as [number, number];
      const [x1, y1] = pts[k + 1] as [number, number];
      const a = w0 + ((w1 - w0) * k) / (pts.length - 1);
      const b = w0 + ((w1 - w0) * (k + 1)) / (pts.length - 1);
      const base = pos.length / 3;
      pos.push(x0 - a, y0, 0, x0 + a, y0, 0, x1 + b, y1, 0, x1 - b, y1, 0);
      idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
  };
  const main: [number, number][] = [[0, 0]];
  let x = 0;
  for (let k = 1; k <= 8; k++) {
    x += (rnd() - 0.5) * 1.9;
    main.push([x, -k * 1.4]);
  }
  strip(main, 0.2, 0.05);
  const from = main[3] as [number, number];
  const side = rnd() < 0.5 ? -1 : 1;
  strip(
    [from, [from[0] + side * 0.9, from[1] - 1.0], [from[0] + side * 1.3, from[1] - 2.3], [from[0] + side * 2.1, from[1] - 3.2]],
    0.09,
    0.02,
  );
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  return geo;
}

function buildRain(): Rain {
  const rnd = mulberry32(77);
  const count = 320;
  const span = 11;
  const slant = 0.2;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let k = 0; k < count; k++) {
    const z = -5 + rnd() * 8.5;
    const x = -12 + rnd() * 24;
    const y = rnd() * span;
    const len = 0.3 + rnd() * 0.3;
    const w = 0.009 + ((z + 5) / 8.5) * 0.006; // nearer streaks a little wider
    const x2 = x - slant * len;
    const y2 = y + len;
    const b = k * 4;
    pos.push(x - w, y, z, x + w, y, z, x2 + w, y2, z, x2 - w, y2, z);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mat = new MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0, depthWrite: false, fog: false, side: DoubleSide });
  const a = new Mesh(geo, mat);
  const b = new Mesh(geo, mat);
  a.frustumCulled = b.frustumCulled = false;
  a.visible = b.visible = false;
  return { a, b, mat, span, slant };
}

export function buildForest(scene: Scene, grad: DataTexture, outlineMat: MeshBasicMaterial): Forest {
  const rnd = mulberry32(4107);
  const toon = (c: number) => new MeshToonMaterial({ color: new Color(c), gradientMap: grad });
  const white = toon(0xffffff); // instanced meshes tint it per instance
  const dummy = new Object3D();
  const glow = glowTexture();
  const sphere = new SphereGeometry(1, 24, 16);

  // ---- ground ----
  const ground = new Mesh(new CircleGeometry(80, 48).rotateX(-Math.PI / 2), toon(0x4bb56c));
  scene.add(ground);
  const mound = new Mesh(sphere, toon(0x5cc67a));
  mound.scale.set(3.6, 0.42, 2.2);
  mound.position.set(0, -0.2, -0.2);
  scene.add(mound);

  // ---- the Owl Tree ----
  const bark = toon(0x8a5743);
  const barkDark = toon(0x6e4335);
  const barkLight = toon(0xa9745a);
  const tree = new Group();
  const profile = [
    new Vector2(1.02, 0),
    new Vector2(0.8, 0.22),
    new Vector2(0.62, 0.7),
    new Vector2(0.54, 1.4),
    new Vector2(0.52, 2.3),
    new Vector2(0.56, 3.0),
    new Vector2(0.66, 3.5),
    new Vector2(0.5, 3.9),
  ];
  const trunkGeo = new LatheGeometry(profile, 18);
  const trunk = new Mesh(trunkGeo, bark);
  const trunkHull = new Mesh(trunkGeo, outlineMat);
  trunkHull.scale.set(1.055, 1.0, 1.055);
  trunkHull.renderOrder = -1;
  tree.add(trunk, trunkHull);
  // Roots: squashed blobs around the foot.
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.4;
    const root = new Mesh(sphere, k % 2 ? bark : barkDark);
    root.scale.set(0.34, 0.2, 0.62);
    root.position.set(Math.cos(a) * 0.95, 0.06, Math.sin(a) * 0.95);
    root.rotation.y = -a + Math.PI / 2;
    outline(root, outlineMat, 1.08);
    tree.add(root);
  }
  // Bark knots.
  for (const [x, y, r] of [
    [-0.36, 0.95, 0.09],
    [0.33, 3.02, 0.08],
    [-0.3, 2.95, 0.06],
  ] as const) {
    const knot = new Mesh(new TorusGeometry(r, r * 0.42, 6, 14), barkDark);
    const surf = Math.sqrt(Math.max(0.01, 0.54 * 0.54 - x * x));
    knot.position.set(x, y, surf + 0.02);
    knot.rotation.y = Math.atan2(x, surf);
    tree.add(knot);
  }
  // The hollow: a dark oval that just breaks the trunk surface, and a raised lip around it.
  const hollow = new Mesh(sphere, new MeshBasicMaterial({ color: 0x241a3d }));
  hollow.scale.set(0.43, 0.52, 0.22);
  hollow.position.set(0, 2.02, 0.34);
  const lip = new Mesh(new TorusGeometry(0.47, 0.075, 8, 28), barkLight);
  lip.scale.set(1, 1.2, 2.4);
  lip.position.set(0, 2.02, 0.36);
  outline(lip, outlineMat, 1.05);
  tree.add(hollow, lip);

  // Branches and perches.
  const leaf = toon(0x6ad08c);
  const leafDark = toon(0x2c9070);
  const leafLight = toon(0x9be6a6);
  const perches: Perch[] = [];
  for (const [px, py, pz] of PERCH_SPOTS) {
    const s = Math.sign(px);
    const high = py > 2;
    const curve = new CatmullRomCurve3([
      new Vector3(s * 0.3, py - (high ? 0.55 : 0.75), 0.05),
      new Vector3(px * 0.5, py - (high ? 0.62 : 0.6), 0.25),
      new Vector3(px * 0.85, py - 0.46, pz - 0.1),
      new Vector3(px + s * 0.42, py - 0.4, pz - 0.06),
    ]);
    tree.add(new Mesh(new TubeGeometry(curve, 24, 0.105, 8, false), bark));
    const hull = new Mesh(new TubeGeometry(curve, 24, 0.132, 8, false), outlineMat);
    hull.renderOrder = -1;
    tree.add(hull);
    // Rounded tip.
    const tip = new Mesh(sphere, bark);
    tip.scale.setScalar(0.105);
    tip.position.set(px + s * 0.42, py - 0.4, pz - 0.06);
    outline(tip, outlineMat, 1.26);
    tree.add(tip);

    const root = new Group();
    root.position.set(px, py, pz);
    // The big round leaf behind the creature: the calm backdrop every stimulus is seen against.
    const disc = new Mesh(sphere, leaf);
    disc.scale.set(0.58, 0.58, 0.09);
    disc.position.z = -0.24;
    outline(disc, outlineMat, 1.055);
    const vein = new Mesh(sphere, leafLight);
    vein.scale.set(0.035, 0.44, 0.03);
    vein.position.set(0, 0, -0.16);
    // Smaller leaves fanned behind it.
    for (const [lx, ly, rot, sc, mat] of [
      [-0.5, -0.2, 0.9, 0.3, leafDark],
      [0.5, -0.18, -0.9, 0.3, leafDark],
      [-0.32, 0.46, 0.4, 0.26, leafDark],
      [0.34, 0.45, -0.45, 0.24, leafLight],
    ] as const) {
      const l = new Mesh(sphere, mat);
      l.scale.set(sc * 0.62, sc, 0.06);
      l.position.set(lx, ly, -0.34);
      l.rotation.z = rot;
      outline(l, outlineMat, 1.09);
      root.add(l);
    }
    root.add(disc, vein);
    tree.add(root);
    perches.push({ root, centre: new Vector3(px, py, pz) });
  }
  scene.add(tree);

  // Canopy: three clusters of leafy blobs behind the perch plane, each with an outline hull, each swaying.
  const blobGeo = new IcosahedronGeometry(1, 2);
  const canopyColors = [0x1f7a68, 0x25896f, 0x2f9e78, 0x1b6b66, 0x38ad80];
  const sway: Group[] = [];
  for (const g of [-1, 0, 1]) {
    const pivot = new Group();
    pivot.position.set(g * 0.5, 3.5, -0.5);
    const n = g === 0 ? 9 : 8;
    const blobs = new InstancedMesh(blobGeo, white, n);
    const hulls = new InstancedMesh(blobGeo, outlineMat, n);
    hulls.renderOrder = -1;
    for (let k = 0; k < n; k++) {
      const x = g * 1.75 + (rnd() - 0.5) * 1.9;
      const r = 0.82 + rnd() * 0.5;
      const y = 0.55 + rnd() * 1.75 - Math.abs(x) * 0.13;
      const z = -0.55 + rnd() * 0.75 - (k % 3) * 0.25;
      dummy.position.set(x - g * 0.5, y, z);
      dummy.rotation.set(rnd() * 3, rnd() * 3, 0);
      dummy.scale.set(r * 1.08, r * 0.9, r);
      dummy.updateMatrix();
      blobs.setMatrixAt(k, dummy.matrix);
      blobs.setColorAt(k, new Color(canopyColors[Math.floor(rnd() * canopyColors.length)] as number));
      dummy.scale.multiplyScalar(1.05);
      dummy.updateMatrix();
      hulls.setMatrixAt(k, dummy.matrix);
    }
    pivot.add(hulls, blobs);
    scene.add(pivot);
    sway.push(pivot);
  }

  // ---- forest behind and beside the clearing ----
  const canopy = new InstancedMesh(blobGeo, white, 120);
  const trunks = new InstancedMesh(new CylinderGeometry(0.12, 0.2, 1, 7), toon(0x6b4232), 50);
  const cones = new InstancedMesh(new ConeGeometry(1, 1.4, 8), white, 90);
  const leafColors = [0x2f9e6e, 0x3cb37a, 0x2b8f7a, 0x278a6a, 0x4ab884];
  const pineColors = [0x23806e, 0x2d9478, 0x1f6f66];
  let ci = 0;
  let ti = 0;
  let pi = 0;
  const spots: [number, number][] = [];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 20; k++) {
      const front = k >= 16;
      const x = s * (front ? 6.4 + rnd() * 5.5 : 3.2 + rnd() * 15);
      const z = front ? -0.5 + rnd() * 2.6 : -4.5 - rnd() * 15;
      spots.push([x, z]);
    }
  }
  for (const [x, z] of spots) {
    const h = 1.2 + rnd() * 1.3;
    const pine = rnd() < 0.42;
    dummy.rotation.set(0, rnd() * 6, 0);
    dummy.position.set(x, h / 2, z);
    dummy.scale.set(1.2, h, 1.2);
    dummy.updateMatrix();
    trunks.setMatrixAt(ti++, dummy.matrix);
    if (pine) {
      for (let l = 0; l < 3; l++) {
        const r = 1.15 - l * 0.3;
        dummy.position.set(x, h + 0.4 + l * 0.72, z);
        dummy.scale.set(r, r * 1.1, r);
        dummy.updateMatrix();
        cones.setMatrixAt(pi, dummy.matrix);
        cones.setColorAt(pi, new Color(pineColors[pi % 3] as number));
        pi++;
      }
    } else {
      const n = 2 + Math.floor(rnd() * 2);
      for (let l = 0; l < n; l++) {
        const r = 0.85 + rnd() * 0.5;
        dummy.position.set(x + (rnd() - 0.5) * 0.9, h + 0.55 + l * 0.38, z + (rnd() - 0.5) * 0.7);
        dummy.scale.set(r, r * 0.92, r);
        dummy.updateMatrix();
        canopy.setMatrixAt(ci, dummy.matrix);
        canopy.setColorAt(ci, new Color(leafColors[Math.floor(rnd() * leafColors.length)] as number));
        ci++;
      }
    }
  }
  // Bushes that frame the front corners.
  for (const [x, z, r] of [
    [-5.6, 1.4, 0.7],
    [-6.5, 0.6, 0.9],
    [5.3, 1.5, 0.75],
    [6.3, 0.8, 0.95],
    [4.4, 0.3, 0.55],
    [-4.5, 0.2, 0.5],
    [3.3, -1.6, 0.6],
    [-3.4, -1.7, 0.65],
  ] as const) {
    dummy.rotation.set(0, rnd() * 6, 0);
    dummy.position.set(x, r * 0.45, z);
    dummy.scale.set(r * 1.25, r * 0.8, r);
    dummy.updateMatrix();
    canopy.setMatrixAt(ci, dummy.matrix);
    canopy.setColorAt(ci, new Color(leafColors[ci % leafColors.length] as number));
    ci++;
  }
  canopy.count = ci;
  trunks.count = ti;
  cones.count = pi;
  scene.add(canopy, trunks, cones);

  // A fallen log on the right, balancing Luma on the left. The pale end caps are inset and stick out a
  // little, so they never share a plane with the bark.
  const log = new Group();
  const logBody = new Mesh(new CylinderGeometry(0.27, 0.3, 1.7, 12).rotateZ(Math.PI / 2), bark);
  outline(logBody, outlineMat, 1.0).scale.set(1.0, 1.1, 1.1);
  const logCore = new Mesh(new CylinderGeometry(0.2, 0.22, 1.74, 12).rotateZ(Math.PI / 2), toon(0xe0b98c));
  const logRing = new Mesh(new CylinderGeometry(0.1, 0.11, 1.78, 10).rotateZ(Math.PI / 2), toon(0xc99a6c));
  const moss = new Mesh(sphere, toon(0x5cc67a));
  moss.scale.set(0.42, 0.1, 0.24);
  moss.position.set(-0.2, 0.25, 0.02);
  log.add(logBody, logCore, logRing, moss);
  log.position.set(3.0, 0.27, 2.2);
  log.rotation.y = 0.55;
  scene.add(log);

  // Stones.
  const stones = new InstancedMesh(new DodecahedronGeometry(1, 1), white, 22);
  const stoneColors = [0x8d87bf, 0x7a74ad, 0x9b95c9];
  for (let k = 0; k < 22; k++) {
    const a = rnd() * Math.PI * 2;
    const near = k < 9;
    const r = near ? 0.12 + rnd() * 0.14 : 0.2 + rnd() * 0.3;
    const x = near ? Math.cos(a) * 3.7 : (rnd() < 0.5 ? -1 : 1) * (3.6 + rnd() * 6);
    const z = near ? -0.2 + Math.abs(Math.sin(a)) * 2.3 : -2.5 + rnd() * 5;
    dummy.position.set(x, r * 0.3, z);
    dummy.scale.set(r * 1.3, r * 0.75, r);
    dummy.rotation.set(rnd(), rnd() * 6, rnd());
    dummy.updateMatrix();
    stones.setMatrixAt(k, dummy.matrix);
    stones.setColorAt(k, new Color(stoneColors[k % 3] as number));
  }
  scene.add(stones);

  // Grass blades, flowers and mushrooms; the spots where Luma and the jar stand stay clear.
  const clear = (x: number, z: number) =>
    (x < 0.6 && x > -3.6 && z > 1.6 && z < 4.2) || (Math.abs(x) < 1.7 && z > 5.2) || Math.hypot(x, z + 0.2) < 1.3;
  const blades = new InstancedMesh(new ConeGeometry(0.05, 0.34, 3).translate(0, 0.17, 0), white, 520);
  const bladeColors = [0x6fd27a, 0x4fb86a, 0x8fe08a];
  let bi = 0;
  while (bi < 520) {
    const x = (rnd() - 0.5) * 22;
    const z = -9 + rnd() * 17;
    if (clear(x, z)) continue;
    dummy.position.set(x, 0, z);
    dummy.rotation.set((rnd() - 0.5) * 0.4, rnd() * 6, (rnd() - 0.5) * 0.4);
    const sc = 0.7 + rnd() * 0.8;
    dummy.scale.set(sc, sc, sc);
    dummy.updateMatrix();
    blades.setMatrixAt(bi, dummy.matrix);
    blades.setColorAt(bi, new Color(bladeColors[bi % 3] as number));
    bi++;
  }
  scene.add(blades);

  const heads = new InstancedMesh(new SphereGeometry(1, 10, 8), white, 70);
  const stems = new InstancedMesh(new CylinderGeometry(0.015, 0.015, 1, 4).translate(0, 0.5, 0), toon(0x3c9a55), 70);
  const flowerColors = [0xff8fc0, 0xffe066, 0xb9a3ff, 0xffffff, 0x7fd0ff];
  let fi = 0;
  while (fi < 70) {
    const x = (rnd() - 0.5) * 18;
    const z = -3.5 + rnd() * 8.5;
    if (clear(x, z) || Math.abs(x) < 2.2) continue;
    const h = 0.18 + rnd() * 0.2;
    dummy.rotation.set(0, 0, 0);
    dummy.position.set(x, 0, z);
    dummy.scale.set(1, h, 1);
    dummy.updateMatrix();
    stems.setMatrixAt(fi, dummy.matrix);
    dummy.position.set(x, h, z);
    dummy.scale.setScalar(0.07 + rnd() * 0.04);
    dummy.updateMatrix();
    heads.setMatrixAt(fi, dummy.matrix);
    heads.setColorAt(fi, new Color(flowerColors[fi % flowerColors.length] as number));
    fi++;
  }
  scene.add(heads, stems);

  const caps = new InstancedMesh(new SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), white, 12);
  const mStems = new InstancedMesh(new CylinderGeometry(0.6, 0.75, 1, 8).translate(0, 0.5, 0), toon(0xfff1d6), 12);
  const capColors = [0xff6f91, 0xff9a62, 0xd98cff];
  (
    [
      [1.25, 0.95],
      [1.5, 0.7],
      [-1.3, 0.85],
      [3.9, 1.6],
      [4.2, 1.35],
      [-4.4, 2.6],
      [-4.1, 2.9],
      [2.2, 3.0],
      [5.6, 3.1],
      [-5.8, -0.6],
      [5.9, -0.9],
      [3.5, 2.95],
    ] as const
  ).forEach(([x, z], k) => {
    const r = 0.12 + rnd() * 0.12;
    dummy.rotation.set(0, 0, (rnd() - 0.5) * 0.3);
    dummy.position.set(x, 0, z);
    dummy.scale.set(r * 0.45, r * 1.4, r * 0.45);
    dummy.updateMatrix();
    mStems.setMatrixAt(k, dummy.matrix);
    dummy.position.set(x, r * 1.35, z);
    dummy.scale.set(r * 1.25, r, r * 1.25);
    dummy.updateMatrix();
    caps.setMatrixAt(k, dummy.matrix);
    caps.setColorAt(k, new Color(capColors[k % 3] as number));
  });
  scene.add(caps, mStems);

  // ---- far away: hills, moon, stars ----
  const hillGeo = new SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  for (const [x, z, r, h, c] of [
    [-26, -44, 16, 8.5, 0x4a4796],
    [2, -52, 22, 9.5, 0x3d3c87],
    [30, -44, 17, 9, 0x4a4796],
    [-12, -34, 11, 5, 0x3b6f8f],
    [16, -32, 12, 5.4, 0x3b6f8f],
  ] as const) {
    const m = new Mesh(hillGeo, toon(c));
    m.scale.set(r, h, r * 0.6);
    m.position.set(x, -0.2, z);
    scene.add(m);
  }

  const moon = new MeshBasicMaterial({ color: 0xf7e9c6, fog: false, transparent: true });
  const moonMesh = new Mesh(new SphereGeometry(2.3, 24, 16), moon);
  moonMesh.position.set(27, 10.6, -58);
  const moonHalo = new SpriteMaterial({ map: glow, color: 0xffe9c2, transparent: true, opacity: 0.42, blending: AdditiveBlending, depthWrite: false, fog: false });
  const halo = new Sprite(moonHalo);
  halo.scale.setScalar(17);
  halo.position.copy(moonMesh.position);
  scene.add(moonMesh, halo);

  const starPos: number[] = [];
  for (let k = 0; k < 260; k++) {
    const a = rnd() * Math.PI * 2;
    const e = 0.03 + rnd() * 0.9;
    starPos.push(Math.cos(a) * 90 * Math.cos(e), 3 + Math.sin(e) * 70, -Math.abs(Math.sin(a)) * 90 - 20);
  }
  const starGeo = new BufferGeometry();
  starGeo.setAttribute("position", new Float32BufferAttribute(starPos, 3));
  const stars = new PointsMaterial({ color: 0xfff6e0, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 });
  scene.add(new Points(starGeo, stars));

  // Fair-weather clouds: two pale wisps that fade out when the storm comes.
  const fairClouds = new MeshBasicMaterial({ color: 0xcbb6e8, transparent: true, opacity: 0.55, fog: false, depthWrite: false });
  for (const [x, y, z, s] of [
    [-30, 9.4, -60, 1],
    [-17, 12.2, -62, 0.7],
    [38, 6.2, -60, 0.8],
  ] as const) {
    for (let k = 0; k < 4; k++) {
      const m = new Mesh(sphere, fairClouds);
      m.scale.set((3.2 - Math.abs(k - 1.5)) * s, 0.75 * s, 1);
      m.position.set(x + (k - 1.5) * 2.6 * s, y + (k % 2) * 0.35, z);
      scene.add(m);
    }
  }

  // Storm clouds: heavy puffs that slide in over the forest. Parked high and transparent while it is calm.
  const clouds: Cloud[] = [];
  const cloudColors = [0x59608f, 0x4b527f, 0x666d9c];
  (
    [
      [-25, 10.2, -40, 1.25],
      [-13, 12.2, -44, 1.0],
      [24, 11.6, -42, 1.3],
      [13, 12.6, -46, 0.95],
      [-36, 8.2, -38, 1.0],
      [36, 8.0, -40, 1.05],
      [0, 13.4, -48, 1.2],
    ] as const
  ).forEach(([x, y, z, s], k) => {
    const mat = new MeshToonMaterial({ color: new Color(cloudColors[k % 3] as number), gradientMap: grad, transparent: true, opacity: 0, fog: false });
    const root = new Group();
    for (let p = 0; p < 6; p++) {
      const m = new Mesh(sphere, mat);
      const r = (2.3 + rnd() * 1.5) * s;
      m.scale.set(r * 1.25, r * 0.78, r * 0.8);
      m.position.set((p - 2.5) * 2.4 * s + (rnd() - 0.5), (p % 2 ? 0.7 : 0) * s + (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 1.5);
      root.add(m);
    }
    const home = new Vector3(x, y, z);
    const away = new Vector3(x + Math.sign(x || 1) * 16, y + 7, z);
    root.position.copy(away);
    root.visible = false;
    scene.add(root);
    clouds.push({ root, mat, home, away, phase: k * 1.7 });
  });

  const rain = buildRain();
  scene.add(rain.a, rain.b);

  const boltMat = new MeshBasicMaterial({ color: 0xeaf0ff, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, fog: false, side: DoubleSide });
  const bolts: Mesh[] = [];
  for (const [x, seed] of [
    [-24, 11],
    [22, 29],
    [-34, 47],
    [33, 5],
  ] as const) {
    const b = new Mesh(boltGeometry(seed), boltMat);
    b.position.set(x, 14.5, -37);
    b.visible = false;
    b.frustumCulled = false;
    scene.add(b);
    bolts.push(b);
  }

  // Luma's blob shadow (cheap, no shadow maps). Floats above the grass and never writes depth.
  const shadow = new Mesh(new PlaneGeometry(1.1, 1.1), new MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = 1;
  scene.add(shadow);

  // Decorative fireflies: only shown outside the measured trial loop, kept away from the perches.
  const ffCount = 30;
  const ffBase = new Float32Array(ffCount * 3);
  let fk = 0;
  while (fk < ffCount) {
    const x = (rnd() - 0.5) * 20;
    const z = -8 + rnd() * 11;
    if (Math.abs(x) < 3.4 && z > -3) continue;
    ffBase[fk * 3] = x;
    ffBase[fk * 3 + 1] = 0.9 + rnd() * 2.6;
    ffBase[fk * 3 + 2] = z;
    fk++;
  }
  const ffGeo = new BufferGeometry();
  ffGeo.setAttribute("position", new Float32BufferAttribute(Array.from(ffBase), 3));
  const fireflies = new Points(
    ffGeo,
    new PointsMaterial({ map: glow, color: 0xd9ff8a, size: 0.38, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
  );
  scene.add(fireflies);

  const station = buildStation(grad, outlineMat, glow);
  scene.add(station.root);

  return { glow, perches, sway, clouds, fairClouds, rain, bolts, boltMat, moon, moonHalo, stars, shadow, fireflies, fireflyBase: ffBase, station };
}

/** The tree stump with the firefly jar on it, next to Luma. Origin on the ground. */
function buildStation(grad: DataTexture, outlineMat: MeshBasicMaterial, glow: CanvasTexture): JarStation {
  const toon = (c: number) => new MeshToonMaterial({ color: new Color(c), gradientMap: grad });
  const root = new Group();

  const stump = new Mesh(new CylinderGeometry(0.36, 0.45, 0.34, 14), toon(0x8a5743));
  stump.position.y = 0.17;
  outline(stump, outlineMat, 1.0).scale.set(1.08, 1.03, 1.08);
  // Pale cut face: narrower than the stump and raised above it, so the two tops are never coplanar.
  const face = new Mesh(new CylinderGeometry(0.3, 0.3, 0.04, 14), toon(0xe0b98c));
  face.position.y = 0.345;
  const ring = new Mesh(new CylinderGeometry(0.16, 0.16, 0.04, 12), toon(0xc99a6c));
  ring.position.y = 0.352;
  root.add(stump, face, ring);

  // Jar: deep blue glass with an outline, a pale rim and a cork. The light inside is drawn by sprites that sit
  // just in front of the glass, so nothing transparent has to be sorted.
  const glassGeo = new LatheGeometry(
    [new Vector2(0.001, 0), new Vector2(0.2, 0), new Vector2(0.26, 0.07), new Vector2(0.26, 0.4), new Vector2(0.18, 0.5), new Vector2(0.18, 0.56), new Vector2(0.001, 0.56)],
    18,
  );
  const jar = new Group();
  jar.position.y = 0.37;
  const glass = new Mesh(glassGeo, toon(0x33458f));
  const glassHull = new Mesh(glassGeo, outlineMat);
  glassHull.scale.set(1.09, 1.03, 1.09);
  glassHull.position.y = -0.008;
  glassHull.renderOrder = -1;
  const rim = new Mesh(new TorusGeometry(0.185, 0.03, 8, 20).rotateX(Math.PI / 2), toon(0xd9e6ff));
  rim.position.y = 0.55;
  const shine = new Mesh(new SphereGeometry(1, 10, 8), new MeshBasicMaterial({ color: 0xbfd4ff, transparent: true, opacity: 0.55, depthWrite: false }));
  shine.scale.set(0.022, 0.13, 0.01);
  shine.position.set(-0.15, 0.24, 0.215);
  shine.rotation.z = 0.08;
  const lid = new Group();
  lid.position.y = 0.58;
  const cork = new Mesh(new CylinderGeometry(0.15, 0.17, 0.12, 12), toon(0xc8925a));
  cork.position.y = 0.05;
  outline(cork, outlineMat, 1.1);
  lid.add(cork);
  jar.add(glass, glassHull, rim, shine, lid);

  const glowMat = new SpriteMaterial({ map: glow, color: 0xdfff7a, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
  const glowSprite = new Sprite(glowMat);
  glowSprite.position.set(0, 0.24, 0.3);
  glowSprite.scale.setScalar(0.9);
  jar.add(glowSprite);
  const motes: Sprite[] = [];
  const moteMat = new SpriteMaterial({ map: glow, color: 0xf4ffb0, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false });
  for (let k = 0; k < 8; k++) {
    const m = new Sprite(moteMat);
    const a = k * 2.4;
    m.position.set(Math.cos(a) * 0.12, 0.1 + ((k * 0.37) % 1) * 0.28, 0.29);
    m.scale.setScalar(0.13);
    m.visible = false;
    motes.push(m);
    jar.add(m);
  }
  root.add(jar);
  return { root, glow: glowMat, glowSprite, motes, lid, mouth: new Vector3(0, 0.37 + 0.62, 0) };
}
