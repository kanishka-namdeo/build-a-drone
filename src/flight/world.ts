/**
 * Drone Lab — the flying range: world primitives, collisions, checkpoints.
 *
 * Units are metres. The world is a flat field with solid prims (boxes,
 * cylinders, trees, gates, houses) and ground decals. Collision uses the
 * craft's hit radius; goals are rings (cross flying the heading) or spheres.
 */

import type { WorldPrim, Goal, FlightState } from '../types';

export interface Solid {
  t: 'box' | 'cyl';
  x: number;
  y: number;
  z: number;
  w?: number;
  d?: number;
  h: number;
  r?: number;
  r1?: number;
  n?: number;
  yaw?: number;
  rot?: number;
  col: string;
  name?: string;
  gate?: boolean;
  taper?: boolean;
}

export interface Decal {
  t: 'flat' | 'disc';
  x: number;
  y: number;
  w?: number;
  d?: number;
  r?: number;
  yaw?: number;
  col: string;
  label?: string;
  ink?: boolean;
  pad?: boolean;
}

export interface World {
  solids: Solid[];
  decals: Decal[];
  goals: Goal[];
  gates: Array<{ x: number; y: number; heading: number }>;
  field: number;
  pad: [number, number];
  ground: string;
  title: string;
  brief: string;
  camTilt: number;
  alt: boolean;
  /** Indoor range (living room etc.): warm walls instead of sky/clouds. */
  indoor?: boolean;
}

export const DEFAULT_GATES: Array<[number, number, number]> = [
  [18.5, 15, 0],
  [21.5, 18.5, 70],
  [18, 21.5, 165],
  [13, 20, 215],
  [12, 15.5, -60]
];

/** Build the runtime world from a range spec (or defaults). */
export function buildWorld(range: {
  title: string;
  brief: string;
  field?: number;
  pad?: [number, number];
  ground?: string;
  alt?: boolean;
  camTilt?: number;
  keepGates?: boolean;
  indoor?: boolean;
  prims?: WorldPrim[];
  goals?: Goal[];
}): World {
  const field = range.field ?? 30;
  const pad = range.pad ?? [field / 2, field / 2];
  const solids: Solid[] = [];
  const decals: Decal[] = [];
  const goals: Goal[] = range.goals ?? [];
  const prims = range.prims ?? (range.goals?.length ? [] : [{ t: 'tree', x: 8, y: 8, h: 6 } as WorldPrim, { t: 'tree', x: 22, y: 10, h: 7 } as WorldPrim, { t: 'tree', x: 25, y: 22, h: 5 } as WorldPrim, { t: 'tree', x: 7, y: 21, h: 6 } as WorldPrim, { t: 'tree', x: 15, y: 26, h: 8 } as WorldPrim, { t: 'tree', x: 24, y: 15, h: 5.5 } as WorldPrim]);
  const keepGates = range.keepGates ?? !range.prims;

  for (const p of prims) {
    switch (p.t) {
      case 'box':
        solids.push({ t: 'box', x: p.x, y: p.y, z: p.z ?? 0, w: p.w, d: p.d, h: p.h, yaw: p.yaw ?? 0, col: p.col ?? '#d9d3c4', solid: undefined, name: p.label, label: undefined } as unknown as Solid);
        break;
      case 'cyl':
        solids.push({ t: 'cyl', x: p.x, y: p.y, z: p.z ?? 0, r: p.r, r1: p.r1 ?? p.r, h: p.h, n: p.n ?? 14, rot: p.rot ?? 0, col: p.col ?? '#c9c2b2' });
        break;
      case 'tree':
        // trunk + foliage cone
        solids.push({ t: 'cyl', x: p.x, y: p.y, z: 0, r: 0.16, r1: 0.14, h: 0.35 * p.h, n: 8, col: '#bf8a4f' });
        solids.push({ t: 'cyl', x: p.x, y: p.y, z: 0.3 * p.h, r: Math.max(0.5, 0.22 * p.h), r1: 0.03, h: 0.7 * p.h, n: 12, col: '#6aa86b', taper: true, name: 'a tree' });
        break;
      case 'pole':
        solids.push({ t: 'cyl', x: p.x, y: p.y, z: 0, r: p.r ?? 0.08, r1: p.r ?? 0.08, h: p.h, n: 8, col: p.col ?? '#8a8f93' });
        break;
      case 'house': {
        const roofH = p.roof ?? Math.min(p.w, p.d) * 0.45;
        solids.push({ t: 'box', x: p.x, y: p.y, z: 0, w: p.w, d: p.d, h: p.h, yaw: p.yaw ?? 0, col: p.col ?? '#e2dccb' });
        solids.push({ t: 'cyl', x: p.x, y: p.y, z: p.h, r: Math.hypot(p.w, p.d) / 2 * 1.02, r1: 0.02, h: roofH, n: 4, rot: (p.yaw ?? 0) + 45, col: p.roofCol ?? '#c96a4e', taper: true, name: 'a roof' });
        break;
      }
      case 'gate': {
        const th = 0.07;
        const gw = p.w ?? 1.6;
        const gh = p.h ?? 1.6;
        const a = ((p.heading + 90) * Math.PI) / 180;
        const dx = Math.cos(a) * (gw / 2 + th / 2);
        const dy = Math.sin(a) * (gw / 2 + th / 2);
        const col = p.col ?? '#ece6d6';
        solids.push({ t: 'box', x: p.x - dx, y: p.y - dy, z: 0, w: th, d: th, h: gh + th, col, gate: true });
        solids.push({ t: 'box', x: p.x + dx, y: p.y + dy, z: 0, w: th, d: th, h: gh + th, col, gate: true });
        solids.push({ t: 'box', x: p.x, y: p.y, z: gh, w: gw + 2 * th, d: th, h: th, yaw: p.heading + 90, col, gate: true });
        break;
      }
      case 'flat':
        decals.push({ t: 'flat', x: p.x, y: p.y, w: p.w, d: p.d, yaw: p.yaw ?? 0, col: p.col ?? '#d7d2c0', label: p.label, ink: p.ink });
        break;
      case 'disc':
        decals.push({ t: 'disc', x: p.x, y: p.y, r: p.r, col: p.col ?? '#e8e3d2', label: p.label });
        break;
    }
  }

  const gates: Array<{ x: number; y: number; heading: number }> = [];
  if (keepGates) {
    for (const [x, y, heading] of DEFAULT_GATES) {
      const th = 0.07;
      const a = ((heading + 90) * Math.PI) / 180;
      const dx = Math.cos(a) * (1.6 / 2 + th / 2);
      const dy = Math.sin(a) * (1.6 / 2 + th / 2);
      solids.push({ t: 'box', x: x - dx, y: y - dy, z: 0, w: th, d: th, h: 1.6 + th, col: '#ece6d6', gate: true });
      solids.push({ t: 'box', x: x + dx, y: y + dy, z: 0, w: th, d: th, h: 1.6 + th, col: '#ece6d6', gate: true });
      solids.push({ t: 'box', x, y, z: 1.6, w: 1.6 + 2 * th, d: th, h: th, yaw: heading + 90, col: '#ece6d6', gate: true });
      gates.push({ x, y, heading });
    }
  }

  decals.push({ t: 'disc', x: pad[0], y: pad[1], r: 0.6, col: '#f4f1e6', label: 'H', pad: true });

  return {
    solids,
    decals,
    goals,
    gates,
    field,
    pad,
    ground: range.ground ?? '#dfe5cf',
    title: range.title,
    brief: range.brief,
    camTilt: range.camTilt ?? 25,
    alt: range.alt ?? true,
    indoor: range.indoor ?? false
  };
}

/* ------------------------------------------------------------------ */
/* collision                                                           */
/* ------------------------------------------------------------------ */

export interface CollideCfg {
  hitR: number;
}

/** True + reason when the craft (radius m) overlaps a solid. */
export function collideAt(w: World, px: number, py: number, pz: number, m: number): string | null {
  for (const o of w.solids) {
    // vertical band
    if (pz - m > o.z + o.h + m || pz + m < o.z - m) continue;
    if (o.t === 'box') {
      const c = Math.cos(-((o.yaw ?? 0) * Math.PI) / 180);
      const s = Math.sin(-((o.yaw ?? 0) * Math.PI) / 180);
      const lx = (px - o.x) * c - (py - o.y) * s;
      const ly = (px - o.x) * s + (py - o.y) * c;
      if (Math.abs(lx) < (o.w ?? 1) / 2 + m && Math.abs(ly) < (o.d ?? 1) / 2 + m) {
        return o.name || 'an obstacle';
      }
    } else {
      const k = Math.min(1, Math.max(0, (pz - o.z) / o.h));
      const rAt = (o.r ?? 1) + ((o.r1 ?? o.r ?? 1) - (o.r ?? 1)) * k;
      if ((o.n ?? 14) === 4) {
        // diamond test for square-section prisms (roofs)
        const c = Math.cos(-((o.rot ?? 0) * Math.PI) / 180);
        const s = Math.sin(-((o.rot ?? 0) * Math.PI) / 180);
        const lx = (px - o.x) * c - (py - o.y) * s;
        const ly = (px - o.x) * s + (py - o.y) * c;
        if (Math.abs(lx) + Math.abs(ly) < rAt + m) return o.name || (o.taper ? 'a roof' : 'an obstacle');
      } else if (Math.hypot(px - o.x, py - o.y) < rAt + m) {
        return o.name || (o.taper ? 'a tree' : 'an obstacle');
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* goals + gates                                                       */
/* ------------------------------------------------------------------ */

export interface GoalCallbacks {
  say(msg: string, dur?: number): void;
  chime(): void;
  ding(): void;
  onLap(lapTime: number): void;
  onRun(runTime: number): void;
}

/** Advance the range checkpoint state. Returns true when something fired. */
export function goalCheck(w: World, fl: FlightState, cb: GoalCallbacks): boolean {
  if (!w.goals.length) return false;
  const g = w.goals[fl.goal] || w.goals[0];
  const px = fl.pos[0];
  const py = fl.pos[1];
  const pz = fl.pos[2];
  let hit = false;
  if (g.heading != null) {
    const hd = (g.heading * Math.PI) / 180;
    const nx = Math.cos(hd);
    const ny = Math.sin(hd);
    const d = (px - g.x) * nx + (py - g.y) * ny;
    const lat = -(px - g.x) * ny + (py - g.y) * nx;
    if (fl.prevD < 0 && d >= 0 && Math.hypot(lat, pz - g.z) < g.r) hit = true;
    fl.prevD = d;
  } else {
    if (Math.hypot(px - g.x, py - g.y, pz - g.z) < g.r) hit = true;
  }
  if (!hit) return false;
  if (fl.runStart < 0) fl.runStart = fl.t;
  cb.chime();
  const last = fl.goal === w.goals.length - 1;
  if (last) {
    const runT = fl.t - fl.runStart;
    cb.say(`${w.title} done: ${runT.toFixed(1)} s`);
    cb.ding();
    cb.onRun(runT);
    fl.goal = 0;
    fl.runStart = fl.t;
  } else {
    fl.goal++;
    cb.say(`Checkpoint ${fl.goal}/${w.goals.length}${g.label ? ` — ${w.goals[fl.goal - 1].label}` : ''}`);
  }
  return true;
}

/** Race gate crossing check (heading-plane crossing inside the opening). */
export function gateCheck(w: World, fl: FlightState, gateW: number, gateH: number, cb: GoalCallbacks): boolean {
  if (!w.gates.length) return false;
  const g = w.gates[fl.gate % w.gates.length];
  const hd = (g.heading * Math.PI) / 180;
  const nx = Math.cos(hd);
  const ny = Math.sin(hd);
  const d = (fl.pos[0] - g.x) * nx + (fl.pos[1] - g.y) * ny;
  const lat = -(fl.pos[0] - g.x) * ny + (fl.pos[1] - g.y) * nx;
  const dz = fl.pos[2] - gateH / 2;
  const prevD = fl.prevD;
  fl.prevD = d;
  if (prevD < 0 && d >= 0 && Math.abs(lat) < gateW / 2 && Math.abs(dz) < gateH / 2) {
    if (fl.gate === 0) {
      // crossing the start/finish: a lap completes only after the full course
      if (fl.lapStart >= 0) {
        const lap = fl.t - fl.lapStart;
        cb.say(`Lap ${lap.toFixed(2)} s`);
        cb.ding();
        cb.onLap(lap);
      } else {
        cb.say('Lap started');
        cb.chime();
      }
      fl.lapStart = fl.t;
    } else {
      cb.chime();
    }
    fl.gate = (fl.gate + 1) % w.gates.length;
    return true;
  }
  return false;
}
