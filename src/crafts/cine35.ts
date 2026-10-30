/**
 * Fig. 03 — the 3-inch cinewhoop (CineLog35-style ducted cine rig).
 *
 * 147 mm wheelbase, four 2004 motors turning 3-inch tri-blades inside printed
 * ducts with bumper struts, an F7 + 35A 4-in-1 stack, a DJI O3-style digital
 * air unit (heatsink fins, two antennas) and a naked action cam on a TPU
 * mount. Built for one job: smooth close-range video through gaps people walk
 * through. The physics override scales the sticks — the cine feel.
 */

import {
  Vec3,
  Tone,
  INK,
  path3,
  fillPath,
  ink,
  matOf
} from '../engine/core';
import { FR, rad } from '../engine/frames';
import type { Frame } from '../engine/frames';
import { obox, ocyl, odisc, otext, tube, glowDot, propDisc } from '../engine/oshapes';
import { CARBON, PCB, SILK, WIRE, LEDBODY, TIN, GOLD } from '../engine/materials';
import type { StatItem } from '../engine/shell';
import type { CraftRecord, DrawOpt, DrawAdd } from '../types';

/* ------------------------------------------------------------------ */
/* geometry + materials                                                */
/* ------------------------------------------------------------------ */

/** Model drawn at ~1.6x: 147 mm wheelbase -> 231 mm motor to motor. */
const MPOS: Array<[number, number, string, 'CW' | 'CCW']> = [
  [-82, -82, 'M1', 'CW'],
  [82, -82, 'M2', 'CCW'],
  [-82, 82, 'M3', 'CCW'],
  [82, 82, 'M4', 'CW']
];

/** Printed duct plastic — the craft's signature colour. */
const DUCT: Tone = matOf('#3a3f45');
/** Soft TPU: camera mount, bumpers. */
const TPU: Tone = matOf('#b9b3a6');
/** Naked action cam body. */
const NAKED: Tone = matOf('#33312e');
/** Grey cine props (read against the dark duct bore). */
const PROP: Tone = { l: '#c8ced4', m: '#a6adb4', d: '#6a7076' };
const STRAP: Tone = { l: '#ef6a4c', m: '#cf5038', d: '#4a2219' };
const ANTENNA: Tone = { l: '#ece6d6', m: '#cfc9b6', d: '#a39d8a' };
const FAULTYCAP: Tone = { l: '#7a6a5a', m: '#5d5145', d: '#3d352c' };

/** Battery looks by design key (front edge fixed at x = 14, on the top plate). */
const BATT_LOOK: Record<string, { col: string; lab: string; long: number; h: number }> = {
  '4s1100': { col: '#2b2a28', lab: '4S 1100', long: 44, h: 26 },
  '4s850': { col: '#3a5f3a', lab: '4S 850', long: 38, h: 22 },
  '6s850': { col: '#2f5fa8', lab: '6S 850', long: 41, h: 24 }
};

export const cine35: CraftRecord = {
  key: 'cine35',
  fig: 3,
  name: '3-inch cinewhoop',
  sub: 'ducted, smooth video',
  hint: 'slow is smooth, smooth is the whole point',
  noun: 'cinewhoop',
  palette: 'mint',
  log: 'betaflight',
  mat: 300,
  benchH: 150,
  flyScale: 3,
  flyVB: 7000,
  fpvProps: true,
  drag: 0.07, // four buckets of printed plastic hanging in the wind
  hitR: 0.15,
  kThrust: 0.175,
  gPerW: 3.4,
  minTW: 2.2,
  maxKvCells: 12075,
  design: { batt: '4s1100', motor: '2004-3000', prop: '3x3x3' },

  batts: {
    '4s1100': { name: '4S 1100 mAh', cells: 4, mah: 1100, g: 128, price: 26, col: '#2b2a28', lab: '4S 1100' },
    '4s850': { name: '4S 850 mAh', cells: 4, mah: 850, g: 98, price: 22, col: '#3a5f3a', lab: '4S 850' },
    '6s850': { name: '6S 850 mAh', cells: 6, mah: 850, g: 140, price: 34, col: '#2f5fa8', lab: '6S 850' }
  },
  motors: {
    '2004-3000': { name: '2004 3000KV', kv: 3000, g: 19, price: 21, forCells: 4 },
    '2004-1950': { name: '2004 1950KV', kv: 1950, g: 19, price: 22, forCells: 6 },
    '1404-4600': { name: '1404 4600KV', kv: 4600, g: 10, price: 16, sz: 0.32 }
  },
  props: {
    '3x3x3': { name: '3x3x3 tri-blade', pf: 1.0, eff: 1.0, g: 2.3, price: 3 },
    '3x2x5': { name: '3x2x5 five-blade (quiet)', pf: 0.92, eff: 0.94, g: 2.6, price: 4 },
    '3x3.5x3': { name: '3x3.5x3 (punchy)', pf: 1.08, eff: 0.92, g: 2.5, price: 3 }
  },
  fixed: [
    { id: 'FRAME', name: 'cine frame: carbon plate + arms', g: 62, price: 55, cat: 'Mechanical' },
    { id: 'DUCTS', name: 'printed duct + bumper set', g: 52, price: 0, cat: 'Mechanical' },
    { id: 'ESC', name: '35A 4-in-1 ESC', g: 7, price: 40, cat: 'Electrical' },
    { id: 'FC', name: 'F7 flight controller', g: 6, price: 40, cat: 'Electrical' },
    { id: 'O3', name: 'DJI O3 air unit + camera', g: 36, price: 229, cat: 'Electrical' },
    { id: 'RX', name: 'ELRS 2.4 GHz receiver', g: 2, price: 18, cat: 'Electrical' },
    { id: 'XT60', name: 'XT60 pigtail + low-ESR cap', g: 10, price: 4, cat: 'Electrical' },
    { id: 'TOP', name: 'top plate + standoffs', g: 12, price: 6, cat: 'Mechanical' },
    { id: 'STRAP', name: 'battery strap + pad', g: 4, price: 3, cat: 'Mechanical' },
    { id: 'NAKED', name: 'naked action cam', g: 36, price: 199, cat: 'Electrical' }
  ],

  parts: [
    {
      id: 'FRAME',
      name: 'CineWhoop frame: carbon plate + short arms (147 mm wheelbase)',
      short: 'FRAME',
      z: 0,
      what: 'A squarish carbon plate with four stubby arms — the motors sit close in so everything fits inside the printed ducts. Carbon is stiff, light, and conducts: never let a bare battery lead touch it.'
    },
    {
      id: 'MOTORS',
      name: '4 brushless motors (2004 size)',
      short: 'MOTORS',
      z: 1,
      after: ['FRAME'],
      what: '2004 stators: 20 mm across, 4 mm tall. Small — but four of them swinging 3-inch props inside ducts give about 3:1 thrust to weight, which is plenty when the flying is slow.'
    },
    {
      id: 'ESC',
      name: '35A 4-in-1 ESC',
      short: 'ESC',
      z: 2,
      after: ['FRAME'],
      what: 'Four speed controllers on one board, DSHOT600. Bidirectional DShot reports prop RPM back to the FC so the RPM filter can notch out motor noise — the difference between jello and clean 4K.'
    },
    {
      id: 'WIRES',
      name: 'Motor wires soldered to the ESC',
      short: 'MOTOR WIRES',
      z: 2,
      after: ['MOTORS', 'ESC'],
      what: 'Three wires per motor, any order — direction is set in the ESC configurator, not by soldering. Keep them short and twisted: they live right under the naked camera.'
    },
    {
      id: 'FC',
      name: 'F7 flight controller',
      short: 'FLIGHT CTRL',
      z: 3,
      after: ['ESC'],
      polar: ['arrow forward', 'arrow backward'],
      what: 'A gyroscope + CPU running Betaflight thousands of times a second, plus a DJI connector for the air unit. The arrow must point at the nose — in a hallway there is no time for it to correct the wrong way.'
    },
    {
      id: 'XT60',
      name: 'XT60 pigtail + low-ESR capacitor',
      short: 'XT60 + CAP',
      z: 2,
      after: ['ESC'],
      polar: ['stripe to minus', 'stripe to plus'],
      what: 'The power lead plus a capacitor that soaks up the voltage spikes four ESCs make when they chop current. Polarised: the stripe goes to minus. Backwards, it vents — next to a LiPo, that is a fire.'
    },
    {
      id: 'CAM',
      name: 'O3 camera on a 20° tilt mount',
      short: 'FPV CAMERA',
      z: 2,
      after: ['FRAME'],
      what: 'The FPV camera half of the air unit, tilted up 20°: cine flying is slow, so you want the horizon low in frame rather than a racer\'s 35°. Its ribbon cable runs back to the air unit body.'
    },
    {
      id: 'O3AIR',
      name: 'O3 air unit (digital video)',
      short: 'O3 AIR UNIT',
      z: 4,
      after: ['FC'],
      what: 'The 36 g heart of the system: low-latency digital video to the goggles with the Betaflight OSD drawn over it via MSP DisplayPort. The fins dump its heat; the two antennas are true diversity.'
    },
    {
      id: 'RX',
      name: 'ELRS receiver',
      short: 'RECEIVER',
      z: 4,
      after: ['FC'],
      what: 'ExpressLRS on 2.4 GHz: control at 500 Hz with a LoRa long-range fallback. Indoors the walls cost you link margin — two antennas at 90° so one is always out of the carbon shadow.'
    },
    {
      id: 'TOP',
      name: 'Top plate + standoffs',
      short: 'TOP PLATE',
      z: 5,
      after: ['FC', 'CAM', 'O3AIR', 'RX'],
      what: 'Squeezes the stack into a rigid sandwich and carries the battery on a strap. On a cine build the top plate also gives the TPU camera mount something stiff to bolt to.'
    },
    {
      id: 'NAKEDCAM',
      name: 'Naked action cam on a TPU mount',
      short: 'NAKED CAM',
      z: 6,
      after: ['TOP'],
      what: 'An action cam stripped of its case: 36 g instead of 116 g — on a 440 g craft that is nearly a fifth of the weight. It records 4K to its own card; the gyro log is what stabilises the footage later.'
    },
    {
      id: 'BATT',
      name: 'LiPo battery, top-mounted + strap',
      short: 'BATTERY',
      z: 7,
      after: ['TOP', 'XT60'],
      what: 'Top-mounted: when you clip a doorway and flip, the ducts and top plate hit first, not the LiPo. 4.2 V per cell full, 3.5 V per cell is land-now.'
    },
    {
      id: 'PROPS',
      name: '3-inch tri-blade propellers',
      short: 'PROPS',
      z: 8,
      after: ['MOTORS', 'TOP'],
      polar: ['props in (correct)', 'swapped CW/CCW'],
      what: 'Two spin clockwise, two counter-clockwise so the torque cancels. They go on LAST — inside a printed duct, a loose prop has nowhere to go but through the duct wall.'
    },
    {
      id: 'DUCTS',
      name: 'Printed ducts + bumpers',
      short: 'DUCTS',
      z: 9,
      after: ['MOTORS', 'ESC'],
      what: 'Four printed shrouds with bumper struts. They protect the props (and the walls), and at cine speeds they add a little static thrust. The bill: 52 g of plastic, drag at speed, and a wash of prop noise the mic will pick up.'
    }
  ],

  mpos: MPOS,
  wrongMotor: 3,

  /* ---------------------------------------------------------------- */
  /* drawing                                                          */
  /* ---------------------------------------------------------------- */

  draw(f: Frame, add: DrawAdd, opt: DrawOpt): void {
    const m = opt.m;
    const has = opt.has;
    const U = opt.U;
    const orient = opt.orient;

    /* ---- frame: squarish plate + 4 stubby arms ---- */
    if (has('FRAME')) {
      const F = U('FRAME');
      add([0, 0, -1.5], obox(F, -54, 54, -54, 54, -3, 0, CARBON, 0.9).svg, 'FRAME');
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1]
      ]) {
        const A = FR.Rz(F, rad((Math.atan2(sy, sx) * 180) / Math.PI));
        add([sx * 52, sy * 52, -2], obox(A, 38, 104, -9, 9, -5, 0, CARBON, 0.9).svg, 'FRAME');
      }
    }

    /* ---- motors: 2004 bells inside the duct footprints ---- */
    if (has('MOTORS')) {
      const F = U('MOTORS');
      MPOS.forEach(([mx, my], i) => {
        const M = FR.T(F, mx, my, 0);
        let svg = ocyl(M, 12, 0, 5, CARBON, 1, 16).svg;
        svg += ocyl(M, 13.5, 5, 19, m, 1, 16).svg;
        const spin = opt.spin[i] || 0;
        for (let b = 0; b < 3; b++) {
          const a = spin * (i % 2 ? -1 : 1) + (b * Math.PI * 2) / 3;
          svg += odisc(M, 2.6, 19.4, INK, 0, 8, Math.cos(a) * 8, Math.sin(a) * 8);
        }
        svg += ocyl(M, 2.2, 19, 23, TIN, 0.7, 10).svg;
        add([mx, my, 12], svg, 'MOTORS');
      });
    }

    /* ---- ESC: 4-in-1 on the stack ---- */
    if (has('ESC')) {
      const F = U('ESC');
      let svg = obox(F, -19, 19, -19, 19, 3, 4.6, PCB, 0.8).svg;
      for (const [cx, cy] of [
        [-11, -11],
        [11, -11],
        [-11, 11],
        [11, 11]
      ]) {
        svg += obox(F, cx - 3.5, cx + 3.5, cy - 3.5, cy + 3.5, 4.6, 6.2, TIN, 0.6).svg;
      }
      add([0, 0, 5], svg, 'ESC');
    }

    /* ---- motor wires ---- */
    if (has('WIRES')) {
      const F = U('WIRES');
      let svg = '';
      MPOS.forEach(([mx, my], i) => {
        const a: Vec3 = FR.pt(F, [mx * 0.64, my * 0.64, 7]);
        const b: Vec3 = FR.pt(F, [Math.sign(mx) * 17, Math.sign(my) * 17, 4]);
        const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 6.5];
        svg += tube([a, mid, b], 0.9, i % 2 ? WIRE.org : WIRE.blu);
      });
      add([0, 0, 6], svg, 'WIRES');
    }

    /* ---- flight controller ---- */
    if (has('FC')) {
      const F = U('FC');
      let svg = obox(F, -16, 16, -16, 16, 8, 9.6, PCB, 0.8).svg;
      svg += obox(F, -5, 5, -5, 5, 9.6, 12, TIN, 0.6).svg; // MCU
      svg += obox(F, 8, 14, -13, -7, 9.6, 10.4, TPU, 0.5).svg; // DJI connector
      const flip = orient('FC') ? -1 : 1;
      const arrow: Vec3[] = [
        FR.pt(F, [12 * flip, 0, 12.3]),
        FR.pt(F, [3 * flip, 5.5, 12.3]),
        FR.pt(F, [3 * flip, -5.5, 12.3])
      ];
      svg += fillPath(path3(arrow), SILK) + ink(path3(arrow), 0.7);
      if (opt.power) {
        svg += odisc(F, 2.5, 9.7, '#3e86d9', 0, 10, -12, 10);
        svg += glowDot(FR.pt(F, [-12, 10, 10]), '#3e86d9', 6);
      }
      add([0, 0, 11], svg, 'FC');
    }

    /* ---- XT60 pigtail + capacitor (rear-left, clear of the air unit) ---- */
    if (has('XT60')) {
      const F = U('XT60');
      let svg = '';
      svg += tube([FR.pt(F, [-30, 18, 6]), FR.pt(F, [-48, 20, 7])], 1.4, WIRE.red);
      svg += tube([FR.pt(F, [-30, 24, 6]), FR.pt(F, [-48, 26, 7])], 1.4, WIRE.blk);
      svg += obox(F, -64, -50, 14, 28, 2, 12, GOLD, 0.9).svg;
      const capMat = opt.fault ? FAULTYCAP : LEDBODY;
      svg += ocyl(F, 4.5, 1, 13, capMat, 1, 14, -52, 34).svg;
      const stripeOff = orient('XT60') ? 3.2 : -3.2;
      svg += ocyl(F, 4.5, 1, 13, { l: '#e8e3d0', m: '#cfc9b6', d: '#a39d8a' }, 0.6, 14, -52 + stripeOff, 34).svg;
      add([-56, 22, 7], svg, 'XT60');
    }

    /* ---- O3 camera: body + 20° lens + ribbon to the air unit ---- */
    if (has('CAM')) {
      const F = U('CAM');
      let svg = '';
      svg += obox(F, 34, 50, 12, 16, 0, 24, CARBON, 0.8).svg;
      svg += obox(F, 34, 50, -16, -12, 0, 24, CARBON, 0.8).svg;
      svg += obox(F, 34, 50, -10, 10, 3, 21, m, 0.9).svg;
      const lensF = FR.Ry(FR.T(F, 50, 0, 13), rad(20));
      svg += ocyl(lensF, 7, 0, 11, CARBON, 0.9, 16).svg;
      svg += odisc(lensF, 5.8, 11.2, '#141416', 0.5, 16);
      if (has('O3AIR')) {
        svg += tube([FR.pt(F, [36, 0, 14]), FR.pt(F, [8, 0, 16]), FR.pt(F, [-24, 0, 18])], 1.1, WIRE.org);
      }
      add([42, 0, 13], svg, 'CAM');
    }

    /* ---- O3 air unit: pokes out past the top plate, fins + 2 antennas ---- */
    if (has('O3AIR')) {
      const F = U('O3AIR');
      let svg = obox(F, -58, -18, -19, 19, 12, 24, matOf('#2c2c30'), 0.95).svg;
      for (let i = 0; i < 4; i++) {
        const fx = -53 + i * 9.5;
        svg += obox(F, fx - 1.25, fx + 1.25, -17, 17, 24, 27.5, TIN, 0.7).svg;
      }
      svg += tube([FR.pt(F, [-56, -8, 22]), FR.pt(F, [-68, -18, 32]), FR.pt(F, [-78, -26, 42])], 1.1, WIRE.wht);
      svg += tube([FR.pt(F, [-56, 8, 22]), FR.pt(F, [-68, 18, 32]), FR.pt(F, [-78, 26, 42])], 1.1, WIRE.wht);
      svg += ocyl(F, 1.5, 40, 46, ANTENNA, 0.7, 10, -78, -26).svg;
      svg += ocyl(F, 1.5, 40, 46, ANTENNA, 0.7, 10, -78, 26).svg;
      add([-38, 0, 20], svg, 'O3AIR');
    }

    /* ---- ELRS receiver ---- */
    if (has('RX')) {
      const F = U('RX');
      let svg = obox(F, -2, 10, -26, -14, 9.5, 10.8, PCB, 0.7).svg;
      svg += tube([FR.pt(F, [4, -20, 11]), FR.pt(F, [-10, -32, 22])], 0.5, WIRE.wht);
      svg += tube([FR.pt(F, [4, -20, 11]), FR.pt(F, [14, -33, 22])], 0.5, WIRE.wht);
      add([4, -20, 13], svg, 'RX');
    }

    /* ---- top plate + standoffs (battery deck; air unit pokes out the back) ---- */
    if (has('TOP')) {
      const F = U('TOP');
      let svg = '';
      for (const [sx, sy] of [
        [-34, -26],
        [34, -26],
        [-34, 26],
        [34, 26]
      ]) {
        svg += ocyl(F, 3, 0, 30, TIN, 0.8, 10, sx, sy).svg;
      }
      svg += obox(F, -36, 46, -30, 30, 30, 32.5, CARBON, 0.9).svg;
      add([5, 0, 16], svg, 'TOP');
    }

    /* ---- naked action cam on its TPU mount ---- */
    if (has('NAKEDCAM')) {
      const F = U('NAKEDCAM');
      let svg = '';
      svg += obox(F, 22, 50, -15, 15, 32.5, 36, TPU, 0.8).svg;
      svg += obox(F, 22, 46, -11, 11, 36, 50, NAKED, 0.9).svg;
      const lensF = FR.Ry(FR.T(F, 46, 0, 43), rad(90));
      svg += ocyl(lensF, 5.5, 0, 9, matOf('#26242a'), 0.8, 14).svg;
      svg += odisc(lensF, 4.4, 9.2, '#141416', 0.5, 14);
      svg += otext(F, 34, 0, 50.4, '4K', 8, SILK);
      add([35, 0, 41], svg, 'NAKEDCAM');
    }

    /* ---- battery, top-mounted, strapped ---- */
    if (has('BATT')) {
      const F = U('BATT');
      const look = BATT_LOOK[opt.design.batt] ?? BATT_LOOK['4s1100'];
      const rear = 14 - look.long;
      const top = 32.5 + look.h;
      let svg = obox(F, rear, 14, -22, 22, 32.5, top, { l: look.col, m: '#413f3d', d: '#26241f' } as Tone, 1).svg;
      svg += obox(F, rear + 2, rear + 10, -23, 23, top, top + 2.2, STRAP, 0.8).svg;
      svg += otext(F, rear + look.long / 2, 0, top + 0.4, look.lab, 8, SILK);
      if (opt.plugged && has('XT60')) {
        svg += tube([FR.pt(F, [rear + 3, 14, 46]), FR.pt(F, [-50, 34, 28]), FR.pt(F, [-56, 24, 13])], 1.4, WIRE.red);
        svg += tube([FR.pt(F, [rear + 3, 20, 46]), FR.pt(F, [-50, 38, 28]), FR.pt(F, [-56, 30, 13])], 1.4, WIRE.blk);
      }
      add([rear + look.long / 2, 0, 45], svg, 'BATT');
    }

    /* ---- props: on the shaft, or in the duct mouths once shrouded ---- */
    if (has('PROPS') && !opt.broken) {
      const F = U('PROPS');
      const swapped = orient('PROPS') === 1;
      const pz = has('DUCTS') ? 37.5 : 24;
      MPOS.forEach(([mx, my, _id, dir], i) => {
        const ccw = (dir === 'CCW') !== swapped;
        const rate = opt.rpm[i] || 0;
        if (rate > 0.12) {
          add([mx, my, 65], propDisc(FR.T(F, mx, my, pz + 1), 40, rate, opt.spin[i] ?? 0), 'PROPS');
          return;
        }
        const P = FR.T(F, mx, my, pz);
        let svg = '';
        const spin = opt.spin[i] || 0;
        for (let b = 0; b < 3; b++) {
          const a = spin * (ccw ? -1 : 1) + (b * Math.PI * 2) / 3;
          const B = FR.Rz(FR.T(P, 0, 0, 0), a);
          const bladeF = FR.Rx(B, ccw ? rad(14) : rad(-14));
          svg += obox(bladeF, 5, 39, -5, 5, -0.6, 0.6, PROP, 0.7).svg;
        }
        svg += ocyl(P, 6, -1.8, 1.8, CARBON, 0.8, 10).svg;
        add([mx, my, 64], svg, 'PROPS');
      });
    }

    /* ---- ducts: wall + bore + 3 bumper struts, drawn around everything ---- */
    if (has('DUCTS')) {
      const F = U('DUCTS');
      MPOS.forEach(([mx, my]) => {
        const D = FR.T(F, mx, my, 0);
        let svg = ocyl(D, 47, 6, 36, DUCT, 1, 26).svg;
        svg += odisc(D, 42.5, 36.2, '#252a31', 0.7, 26);
        svg += odisc(D, 36, 36.5, '#12151a', 0, 26);
        add([mx, my, 62], svg, 'DUCTS');
        let struts = '';
        for (let s = 0; s < 3; s++) {
          const S = FR.Rz(D, rad(90 + s * 120));
          struts += obox(S, 45, 60, -6, 6, 0, 14, DUCT, 0.9).svg;
        }
        add([mx, my, 63], struts, 'DUCTS');
      });
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
      pts.push(FR.pt(f, [sx * 115, sy * 115, 0]));
      pts.push(FR.pt(f, [sx * 82, sy * 82, 36]));
    }
    pts.push(FR.pt(f, [0, 0, 60]));
    return pts;
  },

  tags: [
    ['DUCTS', [98, 98, 30], 34, 26],
    ['MOTORS', [-88, -88, 22], -42, -30],
    ['XT60', [-58, 30, 13], -48, 28],
    ['O3AIR', [-48, -10, 26], -44, -32],
    ['FC', [4, 14, 13], 30, -50],
    ['CAM', [50, -14, 20], 40, 36],
    ['NAKEDCAM', [38, 0, 51], 42, -32],
    ['BATT', [-8, -20, 60], -30, -46]
  ],

  /* ---------------------------------------------------------------- */
  /* wiring                                                           */
  /* ---------------------------------------------------------------- */

  wiring: {
    nodes(d, c) {
      return {
        BATT: [20, 238, 'BATTERY', (c.battName as string) || '4S 1100 mAh', '#e2483d'],
        XT60: [190, 238, 'XT60 + CAP', '1000 uF 35 V', '#e2483d'],
        ESC: [360, 238, '35A 4-IN-1', 'BLHeli_32, DSHOT600', '#e2483d'],
        MOTORS: [600, 238, 'MOTORS x4', (c.motorName as string) || '2004 3000KV', '#f08a2b'],
        FC: [360, 70, 'FLIGHT CTRL', 'F7 + DJI port', '#3e86d9'],
        RX: [140, 70, 'ELRS', '2.4 GHz, 500 Hz', '#8c4bd1'],
        O3AIR: [600, 14, 'O3 AIR UNIT', 'digital, 36 g', '#43a35a'],
        NAKEDCAM: [600, 116, 'NAKED CAM', '4K, in the mount', '#f2c230']
      };
    },
    links: [
      { from: 'BATT', to: 'XT60', kind: 'power', label: 'XT60' },
      { from: 'XT60', to: 'ESC', kind: 'power', label: 'VBAT + GND' },
      { from: 'ESC', to: 'MOTORS', kind: 'motor', label: '3-phase x4' },
      { from: 'ESC', to: 'FC', kind: 'power', label: 'VBAT' },
      { from: 'ESC', to: 'FC', kind: 'data', label: 'DShot + RPM' },
      { from: 'FC', to: 'RX', kind: 'data', label: 'UART1', label2: '+ 5 V' },
      { from: 'FC', to: 'O3AIR', kind: 'data', label: 'UART + 10 V', label2: 'MSP DisplayPort' },
      { from: 'FC', to: 'NAKEDCAM', kind: 'video', label: 'records solo; gyro for stabilisation' }
    ]
  },

  /* ---------------------------------------------------------------- */
  /* content                                                          */
  /* ---------------------------------------------------------------- */

  overview: `<p>A cinewhoop is a micro quad built to carry a camera through gaps people walk through: doorways, hallways, stairwells, the space between branches. This one is a 147 mm wheelbase ducted frame — four 2004 motors turning 3-inch tri-blades inside printed ducts, an F7 stack, a digital air unit and a naked action cam, for about 440 g all-up.</p>
<p>The ducts are the point. They keep the props (and the walls, and the dog) safe, and at cine speeds they even add a little static thrust. The bill comes later: 52 g of plastic, a wall of drag that caps your top speed, and a wash of prop noise the microphone will pick up forever. Small props are also thirsty — about 3.4 g/W at hover against 5+ for a 5-inch — so the flight times read short next to a freestyle quad.</p>
<p>It runs two cameras. You fly through the low-latency digital link — with the Betaflight OSD drawn over it via MSP DisplayPort — while the naked action cam records 4K to its own card. Stripping the cam's case saves 80 g, nearly a fifth of this airframe's weight. In post, the gyro log syncs the footage for gyro-based stabilisation (Gyroflow or ReelSteady), and bidirectional DShot feeds the FC prop RPM so the RPM filter kills motor vibration before it becomes jello.</p>`,

  buildCode: `# cine whoop setup, in the Betaflight CLI:
resource
set motor_pwm_protocol = DSHOT600
set vbat_sag_compensation = 100
set rpm_filter_harmonics = 3
set ff_interpolate_sp = avarage  # smooth sticks
serial 1 64 115200 57600 0 115200  # ELRS
# O3 OSD + recording on a switch:
aux 4 MSP_DISPLAYPORT
save`,

  quiz: [
    {
      q: 'Why two cameras?',
      a: ['Backup in case one fails', 'Fly FPV on the O3, record 4K on the naked cam for stabilised footage', 'The FCC requires it'],
      ok: 1
    },
    {
      q: 'What do the ducts cost you?',
      a: ['Nothing — free thrust', 'Weight, drag and noise at speed', 'Shorter radio range'],
      ok: 1
    },
    {
      q: 'What is the gyro log for?',
      a: ['MSP DisplayPort', 'Syncing the 4K footage for gyro-based stabilisation', 'Arming safety'],
      ok: 1
    },
    {
      q: 'Bidirectional DShot gives the FC...',
      a: ['prop RPM for the RPM filter, killing jello', 'More thrust', 'Longer range'],
      ok: 1
    }
  ],

  practice: 'Fly the house tour in cine mode without touching a wall. Then fly it in angle mode: feel what stick scaling buys.',

  /* ---------------------------------------------------------------- */
  /* flight: cine modes + scaled sticks + the house range             */
  /* ---------------------------------------------------------------- */

  modes: {
    alt: {
      title: 'Altitude hold (easy)',
      code: 'set alt_hold_throttle_deadband = 15\naux 1 ANGLE\naux 2 ALTHOLD',
      hint: 'The FC holds height: W/S climb + descend',
      alt: true
    },
    angle: {
      title: 'Angle mode',
      code: 'set angle_limit = 38\nset p_level = 50\nset i_level = 50',
      hint: 'Self-levelling; throttle stays where you put it'
    },
    cine: {
      title: 'Cine mode',
      code: 'set rc_smoothing = ON\nset rc_smoothing_auto_factor = 30\nset roll_rc_rate = 60\nset roll_srate = 40\nset p_roll = 30',
      hint: 'Scaled sticks for buttery footage',
      alt: true
    },
    acro: {
      title: 'Acro (rate) mode',
      code: 'set roll_rc_rate = 100\nset roll_srate = 70  # ~540 deg/s\nset p_roll = 45\nset d_roll = 40',
      hint: 'Full rates, no self-level — take it outside'
    },
    race: {
      title: 'Gate race',
      code: 'set osd_timer_1 = ON\nset osd_stat_max_spd = ON',
      hint: '5 gates in order; the timer starts at gate 1'
    }
  },

  physics(fl, dt, ctx) {
    // Cine feel: scale the pilot's sticks, run the stock multirotor step,
    // then put the raw values back (the engine reads the same stick object).
    const s = ctx.stick;
    const roll = s.roll;
    const pitch = s.pitch;
    const yaw = s.yaw;
    const thr = s.thr;
    s.roll = roll * 0.45;
    s.pitch = pitch * 0.45;
    s.yaw = yaw * 0.35;
    s.thr = thr * 0.6;
    ctx.stock(fl, dt);
    s.roll = roll;
    s.pitch = pitch;
    s.yaw = yaw;
    s.thr = thr;
  },

  range: {
    title: 'The house tour',
    brief: 'In the front door, down the hall, out the slider, round the pool, back over the roof.',
    field: 50,
    pad: [4, 25],
    ground: '#d5e0c8',
    camTilt: 20,
    prims: [
      // ground: driveway, front path, porch, floors, patio, pool
      { t: 'flat', x: 10, y: 13.15, w: 10, d: 4, col: '#ccc6b6', label: 'DRIVE' },
      { t: 'flat', x: 8.2, y: 25, w: 5.6, d: 1.6, col: '#ddd8c6' },
      { t: 'flat', x: 11.4, y: 25, w: 1.6, d: 2.6, col: '#d8cfb8' },
      { t: 'flat', x: 18, y: 25, w: 11.6, d: 15.6, col: '#e6e0d0' },
      { t: 'flat', x: 14.2, y: 23.2, w: 4, d: 4.4, col: '#dbd4c2', label: 'HALL' },
      { t: 'flat', x: 27, y: 25, w: 5, d: 7, col: '#cfc9b9', label: 'PATIO' },
      { t: 'flat', x: 42, y: 25, w: 5, d: 8, col: '#7ab8c4', label: 'POOL' },
      // front wall with a 1 m door gap (two segments + lintel)
      { t: 'box', x: 12, y: 20.75, w: 0.3, d: 7.5, h: 3, col: '#e2dccb' },
      { t: 'box', x: 12, y: 29.25, w: 0.3, d: 7.5, h: 3, col: '#e2dccb' },
      { t: 'box', x: 12, y: 25, z: 2.1, w: 0.36, d: 1.1, h: 0.9, col: '#e2dccb' },
      // side walls
      { t: 'box', x: 18, y: 17.15, w: 12.3, d: 0.3, h: 3, col: '#dcd5c2' },
      { t: 'box', x: 18, y: 32.85, w: 12.3, d: 0.3, h: 3, col: '#dcd5c2' },
      // interior wall with the hallway doorway
      { t: 'box', x: 16.5, y: 18.6, w: 0.25, d: 3.2, h: 3, col: '#d5cdbb' },
      { t: 'box', x: 16.5, y: 27.4, w: 0.25, d: 11.2, h: 3, col: '#d5cdbb' },
      { t: 'box', x: 16.5, y: 21, z: 2.1, w: 0.3, d: 1.6, h: 0.9, col: '#d5cdbb' },
      // back wall with the 3 m slider gap
      { t: 'box', x: 24, y: 20.25, w: 0.3, d: 6.5, h: 3, col: '#e2dccb' },
      { t: 'box', x: 24, y: 29.75, w: 0.3, d: 6.5, h: 3, col: '#e2dccb' },
      { t: 'box', x: 24, y: 25, z: 2.2, w: 0.36, d: 3, h: 0.8, col: '#e2dccb' },
      // flat modern roof
      { t: 'box', x: 18, y: 25, z: 3, w: 12.6, d: 16.6, h: 0.25, col: '#97a1a8' },
      // garage (attached) + door
      { t: 'box', x: 18, y: 13.15, w: 6, d: 8.3, h: 2.6, col: '#d9d3c4' },
      { t: 'box', x: 18, y: 13.15, z: 2.6, w: 6.5, d: 8.6, h: 0.2, col: '#97a1a8' },
      { t: 'box', x: 14.93, y: 13.15, w: 0.14, d: 5, h: 2, col: '#cfc7b4' },
      // mailbox
      { t: 'pole', x: 6, y: 30.5, h: 1.2 },
      { t: 'box', x: 6, y: 30.5, z: 1.2, w: 0.3, d: 0.3, h: 0.3, col: '#d86a4c' },
      // trees
      { t: 'tree', x: 7, y: 40, h: 6 },
      { t: 'tree', x: 30, y: 37, h: 7 },
      // back fence with a gate gap
      { t: 'box', x: 47, y: 15.5, w: 0.15, d: 13, h: 1.2, col: '#c9c2b2' },
      { t: 'box', x: 47, y: 33.5, w: 0.15, d: 15, h: 1.2, col: '#c9c2b2' },
      { t: 'box', x: 35.5, y: 41, w: 23, d: 0.15, h: 1.2, col: '#c9c2b2' },
      { t: 'box', x: 35.5, y: 9, w: 23, d: 0.15, h: 1.2, col: '#c9c2b2' }
    ],
    goals: [
      { x: 12, y: 25, z: 1.05, r: 0.5, heading: 0, label: 'FRONT DOOR' },
      { x: 16.5, y: 21, z: 1.05, r: 0.6, heading: 0, label: 'HALLWAY' },
      { x: 24, y: 25, z: 1.1, r: 0.8, heading: 0, label: 'SLIDER' },
      { x: 42, y: 25, z: 2.5, r: 1.7, label: 'POOL ORBIT' },
      { x: 18, y: 25, z: 5, r: 1.5, heading: 90, label: 'OVER THE ROOF' },
      { x: 4, y: 25, z: 0.8, r: 1.6, label: 'LAND' }
    ]
  },

  /* ---------------------------------------------------------------- */
  /* calculator + warnings                                             */
  /* ---------------------------------------------------------------- */

  calcRows(c) {
    // standard tiles, but the last one speaks cine: gentle flying, not
    // freestyle punches, so the usable time sits closer to hover.
    return [
      { label: 'All-up weight', value: `${Math.round(c.auw)} g` },
      { label: 'Thrust : weight', value: `${c.tw.toFixed(1)} : 1` },
      { label: 'Hover throttle', value: `${Math.round(c.hoverThr * 100)} %` },
      { label: 'Max current', value: `${Math.round(c.maxA)} A` },
      { label: 'Hover time', value: `${c.hoverMin.toFixed(1)} min` },
      { label: 'Cine time', value: `${(c.hoverMin * 0.65).toFixed(1)} min` }
    ];
  },

  warnings(d) {
    const out: string[] = [];
    if (d.motor === '1404-4600') {
      out.push('The 1404 is a whoop motor: fine in ducts on 2S, but it has no torque for a 500 g cine rig.');
    }
    return out;
  }
};
