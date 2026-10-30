/**
 * Fig. 04 — the 7-inch long-range quad.
 *
 * A 315 mm wheelbase cruiser built for endurance, not punch: 2807 motors
 * swinging 7-inch bi-blades, a 6S1P Li-ion pack (six visible 21700 cells),
 * ELRS 900 MHz control with a T-antenna, a 1 W VTX, GPS + compass on a
 * printed mast — and a Betaflight GPS Rescue failsafe you can trigger on
 * purpose with the "Cut the link" button while flying.
 */

import { Vec3, Tone, INK, path3, ink, fillPath, clamp, project } from '../engine/core';
import { FR, rad } from '../engine/frames';
import type { Frame } from '../engine/frames';
import { obox, ocyl, odisc, otext, tube, glowDot } from '../engine/oshapes';
import { CARBON, PCB, SILK, WIRE, TIN, SLEEVE, LEDBODY, GOLD } from '../engine/materials';
import type { CraftRecord, DrawOpt, DrawAdd, Design, CalcOut, FlightState, PhysCtx } from '../types';
import type { StatItem } from '../engine/shell';

const MPOS: Array<[number, number, string, 'CW' | 'CCW']> = [
  [-145, -145, 'M1', 'CW'],
  [145, -145, 'M2', 'CCW'],
  [-145, 145, 'M3', 'CCW'],
  [145, 145, 'M4', 'CW']
];

/**
 * Home point for the GPS Rescue autopilot. A craft's physics hook gets no
 * access to the world, so the rescue flies back to THIS pad — it must match
 * `range.pad` below ([20, 6] on the mountain-valley field).
 */
const HOME: [number, number] = [20, 6];

/** Body pitch target (rad) while the rescue cruises for home (~13 deg in angle mode). */
const RESCUE_LEAN = 0.35;

const PLASTIK: Tone = { l: '#4a5056', m: '#34393e', d: '#1f2327' };
const STRAPTAB: Tone = { l: '#ef6a4c', m: '#cf5038', d: '#4a2219' };

/* ------------------------------------------------------------------ */
/* GPS Rescue autopilot (phases live in fl.rescue: 1 climb, 2 home,    */
/* 3 descend, 4 done). It writes ctx.stick as if it were the pilot,    */
/* then the stock multirotor step does the flying.                     */
/* ------------------------------------------------------------------ */

function rescueStep(fl: FlightState, ctx: PhysCtx): void {
  const s = ctx.stick;
  const dx = HOME[0] - fl.pos[0];
  const dy = HOME[1] - fl.pos[1];
  const dist = Math.hypot(dx, dy);
  const hoverThr = Math.max(0.1, fl.c.hoverThr);

  // level + hover by default. The pitch/roll commands are angle errors, which
  // works in angle mode (stick = target angle) and in acro (stick = rate).
  s.roll = clamp(-fl.roll * 3, -1, 1);
  s.pitch = clamp(-fl.pitch * 3, -1, 1);
  s.yaw = 0;
  s.thr = 0;
  s.thrAbs = hoverThr;

  // absolute-throttle altitude controller (angle / acro modes use thrAbs,
  // altitude-hold modes use the s.thr climb-rate commands below)
  const altThr = (zT: number, vzT: number): number => {
    const dz = clamp(zT - fl.pos[2], -5, 5);
    return clamp(hoverThr + (dz * 0.6 + (vzT - fl.vel[2]) * 1.2) * 0.028, 0.05, 1);
  };

  const ph = fl.rescue;
  if (ph === 1) {
    if (fl.rescueAnn !== 1) {
      fl.rescueAnn = 1;
      ctx.say('FAILSAFE: control link lost — GPS Rescue: climb');
    }
    const target = dist < 15 ? 7 : 45; // Betaflight rescues low when close to home
    s.thr = fl.pos[2] < target - 0.5 ? 0.8 : 0;
    s.thrAbs = altThr(target, 1.6);
    if (fl.pos[2] >= target - 1) {
      fl.rescueAlt = Math.max(2, fl.pos[2]);
      fl.rescue = 2;
      ctx.say(`Rescue: ${Math.round(fl.pos[2])} m — turning for home`);
    }
  } else if (ph === 2) {
    const zT = typeof fl.rescueAlt === 'number' ? fl.rescueAlt : 45;
    // yaw toward the home pad (bearing error wrapped to -pi..pi)
    const bearing = Math.atan2(dy, dx);
    const off = Math.atan2(Math.sin(fl.yaw - bearing), Math.cos(fl.yaw - bearing));
    s.yaw = clamp(off * 2, -1, 1);
    s.pitch = clamp((RESCUE_LEAN - fl.pitch) * 3, -1, 1);
    s.thr = 0; // hold height
    s.thrAbs = altThr(zT, 0);
    if (dist <= 8) {
      fl.rescue = 3;
      ctx.say('Rescue: over home — descending');
    }
  } else if (ph === 3) {
    const vzT = fl.pos[2] > 3 ? -1.8 : -0.6; // descend, then flare to land soft
    s.thr = clamp(vzT / 2.2, -1, 0);
    s.thrAbs = clamp(hoverThr + (vzT - fl.vel[2]) * 0.034, 0.05, 1);
    if (fl.pos[2] <= 0.2) {
      fl.rescue = 4;
      fl.armed = false;
      ctx.say('Rescue complete: landed and disarmed');
    }
  }
}

/* ------------------------------------------------------------------ */

export const lr7: CraftRecord = {
  key: 'lr7',
  fig: 4,
  name: '7-inch long range',
  sub: 'GPS rescue',
  hint: 'design it, build it, fly it out — then cut the link on purpose',
  noun: 'long ranger',
  palette: 'cobalt',
  log: 'betaflight',
  mat: 420,
  benchH: 160,
  flyScale: 2.6,
  flyVB: 11000,
  fpvProps: true,
  ceiling: 85, // the rescue climbs to 45 m
  hitR: 0.18,
  kThrust: 1.08,
  gPerW: 8,
  minTW: 3.5,
  maxKvCells: 9000, // a 1700KV (4S) motor on 6S is too much
  calLabel: 'Calibrate accelerometer + compass',
  design: { batt: 'liion4000', motor: '2807-1300', prop: '7x3.5' },

  batts: {
    liion4000: { name: '6S1P Li-ion 4000 (21700)', cells: 6, mah: 4000, g: 440, price: 62, col: '#3a5f8a', lab: 'LI-ION 4000', liion: true },
    liion5000: { name: '6S1P Li-ion 5000 (P50B)', cells: 6, mah: 5000, g: 468, price: 78, col: '#2f4f7a', lab: 'LI-ION 5000', liion: true },
    lipo1800: { name: '6S LiPo 1800', cells: 6, mah: 1800, g: 292, price: 54, col: '#2b2a28', lab: 'LIPO 1800' }
  },
  motors: {
    '2807-1300': { name: '2807 1300KV', kv: 1300, g: 48, price: 28 },
    '3008-1100': { name: '3008 1100KV', kv: 1100, g: 56, price: 32 },
    '2807-1700': { name: '2807 1700KV', kv: 1700, g: 47, price: 26, forCells: 4 }
  },
  props: {
    '7x3.5': { name: '7x3.5 bi-blade', pf: 1.0, eff: 1.0, g: 8, price: 5 },
    '7.5x3.7': { name: '7.5x3.7 bi-blade', pf: 1.06, eff: 1.05, g: 9, price: 6 },
    '7x4x3': { name: '7x4 tri-blade', pf: 1.12, eff: 0.9, g: 10.5, price: 6 }
  },
  fixed: [
    { id: 'FRAME', name: '7" LR carbon frame', g: 162, price: 55, cat: 'Mechanical' },
    { id: 'ESC', name: '50A 4-in-1 ESC', g: 10, price: 52, cat: 'Electrical' },
    { id: 'FC', name: 'F7 FC + barometer', g: 8, price: 45, cat: 'Electrical' },
    { id: 'CAM', name: 'analog FPV camera', g: 7, price: 25, cat: 'Electrical' },
    { id: 'VTX', name: '1W VTX + stubby antenna', g: 10, price: 38, cat: 'Electrical' },
    { id: 'RX', name: 'ELRS 900 RX + T-antenna', g: 4, price: 32, cat: 'Electrical' },
    { id: 'GPS', name: 'GPS + compass (M10 + QMC5883)', g: 12, price: 24, cat: 'Electrical' },
    { id: 'XT60', name: 'XT60 pigtail + low-ESR cap', g: 12, price: 4, cat: 'Electrical' },
    { id: 'TOP', name: 'top plate + GPS mast', g: 30, price: 12, cat: 'Mechanical' },
    { id: 'STRAP', name: 'battery strap + pad', g: 6, price: 4, cat: 'Mechanical' }
  ],

  parts: [
    {
      id: 'FRAME',
      name: 'Carbon frame: bottom plate + four long arms (315 mm true-X, 6 mm arms)',
      short: 'FRAME',
      z: 0,
      what: 'A long-range true-X: 315 mm motor to motor on 6 mm arms. Long arms flex more than short ones — the extra width is what makes 7-inch props efficient, and the thick carbon is what keeps them from flapping at low rpm.'
    },
    {
      id: 'MOTORS',
      name: '4 brushless motors (2807)',
      short: 'MOTORS',
      z: 1,
      after: ['FRAME'],
      what: '2807 stator: 28 mm across, 7 mm tall. Low KV on 6S swings a 7-inch prop at ~29 000 rpm — thrust from disc area, not tip speed. More stator millimetres = more grams per watt.'
    },
    {
      id: 'ESC',
      name: '50A 4-in-1 ESC',
      short: 'ESC',
      z: 2,
      after: ['FRAME'],
      what: 'Four 50 A controllers on one board. Full throttle on 6S can pull ~80 A through this build — fine for the ESC in bursts, hard on a Li-ion pack.'
    },
    {
      id: 'WIRES',
      name: 'Motor wires in braided sleeve',
      short: 'MOTOR WIRES',
      z: 2,
      after: ['MOTORS', 'ESC'],
      what: 'Long arms mean long motor leads — 18 cm of sleeved wire per motor. Keep them clear of the spinning bell and tied to the arm, or the props will find them.'
    },
    {
      id: 'FC',
      name: 'F7 flight controller + barometer',
      short: 'FLIGHT CTRL',
      z: 3,
      after: ['ESC'],
      polar: ['arrow forward', 'arrow backward'],
      what: 'The F7 runs Betaflight 2000 times a second; the hump on top is the barometer the rescue uses to hold altitude. The arrow must point at the nose — backwards, it corrects the wrong way.'
    },
    {
      id: 'XT60',
      name: 'XT60 pigtail + low-ESR capacitor',
      short: 'XT60 + CAP',
      z: 2,
      after: ['ESC'],
      polar: ['stripe to minus', 'stripe to plus'],
      what: 'The power lead plus a 1000 uF capacitor that soaks up the ESC switching spikes. Polarised: the stripe goes to minus — backwards, it vents. Li-ion packs have thin tabs, so the cap matters even more here.'
    },
    {
      id: 'CAM',
      name: 'FPV camera (analog, 15° tilt)',
      short: 'CAMERA',
      z: 2,
      after: ['FRAME'],
      what: 'A 700 TVL camera on a 15° tilt mount. Long-range flying is mostly forward cruising, not dives: at cruise pitch the horizon sits mid-frame instead of the sky.'
    },
    {
      id: 'RX',
      name: 'ELRS 900 MHz receiver + T-antenna',
      short: 'T-ANT RX',
      z: 4,
      after: ['FC'],
      what: 'ExpressLRS on 900 MHz — half the frequency of 2.4 GHz, so it bends around trees and folds into hills better. The T-antenna is a dipole: keep both elements clear of carbon and battery.'
    },
    {
      id: 'VTX',
      name: '1W video transmitter + stubby antenna',
      short: 'VTX',
      z: 4,
      after: ['FC'],
      what: 'A 1 W 5.8 GHz VTX — two and a half times the usual power. Even so, expect snow long before the control link gives up: the video always dies first.'
    },
    {
      id: 'TOP',
      name: 'Top plate + printed GPS mast',
      short: 'TOP PLATE',
      z: 5,
      after: ['FC', 'CAM', 'RX', 'VTX'],
      what: 'Standoffs squeeze the stack into a sandwich and the top plate carries the battery on a strap. The printed mast lifts the GPS into clean sky, away from the magnetic mess of the power leads.'
    },
    {
      id: 'GPS',
      name: 'GPS + compass on the mast (M10 + QMC5883)',
      short: 'GPS + MAG',
      z: 6,
      after: ['FC', 'TOP'],
      polar: ['arrow forward', 'arrow backwards'],
      what: 'The M10 GPS and the QMC5883 compass ride at the top of the mast. The white arrow must point the same way as the FC arrow: a backwards compass makes GPS Rescue toilet-bowl away from home.'
    },
    {
      id: 'BATT',
      name: 'Li-ion battery + strap',
      short: 'LI-ION',
      z: 7,
      after: ['TOP', 'XT60'],
      what: '6S1P of 21700 cells: 4000 mAh at 440 g — over twice the energy per gram of a LiPo. The trade is burst current: past ~45 A it sags hard. Wait for 8+ satellites before arming so the recorded home point is accurate.'
    },
    {
      id: 'PROPS',
      name: 'Propellers (7-inch bi-blades)',
      short: 'PROPS',
      z: 8,
      after: ['MOTORS', 'TOP'],
      polar: ['props in (correct)', 'swapped CW/CCW'],
      what: 'Two blades, not three: less tip loss at low rpm, and 8 grams each. They go on LAST — a motor test with props on throws the quad at your face.'
    }
  ],

  mpos: MPOS,

  /* ---------------------------------------------------------------- */
  /* drawing                                                          */
  /* ---------------------------------------------------------------- */

  draw(f: Frame, add: DrawAdd, opt: DrawOpt): void {
    const m = opt.m;
    const has = opt.has;
    const U = opt.U;
    const orient = opt.orient;

    /* ---- frame: bottom plate + four long 6 mm arms ---- */
    if (has('FRAME')) {
      const F = U('FRAME');
      add([0, 0, 0], obox(F, -70, 70, -32, 32, -3, 0, CARBON, 0.9).svg, 'FRAME');
      for (const [mx, my] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1]
      ]) {
        const A = FR.Rz(F, rad((Math.atan2(my, mx) * 180) / Math.PI));
        add([mx * 87, my * 87, 0], obox(A, 30, 216, -8, 8, -6, 0, CARBON, 0.9).svg, 'FRAME');
      }
    }

    /* ---- motors ---- */
    if (has('MOTORS')) {
      const F = U('MOTORS');
      MPOS.forEach(([mx, my], i) => {
        const M = FR.T(F, mx, my, 0);
        let svg = ocyl(M, 15, 0, 5, CARBON, 1, 16).svg;
        svg += ocyl(M, 16, 5, 20, m, 1, 16).svg;
        const spin = opt.spin[i] || 0;
        for (let b = 0; b < 3; b++) {
          const a = spin * (i % 2 ? -1 : 1) + (b * Math.PI * 2) / 3;
          svg += odisc(M, 3, 20.5, INK, 0, 8, Math.cos(a) * 9, Math.sin(a) * 9);
        }
        svg += ocyl(M, 2.6, 20, 25, TIN, 0.7, 10).svg;
        add([mx, my, 12], svg, 'MOTORS');
      });
    }

    /* ---- props: 7-inch bi-blades ---- */
    if (has('PROPS') && !opt.broken) {
      const F = U('PROPS');
      const swapped = orient('PROPS') === 1;
      MPOS.forEach(([mx, my, _id, dir], i) => {
        const ccw = (dir === 'CCW') !== swapped;
        const P = FR.T(F, mx, my, 26);
        const rate = opt.rpm[i] || 0;
        if (rate > 0.12) {
          // prop blur disc
          const c = project(FR.pt(P, [0, 0, 0]));
          add(
            [mx, my, 28],
            `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(90 * opt.k).toFixed(0)}" fill="#fff" opacity="${(0.16 + 0.2 * rate).toFixed(2)}"/>`,
            'PROPS'
          );
        } else {
          let svg = '';
          const spin = opt.spin[i] || 0;
          for (let b = 0; b < 2; b++) {
            const a = spin * (ccw ? -1 : 1) + b * Math.PI;
            const B = FR.Rz(FR.T(P, 0, 0, 0), a);
            const bladeF = FR.Rx(B, ccw ? rad(9) : rad(-9));
            svg += obox(bladeF, 8, 90, -6, 6, -0.8, 0.8, { l: '#f4b829', m: '#d49c1f', d: '#4e4a18' }, 0.7).svg;
          }
          svg += ocyl(P, 6.5, -1, 2.5, CARBON, 0.8, 10).svg;
          add([mx, my, 28], svg, 'PROPS');
        }
      });
    }

    /* ---- ESC ---- */
    if (has('ESC')) {
      const F = U('ESC');
      let svg = obox(F, -21, 21, -21, 21, 3, 4.6, PCB, 0.8).svg;
      for (const [cx, cy] of [
        [-12, -12],
        [12, -12],
        [-12, 12],
        [12, 12]
      ]) {
        svg += obox(F, cx - 4, cx + 4, cy - 4, cy + 4, 4.6, 6.4, TIN, 0.6).svg;
      }
      add([0, 0, 5], svg, 'ESC');
    }

    /* ---- motor wires: long sleeved leads ---- */
    if (has('WIRES')) {
      const F = U('WIRES');
      let svg = '';
      MPOS.forEach(([mx, my], i) => {
        void i;
        const a: Vec3 = FR.pt(F, [mx * 0.88, my * 0.88, 8]);
        const b: Vec3 = FR.pt(F, [Math.sign(mx) * 17, Math.sign(my) * 17, 4]);
        const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 7.5];
        svg += tube([a, mid, b], 1.1, SLEEVE);
      });
      add([0, 0, 6], svg, 'WIRES');
    }

    /* ---- flight controller (F7 + baro hump, polar arrow) ---- */
    if (has('FC')) {
      const F = U('FC');
      let svg = obox(F, -17, 17, -17, 17, 10, 11.6, PCB, 0.8).svg;
      svg += obox(F, -14, -2, -6, 6, 11.6, 14.6, TIN, 0.6).svg; // F7 MCU
      svg += obox(F, -14, -7, 8, 15, 11.6, 13.8, LEDBODY, 0.6).svg; // baro under its hump
      svg += obox(F, 6, 15, -14, -7, 11.6, 12.6, SILK as unknown as Tone, 0.5).svg; // connector
      const flip = orient('FC') ? -1 : 1;
      const arrowPts: Vec3[] = [
        FR.pt(F, [14 * flip, 0, 12.2]),
        FR.pt(F, [3 * flip, 5.5, 12.2]),
        FR.pt(F, [3 * flip, -5.5, 12.2])
      ];
      svg += fillPath(path3(arrowPts), SILK) + ink(path3(arrowPts), 0.7);
      if (opt.power) {
        svg += odisc(F, 2.5, 12.2, '#3e86d9', 0, 10, 11, -11);
        svg += glowDot(FR.pt(F, [11, -11, 12.2]), '#3e86d9', 6);
      }
      add([0, 0, 12], svg, 'FC');
    }

    /* ---- XT60 + cap (rear) ---- */
    if (has('XT60')) {
      const F = U('XT60');
      let svg = '';
      svg += tube([FR.pt(F, [-78, 4, 7]), FR.pt(F, [-104, 10, 7])], 1.4, WIRE.red);
      svg += tube([FR.pt(F, [-78, -4, 7]), FR.pt(F, [-104, -10, 7])], 1.4, WIRE.blk);
      svg += obox(F, -96, -82, -6, 6, 2, 12, GOLD, 0.9).svg;
      const capF = FR.Rz(F, rad(90));
      const capMat = opt.fault ? ({ l: '#7a6a5a', m: '#5d5145', d: '#3d352c' } as Tone) : LEDBODY;
      svg += ocyl(capF, 5, -9, 9, capMat, 1, 16, -50, 15).svg;
      const stripeOff = orient('XT60') ? 3.6 : -3.6;
      svg += ocyl(capF, 5, -9, 9, { l: '#e8e3d0', m: '#cfc9b6', d: '#a39d8a' }, 0.6, 16, -50 + stripeOff, 15).svg;
      add([-88, 8, 7], svg, 'XT60');
    }

    /* ---- camera (15° tilt) ---- */
    if (has('CAM')) {
      const F = U('CAM');
      let svg = '';
      svg += obox(F, 56, 74, 11, 16, 0, 26, CARBON, 0.8).svg;
      svg += obox(F, 56, 74, -16, -11, 0, 26, CARBON, 0.8).svg;
      svg += obox(F, 56, 74, -9, 9, 3, 21, m, 0.9).svg;
      const lensF = FR.Ry(F, rad(16));
      svg += ocyl(lensF, 7, 36, 52, CARBON, 0.9, 16, 54, 0).svg;
      svg += odisc(lensF, 5.6, 52, '#1c1c1e', 0.5, 16, 54, 0);
      add([66, 0, 14], svg, 'CAM');
    }

    /* ---- receiver (900 MHz + T-antenna) ---- */
    if (has('RX')) {
      const F = U('RX');
      let svg = obox(F, 21, 31, 10, 22, 12, 13.2, PCB, 0.7).svg;
      // coax out to the antenna
      svg += tube([FR.pt(F, [26, 16, 13.2]), FR.pt(F, [4, 28, 20]), FR.pt(F, [-30, 32, 30])], 0.7, WIRE.wht);
      // the T: horizontal element + vertical stub at its end
      svg += tube([FR.pt(F, [-30, 32, 32]), FR.pt(F, [-58, 32, 32])], 1, WIRE.wht);
      svg += tube([FR.pt(F, [-58, 32, 32]), FR.pt(F, [-58, 32, 44])], 1, WIRE.wht);
      add([-10, 28, 24], svg, 'RX');
    }

    /* ---- VTX (1 W + stubby antenna) ---- */
    if (has('VTX')) {
      const F = U('VTX');
      let svg = obox(F, 20, 32, -22, -10, 12, 13.4, PCB, 0.8).svg;
      svg += obox(F, 23, 29, -19, -13, 13.4, 15.8, TIN, 0.6).svg; // shield can
      // coax out past the plate edge, then the stubby sticking up beside the pack
      svg += tube([FR.pt(F, [26, -16, 13.4]), FR.pt(F, [40, -26, 24]), FR.pt(F, [52, -28, 33])], 0.7, WIRE.wht);
      svg += ocyl(F, 2.6, 33, 49, { l: '#ef6a4c', m: '#cf5038', d: '#4a2219' }, 0.8, 12, 52, -28).svg;
      svg += odisc(F, 2, 49.2, '#f6f2e6', 0.4, 10, 52, -28);
      if (opt.power) {
        svg += odisc(F, 2, 13.5, '#e2483d', 0, 10, 21, -20);
        svg += glowDot(FR.pt(F, [21, -20, 14]), '#e2483d', 5);
      }
      add([26, -24, 16], svg, 'VTX');
    }

    /* ---- top plate + printed GPS mast ---- */
    if (has('TOP')) {
      const F = U('TOP');
      let svg = '';
      for (const [sx, sy] of [
        [-60, -20],
        [60, -20],
        [-60, 20],
        [60, 20]
      ]) {
        svg += ocyl(F, 3, 0, 30, TIN, 0.8, 10, sx, sy).svg;
      }
      svg += obox(F, -70, 70, -26, 26, 30, 32.5, CARBON, 0.9).svg;
      // the mast (printed, orange PETG)
      svg += ocyl(F, 3, 32.5, 72.5, WIRE.org, 0.9, 10, -58, 0).svg;
      add([0, 0, 33], svg, 'TOP');
    }

    /* ---- GPS puck on the mast (own polar arrow) ---- */
    if (has('GPS')) {
      const F = U('GPS');
      const G = FR.T(F, -58, 0, 0);
      let svg = ocyl(G, 11, 72.5, 78.5, PLASTIK, 1, 20).svg;
      svg += odisc(G, 6.5, 78.6, '#20262b', 0.4, 14, 3, 0); // the M10 patch
      const flip = orient('GPS') ? -1 : 1;
      const pts: Vec3[] = [
        FR.pt(G, [8 * flip, 0, 79.2]),
        FR.pt(G, [-3 * flip, 4.5, 79.2]),
        FR.pt(G, [-3 * flip, -4.5, 79.2])
      ];
      svg += fillPath(path3(pts), SILK) + ink(path3(pts), 0.7);
      add([-58, 0, 76], svg, 'GPS');
    }

    /* ---- battery: Li-ion pack with six visible cell tops ---- */
    if (has('BATT')) {
      const F = U('BATT');
      const key = (opt.design as { batt: string }).batt;
      const B = lr7.batts[key] ?? lr7.batts.liion4000;
      const long = key === 'liion5000' ? 48 : key === 'lipo1800' ? 36 : 44;
      let svg = obox(F, -long, long, -18, 18, 32.5, 62, { l: B.col ?? '#3a5f8a', m: '#413f3d', d: '#26241f' } as Tone, 1).svg;
      // strap tabs
      svg += obox(F, long - 10, long - 2, -19, 19, 44, 47, STRAPTAB, 0.8).svg;
      svg += obox(F, -long + 2, -long + 10, -19, 19, 44, 47, STRAPTAB, 0.8).svg;
      svg += otext(F, 0, -13, 62.6, B.lab ?? 'LI-ION', 8, SILK);
      // the six 21700s peeking through the wrap
      if (B.liion) {
        for (let c = 0; c < 6; c++) {
          svg += odisc(F, 6, 62.2, '#6b7f96', 0.8, 14, -30 + c * 12, 0);
        }
      }
      if (opt.plugged && has('XT60')) {
        svg += tube([FR.pt(F, [-long + 4, 6, 52]), FR.pt(F, [-78, 10, 34]), FR.pt(F, [-92, 10, 14])], 1.4, WIRE.red);
        svg += tube([FR.pt(F, [-long + 4, -6, 52]), FR.pt(F, [-78, -10, 34]), FR.pt(F, [-92, -10, 14])], 1.4, WIRE.blk);
      }
      add([0, 0, 48], svg, 'BATT');
    }
  },

  hull(f: Frame): Vec3[] {
    const pts: Vec3[] = [];
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1]
    ]) {
      pts.push(FR.pt(f, [70 * sx, 32 * sy, -6]));
      pts.push(FR.pt(f, [44 * sx, 18 * sy, 62]));
      pts.push(FR.pt(f, [209 * sx, 209 * sy, 28]));
    }
    return pts;
  },

  tags: [
    ['FC', [10, 0, 16], 48, -42],
    ['GPS', [-58, 0, 80], -44, -38],
    ['BATT', [0, 0, 64], -34, -48],
    ['RX', [-58, 32, 40], -46, -22],
    ['VTX', [52, -28, 46], -44, 26]
  ],

  /* ---------------------------------------------------------------- */
  /* wiring                                                           */
  /* ---------------------------------------------------------------- */

  wiring: {
    nodes(d, c) {
      void d;
      return {
        GPS: [140, 116, 'GPS + COMPASS', 'M10 + QMC5883', '#3e86d9'],
        FC: [360, 116, 'FLIGHT CTRL', 'F7 + baro, Betaflight', '#3e86d9'],
        RX: [580, 116, 'RECEIVER', 'ELRS 900 MHz', '#8c4bd1'],
        VTX: [360, 14, 'VTX', '5.8 GHz, 1 W', '#8c4bd1'],
        CAM: [600, 14, 'CAMERA', 'analog, 15 deg', '#43a35a'],
        BATT: [20, 238, 'BATTERY', (c.battName as string) || 'Li-ion 6S 4000', '#e2483d'],
        XT60: [190, 238, 'XT60 + CAP', '1000 uF 35 V', '#e2483d'],
        ESC: [360, 238, '4-IN-1 ESC', '50 A x 4, BLHeli_32', '#e2483d'],
        MOTORS: [600, 238, 'MOTORS x4', (c.motorName as string) || '2807 1300KV', '#f08a2b']
      };
    },
    links: [
      { from: 'BATT', to: 'XT60', kind: 'power', label: 'XT60' },
      { from: 'XT60', to: 'ESC', kind: 'power', label: 'VBAT + GND' },
      { from: 'ESC', to: 'MOTORS', kind: 'motor', label: '3-phase x4' },
      { from: 'ESC', to: 'FC', kind: 'power' },
      { from: 'ESC', to: 'FC', kind: 'data', label: 'M1-M4' },
      { from: 'FC', to: 'GPS', kind: 'i2c', label: 'GPS + compass' },
      { from: 'FC', to: 'RX', kind: 'data', label: 'ELRS 900', label2: 'UART2' },
      { from: 'FC', to: 'VTX', kind: 'data', label: 'SmartAudio' },
      { from: 'CAM', to: 'VTX', kind: 'video', label: 'video' }
    ]
  },

  /* ---------------------------------------------------------------- */
  /* content                                                          */
  /* ---------------------------------------------------------------- */

  overview: `<p>A 7-inch long-range quad trades punch for endurance. Big, slow bi-blades on 2807 motors hover at around 8 grams per watt — roughly double a freestyle quad — so the same weight of battery carries you for half an hour instead of five minutes.</p>
<p>The pack is 6S1P lithium-ion: 4000 mAh at 440 g, where a LiPo of that weight holds about 1800. The trade is burst current — Li-ion sags hard past ~45 A — so you fly it like an airliner, not a rally car. Control is ExpressLRS on 900 MHz, which propagates through trees far better than 2.4 GHz; the 5.8 GHz video gets snowy long before the control link complains.</p>
<p>That order matters: failsafe watches the CONTROL link, not the video. Lose control and GPS Rescue takes over — climb to a safe altitude, fly back to the home point, land. Wait for 8+ satellites before arming so the home point is accurate, and make sure the compass arrow on the mast points the same way as the one on the FC: a backwards compass makes the rescue toilet-bowl away from home.</p>`,

  buildCode: `# long range setup, in the Betaflight CLI:
set motor_pwm_protocol = DSHOT600
set failsafe_procedure = GPS-RESCUE
set gps_rescue_angle = 32
set gps_rescue_return_alt = 100
set gps_rescue_ground_speed = 1100
set rx_link_quality_low_action = DROP  # let failsafe handle it
set vbat_warning_cell_voltage = 300    # li-ion floor is lower
save`,

  quiz: [
    {
      q: 'Video gets snowy but you still have control. What does failsafe watch?',
      a: ['The video link', 'The CONTROL link — losing it triggers Rescue', 'Both equally'],
      ok: 1
    },
    {
      q: 'Why Li-ion here?',
      a: ['More energy per gram for calm cruising; burst current is the trade', 'They crash better', 'Cheaper per cell'],
      ok: 0
    },
    {
      q: 'GPS Rescue with a backwards compass...',
      a: ['Flies home fine', 'Curves away from home — toilet-bowling', 'Refuses to arm'],
      ok: 1
    },
    {
      q: 'Why wait for 8+ satellites?',
      a: ['More speed', 'A more accurate home point for the rescue', 'Better video'],
      ok: 1
    }
  ],

  practice: 'Fly the valley out past the lake, cut the link, and let Rescue bring it home. Then check the log for the climb altitude.',

  /* ---------------------------------------------------------------- */
  /* flight                                                           */
  /* ---------------------------------------------------------------- */

  modes: {
    rescue: {
      title: 'GPS Rescue (failsafe)',
      code: 'set gps_rescue_angle = 32\nset gps_rescue_initial_climb = 45\nset gps_rescue_ground_speed = 1100\nset failsafe_procedure = GPS-RESCUE',
      hint: 'Lose the link on purpose: it climbs, flies home, lands',
      alt: true
    }
  },

  extraButtons: [
    {
      label: 'Cut the link (failsafe)',
      inFlight: true,
      onClick(fl: FlightState | null): void {
        if (!fl || !fl.armed || fl.crashed) return;
        fl.rescue = 1;
        fl.rescueAnn = 0;
      }
    }
  ],

  /** Stock model, but cruising burns 75 % of hover current (not freestyle's 42 %). */
  calc(d: Design): CalcOut {
    const batt = lr7.batts[d.batt] ?? Object.values(lr7.batts)[0];
    const motor = lr7.motors[d.motor] ?? Object.values(lr7.motors)[0];
    const prop = lr7.props[d.prop] ?? Object.values(lr7.props)[0];
    const n = lr7.mpos.length;

    const V = batt.cells * 3.7;
    const krpm = (motor.kv * V) / 1000;
    const sz = motor.sz ?? 1;
    const thrust = lr7.kThrust * sz * prop.pf * krpm * krpm; // grams per motor
    const auw = lr7.fixed.reduce((s, fx) => s + fx.g, 0) + n * motor.g + n * prop.g + batt.g;
    const tw = (n * thrust) / auw;
    const hoverW = auw / (lr7.gPerW * prop.eff);
    const hoverA = hoverW / V;
    const hoverMin = ((batt.mah / 1000) * 0.8) / hoverA * 60;
    const flyMin = hoverMin * 0.75; // calm LR cruise duty
    const maxA = (n * thrust) / (2 * prop.eff) / V;
    const over = motor.kv * batt.cells > (lr7.maxKvCells ?? 1750 * 6 * 1.15);
    const weak = tw < (lr7.minTW ?? 5);
    const hoverThr = Math.sqrt(auw / (n * thrust));

    let costE = 0;
    let costM = 0;
    let nElect = 0;
    let nMech = 0;
    for (const fx of lr7.fixed) {
      if (fx.cat === 'Electrical') {
        costE += fx.price;
        nElect++;
      } else {
        costM += fx.price;
        nMech++;
      }
    }
    costE += motor.price * n + batt.price;
    nElect += 2;
    costM += prop.price * Math.ceil(n / 2);
    nMech += 1;

    return {
      V,
      krpm,
      thrust,
      auw,
      tw,
      hoverW,
      hoverA,
      hoverMin,
      flyMin,
      maxA,
      over,
      weak,
      hoverThr,
      cost: { Electrical: costE, Mechanical: costM, Total: costE + costM },
      nElect,
      nMech,
      n,
      kv: motor.kv,
      cells: batt.cells,
      mah: batt.mah,
      battName: batt.name,
      motorName: motor.name,
      propName: prop.name,
      cruise: 48 // km/h, 7-inch cruise
    };
  },

  calcRows(c: CalcOut): StatItem[] {
    const cruise = (c.cruise as number) ?? 48;
    return [
      { label: 'All-up weight', value: `${Math.round(c.auw)} g` },
      { label: 'Thrust : weight', value: `${c.tw.toFixed(1)} : 1` },
      { label: 'Hover throttle', value: `${Math.round(c.hoverThr * 100)} %` },
      { label: 'Max current', value: `${Math.round(c.maxA)} A` },
      { label: 'Cruise time', value: `${c.flyMin.toFixed(1)} min` },
      { label: 'Range', value: `${((c.flyMin / 60) * cruise * 0.9).toFixed(1)} km` }
    ];
  },

  warnings(d: Design, c: CalcOut): string[] {
    const out: string[] = [];
    const batt = lr7.batts[d.batt];
    if (batt?.liion && c.maxA > 45) {
      out.push(
        `Li-ion packs sag hard past ~45 A: this build draws ${Math.round(c.maxA)} A at full throttle — a LiPo carries burst current, Li-ion carries energy.`
      );
    }
    return out;
  },

  /** Stock multirotor flight, plus the GPS Rescue state machine. */
  physics(fl: FlightState, dt: number, ctx: PhysCtx): void {
    const r = fl.rescue;
    if (typeof r === 'number' && r > 0) {
      if (r >= 4) {
        // flying again after a completed rescue: clear the tile
        if (fl.armed && !fl.crashed) fl.rescue = 0;
      } else if (fl.crashed) {
        fl.rescue = 0; // a crash ends the rescue (the message already fired)
      } else if (!fl.armed) {
        fl.rescue = 0;
        ctx.say('Link restored: GPS Rescue cancelled');
      }
    }
    const res = fl.rescue;
    if (typeof res === 'number' && res >= 1 && res < 4 && fl.armed && !fl.crashed) {
      rescueStep(fl, ctx);
    }
    ctx.stock(fl, dt);
  },

  flyStats(fl: FlightState): StatItem[] {
    const r = fl.rescue;
    if (typeof r !== 'number' || r < 1) return [];
    const dist = Math.hypot(HOME[0] - fl.pos[0], HOME[1] - fl.pos[1]);
    const phase = r === 1 ? 'CLIMB' : r === 2 ? 'HOME' : r === 3 ? 'DESCEND' : 'LANDED';
    return [
      { label: 'Rescue', value: phase, small: true },
      { label: 'Home', value: `${Math.round(dist)} m` }
    ];
  },

  range: {
    title: 'Mountain valley',
    brief: 'Cross the saddle, skim the lake, orbit the tower, tour the farm — then cut the link and let Rescue bring it home.',
    field: 60,
    pad: [20, 6], // must match HOME above
    ground: '#cfd8c0',
    camTilt: 15,
    keepGates: false,
    prims: [
      // winding river, running north towards the lake
      { t: 'flat', x: 15, y: 12, w: 3, d: 9, yaw: -25, col: '#7ab8c4' },
      { t: 'flat', x: 16.5, y: 19, w: 3, d: 9, yaw: 15, col: '#7ab8c4' },
      { t: 'flat', x: 14.5, y: 26, w: 3, d: 9, yaw: -20, col: '#7ab8c4' },
      { t: 'flat', x: 15.5, y: 33, w: 3, d: 9, yaw: 10, col: '#7ab8c4' },
      // the lake
      { t: 'disc', x: 45, y: 40, r: 8, col: '#7ab8c4' },
      // the saddle: a high ridge west of the pass, a lower one east
      { t: 'box', x: 21, y: 38, w: 6, d: 14, h: 12, yaw: 20, col: '#b9c4a0' },
      { t: 'box', x: 39.5, y: 26.5, w: 6, d: 18, h: 8, yaw: -20, col: '#b9c4a0' },
      // radio tower: mast, three crossarms, red beacon
      { t: 'pole', x: 50, y: 12, h: 40, col: '#8a8f93' },
      { t: 'box', x: 50, y: 12, z: 30, w: 5, d: 0.4, h: 0.4, col: '#8a8f93' },
      { t: 'box', x: 50, y: 12, z: 34, w: 4, d: 0.4, h: 0.4, col: '#8a8f93' },
      { t: 'box', x: 50, y: 12, z: 38, w: 3, d: 0.4, h: 0.4, col: '#8a8f93' },
      { t: 'cyl', x: 50, y: 12, z: 39.8, r: 0.22, h: 0.7, col: '#e2483d' },
      // the farm
      { t: 'house', x: 8, y: 22, w: 8, d: 6, h: 3 },
      { t: 'house', x: 10, y: 40, w: 6, d: 8, h: 4, col: '#b05a4a', roofCol: '#8a4a3a' },
      // power line along the north fence
      { t: 'pole', x: 10, y: 50, h: 7, col: '#9c7a58' },
      { t: 'pole', x: 20, y: 50, h: 7, col: '#9c7a58' },
      { t: 'pole', x: 30, y: 50, h: 7, col: '#9c7a58' },
      { t: 'pole', x: 40, y: 50, h: 7, col: '#9c7a58' },
      // scattered trees
      { t: 'tree', x: 6, y: 10, h: 6 },
      { t: 'tree', x: 26, y: 10, h: 5 },
      { t: 'tree', x: 34, y: 8, h: 7 },
      { t: 'tree', x: 54, y: 24, h: 6 },
      { t: 'tree', x: 48, y: 50, h: 5 },
      { t: 'tree', x: 30, y: 46, h: 6 },
      { t: 'tree', x: 16, y: 46, h: 5 }
    ],
    goals: [
      { x: 30, y: 32, z: 9, r: 2, heading: 45, label: 'CROSS THE SADDLE' },
      { x: 45, y: 40, z: 3, r: 3, label: 'LAKE FLYBY' },
      { x: 50, y: 12, z: 20, r: 4, label: 'TOWER ORBIT' },
      { x: 8, y: 22, z: 4, r: 2.5, heading: 180, label: 'FARM TOUR' },
      { x: 20, y: 6, z: 0.8, r: 2, label: 'HOME LAND' }
    ]
  }
};
