// The star-gazing hill: everything around the nine stars, in the same storybook look as Lantern Watch (toon
// shading, dark outlines). Far hills, a low moon, a line of trees behind the hill, grass, flowers and
// mushrooms on it, and Luma's telescope.
//
// Calm design (see scene.ts): all of it is static, and all of it stays below the star field. Nothing here
// moves, lights up or twinkles, and nothing in the sky can be mistaken for a star to tap. The scenery is
// decoration only: it never changes where the stars are or how big they are.
//
// The camera looks straight ahead from (0, CAMERA_Y, CAMERA_Z) and the stars live in the plane z = 0. Scenery
// is designed in that plane ("apparent" units) and then pushed back along the view ray, so its place on screen
// is known exactly while the depth order and the fog still work.
import {
  AdditiveBlending,
  type CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  type DataTexture,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  Object3D,
  type Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  type Vector3,
} from "three";
import { mulberry32 } from "../bridge-wait/logic";
import { outline } from "../bridge-wait/luma";

export interface NightView {
  /** Half width and half height of the view in the star plane, and the height of the hill top there. */
  hw: number;
  hh: number;
  top: number;
  portrait: boolean;
  cameraY: number;
  cameraZ: number;
  groundR: number;
  /** Where Luma stands and how big it is, to keep its spot clear and put the telescope beside it. */
  luma: Vector3;
  lumaScale: number;
}

export interface Night {
  layout: (v: NightView) => void;
}

/** Highest point any scenery may reach above the hill top, in the star plane. The lowest star edge is higher. */
export const SCENERY_MAX = 1.35;

export function buildNight(scene: Scene, grad: DataTexture, outlineMat: MeshBasicMaterial, glow: CanvasTexture): Night {
  const toon = (c: number) => new MeshToonMaterial({ color: new Color(c), gradientMap: grad });
  const white = toon(0xffffff); // instanced meshes tint it per instance
  const dummy = new Object3D();
  const sphere = new SphereGeometry(1, 24, 16);
  const halfSphere = new SphereGeometry(1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2);

  // ---- far hills ----
  const farHills = [toon(0x3d3c87), toon(0x4a4796), toon(0x3b6f8f)].map((m) => {
    const h = new Mesh(halfSphere, m);
    scene.add(h);
    return h;
  });

  // ---- a low moon, rising behind the hills, well under the star field ----
  const moon = new Mesh(new SphereGeometry(1, 24, 16), new MeshBasicMaterial({ color: 0xf7e9c6, fog: false }));
  const moonHalo = new Sprite(new SpriteMaterial({ map: glow, color: 0xffe9c2, transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false, fog: false }));
  scene.add(moon, moonHalo);

  // ---- the tree line behind the hill ----
  const TREES = 13;
  const blobGeo = new IcosahedronGeometry(1, 2);
  const coneGeo = new ConeGeometry(1, 1.4, 8);
  const trunks = new InstancedMesh(new CylinderGeometry(0.1, 0.15, 1, 7), toon(0x5b3a4a), TREES);
  const blobs = new InstancedMesh(blobGeo, white, TREES * 3);
  const blobHulls = new InstancedMesh(blobGeo, outlineMat, TREES * 3);
  const cones = new InstancedMesh(coneGeo, white, TREES * 3);
  const coneHulls = new InstancedMesh(coneGeo, outlineMat, TREES * 3);
  blobHulls.renderOrder = coneHulls.renderOrder = -1;
  for (const m of [trunks, blobs, blobHulls, cones, coneHulls]) m.frustumCulled = false;
  scene.add(trunks, blobHulls, blobs, coneHulls, cones);
  const leafColors = [0x2f9e6e, 0x278a6a, 0x3cb37a, 0x2b8f7a];
  const pineColors = [0x23806e, 0x1f6f66, 0x2d9478];

  // ---- on the hill: grass, flowers, mushrooms, stones ----
  const N_BLADES = 300;
  const N_FLOWERS = 24;
  const N_SHROOMS = 7;
  const N_STONES = 8;
  const blades = new InstancedMesh(new ConeGeometry(0.05, 0.34, 3).translate(0, 0.17, 0), white, N_BLADES);
  const heads = new InstancedMesh(new SphereGeometry(1, 10, 8), white, N_FLOWERS);
  const stems = new InstancedMesh(new CylinderGeometry(0.015, 0.015, 1, 4).translate(0, 0.5, 0), toon(0x2f8a55), N_FLOWERS);
  const caps = new InstancedMesh(new SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), white, N_SHROOMS);
  const capStems = new InstancedMesh(new CylinderGeometry(0.6, 0.75, 1, 8).translate(0, 0.5, 0), toon(0xfff1d6), N_SHROOMS);
  const stones = new InstancedMesh(new DodecahedronGeometry(1, 1), white, N_STONES);
  for (const m of [blades, heads, stems, caps, capStems, stones]) {
    m.frustumCulled = false;
    scene.add(m);
  }
  const bladeColors = [0x5fc47a, 0x49ad68, 0x7ad68a];
  // Soft colours, never the gold of a lit star.
  const flowerColors = [0xff9cc4, 0xb9a3ff, 0xffffff, 0x8fd0ff, 0xd6a8ff];
  const capColors = [0xff6f91, 0xd98cff, 0xff9a62];
  const stoneColors = [0x8d87bf, 0x7a74ad, 0x9b95c9];
  // Fixed random numbers, so a resize lays the same hill out again.
  const rnd = mulberry32(905);
  const rolls = Array.from({ length: 4 * (N_BLADES + N_FLOWERS + N_SHROOMS + N_STONES + TREES * 8) }, () => rnd());

  // ---- Luma's telescope ----
  const scope = new Group();
  {
    const wood = toon(0x8a5743);
    const brass = toon(0xe0a84e);
    const body = toon(0x4a4796);
    const leg = new CylinderGeometry(0.03, 0.035, 1, 6).translate(0, 0.5, 0);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.5;
      const l = new Mesh(leg, wood);
      l.scale.y = 0.95;
      l.rotation.set(Math.sin(a) * 0.36, 0, -Math.cos(a) * 0.36);
      l.position.set(Math.cos(a) * 0.32, 0, Math.sin(a) * 0.32);
      scope.add(l);
    }
    const hub = new Mesh(sphere, brass);
    hub.scale.setScalar(0.09);
    hub.position.y = 0.9;
    outline(hub, outlineMat, 1.2);
    const tube = new Group();
    tube.position.y = 0.95;
    tube.rotation.z = 0.95; // pointing up at the sky, away from Luma
    const main = new Mesh(new CylinderGeometry(0.115, 0.14, 0.95, 14).rotateZ(-Math.PI / 2), body);
    main.position.x = 0.12;
    outline(main, outlineMat, 1.0).scale.set(1.03, 1.16, 1.16);
    const front = new Mesh(new CylinderGeometry(0.165, 0.165, 0.14, 14).rotateZ(-Math.PI / 2), brass);
    front.position.x = 0.62;
    outline(front, outlineMat, 1.0).scale.set(1.12, 1.12, 1.12);
    const lens = new Mesh(new CylinderGeometry(0.125, 0.125, 0.15, 14).rotateZ(-Math.PI / 2), new MeshBasicMaterial({ color: 0x9fc4ff }));
    lens.position.x = 0.626;
    const eye = new Mesh(new CylinderGeometry(0.07, 0.085, 0.24, 12).rotateZ(-Math.PI / 2), brass);
    eye.position.x = -0.45;
    outline(eye, outlineMat, 1.0).scale.set(1.06, 1.2, 1.2);
    const band = new Mesh(new TorusGeometry(0.135, 0.022, 6, 16).rotateY(Math.PI / 2), brass);
    band.position.x = 0.05;
    tube.add(main, front, lens, eye, band);
    scope.add(hub, tube);
  }
  scene.add(scope);

  const layout = (v: NightView) => {
    const { hw, top, cameraY, cameraZ, groundR } = v;
    let ri = 0;
    const roll = () => rolls[ri++ % rolls.length] as number;
    /** Push a point of the star plane back to depth z along its view ray; returns the scale that keeps its size. */
    const back = (x: number, y: number, z: number) => {
      const k = (cameraZ - z) / cameraZ;
      dummy.position.set(x * k, cameraY - (cameraY - y) * k, z);
      return k;
    };
    const hillY = (x: number, z: number) => top - groundR + Math.sqrt(Math.max(0, groundR * groundR - x * x - z * z));
    /** How far the hill's skyline has dropped at x (it is a big sphere). */
    const drop = (x: number) => groundR - Math.sqrt(Math.max(0, groundR * groundR - x * x));

    // Far hills: wide, low, layered.
    (
      [
        [-0.55, 0.85, 0.95, -44],
        [0.42, 0.95, 1.12, -38],
        [-0.05, 0.6, 0.72, -30],
      ] as const
    ).forEach(([fx, fr, h, z], i) => {
      const hill = farHills[i] as Mesh;
      const k = back(fx * hw, top - 0.55, z);
      hill.position.copy(dummy.position);
      hill.scale.set(Math.max(4, fr * hw) * k, h * k * 1.45, 6);
    });

    // Moon: to the right, its top edge under SCENERY_MAX.
    const mk = back(hw * (v.portrait ? 0.62 : 0.74), top + 0.72, -70);
    moon.position.copy(dummy.position);
    moon.scale.setScalar(0.5 * mk);
    moonHalo.position.copy(dummy.position);
    moonHalo.scale.setScalar(2.0 * mk);

    // Trees: bases hidden behind the hill, tops capped below the star field.
    let bi = 0;
    let ci = 0;
    for (let t = 0; t < TREES; t++) {
      const fx = -1.12 + (t / (TREES - 1)) * 2.24 + (roll() - 0.5) * 0.09;
      const x = fx * hw;
      const z = -3.5 - roll() * 6.5;
      const size = 0.78 + roll() * 0.3;
      const base = top - drop(x) - 0.3;
      const pine = roll() < 0.45;
      const turn = roll() * 6;
      const k = back(x, base + 0.45 * size, z);
      dummy.rotation.set(0, turn, 0);
      dummy.scale.set(k * size, k * 0.9 * size, k * size);
      dummy.updateMatrix();
      trunks.setMatrixAt(t, dummy.matrix);
      const put = (mesh: InstancedMesh, hulls: InstancedMesh, i: number, ax: number, ay: number, sx: number, sy: number, color: number) => {
        const kk = back(x + ax * size, base + ay * size, z);
        dummy.rotation.set(0, turn + i, 0);
        dummy.scale.set(kk * sx * size, kk * sy * size, kk * sx * size);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, new Color(color));
        dummy.scale.multiplyScalar(1.07);
        dummy.updateMatrix();
        hulls.setMatrixAt(i, dummy.matrix);
      };
      if (pine) {
        for (let l = 0; l < 3; l++) put(cones, coneHulls, ci++, 0, 0.66 + l * 0.27, 0.52 - l * 0.12, 0.5 - l * 0.08, pineColors[(t + l) % 3] as number);
      } else {
        const n = 2 + (roll() < 0.5 ? 1 : 0);
        for (let l = 0; l < n; l++) put(blobs, blobHulls, bi++, (roll() - 0.5) * 0.5, 0.78 + l * 0.12 + roll() * 0.06, 0.44 + roll() * 0.12, 0.38 + roll() * 0.06, leafColors[(t + l) % leafColors.length] as number);
      }
    }
    trunks.count = TREES;
    blobs.count = blobHulls.count = bi;
    cones.count = coneHulls.count = ci;
    for (const m of [trunks, blobs, blobHulls, cones, coneHulls]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }

    // The hill itself. Luma's spot and the telescope's stay clear.
    const scopeX = v.luma.x + 1.28 * v.lumaScale;
    const scopeZ = v.luma.z - 0.25;
    const clear = (x: number, z: number) => Math.hypot(x - v.luma.x, (z - v.luma.z) * 0.8) < 0.95 * v.lumaScale || Math.hypot(x - scopeX, z - scopeZ) < 0.55;
    const spot = (zMin: number, zMax: number): [number, number] => {
      for (let tries = 0; tries < 6; tries++) {
        const x = (roll() * 2 - 1) * hw * 1.15;
        const z = zMin + roll() * (zMax - zMin);
        if (!clear(x, z)) return [x, z];
      }
      return [hw * 1.4, zMin]; // off screen
    };
    for (let i = 0; i < N_BLADES; i++) {
      const [x, z] = spot(-7, 4.6);
      dummy.position.set(x, hillY(x, z), z);
      dummy.rotation.set((roll() - 0.5) * 0.4, roll() * 6, (roll() - 0.5) * 0.4);
      dummy.scale.setScalar(0.7 + roll() * 0.8);
      dummy.updateMatrix();
      blades.setMatrixAt(i, dummy.matrix);
      blades.setColorAt(i, new Color(bladeColors[i % 3] as number));
    }
    for (let i = 0; i < N_FLOWERS; i++) {
      const [x, z] = spot(-4, 4.2);
      const y = hillY(x, z);
      const h = 0.18 + roll() * 0.2;
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(x, y, z);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      stems.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, y + h, z);
      dummy.scale.setScalar(0.055 + roll() * 0.03);
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
      heads.setColorAt(i, new Color(flowerColors[i % flowerColors.length] as number));
    }
    for (let i = 0; i < N_SHROOMS; i++) {
      const [x, z] = spot(-1.5, 3.8);
      const y = hillY(x, z);
      const r = 0.12 + roll() * 0.11;
      dummy.rotation.set(0, 0, (roll() - 0.5) * 0.3);
      dummy.position.set(x, y, z);
      dummy.scale.set(r * 0.45, r * 1.4, r * 0.45);
      dummy.updateMatrix();
      capStems.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, y + r * 1.35, z);
      dummy.scale.set(r * 1.25, r, r * 1.25);
      dummy.updateMatrix();
      caps.setMatrixAt(i, dummy.matrix);
      caps.setColorAt(i, new Color(capColors[i % 3] as number));
    }
    for (let i = 0; i < N_STONES; i++) {
      const [x, z] = spot(-3, 4);
      const r = 0.12 + roll() * 0.2;
      dummy.position.set(x, hillY(x, z) + r * 0.25, z);
      dummy.rotation.set(roll(), roll() * 6, roll());
      dummy.scale.set(r * 1.3, r * 0.75, r);
      dummy.updateMatrix();
      stones.setMatrixAt(i, dummy.matrix);
      stones.setColorAt(i, new Color(stoneColors[i % 3] as number));
    }
    for (const m of [blades, heads, stems, caps, capStems, stones]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }

    scope.position.set(scopeX, hillY(scopeX, scopeZ) - 0.02, scopeZ);
    scope.scale.setScalar(0.92 * v.lumaScale);
    scope.rotation.y = -0.3;
  };

  return { layout };
}
