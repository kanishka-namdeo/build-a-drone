/**
 * Fig. 05 — the 5-inch racing quad (MultiGP-style).
 *
 * Stretched-X carbon frame (rear arms wider and further back, so the rear
 * props run in clean air), 2207 2500KV motors on 4S, ~420 g dry, 12-14:1
 * thrust-to-weight, actual rates near 670 deg/s, a 48-degree camera, a
 * pit-mode race VTX, LED strips on the rear arms — and an 8-gate track with
 * a timing arch, a dive tower and a hurdle. Race is the default flight mode.
 */

import { Vec3, Tone, INK, matOf, project, path3, ink, fillPath } from '../engine/core';
import { FR, rad } from '../engine/frames';
import type { Frame } from '../engine/frames';
import { obox, ocyl, odisc, otext, tube, glowDot } from '../engine/oshapes';
import { CARBON, PCB, SILK, WIRE, LEDBODY, TIN, GOLD } from '../engine/materials';
import { AudioSys } from '../engine/audio';
import { Progress } from '../engine/storage';
import type { StatItem } from '../engine/shell';
import type { CraftRecord, DrawOpt, DrawAdd, MotorPos } from '../types';

/* ------------------------------------------------------------------ */
/* geometry                                                            */
/* ------------------------------------------------------------------ */

/** Stretched-X: front arms swept back, rear arms wider + longer. */
const MPOS: MotorPos[] = [
  [-70, -62, 'M1', 'CW'],
  [70, -62, 'M2', 'CCW'],
  [-88, 88, 'M3', 'CCW'],
  [88, 88, 'M4', 'CW']
];

/** The 8 race gates, in the order the clock wants them crossed. */
const RACE_GATES: Array<[number, number, number]> = [
  [10, 18, 0], // G1 start/finish, eastbound under the timing arch
  [18, 10, -45], // G2 south-east sweeper
  [26, 12, 0], // G3 eastbound
  [30, 20, 90], // G4 northbound, then a hard left
  [28.5, 26, 180], // G5 westbound — then climb the dive tower
  [18, 28, 180], // G6 westbound after the dive
  [12, 28, -135], // G7 already banked into the final carousel
  [14, 22, -90] // G8 southbound, carousel back to the line
];
const GATE_W = 1.6;
const GATE_H = 1.6;

/** Battery pack drawing variants (length half-offsets, heights). */
const BATT_DRAW: Record<string, { long: number; h: number; col: string; lab: string }> = {
  '4s1300': { long: 30, h: 29, col: '#2b2a28', lab: '4S 1300' },
  '4s1500': { long: 31, h: 31, col: '#3a5f3a', lab: '4S 1500' },
  '6s1000': { long: 29, h: 33, col: '#2f5fa8', lab: '6S 1000' }
};

const STRAP: Tone = { l: '#ef6a4c', m: '#cf5038', d: '#4a2219' };
const PROP: Tone = { l: '#f4b829', m: '#d49c1f', d: '#4e4a18' };
const TIEMAT: Tone = { l: '#4a443c', m: '#35302a', d: '#211d19' };
const LEDMAT: Tone = { l: '#9fe8a4', m: '#78cf80', d: '#3f8a4c' };
const GLOWMAT: Tone = { l: '#8dff9c', m: '#5dff7e', d: '#2fae4e' };
const SILKT: Tone = { l: '#fbf8ee', m: '#e8e2d2', d: '#c0b9a6' };

export const race5: CraftRecord = {
  key: 'race5',
  fig: 5,
  name: 'Racing quad',
  sub: 'gates + rates',
  hint: 'design it, build it, then race the clock',
  noun: 'race quad',
  palette: 'mustard',
  log: 'betaflight',
  mat: 300,
  benchH: 110,
  flyScale: 4,
  flyVB: 9000,
  fpvProps: true,
  kThrust: 0.96,
  gPerW: 5.0,
  minTW: 9,
  maxKvCells: 12075,
  design: { batt: '4s1300', motor: '2207-2500', prop: '5x4.8x3' },

  batts: {
    '4s1300': { name: '4S 1300', cells: 4, mah: 1300, g: 152, price: 28, col: '#2b2a28', lab: '4S 1300' },
    '4s1500': { name: '4S 1500', cells: 4, mah: 1500, g: 178, price: 30, col: '#3a5f3a', lab: '4S 1500' },
    '6s1000': { name: '6S 1000', cells: 6, mah: 1000, g: 164, price: 36, col: '#2f5fa8', lab: '6S 1000' }
  },
  motors: {
    '2207-2500': { name: '2207 2500KV', kv: 2500, g: 31, price: 21, forCells: 4 },
    '2306-2700': { name: '2306 2700KV', kv: 2700, g: 30, price: 20, forCells: 4 },
    '2207-1950': { name: '2207 1950KV', kv: 1950, g: 32, price: 22, forCells: 6 }
  },
  props: {
    '5x4.8x3': { name: '5x4.8x3 race', pf: 1.05, eff: 0.95, g: 3.8, price: 4 },
    '5.1x3.6x3': { name: '5.1x3.6x3 smooth', pf: 0.95, eff: 1.05, g: 4.0, price: 4 },
    '5x5.2x3': { name: '5x5.2x3 top speed', pf: 1.12, eff: 0.88, g: 4.2, price: 4 }
  },
  fixed: [
    { id: 'FRAME', name: 'stretched-X carbon frame, 2 mm plates', g: 95, price: 45, cat: 'Mechanical' },
    { id: 'ESC', name: '45A 4-in-1 ESC', g: 7, price: 45, cat: 'Electrical' },
    { id: 'FC', name: 'F7 flight controller, 8 kHz', g: 6, price: 39, cat: 'Electrical' },
    { id: 'CAM', name: 'nano camera, steep mount', g: 5, price: 25, cat: 'Electrical' },
    { id: 'VTX', name: 'race VTX + SmartAudio', g: 5, price: 28, cat: 'Electrical' },
    { id: 'RX', name: 'ELRS receiver, 500 Hz', g: 2, price: 18, cat: 'Electrical' },
    { id: 'LEDS', name: 'LED strips, rear arms', g: 4, price: 8, cat: 'Electrical' },
    { id: 'XT60', name: 'XT60 pigtail + capacitor', g: 10, price: 4, cat: 'Electrical' },
    { id: 'TOP', name: '2 mm top plate + standoffs', g: 14, price: 6, cat: 'Mechanical' },
    { id: 'STRAP', name: 'battery strap + pad', g: 4, price: 4, cat: 'Mechanical' }
  ],

  parts: [
    {
      id: 'FRAME',
      name: 'Stretched-X carbon frame: 2 mm plates, 3 mm arms',
      short: 'FRAME',
      z: 0,
      what: 'The rear arms sit wider and further back than the front pair, so the rear props bite clean air instead of the front props\u2019 dirty wash. Carbon is stiff and light \u2014 and it conducts, so never let a bare battery lead touch an arm.'
    },
    {
      id: 'MOTORS',
      name: '4 brushless motors (2207 2500KV)',
      short: 'MOTORS',
      z: 1,
      after: ['FRAME'],
      what: '2207 stators, 2500KV: on 4S (14.8 V) that is about 37 000 rpm. KV \u00d7 volts is what makes thrust \u2014 the wrong pack turns a race motor into syrup or shrapnel.'
    },
    {
      id: 'ESC',
      name: '45A 4-in-1 ESC',
      short: 'ESC',
      z: 2,
      after: ['FRAME'],
      what: 'Four speed controllers on one board, switching DSHOT600. A race punchout spikes past 30 A per motor, which is exactly why the capacitor on the power lead exists.'
    },
    {
      id: 'WIRES',
      name: 'Motor wires soldered to the ESC',
      short: 'MOTOR WIRES',
      z: 2,
      after: ['MOTORS', 'ESC'],
      what: 'Three wires per motor, any order: direction is set in the ESC configurator (\u201cis motor reversed\u201d), never by re-soldering.'
    },
    {
      id: 'FC',
      name: 'F7 flight controller, 8 kHz',
      short: 'FLIGHT CTRL',
      z: 3,
      after: ['ESC'],
      polar: ['arrow forward', 'arrow backward'],
      what: 'The gyro loop runs 8000 times a second \u2014 at 130 km/h that is a correction every 4.5 mm of flight. The arrow must point at the nose, or it corrects the wrong way.'
    },
    {
      id: 'XT60',
      name: 'XT60 pigtail + low-ESR capacitor',
      short: 'XT60 + CAP',
      z: 2,
      after: ['ESC'],
      polar: ['stripe to minus', 'stripe to plus'],
      what: 'The power lead plus a capacitor that soaks up the voltage spikes four ESCs make while chopping 100 A. Polarised: the stripe goes to minus. Backwards, it vents \u2014 violently, on a race throttle curve.'
    },
    {
      id: 'CAM',
      name: 'nano FPV camera, 48\u00b0 tilt',
      short: 'CAM 48\u00b0',
      z: 2,
      after: ['FRAME'],
      what: 'A tiny camera on a steep mount. 48\u00b0 because at race speed you fly flat-out: the tilt keeps the gates in frame, not the ground. Too little tilt and you outrun your own picture.'
    },
    {
      id: 'RX',
      name: 'ELRS receiver, 500 Hz',
      short: 'RECEIVER',
      z: 4,
      after: ['FC'],
      what: 'ExpressLRS delivers a stick update every 2 ms. Through a hairpin at speed, latency is lap time. The whip is zip-tied down a rear arm so a gate clip cannot snap it off.'
    },
    {
      id: 'VTX',
      name: 'race VTX + SmartAudio',
      short: 'VTX',
      z: 4,
      after: ['FC'],
      what: 'Changes channels from the goggles via SmartAudio. Pit mode keys up at 25 mW so you never stomp another pilot\u2019s video before the start \u2014 full power only when you launch. Never power it without the antenna.'
    },
    {
      id: 'LEDS',
      name: 'LED strips on the rear arms',
      short: 'LED STRIPS',
      z: 4,
      after: ['FC'],
      what: 'Driven by the FC\u2019s LED_STRIP port. They glow as soon as the pack is plugged, so spotters and timing crews can tell six near-identical quads apart at speed.'
    },
    {
      id: 'TOP',
      name: '2 mm top plate + standoffs',
      short: 'TOP PLATE',
      z: 5,
      after: ['FC', 'CAM', 'RX', 'VTX', 'LEDS'],
      what: 'A thin plate on aluminium standoffs, and the battery straps on top of it. Two millimetres, because on a race quad even the plate has to earn its grams.'
    },
    {
      id: 'BATT',
      name: 'LiPo battery + strap',
      short: 'BATTERY',
      z: 6,
      after: ['TOP', 'XT60'],
      what: '4S 1300: one pack per heat. Land at 3.5 V per cell \u2014 race packs are consumables, buy more packs. Full is 4.2 V per cell.'
    },
    {
      id: 'PROPS',
      name: 'Propellers (5x4.8x3 race)',
      short: 'PROPS',
      z: 7,
      after: ['MOTORS', 'TOP'],
      polar: ['props in (correct)', 'swapped CW/CCW'],
      what: 'Two spin clockwise, two counter-clockwise so torque cancels. Props go on LAST \u2014 a motor test with props on throws the quad at your face.'
    }
  ],

  mpos: MPOS,
  wrongMotor: 2,

  /* ---------------------------------------------------------------- */
  /* drawing                                                          */
  /* ---------------------------------------------------------------- */

  draw(f: Frame, add: DrawAdd, opt: DrawOpt): void {
    const m = opt.m;
    const has = opt.has;
    const U = opt.U;
    const orient = opt.orient;

    /* ---- frame: squished-X plate + thin 3 mm arms ---- */
    if (has('FRAME')) {
      const F = U('FRAME');
      add([0, 0, 1], obox(F, -38, 42, -20, 20, 0, 2, CARBON, 0.9).svg, 'FRAME');
      for (const [mx, my] of [
        [-70, -62],
        [70, -62],
        [-88, 88],
        [88, 88]
      ]) {
        const len = Math.hypot(mx, my);
        const A = FR.Rz(F, rad((Math.atan2(my, mx) * 180) / Math.PI));
        add([mx * 0.6, my * 0.6, -1.5], obox(A, 20, len + 2, -6, 6, -3, 0, CARBON, 0.9).svg, 'FRAME');
      }
    }

    /* ---- motors ---- */
    if (has('MOTORS')) {
      const F = U('MOTORS');
      MPOS.forEach(([mx, my], i) => {
        const M = FR.T(F, mx, my, 0);
        let svg = ocyl(M, 12.5, 0, 4, CARBON, 1, 16).svg;
        svg += ocyl(M, 13.5, 4, 18, m, 1, 16).svg;
        const spin = opt.spin[i] || 0;
        for (let b = 0; b < 3; b++) {
          const a = spin * (i % 2 ? -1 : 1) + (b * Math.PI * 2) / 3;
          svg += odisc(M, 2.6, 18.4, INK, 0, 8, Math.cos(a) * 8, Math.sin(a) * 8);
        }
        svg += ocyl(M, 2.2, 18, 23, TIN, 0.7, 10).svg;
        add([mx, my, 10], svg, 'MOTORS');
      });
    }

    /* ---- motor wires ---- */
    if (has('WIRES')) {
      const F = U('WIRES');
      let svg = '';
      MPOS.forEach(([mx, my], i) => {
        const a: Vec3 = FR.pt(F, [mx * 0.87, my * 0.87, 2.5]);
        const b: Vec3 = FR.pt(F, [Math.sign(mx) * 16, Math.sign(my) * 16, 2.8]);
        const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 5.5];
        svg += tube([a, mid, b], 0.9, i % 2 ? WIRE.org : WIRE.blu);
      });
      add([0, 0, 4], svg, 'WIRES');
    }

    /* ---- ESC (thin board under the FC) ---- */
    if (has('ESC')) {
      const F = U('ESC');
      let svg = obox(F, -17, 17, -17, 17, 2, 3.4, PCB, 0.8).svg;
      for (const [cx, cy] of [
        [-15.5, -15.5],
        [15.5, -15.5],
        [-15.5, 15.5],
        [15.5, 15.5]
      ]) {
        svg += odisc(F, 1.6, 3.45, TIN.l, 0.4, 8, cx, cy);
      }
      add([0, 0, 3], svg, 'ESC');
    }

    /* ---- flight controller ---- */
    if (has('FC')) {
      const F = U('FC');
      let svg = obox(F, -15, 15, -15, 15, 3.4, 5.2, PCB, 0.8).svg;
      svg += obox(F, -5, 5, -5, 5, 5.2, 6.8, TIN, 0.6).svg;
      svg += obox(F, 7, 13, -11, -5, 5.2, 5.9, SILKT, 0.5).svg;
      const flip = orient('FC') ? -1 : 1;
      const pts: Vec3[] = [FR.pt(F, [14 * flip, 0, 5.4]), FR.pt(F, [6 * flip, 5, 5.4]), FR.pt(F, [6 * flip, -5, 5.4])];
      svg += fillPath(path3(pts), SILK) + ink(path3(pts), 0.7);
      if (opt.power) {
        svg += odisc(F, 2, 5.3, '#3e86d9', 0, 10, -11, 10);
        svg += glowDot(FR.pt(F, [-11, 10, 5.6]), '#3e86d9', 6);
      }
      add([0, 0, 5], svg, 'FC');
    }

    /* ---- XT60 + cap (rear, on the plate) ---- */
    if (has('XT60')) {
      const F = U('XT60');
      let svg = '';
      svg += tube([FR.pt(F, [-56, 4, 6]), FR.pt(F, [-44, 7, 4]), FR.pt(F, [-20, 7, 2.6])], 1.3, WIRE.red);
      svg += tube([FR.pt(F, [-56, -4, 6]), FR.pt(F, [-44, -7, 4]), FR.pt(F, [-20, -7, 2.6])], 1.3, WIRE.blk);
      svg += obox(F, -68, -56, -6, 6, 2, 10, GOLD, 0.9).svg;
      // capacitor lying across the frame behind the stack
      const capF = FR.Rx(F, rad(90));
      const capMat = opt.fault ? ({ l: '#7a6a5a', m: '#5d5145', d: '#3d352c' } as Tone) : LEDBODY;
      svg += ocyl(capF, 4, -8, 8, capMat, 1, 14, -27, 5.5).svg;
      const stripeOff = orient('XT60') ? 2.8 : -2.8;
      svg += ocyl(capF, 4, -8, 8, { l: '#e8e3d0', m: '#cfc9b6', d: '#a39d8a' }, 0.6, 14, -27 + stripeOff, 5.5).svg;
      add([-58, 0, 6], svg, 'XT60');
    }

    /* ---- camera, lens tilted 48 degrees ---- */
    if (has('CAM')) {
      const F = U('CAM');
      let svg = '';
      svg += obox(F, 33, 50, 11, 14.5, 0, 21, CARBON, 0.8).svg;
      svg += obox(F, 33, 50, -14.5, -11, 0, 21, CARBON, 0.8).svg;
      svg += obox(F, 35, 49, -9, 9, 2.5, 16.5, m, 0.9).svg;
      const G = FR.Ry(FR.T(F, 42, 0, 10), rad(42)); // local z points 48 deg above the nose
      svg += ocyl(G, 4.6, 0, 9, CARBON, 0.9, 14).svg;
      svg += odisc(G, 4, 9.2, '#1c1c1e', 0.5, 14);
      add([44, 0, 12], svg, 'CAM');
    }

    /* ---- ELRS receiver + whip zip-tied down the right rear arm ---- */
    if (has('RX')) {
      const F = U('RX');
      let svg = obox(F, -28, -18, -6, 6, 5.2, 6.4, PCB, 0.7).svg;
      const R4 = FR.Rz(F, rad(45));
      svg += tube(
        [
          FR.pt(F, [-23, 3, 6.6]),
          FR.pt(F, [-30, 14, 5]),
          FR.pt(R4, [40, -7, 2.2]),
          FR.pt(R4, [70, -7, 2.2]),
          FR.pt(R4, [95, -6, 2.6]),
          FR.pt(R4, [103, -4, 10])
        ],
        0.7,
        WIRE.wht
      );
      svg += obox(R4, 54, 58, -7, 7, 0, 2.6, TIEMAT, 0.7).svg;
      svg += obox(R4, 82, 86, -7, 7, 0, 2.6, TIEMAT, 0.7).svg;
      add([-6, 8, 6], svg, 'RX');
    }

    /* ---- race VTX + coax zip-tied down the left rear arm ---- */
    if (has('VTX')) {
      const F = U('VTX');
      let svg = obox(F, 22.5, 34.5, -7, 7, 12.2, 13.6, PCB, 0.8).svg;
      svg += obox(F, 25.5, 31.5, -4, 4, 13.6, 15.2, TIN, 0.6).svg;
      if (opt.power) {
        svg += odisc(F, 1.8, 13.7, '#e2483d', 0, 10, 32, -5);
        svg += glowDot(FR.pt(F, [32, -5, 14]), '#e2483d', 5);
      }
      const R3 = FR.Rz(F, rad(135));
      svg += tube(
        [
          FR.pt(F, [25, 5, 12]),
          FR.pt(F, [8, 21, 7]),
          FR.pt(F, [-16, 34, 4]),
          FR.pt(R3, [46, 7, 2.2]),
          FR.pt(R3, [72, 7, 2.2]),
          FR.pt(R3, [96, 6, 2.6]),
          FR.pt(R3, [104, 4, 11])
        ],
        0.9,
        WIRE.blk
      );
      svg += obox(R3, 54, 58, -7, 7, 0, 2.6, TIEMAT, 0.7).svg;
      svg += obox(R3, 82, 86, -7, 7, 0, 2.6, TIEMAT, 0.7).svg;
      add([28, 0, 13], svg, 'VTX');
    }

    /* ---- LED strips glowing along the rear arms ---- */
    if (has('LEDS')) {
      const F = U('LEDS');
      let svg = '';
      for (const [ang, side] of [
        [135, -1],
        [45, 1]
      ]) {
        const R = FR.Rz(F, rad(ang));
        const y0 = side < 0 ? -5.5 : 1.5;
        svg += obox(R, 30, 102, y0, y0 + 4, 0, 1.4, LEDMAT, 0.7).svg;
        if (opt.power) {
          svg += obox(R, 30, 102, y0, y0 + 4, 1.4, 2.4, GLOWMAT, 0.4).svg;
          for (let x = 42; x <= 96; x += 13) {
            svg += glowDot(FR.pt(R, [x, y0 + 2, 2.6]), '#5dff7e', 5);
          }
        }
      }
      add([0, 66, 1.5], svg, 'LEDS');
    }

    /* ---- 2 mm top plate + standoffs ---- */
    if (has('TOP')) {
      const F = U('TOP');
      let svg = '';
      for (const [sx, sy] of [
        [-30, -13],
        [30, -13],
        [-30, 13],
        [30, 13]
      ]) {
        svg += ocyl(F, 2.2, 2, 10, TIN, 0.8, 10, sx, sy).svg;
      }
      svg += obox(F, -36, 36, -18, 18, 10, 12, CARBON, 0.9).svg;
      add([0, 0, 11], svg, 'TOP');
    }

    /* ---- battery on the top plate ---- */
    if (has('BATT')) {
      const F = U('BATT');
      const b = BATT_DRAW[opt.design.batt] ?? BATT_DRAW['4s1300'];
      const top = 12 + b.h;
      let svg = obox(F, -(b.long + 10), b.long - 10, -16, 16, 12, top, matOf(b.col), 1).svg;
      svg += obox(F, -16, -8, -17, 17, top, top + 3, STRAP, 0.8).svg;
      svg += otext(F, 4, 0, top + 0.6, b.lab, 8, SILK);
      if (opt.plugged && has('XT60')) {
        svg += tube([FR.pt(F, [-(b.long + 9), 6, top - 6]), FR.pt(F, [-64, 8, 20]), FR.pt(F, [-62, 5, 11])], 1.3, WIRE.red);
        svg += tube([FR.pt(F, [-(b.long + 9), -6, top - 6]), FR.pt(F, [-64, -8, 20]), FR.pt(F, [-62, -5, 11])], 1.3, WIRE.blk);
      }
      add([-10, 0, 12 + b.h / 2], svg, 'BATT');
    }

    /* ---- props ---- */
    if (has('PROPS') && !opt.broken) {
      const F = U('PROPS');
      const swapped = orient('PROPS') === 1;
      MPOS.forEach(([mx, my, _id, dir], i) => {
        const ccw = (dir === 'CCW') !== swapped;
        const P = FR.T(F, mx, my, 23);
        const rate = opt.rpm[i] || 0;
        if (rate > 0.12) {
          const [dx, dy] = project([P.o[0], P.o[1], P.o[2]]);
          add(
            [mx, my, 25],
            `<ellipse cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" rx="${(63 * opt.k).toFixed(0)}" ry="${(63 * opt.k).toFixed(0)}" fill="#fff" opacity="${(0.14 + 0.18 * rate).toFixed(2)}"/>`,
            'PROPS'
          );
        } else {
          let svg = '';
          const spin = opt.spin[i] || 0;
          for (let bl = 0; bl < 3; bl++) {
            const a = spin * (ccw ? -1 : 1) + (bl * Math.PI * 2) / 3;
            const B = FR.Rz(FR.T(P, 0, 0, 0), a);
            const bladeF = FR.Rx(B, ccw ? rad(10) : rad(-10));
            svg += obox(bladeF, 6, 63, -4.2, 4.2, -0.7, 0.7, PROP, 0.7).svg;
          }
          svg += ocyl(P, 5.5, -1.5, 1.5, CARBON, 0.8, 10).svg;
          add([mx, my, 24], svg, 'PROPS');
        }
      });
    }
  },

  hull(f: Frame): Vec3[] {
    const pts: Vec3[] = [];
    for (const [mx, my] of [
      [-70, -62],
      [70, -62],
      [-88, 88],
      [88, 88]
    ]) {
      pts.push(FR.pt(f, [mx, my, -3]));
      pts.push(FR.pt(f, [mx, my, 19]));
    }
    pts.push(FR.pt(f, [-40, -16, 45]));
    pts.push(FR.pt(f, [-40, 16, 45]));
    pts.push(FR.pt(f, [20, -16, 45]));
    pts.push(FR.pt(f, [20, 16, 45]));
    pts.push(FR.pt(f, [52, 0, 21]));
    return pts;
  },

  tags: [
    ['FC', [6, 0, 7], 48, -44],
    ['LEDS', [-58, 58, 2], -46, 28],
    ['CAM', [48, 0, 19], 42, -28],
    ['VTX', [29, 0, 14], 46, -20],
    ['MOTORS', [70, -62, 16], 36, 22],
    ['BATT', [-10, 0, 44], -28, -46],
    ['XT60', [-62, 0, 8], -46, 24]
  ],

  /* ---------------------------------------------------------------- */
  /* wiring                                                           */
  /* ---------------------------------------------------------------- */

  wiring: {
    nodes(d, c) {
      return {
        BATT: [20, 238, 'BATTERY', (c.battName as string) || '4S 1300', '#e2483d'],
        XT60: [190, 238, 'XT60 + CAP', '1000 uF 35 V', '#e2483d'],
        ESC: [360, 238, '4-IN-1 ESC', '45 A x 4, DSHOT600', '#e2483d'],
        FC: [360, 70, 'FLIGHT CTRL', 'F7, 8 kHz, Betaflight', '#3e86d9'],
        RX: [140, 70, 'RECEIVER', 'ELRS 500 Hz', '#8c4bd1'],
        LEDS: [140, 152, 'LED STRIPS', 'rear arms, LED_STRIP', '#43a35a'],
        CAM: [600, 14, 'CAMERA', 'nano, 48 deg', '#43a35a'],
        VTX: [600, 116, 'VTX', 'race, 25 mW pit mode', '#8c4bd1'],
        MOTORS: [600, 238, 'MOTORS x4', (c.motorName as string) || '2207 2500KV', '#f08a2b']
      };
    },
    links: [
      { from: 'BATT', to: 'XT60', kind: 'power', label: 'XT60' },
      { from: 'XT60', to: 'ESC', kind: 'power', label: 'VBAT + GND' },
      { from: 'ESC', to: 'MOTORS', kind: 'motor', label: '3-phase x4' },
      { from: 'ESC', to: 'FC', kind: 'power', label: '5 V BEC' },
      { from: 'ESC', to: 'FC', kind: 'data', label: 'M1-M4' },
      { from: 'FC', to: 'RX', kind: 'data', label: 'ELRS 500 Hz' },
      { from: 'FC', to: 'VTX', kind: 'data', label: 'SmartAudio' },
      { from: 'FC', to: 'LEDS', kind: 'data', label: 'LED_STRIP' },
      { from: 'CAM', to: 'VTX', kind: 'video', label: 'analog video' }
    ]
  },

  /* ---------------------------------------------------------------- */
  /* content                                                          */
  /* ---------------------------------------------------------------- */

  overview: `<p>Racing is laps around gates against the clock. Everything on this page exists to get you through the next gate sooner: a stretched-X frame so the rear props run in clean air instead of the front props\u2019 dirty wash, thin 2 mm plates, and around 420 g carrying 12-14:1 thrust-to-weight \u2014 the 5-inch racing sweet spot.</p>
<p>Racing lives in acro mode with tuned rates: expo softens the centre of the stick while the max rate stays put \u2014 this setup\u2019s actual rates sit near 670\u00b0/s. The camera is tilted 48\u00b0 because at 130+ km/h you fly flat-out with the horizon in frame, and pit mode keys the video up at 25 mW so you never stomp another pilot\u2019s channel before the start.</p>
<p>A pack per heat: land at 3.5 V per cell \u2014 race packs are consumables, buy more packs. The LED strips glow on the rear arms so spotters can tell the quads apart at speed.</p>`,

  buildCode: `# race setup, in the Betaflight CLI:
set motor_pwm_protocol = DSHOT600
# actual rates ~670 deg/s:
set roll_rc_rate = 1.00
set roll_srate = 0.82
set roll_expo = 0.24
set pitch_rc_rate = 1.00
set pitch_srate = 0.82
set vcd_soft_led = ON
# pit mode on a switch:
aux 5 VTX_PIT_MODE
save`,

  quiz: [
    {
      q: 'Why the stretched-X frame?',
      a: ['It looks faster', 'Rear props sit out of the front props\u2019 dirty air', 'Fewer parts'],
      ok: 1
    },
    {
      q: 'Pit mode is for...',
      a: ['Saving battery', 'Not stomping another pilot\u2019s video channel before the start', 'Cooler motors'],
      ok: 1
    },
    {
      q: 'Higher expo means...',
      a: ['Softer centre stick, same max rate', 'More max rate', 'Longer range'],
      ok: 0
    },
    {
      q: 'You land a race pack at...',
      a: ['2.8 V/cell, every electron counts', '3.5 V/cell \u2014 a pack per heat, buy more packs'],
      ok: 1
    }
  ],

  practice:
    'Race five laps. Then bump camera tilt in your head: hold 48\u00b0 through the long straight and count how much earlier you must start braking.',

  /* ---------------------------------------------------------------- */
  /* flight: race is the default mode                                 */
  /* ---------------------------------------------------------------- */

  mode: 'race',
  modes: {
    race: {
      title: 'Race \u2014 8 gates',
      code: `# race mode \u2014 the clock is the game
set osd_timer_1 = ON
set osd_timer_1_src = TOTAL_ARMED
set osd_stat_tim_1 = ON
set osd_stat_max_spd = ON
save`,
      hint: '8 gates in order \u2014 over the tower, under the hurdle; the clock starts at gate 1'
    },
    acro: {
      title: 'Acro (rate) mode',
      code: `# acro \u2014 the racing mode, ~670 deg/s
set roll_rc_rate = 1.00
set roll_srate = 0.82
set roll_expo = 0.24
set pitch_rc_rate = 1.00
set pitch_srate = 0.82
set pitch_expo = 0.24
save`,
      hint: 'Racing lives in acro: flip and roll mid-lap'
    }
  },

  range: {
    title: 'MultiGP race track',
    brief: 'Cross the start/finish eastbound, then 8 gates in order: around, over the dive tower, under the hurdle, back to the line.',
    field: 36,
    pad: [4, 18],
    ground: '#cdd6c4',
    camTilt: 48,
    keepGates: false,
    prims: [
      // ---- start grid + timing arch at the start/finish ----
      { t: 'flat', x: 4, y: 18, w: 3, d: 8, col: '#c9c4b4', label: 'START' },
      { t: 'flat', x: 10, y: 18, w: 0.6, d: 8, col: '#e8e3d0', ink: true, label: 'FINISH' },
      { t: 'pole', x: 10, y: 14.3, h: 4, r: 0.09, col: '#8a8f93' },
      { t: 'pole', x: 10, y: 21.7, h: 4, r: 0.09, col: '#8a8f93' },
      { t: 'box', x: 10, y: 18, z: 4, w: 0.45, d: 7.9, h: 0.28, col: '#b7b0a0' },
      { t: 'box', x: 10, y: 18, z: 3.1, w: 0.16, d: 2.6, h: 0.95, col: '#d49c1f' },
      { t: 'flat', x: 12.6, y: 18, w: 2, d: 6, col: '#c9c4b4', label: 'MULTIGP' },
      // ---- the 8 gates, in racing order ----
      { t: 'gate', x: 10, y: 18, heading: 0 },
      { t: 'gate', x: 18, y: 10, heading: -45 },
      { t: 'gate', x: 26, y: 12, heading: 0 },
      { t: 'gate', x: 30, y: 20, heading: 90 },
      { t: 'gate', x: 28.5, y: 26, heading: 180 },
      { t: 'gate', x: 18, y: 28, heading: 180 },
      { t: 'gate', x: 12, y: 28, heading: -135 },
      { t: 'gate', x: 14, y: 22, heading: -90 },
      // ---- dive tower: scaffold, platform, gate on top (gate prims have no z, so posts + bar by hand) ----
      { t: 'pole', x: 22.5, y: 24.5, h: 7, r: 0.09, col: '#8a8f93' },
      { t: 'pole', x: 25.5, y: 24.5, h: 7, r: 0.09, col: '#8a8f93' },
      { t: 'pole', x: 22.5, y: 27.5, h: 7, r: 0.09, col: '#8a8f93' },
      { t: 'pole', x: 25.5, y: 27.5, h: 7, r: 0.09, col: '#8a8f93' },
      { t: 'box', x: 24, y: 26, z: 7, w: 3, d: 3, h: 0.3, col: '#b7b0a0' },
      { t: 'cyl', x: 24, y: 25.2, z: 7.3, r: 0.07, h: 1.6, col: '#ece6d6' },
      { t: 'cyl', x: 24, y: 26.8, z: 7.3, r: 0.07, h: 1.6, col: '#ece6d6' },
      { t: 'box', x: 24, y: 26, z: 8.9, w: 1.74, d: 0.07, h: 0.07, yaw: 270, col: '#ece6d6' },
      // ---- hurdle on the back straight: fly UNDER ----
      { t: 'pole', x: 16, y: 26.2, h: 1.2, r: 0.06, col: '#8a8f93' },
      { t: 'pole', x: 16, y: 28.6, h: 1.2, r: 0.06, col: '#8a8f93' },
      { t: 'box', x: 16, y: 27.4, z: 1.2, w: 0.12, d: 2.4, h: 0.12, col: '#ece6d6' },
      // ---- pit tents ----
      { t: 'box', x: 6, y: 9, w: 3, d: 2.6, h: 2.2, col: '#d49c1f' },
      { t: 'box', x: 10, y: 7, w: 3, d: 2.6, h: 2.2, col: '#76a0e2' },
      // ---- corner flags ----
      { t: 'pole', x: 8.5, y: 13.2, h: 2.6, r: 0.05, col: '#8a8f93' },
      { t: 'box', x: 8.5, y: 13.2, z: 2.6, w: 0.34, d: 0.34, h: 0.34, col: '#e2483d' },
      { t: 'pole', x: 21.5, y: 7.2, h: 2.6, r: 0.05, col: '#8a8f93' },
      { t: 'box', x: 21.5, y: 7.2, z: 2.6, w: 0.34, d: 0.34, h: 0.34, col: '#d49c1f' },
      { t: 'pole', x: 33.2, y: 14.5, h: 2.6, r: 0.05, col: '#8a8f93' },
      { t: 'box', x: 33.2, y: 14.5, z: 2.6, w: 0.34, d: 0.34, h: 0.34, col: '#76a0e2' },
      { t: 'pole', x: 20.5, y: 33.2, h: 2.6, r: 0.05, col: '#8a8f93' },
      { t: 'box', x: 20.5, y: 33.2, z: 2.6, w: 0.34, d: 0.34, h: 0.34, col: '#43b05c' },
      { t: 'pole', x: 8, y: 31.8, h: 2.6, r: 0.05, col: '#8a8f93' },
      { t: 'box', x: 8, y: 31.8, z: 2.6, w: 0.34, d: 0.34, h: 0.34, col: '#e2483d' },
      // ---- trees outside the track ----
      { t: 'tree', x: 2, y: 5, h: 6 },
      { t: 'tree', x: 33, y: 4, h: 7 },
      { t: 'tree', x: 34, y: 33, h: 6 },
      { t: 'tree', x: 22, y: 34, h: 5.5 },
      { t: 'tree', x: 2, y: 31, h: 6.5 },
      { t: 'tree', x: 34, y: 15, h: 5 }
    ]
  },

  /* ---------------------------------------------------------------- */
  /* race logic + extra tiles                                         */
  /* ---------------------------------------------------------------- */

  /**
   * Stock multirotor step, then the 8-gate race clock. The world's gate prims
   * are the visuals; the crossing order lives here (gate prim order matches).
   */
  physics(fl, dt, ctx) {
    ctx.stock(fl, dt);
    if (!fl.armed || fl.crashed) return;
    const g = RACE_GATES[fl.gate % RACE_GATES.length];
    const hd = (g[2] * Math.PI) / 180;
    const nx = Math.cos(hd);
    const ny = Math.sin(hd);
    const d = (fl.pos[0] - g[0]) * nx + (fl.pos[1] - g[1]) * ny;
    const lat = -(fl.pos[0] - g[0]) * ny + (fl.pos[1] - g[1]) * nx;
    const dz = fl.pos[2] - GATE_H / 2;
    const prevD = fl.prevD;
    fl.prevD = d;
    if (!(prevD < 0 && d >= 0 && Math.abs(lat) < GATE_W / 2 && Math.abs(dz) < GATE_H / 2)) return;
    if (fl.gate === 0) {
      if (fl.lapStart >= 0) {
        const lap = fl.t - fl.lapStart;
        fl.lastLap = lap;
        const prev = (fl.bestLap as number | undefined) ?? Progress.get('race5').bestLap ?? 0;
        if (!prev || lap < prev) {
          fl.bestLap = lap;
          Progress.set('race5', { bestLap: lap });
          ctx.say(`Lap ${lap.toFixed(2)} s (best!)`);
        } else {
          ctx.say(`Lap ${lap.toFixed(2)} s`);
        }
        AudioSys.sfx('ding');
      } else {
        ctx.say('Lap started');
        AudioSys.sfx('chime');
      }
      fl.lapStart = fl.t;
    } else {
      AudioSys.sfx('chime');
    }
    fl.gate = (fl.gate + 1) % RACE_GATES.length;
  },

  flyStats(fl): StatItem[] {
    const out: StatItem[] = [{ label: 'Gates', value: `${fl.gate + 1}/${RACE_GATES.length}`, small: true }];
    const last = fl.lastLap as number | undefined;
    if (last != null) out.push({ label: 'Lap', value: `${last.toFixed(2)} s`, small: true });
    const best = (fl.bestLap as number | undefined) ?? Progress.get('race5').bestLap;
    if (best) out.push({ label: 'Best lap', value: `${best.toFixed(2)} s` });
    return out;
  },

  /** Same tiles as the stock calculator, but the last row is race time. */
  calcRows(c) {
    return [
      { label: 'All-up weight', value: `${Math.round(c.auw)} g` },
      { label: 'Thrust : weight', value: `${c.tw.toFixed(1)} : 1` },
      { label: 'Hover throttle', value: `${Math.round(c.hoverThr * 100)} %` },
      { label: 'Max current', value: `${Math.round(c.maxA)} A` },
      { label: 'Hover time', value: `${c.hoverMin.toFixed(1)} min` },
      { label: 'Race time', value: `~${c.flyMin.toFixed(1)} min` }
    ];
  },

  /** Mismatched motor/battery pairs: syrup one way, grenade the other. */
  warnings(d) {
    const motor = this.motors[d.motor];
    const batt = this.batts[d.batt];
    const out: string[] = [];
    if (motor && batt && motor.forCells === 6 && batt.cells === 4) {
      out.push('A 6S motor on 4S turns into syrup: KV x V is what makes thrust. Pick the 2500 KV.');
    }
    if (motor && batt && motor.forCells === 4 && batt.cells === 6) {
      out.push('2500 KV on 6S is a grenade: over the ESC\u2019s voltage.');
    }
    return out;
  }
};
