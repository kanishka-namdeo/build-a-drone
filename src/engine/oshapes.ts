/**
 * Drone Lab — oriented 3D shapes.
 *
 * Solids drawn through a `Frame` so a part's modelling code stays in its own
 * local coordinates (local +x = nose, +z = up). All of these render with the
 * interior tone and weighted silhouette ink conventions.
 */

import {
  Vec3,
  Tone,
  INK,
  project,
  path3,
  path2,
  fillPath,
  ink,
  poly3,
  loft,
  hullInk,
  toneIn,
  textMatrix,
  convexHull,
  clamp01
} from './core';
import { Frame, FR } from './frames';

/** Oriented box: 6 faces, back-faces culled. Returns `{ at, svg, pts }`. */
export function obox(
  f: Frame,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  t: Tone,
  w = 0.9
): { at: Vec3; svg: string; pts: Vec3[] } {
  const P = (x: number, y: number, z: number): Vec3 => FR.pt(f, [x, y, z]);
  const faces: Array<[Vec3[], Vec3]> = [
    [[P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)], [0, -1, 0]],
    [[P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], [0, 1, 0]],
    [[P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1)], [-1, 0, 0]],
    [[P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)], [1, 0, 0]],
    [[P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], [0, 0, 1]],
    [[P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0)], [0, 0, -1]]
  ];
  let svg = '';
  for (const [pts, n] of faces) {
    const wn = FR.dir(f, n as Vec3);
    if (wn[0] + wn[1] + wn[2] <= 1e-6) continue;
    svg += poly3(pts, toneIn(wn, t), w);
  }
  const all = [P(x0, y0, z0), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
  return { at: FR.pt(f, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]), svg, pts: all };
}

/**
 * Oriented cylinder along local z, centred at local (cx, cy); `r1` tapers the
 * top. Cap drawn on whichever end faces the viewer.
 */
export function ocyl(
  f: Frame,
  r: number,
  z0: number,
  z1: number,
  t: Tone,
  w = 1,
  n = 20,
  cx = 0,
  cy = 0,
  r1 = r
): { at: Vec3; svg: string; pts: Vec3[] } {
  const ring = (z: number, rad: number): Vec3[] => {
    const pts: Vec3[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push(FR.pt(f, [cx + rad * Math.cos(a), cy + rad * Math.sin(a), z]));
    }
    return pts;
  };
  const A = ring(z0, r);
  const B = ring(z1, r1);
  let svg = loft(A, B, (nn) => toneIn(nn, t));
  const capZ = z1;
  const capNrm = FR.dir(f, [0, 0, 1]);
  if (capNrm[0] + capNrm[1] + capNrm[2] > 1e-6) {
    svg += fillPath(path3(B), t.l) + ink(path3(B), w * 0.8);
  } else {
    svg += fillPath(path3(A), t.d) + ink(path3(A), w * 0.8);
  }
  void capZ;
  svg += hullInk([...A, ...B], w);
  return { at: FR.pt(f, [cx, cy, (z0 + z1) / 2]), svg, pts: [...A, ...B] };
}

/** Flat disc in the local xy plane. */
export function odisc(f: Frame, r: number, z: number, col: string, w = 0.6, n = 16, cx = 0, cy = 0): string {
  const pts: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(FR.pt(f, [cx + r * Math.cos(a), cy + r * Math.sin(a), z]));
  }
  return fillPath(path3(pts), col) + (w > 0 ? ink(path3(pts), w) : '');
}

/** Text on the local xy plane, reading along +x. */
export function otext(f: Frame, x: number, y: number, z: number, str: string, size: number, col = INK): string {
  const U = FR.dir(f, [1, 0, 0]);
  const V = FR.dir(f, [0, 1, 0]);
  return (
    `<text transform="${textMatrix(FR.pt(f, [x, y, z]), U, V)}" font-family="ui-monospace,Menlo,monospace" ` +
    `font-size="${size}" font-weight="800" fill="${col}" text-anchor="middle" letter-spacing="0.04em">${str.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`
  );
}

/* ------------------------------------------------------------------ */
/* wires                                                               */
/* ------------------------------------------------------------------ */

/** 0.75/0.25 corner-cutting smoothing (Chaikin-like); endpoints kept. */
export function smooth3(pts: Vec3[], it = 3): Vec3[] {
  let p = pts;
  for (let k = 0; k < it; k++) {
    const out: Vec3[] = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i];
      const b = p[i + 1];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, a[2] * 0.75 + b[2] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, a[2] * 0.25 + b[2] * 0.75]);
    }
    out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}

/**
 * A stroked 3D wire: dark outline, body stroke, offset highlight — reads as a
 * round cable at small sizes.
 */
export function tube(pts: Vec3[], r: number, t: Tone): string {
  const p = smooth3(pts);
  const d = path3(p, false);
  const dk = clamp01(r * 2 + 2.4 * 0); // outline extra
  return (
    ink(d, r * 2 + 2.4) +
    `<path d="${d}" fill="none" stroke="${t.m}" stroke-width="${r * 2}" stroke-linecap="round"/>` +
    `<path d="${d}" fill="none" stroke="${t.l}" stroke-width="${r * 0.55}" stroke-linecap="round" opacity="0.85" transform="translate(${(-0.35 * r).toFixed(2)} ${(-0.35 * r).toFixed(2)})"/>`
  );
  void dk;
}

/** Wire that arches up between two 3D points (jumpers). */
export function jumper(a: Vec3, b: Vec3, t: Tone, arc = 10, r = 0.55): string {
  const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 + arc];
  return tube([a, mid, b], r, t);
}

/* ------------------------------------------------------------------ */
/* glow dots (deferred radial gradients)                               */
/* ------------------------------------------------------------------ */

export interface GlowDot {
  p: Vec3;
  col: string;
  r: number;
}

const GLOWS: GlowDot[] = [];

/** Queue a glowing dot; call `drainGlows()` when the scene assembles. */
export function glowDot(p: Vec3, col: string, r = 5.5): string {
  GLOWS.push({ p, col, r });
  return '';
}

let glowN = 0;

/** Render + clear queued glow dots as radial-gradient circles. */
export function drainGlows(): string {
  let svg = '';
  let defs = '';
  for (const g of GLOWS) {
    const id = `glow${++glowN}`;
    const [x, y] = project(g.p);
    defs += `<radialGradient id="${id}"><stop offset="0" stop-color="${g.col}"/><stop offset="1" stop-color="${g.col}" stop-opacity="0"/></radialGradient>`;
    svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${g.r}" fill="url(#${id})"/>`;
  }
  GLOWS.length = 0;
  return defs ? `<defs>${defs}</defs>${svg}` : svg;
}

/* ------------------------------------------------------------------ */
/* small standard parts                                                */
/* ------------------------------------------------------------------ */

/** A small hobby servo (case + horn discs) in a frame. */
export function servoPiece(f: Frame, horn = true, label = ''): { at: Vec3; svg: string } {
  const DARKMAT: Tone = { l: '#55504a', m: '#3d3935', d: '#272421' };
  const METALMAT: Tone = { l: '#eef0f0', m: '#c6ccce', d: '#8f989b' };
  let svg = obox(f, -12, 12, -22.5, 22.5, -16, 16, DARKMAT).svg;
  if (horn) {
    svg += odisc(FR.up(f, 16.5), 9, 0, METALMAT.l, 0.7) + odisc(FR.up(f, 17.2), 2.2, 0, METALMAT.m, 0.5);
  }
  if (label) svg += otext(f, 0, -25, 0, label, 6);
  return { at: f.o, svg };
}

/** Screen-space pill silhouette helper (used by misc HUD-ish bits). */
export function screenHull(pts2: Array<[number, number]>, col: string, w = 1.2): string {
  const h = convexHull(pts2);
  if (h.length < 3) return '';
  return fillPath(path2(h), col) + ink(path2(h), w);
}
