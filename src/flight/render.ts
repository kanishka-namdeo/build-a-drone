/**
 * Drone Lab — flight renderers: third-person isometric world and the FPV
 * perspective view with OSD.
 *
 * The isometric world reuses the bench engine at 1000 px per metre. The FPV
 * view is a small perspective renderer: a camera at the craft, back-face
 * culled solids, painter-sorted, with a white monospace OSD on top.
 */

import {
  Vec2,
  Vec3,
  Tone,
  INK,
  project,
  setPan,
  path3,
  path2,
  fillPath,
  ink,
  poly3,
  matOf,
  mix,
  board3,
  castShadow,
  clipTo,
  clamp,
  vfxDefOnce,
  PALETTES
} from '../engine/core';
import {
  skyBand,
  hazeOverlay,
  vignette,
  scanlines,
  groundDetail,
  cloudShadows,
  cloudShape,
  isGrass,
  fogMix,
  aoDisc,
  downwash,
  treeLumps,
  polePennant,
  skyGrad,
  sunGrad,
  GroundKind
} from '../engine/vfx';
import { FR, rad } from '../engine/frames';
import { obox, ocyl, odisc, otext, drainGlows, propBlurDef } from '../engine/oshapes';
import type { World } from './world';
import type { FlightState, CraftRecord, DrawOpt, DrawAdd } from '../types';

const K = 1000; // px per metre
const GROUND_Z = 40; // ground board top surface (px)

export interface IsoCam {
  x: number;
  y: number;
  z: number;
}

/** Centre the view on the smoothed camera. Sets pan; call before projecting. */
export function isoCamPan(cam: IsoCam, vbW: number, vbH: number): void {
  const C = Math.cos(Math.PI / 6);
  const S = Math.sin(Math.PI / 6);
  setPan(vbW / 2 - (cam.x - cam.y) * K * C, vbH * 0.62 - (cam.x + cam.y) * K * S + cam.z * K);
}

/** The whole world in isometric: ground, decals, solids, shadows, goals. */
export function drawWorldIso(w: World, fl: FlightState, accent: string, opts?: { goalLabel?: boolean }): string {
  const F = w.field;
  const vbW = 8000;
  const vbH = vbW * 0.75;
  const cam: IsoCam = { x: fl.cam[0], y: fl.cam[1], z: fl.cam[2] };
  isoCamPan(cam, vbW, vbH);

  // atmosphere behind everything: distant hills, sun, drifting clouds, birds
  // (indoors: a warm wall band instead)
  let out = skyBand({ vbW, vbH, t: fl.t, indoor: w.indoor });

  const { svg: ground, top } = board3(0, 0, F * K, F * K, 40, 400, matOf(w.ground));

  // 1 m grid
  let grid = '';
  const step = Math.max(1, Math.round(F / 30));
  for (let x = step; x < F; x += step) grid += ink(path3([[x * K, 0, GROUND_Z + 0.1], [x * K, F * K, GROUND_Z + 0.1]]), 0.8);
  for (let y = step; y < F; y += step) grid += ink(path3([[0, y * K, GROUND_Z + 0.1], [F * K, y * K, GROUND_Z + 0.1]]), 0.8);

  // surface detail: mow stripes + tufts (grass), planks (wood), joints (stone)
  const kind: GroundKind = isGrass(w.ground) ? 'grass' : /e8dd|e0d5|d9c9|cdb39a/.test(w.ground) ? 'wood' : 'stone';
  const detail = groundDetail(kind, F, w.ground, GROUND_Z + 0.6, K);
  const cshadows = cloudShadows(F, fl.t, GROUND_Z + 0.8, K);

  // decals
  let decals = '';
  for (const d of w.decals) {
    if (d.t === 'flat') {
      const f = FR.Rz(FR.I(d.x * K, d.y * K, GROUND_Z + 1), rad(d.yaw ?? 0));
      decals += obox(f, -(d.w ?? 1) * K / 2, (d.w ?? 1) * K / 2, -(d.d ?? 1) * K / 2, (d.d ?? 1) * K / 2, 0, 1, matOf(d.col)).svg;
      if (d.label) decals += otext(f, 0, 0, 60, d.label, 120, INK);
    } else {
      const pts: Vec3[] = [];
      const n = 30;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push([d.x * K + (d.r ?? 1) * K * Math.cos(a), d.y * K + (d.r ?? 1) * K * Math.sin(a), GROUND_Z + 1]);
      }
      decals += fillPath(path3(pts), d.col) + ink(path3(pts), 0.8);
      if (d.label) decals += otext(FR.I(d.x * K, d.y * K, GROUND_Z + 2), 0, 0, 0, d.label, 150, INK);
    }
  }

  // solids + soft contact shading + cast shadows, distance-hazed
  let solids = '';
  let shadows = '';
  let contacts = '';
  for (const o of w.solids) {
    const dist = Math.hypot(o.x - cam.x, o.y - cam.y);
    const fog = clamp((dist - 9) / 55, 0, 0.5);
    const tone: Tone = fog > 0
      ? { l: fogMix(matOf(o.col).l, fog), m: fogMix(matOf(o.col).m, fog), d: fogMix(matOf(o.col).d, fog) }
      : matOf(o.col);
    if (o.t === 'box') {
      const f = FR.Rz(FR.I(o.x * K, o.y * K, GROUND_Z + (o.z ?? 0) * K), rad(o.yaw ?? 0));
      const b = obox(f, -(o.w ?? 1) * K / 2, (o.w ?? 1) * K / 2, -(o.d ?? 1) * K / 2, (o.d ?? 1) * K / 2, 0, (o.h ?? 1) * K, tone);
      solids += b.svg;
      shadows += castShadow(b.pts, GROUND_Z);
      contacts += aoDisc([o.x * K, o.y * K, GROUND_Z + 1.5], Math.max(o.w ?? 1, o.d ?? 1) * K * 0.72, 1 - fog);
    } else {
      const f = FR.I(o.x * K, o.y * K, GROUND_Z + (o.z ?? 0) * K);
      const c = ocyl(f, (o.r ?? 1) * K, 0, (o.h ?? 1) * K, tone, 1, Math.min(20, o.n ?? 14), 0, 0, (o.r1 ?? o.r ?? 1) * K);
      solids += c.svg;
      shadows += castShadow(c.pts, GROUND_Z);
      contacts += aoDisc([o.x * K, o.y * K, GROUND_Z + 1.5], (o.r ?? 1) * K * (o.taper ? 1.5 : 1.15), 1 - fog);
      // lumpy foliage on tree canopies (taper cones in green)
      if (o.taper && (o.r ?? 1) >= 0.45 && isGrass(o.col)) {
        solids += treeLumps(o.x * K, o.y * K, GROUND_Z + (o.z ?? 0) * K, (o.h ?? 1) * K, (o.r ?? 1) * K, (o.r1 ?? o.r ?? 1) * K, o.col, Math.round(o.x * 13 + o.y * 7));
      }
      // pennants on tall marker poles, so they read as course markers
      if (!o.taper && (o.r ?? 1) <= 0.17 && (o.h ?? 1) >= 3.5 && (o.z ?? 0) === 0) {
        solids += odisc(FR.I(o.x * K, o.y * K, GROUND_Z + 2), 0.26 * K, 0, mix(o.col, '#000000', 0.28), 1.4, 14);
        solids += polePennant(o.x, o.y, (o.h ?? 1), o.col, fl.t, K);
        contacts += aoDisc([o.x * K, o.y * K, GROUND_Z + 1.5], 0.4 * K, 1);
      }
    }
  }

  // downwash rings when hovering low
  const wash = fl.armed && !fl.crashed ? downwash(fl.pos[0], fl.pos[1], GROUND_Z + 0.6, fl.pos[2], fl.t, K) : '';

  // goals: rings or spheres; the next one gets the accent + a glow + a pulse
  let goals = '';
  w.goals.forEach((g, i) => {
    const next = i === (fl.goal % Math.max(1, w.goals.length));
    const col = next ? accent : 'rgba(35,30,22,0.35)';
    const pulse = next ? 1 + 0.1 * Math.sin(fl.t * 4.2) : 1;
    if (g.heading != null) {
      const hd = rad(g.heading);
      const pts: Vec3[] = [];
      const n = 33;
      for (let j = 0; j <= n; j++) {
        const a = (j / n) * Math.PI * 2;
        pts.push([g.x * K + Math.cos(hd) * g.r * K * Math.cos(a), g.y * K + Math.sin(hd) * g.r * K * Math.cos(a), GROUND_Z + g.z * K + g.r * K * Math.sin(a)]);
      }
      if (next) {
        goals += drainGlowRing([g.x * K, g.y * K, GROUND_Z + g.z * K], g.r * K * 1.35, accent);
      }
      goals += `<path d="${path3(pts, false)}" fill="none" stroke="${col}" stroke-width="${(next ? 26 : 14) * pulse}"/>`;
      if (next && opts?.goalLabel !== false && g.label) {
        goals += otext(FR.I(g.x * K, g.y * K, GROUND_Z + (g.z + g.r) * K), 0, 0, 200, g.label, 170, INK);
      }
    } else {
      const [sx, sy] = project([g.x * K, g.y * K, GROUND_Z + g.z * K]);
      goals += `<circle cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="${(g.r * K * 1.22 * pulse).toFixed(0)}" fill="${col}" opacity="0.35"/>`;
      if (next && g.label) {
        goals += `<text x="${sx.toFixed(0)}" y="${(sy - g.r * K * 1.4).toFixed(0)}" font-family="ui-monospace,Menlo,monospace" font-size="170" font-weight="800" fill="${INK}" text-anchor="middle">${g.label}</text>`;
      }
    }
  });

  return (
    out +
    ground +
    clipTo(top, shadows + contacts + grid + detail + cshadows + decals + wash) +
    hazeOverlay(vbW, vbH) +
    solids +
    goals
  );
}

/** Soft accent glow behind a goal ring (screen-space radial gradient). */
function drainGlowRing(p3: Vec3, r: number, col: string): string {
  const [x, y] = project(p3);
  const id = 'dlgg';
  const def = vfxDefOnce(
    id,
    `<defs><radialGradient id="${id}"><stop offset="0" stop-color="${col}" stop-opacity="0.3"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient></defs>`
  );
  return def + `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(0)}" fill="url(#${id})"/>`;
}

/** The craft in flight, drawn through its own draw() at flyScale. */
export function drawCraftFlight(
  craft: CraftRecord,
  fl: FlightState,
  m: Tone,
  design: CraftRecord['design'],
  plugged: boolean
): { svg: string; groundDot: string } {
  const flyScale = craft.flyScale ?? 4;
  const f = FR.S(
    FR.Rx(FR.Ry(FR.Rz(FR.I(fl.pos[0] * K, fl.pos[1] * K, GROUND_Z + fl.pos[2] * K), fl.yaw), fl.pitch), -fl.roll + fl.tumble),
    flyScale
  );
  const parts: Array<{ at: Vec3; svg: string }> = [];
  const add: DrawAdd = (at, svg) => parts.push({ at, svg });
  const opt: DrawOpt = {
    has: () => true,
    U: (id: string) => f,
    orient: () => 0,
    m,
    spin: fl.spin,
    rpm: fl.armed ? fl.spin.map(() => Math.max(0.2, fl.thrEff)) : fl.spin.map(() => 0),
    power: fl.armed,
    broken: fl.crashed,
    k: flyScale,
    design,
    plugged: true,
    fault: false,
    all: true,
    fl
  };
  void plugged;
  craft.draw(f, add, opt);
  // soft altitude-scaled cast shadow on the ground
  const alt = fl.pos[2];
  const hull = craft.hull(f);
  const shadow =
    castShadow(hull, GROUND_Z, null, { a: clamp(0.55 - alt * 0.03, 0.12, 0.55), grow: clamp(alt * 0.055, 0, 0.9) });
  const [gx, gy] = project([fl.pos[0] * K, fl.pos[1] * K, GROUND_Z]);
  const [dx, dy] = project([fl.pos[0] * K, fl.pos[1] * K, GROUND_Z + fl.pos[2] * K]);
  const groundDot =
    fl.pos[2] > 0.05
      ? `<line x1="${dx.toFixed(1)}" y1="${dy.toFixed(1)}" x2="${gx.toFixed(1)}" y2="${gy.toFixed(1)}" stroke="${INK}" stroke-width="2" stroke-dasharray="10 8" opacity="0.35"/><circle cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" r="10" fill="${INK}" opacity="0.45"/>`
      : '';
  return { svg: shadow + parts.sort((a, b) => (a.at[0] + a.at[1] + a.at[2]) - (b.at[0] + b.at[1] + b.at[2])).map((p) => p.svg).join(''), groundDot };
}

/** Off-screen goal pointer: a labelled pill + accent arrow at the screen edge. */
export function goalPointer(w: World, fl: FlightState, accent: string): string {
  const target = w.goals.length
    ? w.goals[fl.goal % w.goals.length]
    : w.gates.length
      ? w.gates[fl.gate % w.gates.length]
      : null;
  if (!target) return '';
  const [tx, ty] = project([(target as { x: number }).x * K, (target as { y: number }).y * K, GROUND_Z + 300]);
  const vbW = 8000;
  const vbH = vbW * 0.75;
  if (tx > 260 && tx < vbW - 260 && ty > 210 && ty < vbH - 210) return ''; // on screen
  const cx = vbW / 2;
  const cy = vbH / 2;
  const ang = Math.atan2(ty - cy, tx - cx);
  const rx = (vbW / 2 - 300) * Math.abs(Math.cos(ang));
  const ry = (vbH / 2 - 240) * Math.abs(Math.sin(ang));
  const t = Math.min(rx / Math.max(1e-6, Math.abs(Math.cos(ang))), ry / Math.max(1e-6, Math.abs(Math.sin(ang))));
  const px = cx + Math.cos(ang) * t;
  const py = cy + Math.sin(ang) * t;
  const dist = Math.hypot((target as { x: number }).x - fl.pos[0], (target as { y: number }).y - fl.pos[1], ((target as { z?: number }).z ?? 0.8) - fl.pos[2]);
  const label = w.goals.length ? 'GOAL' : `GATE ${(fl.gate % Math.max(1, w.gates.length)) + 1}`;
  // pill sits just inside the arrow, text stays horizontal
  const ix = px - Math.cos(ang) * 190;
  const iy = py - Math.sin(ang) * 150;
  const text = `${label} · ${Math.round(dist)}M`;
  const fs = 108;
  const pw = text.length * fs * 0.62 + fs * 1.6;
  const ph = fs * 1.9;
  const pill = `M${(ix - pw / 2).toFixed(0)} ${(iy - ph / 2).toFixed(0)}h${pw.toFixed(0)}a${(ph / 2).toFixed(0)} ${(ph / 2).toFixed(0)} 0 0 1 0 ${ph.toFixed(0)}h${(-pw).toFixed(0)}a${(ph / 2).toFixed(0)} ${(ph / 2).toFixed(0)} 0 0 1 0 ${(-ph).toFixed(0)}Z`;
  return (
    `<g transform="rotate(${((ang * 180) / Math.PI).toFixed(1)} ${px.toFixed(0)} ${py.toFixed(0)})">` +
    `<path d="M${px.toFixed(0)} ${py.toFixed(0)}l-52 -34v68Z" fill="${accent}" stroke="${INK}" stroke-width="5"/>` +
    `</g>` +
    `<path d="${pill}" fill="rgba(251,250,244,0.94)" stroke="${INK}" stroke-width="5"/>` +
    `<text x="${ix.toFixed(0)}" y="${(iy + fs * 0.36).toFixed(0)}" font-family="ui-monospace,Menlo,monospace" font-size="${fs}" font-weight="800" fill="${INK}" text-anchor="middle" letter-spacing="2">${text}</text>`
  );
}

/* ------------------------------------------------------------------ */
/* FPV                                                                 */
/* ------------------------------------------------------------------ */

export interface FpvBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const SUN: Vec3 = (() => {
  const v: Vec3 = [-0.45, -0.25, 0.86];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

interface Cam3 {
  pos: Vec3;
  /** rows of the rotation matrix; camera looks along local +x. */
  R: number[][];
}

function rotMat(yaw: number, pitch: number, roll: number, tilt: number): number[][] {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const mul = (A: number[][], B: number[][]): number[][] => {
    const o: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
    return o;
  };
  const Rz = [[cy, -sy, 0], [sy, cy, 0], [0, 0, 1]];
  const Ry = [[cp, 0, sp], [0, 1, 0], [-sp, 0, cp]];
  const Rx = [[1, 0, 0], [0, cr, -sr], [0, sr, cr]];
  const Rt = [[ct, 0, -st], [0, 1, 0], [st, 0, ct]];
  return mul(mul(mul(Rz, Ry), Rx), Rt);
}

function projectFpv(cam: Cam3, p: Vec3, B: FpvBox, f: number): Vec2 | null {
  const d: Vec3 = [p[0] - cam.pos[0], p[1] - cam.pos[1], p[2] - cam.pos[2]];
  const depth = cam.R[0][0] * d[0] + cam.R[0][1] * d[1] + cam.R[0][2] * d[2];
  if (depth < 0.06) return null;
  const right = cam.R[1][0] * d[0] + cam.R[1][1] * d[1] + cam.R[1][2] * d[2];
  const up = cam.R[2][0] * d[0] + cam.R[2][1] * d[1] + cam.R[2][2] * d[2];
  return [B.x + B.w / 2 - (f * right) / depth, B.y + B.h / 2 - (f * up) / depth];
}

/** Sutherland-Hodgman-ish clip of a polygon against the near plane. */
function clipNear(cam: Cam3, poly: Vec3[]): Vec3[] {
  const depth = (p: Vec3): number => {
    const d: Vec3 = [p[0] - cam.pos[0], p[1] - cam.pos[1], p[2] - cam.pos[2]];
    return cam.R[0][0] * d[0] + cam.R[0][1] * d[1] + cam.R[0][2] * d[2];
  };
  const out: Vec3[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = depth(a);
    const db = depth(b);
    if (da >= 0.06) out.push(a);
    if ((da >= 0.06) !== (db >= 0.06)) {
      const t = (0.06 - da) / (db - da);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  return out;
}

function polyFpv(cam: Cam3, poly: Vec3[], B: FpvBox, f: number, col: string, stroke = ''): string {
  const clipped = clipNear(cam, poly);
  if (clipped.length < 3) return '';
  const pts = clipped.map((p) => projectFpv(cam, p, B, f));
  if (pts.some((p) => !p)) return '';
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p![0].toFixed(1)} ${p![1].toFixed(1)}`).join('') + 'Z';
  return fillPath(d, col) + (stroke ? ink(d, 2) : '');
}

/** The FPV scene: perspective world through goggles + OSD. */
export function fpvScene(
  w: World,
  fl: FlightState,
  craft: CraftRecord,
  mode: string,
  B: FpvBox,
  phone: boolean
): string {
  const tilt = rad(w.camTilt ?? 25);
  const cam: Cam3 = { pos: [fl.pos[0], fl.pos[1], fl.pos[2] + 0.08], R: rotMat(fl.yaw, fl.pitch, -fl.roll + fl.tumble, -tilt) };
  const fov = rad(105);
  const f = B.w / 2 / Math.tan(fov / 2);
  const F = w.field;
  const indoor = !!w.indoor;
  const hazeCol = indoor ? '#e9e0ca' : '#dbe4e4';

  type Item = { d: number; svg: string };
  const items: Item[] = [];
  const push = (d: number, svg: string): void => {
    if (svg) items.push({ d, svg });
  };

  // gradient sky (or a warm ceiling indoors) + hazed far ground
  const far = Math.max(500, F * 4);
  push(far * 2, (indoor ? '' : skyGrad()) + polyFpv(cam, [[far, -far, indoor ? 60 : 300], [far, far, indoor ? 60 : 300], [far, far, -300], [far, -far, -300]], B, f, indoor ? '#e7e0cf' : 'url(#dlsky)'));
  push(far * 1.9, polyFpv(cam, [[far, -far, 0], [far, far, 0], [far, far, -300], [far, -far, -300]], B, f, fogMix(indoor ? '#e3dbc6' : '#e3e6d2', indoor ? 0.35 : 0.62)));

  // sun (screen position from the light direction) + glow — outdoors only
  if (!indoor) {
    const sp = projectFpv(cam, [cam.pos[0] + SUN[0] * 500, cam.pos[1] + SUN[1] * 500, cam.pos[2] + SUN[2] * 500], B, f);
    if (sp) {
      push(
        far * 2.05,
        sunGrad() +
          `<circle cx="${sp[0].toFixed(0)}" cy="${sp[1].toFixed(0)}" r="${(B.w * 0.2).toFixed(0)}" fill="url(#dlsun)"/>` +
          `<circle cx="${sp[0].toFixed(0)}" cy="${sp[1].toFixed(0)}" r="${(B.w * 0.024).toFixed(0)}" fill="#fff6d5" opacity="0.95"/>`
      );
    }
  }

  // hills on the horizon ring, two atmospheric layers — outdoors only
  if (!indoor) {
    for (let ring = 0; ring < 2; ring++) {
      const n = ring ? 22 : 28;
      const hgtK = ring ? 0.8 : 1.25;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.11;
        const hgt = (22 + 40 * Math.abs(Math.sin(i * 1.7 + ring))) * hgtK;
        const r = far * (ring ? 0.985 : 1);
        const x = cam.pos[0] + Math.cos(a) * r;
        const y = cam.pos[1] + Math.sin(a) * r;
        const col = ring ? fogMix('#b0c4bc', 0.34) : fogMix('#c2d2c8', 0.58);
        push(r * (ring ? 1.75 : 1.8), polyFpv(cam, [[x - r * 0.15, y - r * 0.15, 0], [x + r * 0.15, y + r * 0.15, 0], [x + r * 0.06, y + r * 0.06, hgt], [x - r * 0.06, y - r * 0.06, hgt]], B, f, col));
      }
    }
  }

  // drifting cumulus, world-anchored so they parallax properly — outdoors only
  if (!indoor) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const dist = 60 + (i % 3) * 45;
      const x = cam.pos[0] + Math.cos(a) * dist + fl.t * 0.6;
      const y = cam.pos[1] + Math.sin(a) * dist;
      const z = 24 + (i % 2) * 9;
      const p = projectFpv(cam, [x, y, z], B, f);
      if (p) {
        const s = (f * 6.5) / dist;
        if (s > 4) push(dist, cloudShape(p[0], p[1], s, 0.9));
      }
    }
  }

  // field polygon + gentle distance fade
  push(far, polyFpv(cam, [[0, 0, 0.01], [F, 0, 0.01], [F, F, 0.01], [0, F, 0.01]], B, f, w.ground));

  // horizon fog band (screen space, at the projected far-ground line)
  {
    const fwd: Vec3 = [Math.cos(fl.yaw), Math.sin(fl.yaw), 0];
    const hp = projectFpv(cam, [cam.pos[0] + fwd[0] * 400, cam.pos[1] + fwd[1] * 400, 0], B, f);
    if (hp) {
      const bh = B.h * 0.16;
      const fogDef = vfxDefOnce(
        'dlfog',
        `<defs><linearGradient id="dlfog" x1="0" y1="0" x2="0" y2="1">` +
          `<stop offset="0" stop-color="${hazeCol}" stop-opacity="0"/>` +
          `<stop offset="0.45" stop-color="${hazeCol}" stop-opacity="0.55"/>` +
          `<stop offset="1" stop-color="${hazeCol}" stop-opacity="0"/></linearGradient></defs>`
      );
      push(far * 1.95, fogDef + `<rect x="${B.x}" y="${(hp[1] - bh / 2).toFixed(0)}" width="${B.w}" height="${bh.toFixed(0)}" fill="url(#dlfog)"/>`);
    }
  }

  // field grid
  for (let x = 2; x < F; x += 2) {
    push(far * 0.9, polyFpv(cam, [[x, 0, 0.02], [x + 0.05, 0, 0.02], [x + 0.05, F, 0.02], [x, F, 0.02]], B, f, 'rgba(35,30,22,0.08)'));
  }
  for (let y = 2; y < F; y += 2) {
    push(far * 0.9, polyFpv(cam, [[0, y, 0.02], [F, y, 0.02], [F, y + 0.05, 0.02], [0, y + 0.05, 0.02]], B, f, 'rgba(35,30,22,0.08)'));
  }

  // decals (far to near)
  for (const d of [...w.decals].reverse()) {
    if (d.t === 'flat') {
      const hw = (d.w ?? 1) / 2;
      const hd = (d.d ?? 1) / 2;
      push(Math.hypot(d.x - cam.pos[0], d.y - cam.pos[1]), polyFpv(cam, [[d.x - hw, d.y - hd, 0.03], [d.x + hw, d.y - hd, 0.03], [d.x + hw, d.y + hd, 0.03], [d.x - hw, d.y + hd, 0.03]], B, f, d.col));
    } else {
      const pts: Vec3[] = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        pts.push([d.x + (d.r ?? 1) * Math.cos(a), d.y + (d.r ?? 1) * Math.sin(a), 0.03]);
      }
      push(Math.hypot(d.x - cam.pos[0], d.y - cam.pos[1]), polyFpv(cam, pts, B, f, d.col));
    }
  }

  // solids: boxes emit 6 faces (culled), cylinders emit loft quads + cap
  for (const o of w.solids) {
    const dist = Math.hypot(o.x - cam.pos[0], o.y - cam.pos[1]);
    const fog = clamp((dist - 12) / 70, 0, 0.5);
    const omat = matOf(o.col);
    const mat: Tone = fog > 0 ? { l: fogMix(omat.l, fog), m: fogMix(omat.m, fog), d: fogMix(omat.d, fog) } : omat;
    if (o.t === 'box') {
      const hw = (o.w ?? 1) / 2;
      const hd = (o.d ?? 1) / 2;
      const z0 = o.z ?? 0;
      const yaw = rad(o.yaw ?? 0);
      const c = Math.cos(yaw);
      const s = Math.sin(yaw);
      const corner = (sx: number, sy: number, sz: number): Vec3 => [o.x + sx * hw * c - sy * hd * s, o.y + sx * hw * s + sy * hd * c, z0 + sz];
      const faces: Array<[Vec3[], Vec3]> = [
        [[corner(-1, -1, 0), corner(1, -1, 0), corner(1, -1, o.h ?? 1), corner(-1, -1, o.h ?? 1)], [0, -1, 0]],
        [[corner(-1, 1, 0), corner(1, 1, 0), corner(1, 1, o.h ?? 1), corner(-1, 1, o.h ?? 1)], [0, 1, 0]],
        [[corner(-1, -1, 0), corner(-1, 1, 0), corner(-1, 1, o.h ?? 1), corner(-1, -1, o.h ?? 1)], [-1, 0, 0]],
        [[corner(1, -1, 0), corner(1, 1, 0), corner(1, 1, o.h ?? 1), corner(1, -1, o.h ?? 1)], [1, 0, 0]],
        [[corner(-1, -1, o.h ?? 1), corner(1, -1, o.h ?? 1), corner(1, 1, o.h ?? 1), corner(-1, 1, o.h ?? 1)], [0, 0, 1]]
      ];
      for (const [poly, n] of faces) {
        const ctr: Vec3 = [(poly[0][0] + poly[2][0]) / 2, (poly[0][1] + poly[2][1]) / 2, (poly[0][2] + poly[2][2]) / 2];
        const vd: Vec3 = [ctr[0] - cam.pos[0], ctr[1] - cam.pos[1], ctr[2] - cam.pos[2]];
        if (n[0] * vd[0] + n[1] * vd[1] + n[2] * vd[2] > 0) continue; // backface
        const dLight = n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2];
        const col = dLight > 0.55 ? mat.l : dLight > 0.05 ? mat.m : mat.d;
        push(dist, polyFpv(cam, poly, B, f, col));
      }
    } else {
      const n = Math.min(14, o.n ?? 14);
      const z0 = o.z ?? 0;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2 + (o.rot ?? 0);
        const a1 = ((i + 1) / n) * Math.PI * 2 + (o.rot ?? 0);
        const r0 = o.r ?? 1;
        const r1 = o.r1 ?? r0;
        const k = 1;
        const p00: Vec3 = [o.x + r0 * Math.cos(a0), o.y + r0 * Math.sin(a0), z0];
        const p01: Vec3 = [o.x + r0 * Math.cos(a1), o.y + r0 * Math.sin(a1), z0];
        const p10: Vec3 = [o.x + (r0 + (r1 - r0) * k) * Math.cos(a0), o.y + (r0 + (r1 - r0) * k) * Math.sin(a0), z0 + (o.h ?? 1)];
        const p11: Vec3 = [o.x + (r0 + (r1 - r0) * k) * Math.cos(a1), o.y + (r0 + (r1 - r0) * k) * Math.sin(a1), z0 + (o.h ?? 1)];
        const nx = Math.cos((a0 + a1) / 2);
        const ny = Math.sin((a0 + a1) / 2);
        const vd: Vec3 = [(p00[0] + p11[0]) / 2 - cam.pos[0], (p00[1] + p11[1]) / 2 - cam.pos[1], (p00[2] + p11[2]) / 2 - cam.pos[2]];
        if (nx * vd[0] + ny * vd[1] > 0) continue;
        const dLight = nx * SUN[0] + ny * SUN[1] + 0.2 * SUN[2];
        const col = dLight > 0.55 ? mat.l : dLight > 0.05 ? mat.m : mat.d;
        push(dist, polyFpv(cam, [p00, p01, p11, p10], B, f, col));
      }
      // top cap
      const cap: Vec3[] = [];
      const r1v = o.r1 ?? o.r ?? 1;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (o.rot ?? 0);
        cap.push([o.x + r1v * Math.cos(a), o.y + r1v * Math.sin(a), z0 + (o.h ?? 1)]);
      }
      push(dist, polyFpv(cam, cap, B, f, mat.l));
    }
  }

  // goal rings
  for (let gi = 0; gi < w.goals.length; gi++) {
    const g = w.goals[gi];
    const next = gi === (fl.goal % Math.max(1, w.goals.length));
    if (g.heading != null) {
      const hd = rad(g.heading);
      const pts: Vec3[] = [];
      for (let j = 0; j <= 28; j++) {
        const a = (j / 28) * Math.PI * 2;
        pts.push([g.x + Math.cos(hd) * g.r * Math.cos(a), g.y + Math.sin(hd) * g.r * Math.cos(a), g.z + g.r * Math.sin(a)]);
      }
      const clipped = clipNear(cam, pts);
      const scr = clipped.map((p) => projectFpv(cam, p, B, f));
      if (scr.some((p) => !p)) continue;
      const d = scr.map((p, i) => `${i ? 'L' : 'M'}${p![0].toFixed(1)} ${p![1].toFixed(1)}`).join('');
      const dist = Math.hypot(g.x - cam.pos[0], g.y - cam.pos[1]);
      const sw = Math.min(18, Math.max(1.5, 260 / Math.max(1, dist)));
      push(dist, `<path d="${d}" fill="none" stroke="${next ? '#ef6a4c' : 'rgba(255,255,255,0.65)'}" stroke-width="${sw.toFixed(1)}"/>`);
    } else {
      const dist = Math.hypot(g.x - cam.pos[0], g.y - cam.pos[1], g.z - cam.pos[2]);
      const p = projectFpv(cam, [g.x, g.y, g.z], B, f);
      if (p) {
        const rr = Math.max(4, (f * g.r) / Math.max(0.5, dist));
        push(dist, `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${rr.toFixed(1)}" fill="${next ? 'rgba(239,106,76,0.35)' : 'rgba(255,255,255,0.25)'}" stroke="${next ? '#ef6a4c' : 'rgba(255,255,255,0.6)'}" stroke-width="3"/>`);
      }
    }
  }

  items.sort((a, b) => b.d - a.d);
  let inner = items.map((i) => i.svg).join('');

  // props visible in the top corners: blur disc + streak arc
  if (craft.fpvProps && fl.armed && !fl.crashed) {
    const op = (0.3 + 0.45 * fl.thrEff).toFixed(2);
    const arc = (cx: number, cy: number, r: number): string => {
      const a0 = -2.4 + 0.2 * Math.sin(fl.t * 40);
      const pts: Vec2[] = [];
      for (let j = 0; j <= 10; j++) {
        const a = a0 + (j / 10) * 1.9;
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
    };
    for (const cx of [B.x + 120, B.x + B.w - 120]) {
      const cy = B.y + 96;
      inner +=
        propBlurDef() +
        `<circle cx="${cx}" cy="${cy}" r="118" fill="url(#dlpb)" opacity="${op}"/>` +
        `<path d="${arc(cx, cy, 104)}" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" opacity="${(0.25 + 0.3 * fl.thrEff).toFixed(2)}"/>`;
    }
  }

  // goggles frame
  const frame =
    `<rect x="${B.x}" y="${B.y}" width="${B.w}" height="${B.h}" rx="26" fill="none" stroke="${INK}" stroke-width="8"/>` +
    (phone ? '' : `<text x="${B.x - 18}" y="${B.y + 40}" font-family="ui-monospace,Menlo,monospace" font-size="26" font-weight="800" fill="${INK}" text-anchor="end" transform="rotate(-90 ${B.x - 18} ${B.y + 40})">FPV · 105° · 25° TILT</text>`);

  // lens character: vignette + scanlines over the feed only
  const lens = vignette(B.w, B.h, 0.72).replace('<rect x="0"', `<rect x="${B.x}"`) + scanlines(B.w, B.h, indoor ? 0 : 1).replace('<rect x="0"', `<rect x="${B.x}"`);

  return inner + frame + lens + osd(fl, B, mode, w);
}

/* ------------------------------------------------------------------ */
/* OSD                                                                 */
/* ------------------------------------------------------------------ */

function osdText(x: number, y: number, s: string, size = 30, col = '#fff'): string {
  return `<text x="${x}" y="${y}" font-family="ui-monospace,Menlo,monospace" font-size="${size}" font-weight="800" fill="${col}" stroke="rgba(20,18,14,0.85)" stroke-width="5" paint-order="stroke" text-anchor="middle" letter-spacing="1">${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
}

function osd(fl: FlightState, B: FpvBox, mode: string, w: World): string {
  const c = fl.c as { cells?: number };
  const cells = (c.cells as number) ?? 6;
  const vpc = fl.volt / cells;
  const vcol = vpc < 3.5 ? '#ff5a4d' : '#fff';
  const mm = Math.floor(fl.t / 60);
  const ss = Math.floor(fl.t % 60);
  const kmh = (Math.hypot(fl.vel[0], fl.vel[1], fl.vel[2]) * 3.6).toFixed(0);
  const cx = B.x + B.w / 2;
  const cy = B.y + B.h / 2;
  const blink = Math.sin(performance.now() / 125) > 0;

  let s = '';
  // artificial horizon: centre bar offset by pitch, rotated by roll
  const pitchOff = Math.max(-150, Math.min(150, (fl.pitch * 180) / Math.PI * 4));
  s += `<g transform="rotate(${((-fl.roll * 180) / Math.PI).toFixed(1)} ${cx} ${cy})">` +
    ink(`M${cx - 120} ${cy + pitchOff}L${cx - 30} ${cy + pitchOff}M${cx + 30} ${cy + pitchOff}L${cx + 120} ${cy + pitchOff}`, 3).replace(/stroke="#231e16"/, 'stroke="rgba(255,255,255,0.9)"') +
    `</g>`;
  s += osdText(cx, cy - 14, '+', 34);
  // voltage + amps
  s += osdText(B.x + 130, B.y + 54, `${fl.volt.toFixed(1)}V`, 30, vcol);
  s += osdText(B.x + 130, B.y + 92, `${vpc.toFixed(2)}V/C ${fl.used.toFixed(0)}mAh`, 22);
  // timer
  s += osdText(B.x + B.w - 130, B.y + 54, `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, 30);
  // altitude + speed
  s += osdText(B.x + 130, B.y + B.h - 46, `ALT ${fl.pos[2].toFixed(1)}M`, 26);
  s += osdText(B.x + B.w - 130, B.y + B.h - 46, `${kmh} KM/H`, 26);
  // status
  const status = fl.crashed ? 'CRASHED' : !fl.armed ? 'DISARMED' : mode.toUpperCase();
  const scol = fl.crashed ? '#ff5a4d' : fl.armed ? '#7dffa0' : '#ffd76e';
  s += osdText(cx, B.y + B.h - 46, status, 28, scol);
  // low battery flash
  if (fl.lowWarned && fl.armed && blink) s += osdText(cx, B.y + 110, 'LOW BATTERY', 34, '#ff5a4d');
  // nav arrow to next target
  const target = navTarget(fl, w);
  if (target) {
    const dx = target[0] - fl.pos[0];
    const dy = target[1] - fl.pos[1];
    const bearing = Math.atan2(dy, dx) - fl.yaw;
    const dist = Math.hypot(dx, dy, (target[2] ?? 0) - fl.pos[2]);
    const ax = cx + Math.cos(bearing) * -0 + Math.cos(bearing + Math.PI) * 0; // arrow at fixed radius
    void ax;
    const r = 150;
    const px = cx + Math.cos(bearing) * r;
    const py = cy - Math.sin(bearing) * r * 0.0 + Math.sin(bearing) * r;
    s += `<g transform="rotate(${(-bearing * 180) / Math.PI + 90} ${cx} ${cy})"><path d="M${cx} ${cy - r - 26}l-16 22h32Z" fill="#fff" stroke="rgba(20,18,14,0.85)" stroke-width="4"/></g>`;
    s += osdText(cx, cy - r - 44, `${Math.round(dist)}M`, 24);
    void px;
    void py;
  }
  // message
  if (fl.msg && fl.msgT > 0) s += osdText(cx, B.y + B.h - 96, fl.msg.slice(0, 46), 24, '#ffd76e');
  return s;
}

function navTarget(fl: FlightState, w: World): Vec3 | null {
  if (w.goals.length) {
    const g = w.goals[fl.goal % w.goals.length];
    return [g.x, g.y, g.z];
  }
  if (w.gates.length) {
    const g = w.gates[fl.gate % w.gates.length];
    return [g.x, g.y, 0.8];
  }
  return [w.pad[0], w.pad[1], 0];
}

void PALETTES;
void drainGlows;
void poly3;
