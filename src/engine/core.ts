/**
 * Drone Lab — isometric drawing core.
 *
 * A tiny original engine that draws "hand-inked" isometric figures as SVG
 * strings. One fixed view (front-left-top) and one fixed light (from above,
 * behind the viewer's right shoulder): the front is lit, the left side is in
 * shade, and cast shadows fall toward the lower-left of the screen.
 *
 * Coordinates: x = toward the viewer's right (depth), y = toward the viewer's
 * left, z = up. Screen origin is the SVG origin (top-left, y down).
 * All drawing helpers return SVG markup strings; scenes are composed by
 * concatenating them and depth-sorting via `byDepth`.
 */

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

/** A three-tone material: light / mid / dark faces (+ optional specular cap). */
export interface Tone {
  l: string;
  m: string;
  d: string;
  /** Brightest band colour (sheen). Defaults to a warm-tinted `l`. */
  hl?: string;
}

/* ------------------------------------------------------------------ */
/* palettes + materials                                                */
/* ------------------------------------------------------------------ */

export const PALETTES: Record<string, Tone> = {
  mustard: { l: '#f4b829', m: '#d49c1f', d: '#4e4a18' },
  tomato: { l: '#ef6a4c', m: '#cf5038', d: '#4a2219' },
  mint: { l: '#93d3b0', m: '#71b693', d: '#1f4034' },
  cobalt: { l: '#76a0e2', m: '#5a82c6', d: '#1c2948' },
  blush: { l: '#f3a6bb', m: '#d8869c', d: '#4b2430' }
};

export const METAL: Tone = { l: '#eef0f0', m: '#c6ccce', d: '#8f989b' };
export const CLEAR: Tone = { l: '#e4f2f4', m: '#c4dfe4', d: '#97b9c0' };
export const CERAMIC: Tone = { l: '#fbfaf3', m: '#e3e0d2', d: '#bdb8a6' };
export const DARK: Tone = { l: '#55504a', m: '#3d3935', d: '#272421' };
export const BOARDMAT: Tone = { l: '#e6e1d4', m: '#cfc8b8', d: '#aaa293' };
export const WOOD: Tone = { l: '#d9a86c', m: '#bf8a4f', d: '#8e6236' };

export const INK = '#231e16';
export const SHADOW_COL = '#41538f';
export const PAPER = '#f2efe7';

/** Derive a three-tone material from a single base colour. */
export function matOf(hex: string): Tone {
  return { l: hex, m: mix(hex, '#000000', 0.16), d: mix(hex, '#000000', 0.42), hl: mix(hex, '#fffdf2', 0.42) };
}

/** Channel-wise linear blend of two hex colours. */
export function mix(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const ease = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
export const clamp01 = (v: number): number => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/* ------------------------------------------------------------------ */
/* projection                                                          */
/* ------------------------------------------------------------------ */

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

let panX = 0;
let panY = 0;

/** Screen-space pan applied by `project` (used to centre a scene in its frame). */
export function setPan(x: number, y: number): void {
  panX = x;
  panY = y;
}
export function getPan(): Vec2 {
  return [panX, panY];
}

/** Project a 3D point to screen. */
export function project(p: Vec3): Vec2 {
  return [(p[0] - p[1]) * COS30 + panX, (p[0] + p[1]) * SIN30 - p[2] + panY];
}

/** Project a direction (no pan). */
export function projectDir(v: Vec3): Vec2 {
  return [(v[0] - v[1]) * COS30, (v[0] + v[1]) * SIN30 - v[2]];
}

/** Distance toward the viewer: parts with smaller depth are drawn first. */
export function depthOf(p: Vec3): number {
  return p[0] + p[1] + p[2];
}

/** Depth-sorted join of `{ at, svg }` pieces (painter's algorithm). */
export function byDepth(parts: Array<{ at: Vec3; svg: string } | null | undefined | false>): string {
  return parts
    .filter(Boolean)
    .sort((a: any, b: any) => depthOf(a.at) - depthOf(b.at))
    .map((p: any) => p.svg)
    .join('');
}

/* ------------------------------------------------------------------ */
/* path helpers                                                        */
/* ------------------------------------------------------------------ */

const f = (n: number): string => (Math.round(n * 10) / 10).toString();

/** SVG path data through 3D points (projected). */
export function path3(pts: Vec3[], close = true): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${f(project(p)[0])} ${f(project(p)[1])}`).join('') + (close ? 'Z' : '');
}

/** SVG path data through 2D screen points. */
export function path2(pts: Vec2[], close = true): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join('') + (close ? 'Z' : '');
}

/** Ink stroke (fill none). */
export function ink(d: string, w = 1): string {
  return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Filled path (no stroke). */
export function fillPath(d: string, c: string, extra = ''): string {
  return `<path d="${d}" fill="${c}" ${extra}/>`;
}

/** Filled path + same-colour stroke (hides seams between loft strips). */
export function facePath(d: string, c: string): string {
  return `<path d="${d}" fill="${c}" stroke="${c}" stroke-width="${f(0.7)}" stroke-linejoin="round"/>`;
}

/** The workhorse: a filled + inked 3D polygon. */
export function poly3(pts: Vec3[], c: string, w = 0.9): string {
  return fillPath(path3(pts), c) + ink(path3(pts), w);
}

/** Open polyline through 3D points. */
export function line3(pts: Vec3[], w = 0.9): string {
  return ink(path3(pts, false), w);
}

/* ------------------------------------------------------------------ */
/* 2D generators in a plane (u, v with v up)                           */
/* ------------------------------------------------------------------ */

export type PlaneFn = (uv: Vec2) => Vec3;
/** Plane x = const (u = y, v = z) — the front-facing plane. */
export const planeX = (x: number): PlaneFn => ([u, v]) => [x, u, v];
/** Plane y = const (u = x, v = z) — the side plane. */
export const planeY = (y: number): PlaneFn => ([u, v]) => [u, y, v];
/** Plane z = const (u = x, v = y) — the horizontal plane. */
export const planeZ = (z: number): PlaneFn => ([u, v]) => [u, v, z];

/** Arc in a plane, angles in degrees. */
export function arcUV(cu: number, cv: number, r: number, a0: number, a1: number, n = 7): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    out.push([cu + r * Math.cos(a), cv + r * Math.sin(a)]);
  }
  return out;
}

/** Rounded rectangle outline in a plane (falls back to sharp corners). */
export function rrUV(u0: number, v0: number, u1: number, v1: number, r: number, n = 7): Vec2[] {
  if (r <= 0) return [
    [u0, v0], [u1, v0], [u1, v1], [u0, v1]
  ];
  const pts: Vec2[] = [];
  const corners: Array<[number, number, number, number]> = [
    [u1 - r, v1 - r, 0, 90],
    [u0 + r, v1 - r, 90, 180],
    [u0 + r, v0 + r, 180, 270],
    [u1 - r, v0 + r, 270, 360]
  ];
  for (const [cu, cv, a0, a1] of corners) pts.push(...arcUV(cu, cv, r, a0, a1, n));
  return pts;
}

/** Ellipse / circle in a plane. */
export function ellUV(cu: number, cv: number, ru: number, rv: number, n = 24): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([cu + ru * Math.cos(a), cv + rv * Math.sin(a)]);
  }
  return out;
}

/** Lift 2D plane points into 3D. */
export function on(plane: PlaneFn, pts: Vec2[]): Vec3[] {
  return pts.map((p) => plane(p));
}

/* ------------------------------------------------------------------ */
/* lights + shading                                                    */
/* ------------------------------------------------------------------ */

// Light from above, behind the viewer's right shoulder. The azimuth is chosen
// so cast shadows fall toward the lower-left of the screen.
const LIGHT_AZ = (105 * Math.PI) / 180;
/** Horizontal shadow direction (unit-ish, in model xy). */
export const SH_DIR: Vec2 = [0.85 * Math.cos(LIGHT_AZ), 0.85 * Math.sin(LIGHT_AZ)];
/** Full shading light direction (unit). */
export const LIGHT: Vec3 = norm3([-SH_DIR[0], -SH_DIR[1], 1]);
/** Fixed light for interiors / small props. */
export const LIGHT_IN: Vec3 = norm3([0.6, 0.2, 1]);

function norm3(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/*
 * Cel-shaded tone ramp: every material is expanded into BANDS colours —
 * shadows drift toward a cool indigo, highlights toward warm cream (the way
 * ink illustrations actually shade), with an optional specular cap band.
 * Ramps are memoised per material so repeated faces cost nothing.
 */
const BANDS = 8;
const rampCache = new Map<string, string[]>();

function rampOf(t: Tone): string[] {
  // Some craft code passes partial tones (e.g. only l + m); fill the gaps.
  const l = t.l ?? t.m ?? '#cccccc';
  const m = t.m ?? l;
  const d = t.d ?? mix(m, '#000000', 0.38);
  const key = `${l}|${m}|${d}|${t.hl ?? ''}`;
  let r = rampCache.get(key);
  if (r) return r;
  const dCool = mix(d, '#3d4a7a', 0.26); // cool shadow tint
  const lWarm = mix(l, '#fff6e2', 0.34); // warm highlight tint
  r = [];
  for (let i = 0; i < BANDS; i++) {
    const u = i / (BANDS - 1); // 0 = darkest band
    r.push(u < 0.5 ? mix(dCool, m, ease(u * 2)) : mix(m, lWarm, ease((u - 0.5) * 2)));
  }
  r[BANDS - 1] = t.hl ?? lWarm; // brightest band = sheen
  if (rampCache.size > 400) rampCache.clear();
  rampCache.set(key, r);
  return r;
}

function bandOf(d: number, lo: number, hi: number): number {
  const u = clamp01((d - lo) / (hi - lo));
  return Math.min(BANDS - 1, Math.round(u * (BANDS - 1)));
}

/** Exterior shading: sunlit look, front lit / left in shade. */
export function tone(n: Vec3, t: Tone): string {
  return rampOf(t)[bandOf(dot3(n, LIGHT), -0.8, 0.78)];
}

/** Interior shading for small props (harsher falloff). */
export function toneIn(n: Vec3, t: Tone): string {
  return rampOf(t)[bandOf(dot3(n, LIGHT_IN), -0.75, 0.85)];
}

/* ------------------------------------------------------------------ */
/* shared vfx defs (gradients etc., emitted once per render pass)      */
/* ------------------------------------------------------------------ */

const vfxEmitted = new Set<string>();

/** Start a new render pass: shared defs may be emitted again. */
export function vfxReset(): void {
  vfxEmitted.clear();
}

/** Return `markup` the first time `id` is requested in this pass, else ''. */
export function vfxDefOnce(id: string, markup: string): string {
  if (vfxEmitted.has(id)) return '';
  vfxEmitted.add(id);
  return markup;
}

/** Cast-shadow gradient (screen-space direction matches SH_DIR: lower-left). */
export function shadowGradDef(): string {
  return vfxDefOnce(
    'dlsh',
    '<defs><linearGradient id="dlsh" x1="0.8" y1="0.32" x2="0.1" y2="0.74">' +
      '<stop offset="0" stop-color="#41538f" stop-opacity="0.5"/>' +
      '<stop offset="0.55" stop-color="#41538f" stop-opacity="0.3"/>' +
      '<stop offset="1" stop-color="#41538f" stop-opacity="0.04"/>' +
      '</linearGradient></defs>'
  );
}

/* ------------------------------------------------------------------ */
/* solids                                                              */
/* ------------------------------------------------------------------ */

/**
 * Loft between two closed rings of 3D points (equal length). Faces pointing
 * away from the viewer are culled; `flip` inverts for seen-from-inside cases.
 */
export function loft(A: Vec3[], B: Vec3[], t: Tone | ((n: Vec3) => string), flip = false): string {
  let svg = '';
  const cA: Vec3 = [
    A.reduce((s, p) => s + p[0], 0) / A.length,
    A.reduce((s, p) => s + p[1], 0) / A.length,
    A.reduce((s, p) => s + p[2], 0) / A.length
  ];
  for (let i = 0; i < A.length; i++) {
    const a0 = A[i];
    const a1 = A[(i + 1) % A.length];
    const b0 = B[i];
    const b1 = B[(i + 1) % A.length];
    // normal of quad a0 -> a1 -> b1 -> b0
    const u: Vec3 = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]];
    const v: Vec3 = [b0[0] - a0[0], b0[1] - a0[1], b0[2] - a0[2]];
    let n = norm3([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
    const ctr: Vec3 = [(a0[0] + b1[0]) / 2, (a0[1] + b1[1]) / 2, (a0[2] + b1[2]) / 2];
    if ((n[0] * (ctr[0] - cA[0]) + n[1] * (ctr[1] - cA[1]) + n[2] * (ctr[2] - cA[2])) < 0) {
      n = [-n[0], -n[1], -n[2]];
    }
    if (flip) n = [-n[0], -n[1], -n[2]];
    if (n[0] + n[1] + n[2] <= 1e-6) continue; // facing away from viewer
    const col = typeof t === 'function' ? t(n) : tone(n, t);
    svg += facePath(path3([a0, a1, b1, b0]), col);
  }
  return svg;
}

/** 2D monotone-chain convex hull (screen coords). */
export function convexHull(pts: Vec2[]): Vec2[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Vec2[] = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper: Vec2[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/**
 * Weighted silhouette ink: thin rods stay thin, chunky bodies get thicker.
 * `w` is the base width; the weight grows with the hull's area/perimeter.
 */
export function hullInk(pts3: Vec3[], w = 1.4): string {
  const scr = pts3.map(project);
  const h = convexHull(scr);
  if (h.length < 3) return '';
  let area = 0;
  let per = 0;
  for (let i = 0; i < h.length; i++) {
    const a = h[i];
    const b = h[(i + 1) % h.length];
    area += a[0] * b[1] - b[0] * a[1];
    per += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const thick = Math.abs(area / 2) / (per || 1) / (inkScaleRef * 585);
  const width = Math.min(w, 0.9 + 20 * thick);
  return ink(path2(h), width);
}

/** Global ink-scale reference (viewBox width / 585) — set by the shell. */
let inkScaleRef = 1;
export function setInkScaleRef(k: number): void {
  inkScaleRef = k;
}
export function inkScale(): number {
  return inkScaleRef;
}

/** Rescale every stroke-width in an SVG string by `k` (constant on-screen weight). */
export function inkScaleSvg(svg: string, k: number): string {
  return svg.replace(/stroke-width="([^"]+)"/g, (_m, v) => `stroke-width="${(parseFloat(v) * k).toFixed(2)}"`);
}

/** Axis-aligned box: 5 visible faces (no bottom). */
export function box3(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, t: Tone, w = 0.9): string {
  let svg = '';
  const faces: Array<[Vec3[], Vec3]> = [
    [[ [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1] ], [0, 1, 0]], // +y front-left
    [[ [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1] ], [1, 0, 0]], // +x front-right
    [[ [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1] ], [0, -1, 0]], // -y back-left
    [[ [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1] ], [-1, 0, 0]], // -x back-right
    [[ [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1] ], [0, 0, 1]] // top
  ];
  for (const [pts, n] of faces) {
    if (n[0] + n[1] + n[2] <= 1e-6) continue;
    svg += poly3(pts, tone(n, t), w);
  }
  return svg;
}

/** Extrude a rounded profile (u=y, v=z) along x from x0 to x1. */
export function extrude(profile: Vec2[], x0: number, x1: number, t: Tone, shade: (n: Vec3, m: Tone) => string = tone): string {
  return loft(on(planeX(x0), profile), on(planeX(x1), profile), (n) => shade(n, t));
}

/** Vertical cylinder (z axis) with top cap. */
export function cyl3(x: number, y: number, z0: number, z1: number, r: number, t: Tone, w = 1.2, n = 24): string {
  const A = on(planeZ(z0), ellUV(0, 0, r, r, n)).map((p) => [x + p[0], y + p[1], p[2]] as Vec3);
  const B = on(planeZ(z1), ellUV(0, 0, r, r, n)).map((p) => [x + p[0], y + p[1], p[2]] as Vec3);
  let svg = loft(A, B, t);
  const cap = on(planeZ(z1), ellUV(0, 0, r, r, n)).map((p) => [x + p[0], y + p[1], p[2]] as Vec3);
  svg += fillPath(path3(cap), t.l) + ink(path3(cap), w * 0.8);
  svg += hullInk([...A, ...B], w);
  return svg;
}

/** Cylinder lying along x at height (y, z). */
export function cylX3(x0: number, x1: number, y: number, z: number, r: number, t: Tone, w = 1.1, n = 20): string {
  const ring = (x: number): Vec3[] => {
    const pts: Vec3[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([x, y + r * Math.cos(a), z + r * Math.sin(a)]);
    }
    return pts;
  };
  let svg = loft(ring(x0), ring(x1), t);
  const end = ring(x1);
  svg += fillPath(path3(end), t.l) + ink(path3(end), w * 0.8);
  svg += hullInk([...ring(x0), ...ring(x1)], w);
  return svg;
}

/** Cylinder between two arbitrary 3D points; `r1` tapers the far end. */
export function rod3(a: Vec3, b: Vec3, r: number, t: Tone, w = 1, r1 = r, n = 16): string {
  const d = norm3([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
  const ref: Vec3 = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  let u = norm3([d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]]);
  const v: Vec3 = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
  const ring = (c: Vec3, rad: number): Vec3[] => {
    const pts: Vec3[] = [];
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2;
      pts.push([
        c[0] + u[0] * Math.cos(ang) * rad + v[0] * Math.sin(ang) * rad,
        c[1] + u[1] * Math.cos(ang) * rad + v[1] * Math.sin(ang) * rad,
        c[2] + u[2] * Math.cos(ang) * rad + v[2] * Math.sin(ang) * rad
      ]);
    }
    return pts;
  };
  const A = ring(a, r);
  const B = ring(b, r1);
  let svg = loft(A, B, t);
  if (Math.max(r, r1) > 0) {
    // cap on the end facing the viewer
    const capRing = depthOf(b) < depthOf(a) ? A : B;
    svg += fillPath(path3(capRing), capRing === A ? t.l : t.m) + ink(path3(capRing), w * 0.7);
  }
  svg += hullInk([...A, ...B], w);
  return svg;
}

/* ------------------------------------------------------------------ */
/* text                                                                */
/* ------------------------------------------------------------------ */

/** SVG transform matrix from a projected origin + projected basis vectors. */
export function textMatrix(o: Vec3, U: Vec3, V: Vec3): string {
  const p = project(o);
  const pu = projectDir(U);
  const pv = projectDir(V);
  return `matrix(${f(pu[0])} ${f(pu[1])} ${f(pv[0])} ${f(pv[1])} ${f(p[0])} ${f(p[1])})`;
}

/** Text on the front plane (x = const), reads left-to-right on screen. */
export function textX(x: number, y: number, z: number, str: string, size: number, col = INK, weight = 700): string {
  return `<text transform="${textMatrix([x, y, z], [0, -1, 0], [0, 0, -1])}" font-family="ui-monospace,Menlo,monospace" font-size="${f(size)}" font-weight="${weight}" fill="${col}" text-anchor="middle" letter-spacing="0.04em">${esc(str)}</text>`;
}

/** Text on the side plane (y = const). */
export function textY(x: number, y: number, z: number, str: string, size: number, col = INK, weight = 700): string {
  return `<text transform="${textMatrix([x, y, z], [1, 0, 0], [0, 0, -1])}" font-family="ui-monospace,Menlo,monospace" font-size="${f(size)}" font-weight="${weight}" fill="${col}" text-anchor="middle" letter-spacing="0.04em">${esc(str)}</text>`;
}

/** Text on a horizontal plane (z = const), reading along +x or +y. */
export function textTop(x: number, y: number, z: number, str: string, size: number, col = INK, weight = 700, alongY = false): string {
  const U: Vec3 = alongY ? [0, 1, 0] : [1, 0, 0];
  const V: Vec3 = alongY ? [-1, 0, 0] : [0, 1, 0];
  return `<text transform="${textMatrix([x, y, z], U, V)}" font-family="ui-monospace,Menlo,monospace" font-size="${f(size)}" font-weight="${weight}" fill="${col}" text-anchor="middle" letter-spacing="0.04em">${esc(str)}</text>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ------------------------------------------------------------------ */
/* ground, shadows, boards                                             */
/* ------------------------------------------------------------------ */

const SHADOW_SHORTEN = 0.53; // cast shadows deliberately shortened

export interface ShadowOpts {
  /** Overall strength (default 1). */
  a?: number;
  /** Penumbra growth: hull is inflated about its centroid by this factor. */
  grow?: number;
}

/**
 * Cast shadow of `pts3` onto plane z = z0 (a 2D hull fill). The light is fixed
 * relative to the viewer, so shadows skew consistently to the lower-left. The
 * fill is a shared gradient — darkest at the object's base, fading to nothing
 * at the tip, so it reads as a soft shadow without any filters.
 */
export function castShadow(pts3: Vec3[], z0 = 0, clip: string | null = null, opts: ShadowOpts = {}): string {
  const a = opts.a ?? 1;
  const grow = opts.grow ?? 0;
  const scr: Vec2[] = pts3.map((p) => {
    const h = (p[2] - z0) * SHADOW_SHORTEN;
    return project([p[0] + SH_DIR[0] * h, p[1] + SH_DIR[1] * h, z0]);
  });
  let h = convexHull(scr);
  if (h.length < 3) return '';
  if (grow > 0) {
    let cx = 0;
    let cy = 0;
    for (const p of h) {
      cx += p[0];
      cy += p[1];
    }
    cx /= h.length;
    cy /= h.length;
    h = h.map((p) => [cx + (p[0] - cx) * (1 + grow), cy + (p[1] - cy) * (1 + grow)] as Vec2);
  }
  const d = path2(h);
  const g = clip ? `<g clip-path="url(#${clip})" opacity="${a.toFixed(3)}">` : `<g opacity="${a.toFixed(3)}">`;
  return shadowGradDef() + `${g}${fillPath(d, 'url(#dlsh)')}</g>`;
}

/** Flat disc on a horizontal plane (no ink). */
export function discFlat(x: number, y: number, z: number, r: number, col: string, n = 14): string {
  const pts: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([x + r * Math.cos(a), y + r * Math.sin(a), z]);
  }
  return fillPath(path3(pts), col);
}

/** Rounded cutting-mat style board slab. Returns [svg, topOutlinePts]. */
export function board3(x0: number, y0: number, x1: number, y1: number, h = 3, r = 5, t: Tone = BOARDMAT): { svg: string; top: Vec3[] } {
  const top = on(planeZ(h), rrUV(x0, y0, x1, y1, r)).map((p) => p as Vec3);
  const bot = on(planeZ(0), rrUV(x0, y0, x1, y1, r)).map((p) => p as Vec3);
  let svg = loft(bot, top, t);
  svg += fillPath(path3(top), t.l) + ink(path3(top), 1);
  // bevel: light rim on the two front top edges, shade on the back edges
  const eF: Vec3[] = [[x0, y1, h], [x1, y1, h]];
  const eR: Vec3[] = [[x1, y0, h], [x1, y1, h]];
  svg += `<path d="${path3(eF, false)}" fill="none" stroke="${mix(t.l, '#ffffff', 0.55)}" stroke-width="1.4" stroke-linecap="round" opacity="0.8"/>`;
  svg += `<path d="${path3(eR, false)}" fill="none" stroke="${mix(t.l, '#ffffff', 0.45)}" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>`;
  const eB: Vec3[] = [[x0, y0, h], [x1, y0, h]];
  const eL: Vec3[] = [[x0, y0, h], [x0, y1, h]];
  svg += `<path d="${path3(eB, false)}" fill="none" stroke="${mix(t.d, '#3d4a7a', 0.3)}" stroke-width="1.1" stroke-linecap="round" opacity="0.45"/>`;
  svg += `<path d="${path3(eL, false)}" fill="none" stroke="${mix(t.d, '#3d4a7a', 0.3)}" stroke-width="1.1" stroke-linecap="round" opacity="0.45"/>`;
  svg += hullInk([...top, ...bot], 1.8);
  return { svg, top };
}

/* ------------------------------------------------------------------ */
/* grouping, interaction, labels                                       */
/* ------------------------------------------------------------------ */

let clipN = 0;

/** Clickable group; dispatch goes through the shell's `acts` map. */
export function act(name: string, inner: string, data = ''): string {
  return `<g data-act="${name}"${data ? ` ${data}` : ''} role="button" tabindex="0">${inner}</g>`;
}

/** Clip a drawing to a 3D polygon outline. */
export function clipTo(pts3: Vec3[], inner: string): string {
  const id = `clip${++clipN}`;
  return `<defs><clipPath id="${id}"><path d="${path3(pts3)}"/></clipPath></defs><g clip-path="url(#${id})">${inner}</g>`;
}

/**
 * A callout pill anchored at a 3D point. `dx/dy` are screen offsets at the
 * reference zoom; `on` highlights the pill in the accent colour.
 */
export function tag(p3: Vec3, dx: number, dy: number, text: string, on = false): string {
  const k = inkScale();
  const [X, Y] = project(p3);
  const cx = X + dx * k;
  const cy = Y + dy * k;
  const fs = 8.6 * k;
  const w = text.length * fs * 0.62 + fs * 1.5;
  const h = fs * 1.8;
  const rx = h / 2;
  const pill = `M${f(cx - w / 2)} ${f(cy - h / 2)}h${f(w)}a${f(rx)} ${f(rx)} 0 0 1 0 ${f(h)}h${f(-w)}a${f(rx)} ${f(rx)} 0 0 1 0 ${f(-h)}Z`;
  const bg = on ? 'var(--accent)' : '#fff4d6';
  return (
    `<g class="dl-tag${on ? ' on' : ''}">` +
    ink(`M${f(X)} ${f(Y)}L${f(cx)} ${f(cy)}`, 1) +
    `<circle cx="${f(X)}" cy="${f(Y)}" r="${f(1.3 * k)}" fill="${INK}"/>` +
    fillPath(pill, bg) +
    ink(pill, 1.2) +
    `<text x="${f(cx)}" y="${f(cy + fs * 0.36)}" font-family="ui-monospace,Menlo,monospace" font-size="${f(fs)}" font-weight="800" fill="${INK}" text-anchor="middle" letter-spacing="0.04em">${esc(text)}</text>` +
    `</g>`
  );
}

/* ------------------------------------------------------------------ */
/* the hand-ink filter                                                 */
/* ------------------------------------------------------------------ */

/**
 * Build the hand-ink SVG filter: a wobble displacement + paper grain + soft
 * blotches, all multiplied together. `k` keeps frequencies constant on screen.
 */
export function handInkFilter(k: number): string {
  const kf = Math.max(0.05, k);
  return (
    `<filter id="handink" x="-5%" y="-5%" width="110%" height="110%" filterUnits="userSpaceOnUse">` +
    `<feTurbulence type="fractalNoise" baseFrequency="${(0.045 / kf).toFixed(5)}" numOctaves="2" seed="4" result="twarp"/>` +
    `<feDisplacementMap id="inkwob" in="SourceGraphic" in2="twarp" scale="${(2.4 * kf).toFixed(2)}" xChannelSelector="R" yChannelSelector="G" result="wob"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="${(0.9 / kf).toFixed(4)}" numOctaves="3" seed="11" result="tn1"/>` +
    `<feColorMatrix in="tn1" type="matrix" values="0 0 0 0 0.52 0 0 0 0 0.5 0 0 0 0 0.45 0 0 0 0.16 0" result="grain"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="${(0.012 / kf).toFixed(5)}" numOctaves="2" seed="7" result="tn2"/>` +
    `<feColorMatrix in="tn2" type="matrix" values="0 0 0 0 0.9 0 0 0 0 0.88 0 0 0 0 0.82 0 0 0 0.12 0" result="blot"/>` +
    `<feBlend in="wob" in2="grain" mode="multiply" result="g1"/>` +
    `<feBlend in="g1" in2="blot" mode="multiply" result="g2"/>` +
    `<feComposite in="g2" in2="wob" operator="in"/>` +
    `</filter>`
  );
}

/** Paper-grain background tile (data URI) for the page chrome. */
export function paperGrainDataUri(): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320">` +
    `<filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="3"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0.42 0 0 0 0 0.38 0 0 0 0 0.3 0 0 0 0.05 0"/></filter>` +
    `<rect width="320" height="320" filter="url(#g)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
