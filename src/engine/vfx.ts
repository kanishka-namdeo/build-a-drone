/**
 * Drone Lab — atmosphere + finishing effects.
 *
 * Everything here is cheap by design: flat fills, shared gradients referenced
 * from tiny per-scene `<defs>`, and strings that can be regenerated at 60 fps.
 * No SVG filters (those live only in the baked hand-ink pass), no per-face
 * gradient soup. Heavier detail (grass tufts, mow stripes) is generated once
 * per world and cached as a string.
 */

import {
  Vec2,
  Vec3,
  INK,
  mix,
  project,
  fillPath,
  ink,
  path3,
  path2,
  vfxDefOnce
} from './core';

/* ------------------------------------------------------------------ */
/* small utilities                                                     */
/* ------------------------------------------------------------------ */

/** Deterministic seeded RNG (mulberry32) so scenery never shimmers. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Aerial perspective: pull a colour toward the haze tone by `t` (0..1). */
export function fogMix(col: string, t: number): string {
  return mix(col, '#dbe4e4', Math.max(0, Math.min(1, t)));
}

/** Rough "is this a grass green?" test for ground-kind detection. */
export function isGrass(hex: string): boolean {
  const s = hex.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return g > r + 3 && g > b + 3;
}

/* ------------------------------------------------------------------ */
/* shared gradients                                                    */
/* ------------------------------------------------------------------ */

const f = (n: number): string => (Math.round(n * 10) / 10).toString();

function skyGrad(): string {
  return vfxDefOnce(
    'dlsky',
    '<defs><linearGradient id="dlsky" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#b7d2e4"/>' +
      '<stop offset="0.55" stop-color="#d8e7ea"/>' +
      '<stop offset="0.85" stop-color="#efe9d6"/>' +
      '<stop offset="1" stop-color="#f4eeda"/>' +
      '</linearGradient></defs>'
  );
}
export { skyGrad };

function sunGrad(): string {
  return vfxDefOnce(
    'dlsun',
    '<defs><radialGradient id="dlsun">' +
      '<stop offset="0" stop-color="#fff8dc" stop-opacity="0.95"/>' +
      '<stop offset="0.22" stop-color="#ffefb5" stop-opacity="0.55"/>' +
      '<stop offset="1" stop-color="#ffefb5" stop-opacity="0"/>' +
      '</radialGradient></defs>'
  );
}
export { sunGrad };

function aoGrad(): string {
  return vfxDefOnce(
    'dlao',
    '<defs><radialGradient id="dlao">' +
      '<stop offset="0" stop-color="#2c2418" stop-opacity="0.34"/>' +
      '<stop offset="0.55" stop-color="#2c2418" stop-opacity="0.15"/>' +
      '<stop offset="1" stop-color="#2c2418" stop-opacity="0"/>' +
      '</radialGradient></defs>'
  );
}

function vignGrad(): string {
  return vfxDefOnce(
    'dlvign',
    '<defs><radialGradient id="dlvign" cx="0.5" cy="0.46" r="0.78">' +
      '<stop offset="0.55" stop-color="#141008" stop-opacity="0"/>' +
      '<stop offset="1" stop-color="#141008" stop-opacity="0.34"/>' +
      '</radialGradient></defs>'
  );
}

function cloudShadowGrad(): string {
  return vfxDefOnce(
    'dlcs',
    '<defs><radialGradient id="dlcs">' +
      '<stop offset="0" stop-color="#2c3a52" stop-opacity="0.10"/>' +
      '<stop offset="1" stop-color="#2c3a52" stop-opacity="0"/>' +
      '</radialGradient></defs>'
  );
}

/* ------------------------------------------------------------------ */
/* sky furniture (screen space, shared by clouds/sun/birds)            */
/* ------------------------------------------------------------------ */

/** One puffy cumulus: a cluster of ellipses with a shaded underside. */
export function cloudShape(cx: number, cy: number, s: number, op = 0.92): string {
  const e = (dx: number, dy: number, rx: number, ry: number, fill: string, o: number): string =>
    `<ellipse cx="${f(cx + dx * s)}" cy="${f(cy + dy * s)}" rx="${f(rx * s)}" ry="${f(ry * s)}" fill="${fill}" opacity="${o}"/>`;
  return (
    e(0, 0.18, 1.5, 0.62, '#c6d3d8', 0.5) +
    e(-0.55, 0.05, 0.85, 0.55, '#f4f6f2', op) +
    e(0.1, -0.16, 1.05, 0.72, '#f8faf6', op) +
    e(0.85, 0.02, 0.8, 0.55, '#f2f5f0', op) +
    e(0.35, 0.22, 1.1, 0.5, '#eef2ec', op * 0.96) +
    `<path d="M${f(cx - 1.6 * s)} ${f(cy + 0.42 * s)}q${f(1.7 * s)} ${f(0.34 * s)} ${f(3.2 * s)} 0" fill="none" stroke="${INK}" stroke-width="${f(0.9 * s)}" stroke-linecap="round" opacity="0.16"/>`
  );
}

/** A tiny drifting bird: two hand-inked arcs. */
function bird(cx: number, cy: number, s: number): string {
  return (
    `<path d="M${f(cx - s)} ${f(cy)}q${f(s * 0.5)} ${f(-s * 0.55)} ${f(s)} 0q${f(s * 0.5)} ${f(-s * 0.55)} ${f(s)} 0" ` +
    `fill="none" stroke="${INK}" stroke-width="${f(s * 0.16)}" stroke-linecap="round" opacity="0.4"/>`
  );
}

export interface SkyBandOpts {
  /** viewBox width / height of the flight scene. */
  vbW: number;
  vbH: number;
  /** Flight time (s) — drives cloud + bird drift. */
  t: number;
  /** Fraction of the viewport height covered by haze at the top. */
  hazeH?: number;
  /** Indoor range: warm wall band instead of sky. */
  indoor?: boolean;
}

/**
 * The "beyond the field" band for the isometric flight view: distant hills
 * poking into the top edge, a haze gradient, drifting clouds and a sun glow —
 * or, indoors, a warm wall with faint wallpaper stripes. Drawn in screen
 * space before the ground so the world sits on top of it.
 */
export function skyBand(o: SkyBandOpts): string {
  const { vbW, vbH, t } = o;
  const hazeH = o.hazeH ?? 0.34;
  const hazeCol = o.indoor ? '#e9e0ca' : '#e9ede6';

  if (o.indoor) {
    // warm interior wall: gradient + faint wallpaper stripes + baseboard
    let w = vfxDefOnce(
      'dlwall',
      `<defs><linearGradient id="dlwall" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="#efe9da"/>` +
        `<stop offset="1" stop-color="#e3dbc6"/></linearGradient></defs>`
    );
    const bandH = vbH * hazeH;
    w += `<rect x="0" y="0" width="${f(vbW)}" height="${f(bandH)}" fill="url(#dlwall)"/>`;
    for (let y = bandH * 0.18; y < bandH * 0.9; y += bandH * 0.16) {
      w += `<rect x="0" y="${f(y)}" width="${f(vbW)}" height="${f(bandH * 0.05)}" fill="rgba(120,100,70,0.05)"/>`;
    }
    // two framed pictures on the wall, faint
    for (const [fx, fy, fw] of [[0.18, 0.4, 0.09], [0.78, 0.34, 0.12]] as const) {
      const pw = vbW * fw;
      const ph = pw * 0.75;
      const px = vbW * fx - pw / 2;
      const py = bandH * fy;
      w +=
        `<rect x="${f(px)}" y="${f(py)}" width="${f(pw)}" height="${f(ph)}" fill="#f2ecdd" stroke="rgba(35,30,22,0.35)" stroke-width="${f(vbW * 0.0012)}"/>` +
        `<rect x="${f(px + pw * 0.12)}" y="${f(py + ph * 0.14)}" width="${f(pw * 0.76)}" height="${f(ph * 0.72)}" fill="none" stroke="rgba(35,30,22,0.18)" stroke-width="${f(vbW * 0.0008)}"/>`;
    }
    w += vfxDefOnce(
      'dlhaze',
      `<defs><linearGradient id="dlhaze" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${hazeCol}" stop-opacity="0.7"/>` +
        `<stop offset="1" stop-color="${hazeCol}" stop-opacity="0"/></linearGradient></defs>`
    );
    return w;
  }

  let s = skyGrad();

  // hills silhouettes along the very top edge (two atmospheric layers)
  const rng = mulberry32(20260101);
  const hills = (baseY: number, amp: number, col: string, op: number, seed: number): string => {
    const r = mulberry32(seed);
    let d = `M0 ${f(baseY)}`;
    let x = 0;
    while (x < vbW) {
      const w = vbW * (0.09 + r() * 0.1);
      const h = amp * (0.35 + r() * 0.65);
      d += `q${f(w / 2)} ${f(-h)} ${f(w)} 0`;
      x += w;
    }
    d += `L${f(vbW)} 0L0 0Z`;
    return `<path d="${d}" fill="${col}" opacity="${op}"/>`;
  };
  s += hills(vbH * 0.052, vbH * 0.052, fogMix('#b9ccb8', 0.5), 0.85, 7);
  s += hills(vbH * 0.03, vbH * 0.04, fogMix('#a7bda6', 0.32), 0.9, 20260101 + Math.floor(rng() * 99));

  // sun glow, upper right
  s += sunGrad();
  const sunX = vbW * 0.8;
  const sunY = vbH * 0.085;
  s += `<circle cx="${f(sunX)}" cy="${f(sunY)}" r="${f(vbW * 0.085)}" fill="url(#dlsun)"/>`;
  s += `<circle cx="${f(sunX)}" cy="${f(sunY)}" r="${f(vbW * 0.011)}" fill="#fff6d5" opacity="0.9"/>`;

  // clouds drifting slowly left, wrapped
  const drift = (t * vbW * 0.004) % (vbW * 1.5);
  const specs: Array<[number, number, number]> = [
    [0.16, 0.075, 0.030],
    [0.46, 0.045, 0.022],
    [0.72, 0.10, 0.026],
    [1.02, 0.06, 0.034]
  ];
  for (const [fx, fy, fs] of specs) {
    const cx = ((fx * vbW * 1.5 - drift) % (vbW * 1.5) + vbW * 1.5) % (vbW * 1.5) - vbW * 0.25;
    s += cloudShape(cx, vbH * fy, vbW * fs, 0.9);
  }

  // a couple of birds high in the haze
  const bx = ((vbW * 0.3 + t * vbW * 0.008) % (vbW * 1.2)) - vbW * 0.1;
  s += bird(bx, vbH * 0.13, vbW * 0.008);
  s += bird(bx + vbW * 0.018, vbH * 0.145, vbW * 0.0065);

  // haze gradient laid over the far ground (drawn after ground in the caller)
  s += vfxDefOnce(
    'dlhaze',
    `<defs><linearGradient id="dlhaze" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${hazeCol}" stop-opacity="0.96"/>` +
      `<stop offset="0.45" stop-color="${hazeCol}" stop-opacity="0.55"/>` +
      `<stop offset="1" stop-color="${hazeCol}" stop-opacity="0"/>` +
      `</linearGradient></defs>`
  );

  return s;
}

/** The haze overlay rect itself (drawn after the ground, before solids). */
export function hazeOverlay(vbW: number, vbH: number, h?: number): string {
  const hh = (h ?? 0.34) * vbH;
  return `<rect x="0" y="0" width="${f(vbW)}" height="${f(hh)}" fill="url(#dlhaze)"/>`;
}

/** Vignette: darkened corners, keeps the eye centred. */
export function vignette(vbW: number, vbH: number, strength = 1): string {
  return (
    vignGrad() +
    `<rect x="0" y="0" width="${f(vbW)}" height="${f(vbH)}" fill="url(#dlvign)" opacity="${strength.toFixed(2)}" pointer-events="none"/>`
  );
}

/** CRT-ish scanlines for the FPV feed (very subtle). */
export function scanlines(vbW: number, vbH: number, strength = 1): string {
  const id = 'dlscan';
  const def = vfxDefOnce(
    id,
    `<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse">` +
      `<rect width="6" height="3" fill="#0a0d10" opacity="${(0.04 * strength).toFixed(3)}"/></pattern></defs>`
  );
  return def + `<rect x="0" y="0" width="${f(vbW)}" height="${f(vbH)}" fill="url(#${id})" pointer-events="none"/>`;
}

/* ------------------------------------------------------------------ */
/* ground detail (3D, cached per world)                                */
/* ------------------------------------------------------------------ */

export type GroundKind = 'grass' | 'wood' | 'stone';

const groundCache = new Map<string, string>();

/**
 * Mow stripes + grass tufts (or planks / paving joints), generated once per
 * world and cached. `z` is the board-top height in px, `K` px per metre.
 */
export function groundDetail(kind: GroundKind, field: number, ground: string, z: number, K: number): string {
  const key = `${kind}|${field}|${ground}|${z}|${K}`;
  const hit = groundCache.get(key);
  if (hit != null) return hit;

  let svg = '';
  if (kind === 'grass') {
    // mow stripes: alternating broad bands along y
    const light = mix(ground, '#ffffff', 0.04);
    const dark = mix(ground, '#41538f', 0.032);
    for (let i = 0; i < field; i += 7) {
      const c = (i / 7) % 2 ? light : dark;
      svg += fillPath(path3([[0, i * K, z], [field * K, i * K, z], [field * K, (i + 7) * K, z], [0, (i + 7) * K, z]]), c);
    }
    // tufts, leaning with the light
    const rng = mulberry32(4242);
    const n = Math.max(46, Math.min(130, Math.round(field * field * 0.12)));
    for (let i = 0; i < n; i++) {
      const x = rng() * field * K;
      const y = rng() * field * K;
      if (Math.hypot(x - field * K / 2, y - field * K / 2) < K * 0.9) continue; // keep the pad clean
      const h = K * (0.09 + rng() * 0.07);
      const lean = K * 0.03;
      const c = rng() > 0.5 ? mix(ground, '#3f7a3c', 0.5) : mix(ground, '#6da13e', 0.45);
      svg += `<path d="M${f(x)} ${f(y)}l${f(-lean * 0.4)} ${f(-h * 0.8)}" stroke="${c}" stroke-width="${f(K * 0.018)}" stroke-linecap="round" fill="none"/>`;
      svg += `<path d="M${f(x)} ${f(y)}l${f(lean)} ${f(-h)}" stroke="${c}" stroke-width="${f(K * 0.02)}" stroke-linecap="round" fill="none"/>`;
      svg += `<path d="M${f(x)} ${f(y)}l${f(lean * 2.2)} ${f(-h * 0.7)}" stroke="${mix(c, '#ffffff', 0.18)}" stroke-width="${f(K * 0.016)}" stroke-linecap="round" fill="none"/>`;
    }
    // a few flowers
    for (let i = 0; i < 9; i++) {
      const x = rng() * field * K;
      const y = rng() * field * K;
      const col = ['#f4b829', '#ef6a4c', '#f3a6bb'][i % 3];
      svg += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(K * 0.014)}" fill="${col}" opacity="0.85"/>`;
    }
  } else if (kind === 'wood') {
    // floorboards along x + knots
    const line = mix(ground, '#8a6a42', 0.4);
    for (let y = 0.55; y < field; y += 0.55) {
      svg += ink(path3([[0, y * K, z], [field * K, y * K, z]], false), K * 0.006).replace(/stroke="#231e16"/, `stroke="${line}"`);
    }
    const rng = mulberry32(99);
    for (let i = 0; i < 14; i++) {
      const x = rng() * field * K;
      const y = rng() * field * K;
      svg += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(K * 0.02)}" ry="${f(K * 0.012)}" fill="none" stroke="${mix(ground, '#8a6a42', 0.5)}" stroke-width="${f(K * 0.005)}" opacity="0.5"/>`;
    }
  } else {
    // paving joints + soft stains
    const line = mix(ground, '#9a958a', 0.5);
    for (let v = 2; v < field; v += 2) {
      svg += ink(path3([[v * K, 0, z], [v * K, field * K, z]], false), K * 0.005).replace(/stroke="#231e16"/, `stroke="${line}"`);
      svg += ink(path3([[0, v * K, z], [field * K, v * K, z]], false), K * 0.005).replace(/stroke="#231e16"/, `stroke="${line}"`);
    }
    const rng = mulberry32(55);
    for (let i = 0; i < 5; i++) {
      const x = rng() * field * K;
      const y = rng() * field * K;
      const r = K * (0.25 + rng() * 0.4);
      const pts: Vec2[] = [];
      for (let j = 0; j < 10; j++) {
        const a = (j / 10) * Math.PI * 2;
        pts.push([x + Math.cos(a) * r * (0.8 + rng() * 0.3), y + Math.sin(a) * r * 0.5]);
      }
      svg += fillPath(path2(pts), mix(ground, '#7a7468', 0.18));
    }
  }

  if (groundCache.size > 24) groundCache.clear();
  groundCache.set(key, svg);
  return svg;
}

/** Cloud shadows drifting across the ground (3D positions, world metres). */
export function cloudShadows(field: number, t: number, z: number, K: number): string {
  cloudShadowGrad();
  const rng = mulberry32(777);
  let svg = '';
  for (let i = 0; i < 3; i++) {
    const x0 = rng() * field * 1.4;
    const y0 = rng() * field;
    const r = (2.5 + rng() * 2.5) * K;
    const x = ((x0 + t * 0.55) % (field * 1.5)) * K;
    const y = y0 * K;
    svg += `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r)}" ry="${f(r * 0.55)}" fill="url(#dlcs)"/>`;
  }
  return svg;
}

/** Soft contact-shadow ellipse under a point (ground plane). */
export function aoDisc(p3: Vec3, r: number, op = 1): string {
  aoGrad();
  const pts: Vec2[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    pts.push(project([p3[0] + Math.cos(a) * r, p3[1] + Math.sin(a) * r, p3[2]]));
  }
  return `<g opacity="${op.toFixed(2)}">${fillPath(path2(pts), 'url(#dlao)')}</g>`;
}

/** Expanding downwash rings under a low hovering craft. */
export function downwash(x: number, y: number, z: number, alt: number, t: number, K: number): string {
  if (alt > 1.8) return '';
  const k = 1 - alt / 1.8;
  let svg = aoDisc([x * K, y * K, z], K * (0.35 + 0.3 * k), 0.5 + 0.5 * k);
  for (let i = 0; i < 2; i++) {
    const ph = (t * 1.6 + i * 0.5) % 1;
    const r = K * (0.3 + ph * 0.9);
    const op = (1 - ph) * 0.28 * k;
    const pts: Vec2[] = [];
    for (let j = 0; j < 16; j++) {
      const a = (j / 16) * Math.PI * 2;
      pts.push(project([x * K + Math.cos(a) * r, y * K + Math.sin(a) * r, z]));
    }
    svg += `<path d="${path2(pts)}" fill="none" stroke="#3d5030" stroke-width="${f(K * 0.02)}" opacity="${op.toFixed(2)}"/>`;
  }
  return svg;
}

/**
 * Lumpy foliage clumps over a taper-cone tree canopy, so trees read as trees
 * instead of geometric cones. `z0`/`h`/`r`/`r1` describe the cone (px units).
 */
export function treeLumps(x: number, y: number, z0: number, h: number, r: number, r1: number, col: string, seed: number): string {
  const rng = mulberry32(seed);
  let svg = '';
  const lump = (cx: number, cy: number, cz: number, lr: number, c: string): string => {
    const pts: Vec2[] = [];
    for (let j = 0; j < 11; j++) {
      const a = (j / 11) * Math.PI * 2;
      const rr = lr * (0.82 + rng() * 0.3);
      pts.push(project([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, cz]));
    }
    return fillPath(path2(pts), c) + `<path d="${path2(pts)}" fill="none" stroke="rgba(35,30,22,0.28)" stroke-width="1.1"/>`;
  };
  const lite = mix(col, '#ffffff', 0.14);
  const deep = mix(col, '#3d4a7a', 0.16);
  const n = 4;
  for (let k = 0; k < n; k++) {
    const zf = 0.28 + (k / (n - 1)) * 0.62 + rng() * 0.06;
    const rAt = r + (r1 - r) * zf;
    const lr = Math.max(rAt * 0.85, r * 0.3);
    const ang = rng() * Math.PI * 2;
    const ox = Math.cos(ang) * rAt * 0.35;
    const oy = Math.sin(ang) * rAt * 0.35;
    svg += lump(x + ox, y + oy, z0 + zf * h, lr, k % 2 ? lite : deep);
  }
  // sun-side highlight blob
  svg += lump(x + r * 0.3, y - r * 0.2, z0 + h * 0.55, r * 0.42, mix(col, '#fff6e2', 0.24));
  return svg;
}

/** A fluttering pennant on top of a pylon pole, so pylons read as markers. */
export function polePennant(x: number, y: number, zTop: number, col: string, t: number, K: number): string {
  const flutter = Math.sin(t * 3.1 + x * 0.7) * 0.22;
  const [tx, ty] = project([x * K, y * K, zTop]);
  const [bx, by] = project([x * K, y * K, zTop - 0.5]);
  const [ex, ey] = project([(x + 1.0) * K, y * K, zTop - 0.25 + flutter * 0.3]);
  return (
    `<circle cx="${tx.toFixed(0)}" cy="${ty.toFixed(0)}" r="${(K * 0.045).toFixed(0)}" fill="${mix(col, '#ffffff', 0.3)}" stroke="rgba(35,30,22,0.5)" stroke-width="1.5"/>` +
    `<path d="M${tx.toFixed(0)} ${ty.toFixed(0)}L${ex.toFixed(0)} ${ey.toFixed(0)}L${bx.toFixed(0)} ${by.toFixed(0)}Z" fill="${col}" stroke="rgba(35,30,22,0.5)" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M${tx.toFixed(0)} ${ty.toFixed(0)}L${((tx + ex) / 2).toFixed(0)} ${((ty + ey) / 2 + K * 0.02).toFixed(0)}L${bx.toFixed(0)} ${by.toFixed(0)}" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="1.2"/>`
  );
}
