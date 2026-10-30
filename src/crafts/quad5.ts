/**
 * Fig. 01 — the 5-inch freestyle FPV quad (the template craft).
 *
 * Four brushless motors on a true-X carbon frame, a 4-in-1 ESC, an F7 flight
 * controller running Betaflight, an analog camera + VTX, and an ELRS radio
 * link. Default first FPV build.
 */

import {
  Vec3,
  Tone,
  INK,
  path3,
  ink,
  fillPath,
  poly3,
  PALETTES
} from '../engine/core';
import { FR, rad } from '../engine/frames';
import type { Frame } from '../engine/frames';
import { obox, ocyl, odisc, otext, tube, glowDot, propDisc } from '../engine/oshapes';
import { CARBON, PCB, SILK, WIRE, LEDBODY, TIN } from '../engine/materials';
import type { CraftRecord, DrawOpt, DrawAdd } from '../types';

const MPOS: Array<[number, number, string, 'CW' | 'CCW']> = [
  [-79.5, -79.5, 'M1', 'CW'],
  [79.5, -79.5, 'M2', 'CCW'],
  [-79.5, 79.5, 'M3', 'CCW'],
  [79.5, 79.5, 'M4', 'CW']
];

const GOLDMAT: Tone = { l: '#f3d679', m: '#d6b04a', d: '#9c7a26' };
const REDBODY: Tone = { l: '#e2483d', m: '#c23830', d: '#7d1f1a' };

export const quad5: CraftRecord = {
  key: 'quad5',
  fig: 1,
  name: '5-inch freestyle quad',
  sub: 'Betaflight + FPV',
  hint: 'design it, build it, smoke-test it, then fly it',
  noun: 'drone',
  palette: 'tomato',
  log: 'betaflight',
  mat: 280,
  benchH: 130,
  flyScale: 4,
  flyVB: 8000,
  fpvProps: true,
  kThrust: 1.06,
  gPerW: 5.4,
  minTW: 5,
  design: { batt: '6s1100', motor: '2306-1750', prop: '5x4.3x3' },

  batts: {
    '6s1100': { name: '6S 1100 mAh', cells: 6, mah: 1100, g: 178, price: 38, col: '#2b2a28', lab: '6S 1100' },
    '6s1800': { name: '6S 1800 mAh', cells: 6, mah: 1800, g: 282, price: 54, col: '#2f5fa8', lab: '6S 1800' },
    '4s1500': { name: '4S 1500 mAh', cells: 4, mah: 1500, g: 182, price: 30, col: '#d9a520', lab: '4S 1500' }
  },
  motors: {
    '2306-1750': { name: '2306 1750KV', kv: 1750, g: 32, price: 22, forCells: 6 },
    '2207-1950': { name: '2207 1950KV', kv: 1950, g: 34, price: 24, forCells: 6 },
    '2306-2450': { name: '2306 2450KV', kv: 2450, g: 31, price: 20, forCells: 4 }
  },
  props: {
    '5x4.3x3': { name: '5x4.3x3 tri-blade', pf: 1.0, eff: 1.0, g: 4.4, price: 4 },
    '5.1x2.5x3': { name: '5.1x2.5x3 (efficient)', pf: 0.84, eff: 1.18, g: 4.0, price: 4 },
    '5x5x3': { name: '5x5x3 (aggressive)', pf: 1.1, eff: 0.88, g: 4.8, price: 4 }
  },
  fixed: [
    { id: 'FRAME', name: '5" carbon frame', g: 118, price: 39, cat: 'Mechanical' },
    { id: 'ESC', name: '45A 4-in-1 ESC', g: 8, price: 45, cat: 'Electrical' },
    { id: 'FC', name: 'F7 flight controller', g: 7, price: 39, cat: 'Electrical' },
    { id: 'CAM', name: 'analog FPV camera', g: 7, price: 25, cat: 'Electrical' },
    { id: 'VTX', name: '5.8 GHz VTX + antenna', g: 9, price: 30, cat: 'Electrical' },
    { id: 'RX', name: 'ELRS 2.4 GHz receiver', g: 2, price: 18, cat: 'Electrical' },
    { id: 'XT60', name: 'XT60 pigtail + low-ESR cap', g: 12, price: 4, cat: 'Electrical' },
    { id: 'TOP', name: 'top plate + standoffs', g: 22, price: 8, cat: 'Mechanical' },
    { id: 'STRAP', name: 'battery strap + pad', g: 5, price: 4, cat: 'Mechanical' }
  ],

  parts: [
    {
      id: 'FRAME',
      name: 'Carbon frame: bottom plate + arms (225 mm true-X, 5 mm arms)',
      short: 'FRAME',
      z: 0,
      what: '5 mm carbon arms on a true-X bottom plate, 225 mm motor to motor. Carbon is stiff and light, and it conducts: never let a bare battery lead touch it.'
    },
    {
      id: 'MOTORS',
      name: '4 brushless motors',
      short: 'MOTORS',
      z: 1,
      after: ['FRAME'],
      what: 'Outrunners: the shell spins around the windings. KV = rpm per volt with no load, so a 1750KV motor on 6S (22.2 V) turns ~39 000 rpm.'
    },
    {
      id: 'ESC',
      name: '45A 4-in-1 ESC',
      short: 'ESC',
      z: 2,
      after: ['FRAME'],
      what: 'Four speed controllers on one board. Each turns DC from the battery into 3-phase AC for its motor, switching with DSHOT600 ~48 000 times a second.'
    },
    {
      id: 'WIRES',
      name: 'Motor wires soldered to the ESC',
      short: 'MOTOR WIRES',
      z: 2,
      after: ['MOTORS', 'ESC'],
      what: 'Three wires per motor, any order: swapping two of them reverses the motor. Direction is set in the ESC configurator, not by soldering.'
    },
    {
      id: 'FC',
      name: 'F7 flight controller',
      short: 'FLIGHT CTRL',
      z: 3,
      after: ['ESC'],
      polar: ['arrow forward', 'arrow backward'],
      what: 'A gyroscope + CPU running Betaflight 2000 times a second. The arrow printed on it must point at the nose, or it corrects the wrong way.'
    },
    {
      id: 'XT60',
      name: 'XT60 pigtail + low-ESR capacitor',
      short: 'XT60 + CAP',
      z: 2,
      after: ['ESC'],
      polar: ['stripe to minus', 'stripe to plus'],
      what: 'The power lead plus a 1000 uF capacitor that soaks up the voltage spikes four ESCs make when they chop 100 A. Polarised: the stripe goes to minus. Backwards, it vents.'
    },
    {
      id: 'CAM',
      name: 'FPV camera (analog, ~30° tilt)',
      short: 'CAMERA',
      z: 2,
      after: ['FRAME'],
      what: 'A 700 TVL analog camera on a tilt mount. The 30° uptilt matters: at speed the quad pitches forward, and you want the horizon in frame, not the ground.'
    },
    {
      id: 'RX',
      name: 'ELRS receiver',
      short: 'RECEIVER',
      z: 4,
      after: ['FC'],
      what: 'ExpressLRS on 2.4 GHz: control link at 500 Hz with a long-range LoRa fallback. Two antennas at 90° so one is always out of the carbon shadow.'
    },
    {
      id: 'VTX',
      name: '5.8 GHz video transmitter',
      short: 'VTX',
      z: 4,
      after: ['FC'],
      what: 'Sends the camera picture to your goggles at 400 mW. The antenna is a circularly polarised cloverleaf — never power a VTX without one.'
    },
    {
      id: 'TOP',
      name: 'Top plate + standoffs',
      short: 'TOP PLATE',
      z: 5,
      after: ['FC', 'CAM', 'RX', 'VTX'],
      what: 'Aluminium standoffs squeeze the stack into a rigid sandwich and the top plate carries the battery on a strap.'
    },
    {
      id: 'BATT',
      name: 'LiPo battery + strap',
      short: 'BATTERY',
      z: 6,
      after: ['TOP', 'XT60'],
      what: '6S lithium polymer: 22.2 V nominal, 4.2 V per cell full, 3.5 V per cell is land-now. The C rating is how fast you may pull the charge out.'
    },
    {
      id: 'PROPS',
      name: 'Propellers',
      short: 'PROPS',
      z: 7,
      after: ['MOTORS', 'TOP'],
      polar: ['props in (correct)', 'swapped CW/CCW'],
      what: 'Two spin clockwise, two counter-clockwise so the torque cancels. Props go on LAST: a motor test with props on throws the quad at your face.'
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

    /* ---- frame ---- */
    if (has('FRAME')) {
      const F = U('FRAME');
      add([0, 0, 0], obox(F, -56, 56, -23, 23, -3, 0, CARBON, 0.9).svg, 'FRAME');
      // four arms to the motor diagonals
      for (const [mx, my] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1]
      ]) {
        const A = FR.Rz(F, rad((Math.atan2(my, mx) * 180) / Math.PI));
        add([(mx * 58), (my * 58), 0], obox(A, 20, 116, -7, 7, -5, 0, CARBON, 0.9).svg, 'FRAME');
      }
    }

    /* ---- ESC ---- */
    if (has('ESC')) {
      const F = U('ESC');
      let svg = obox(F, -18, 18, -18, 18, 3, 4.6, PCB, 0.8).svg;
      for (const [cx, cy] of [
        [-10, -10],
        [10, -10],
        [-10, 10],
        [10, 10]
      ]) {
        svg += obox(F, cx - 3, cx + 3, cy - 3, cy + 3, 4.6, 6.2, TIN, 0.6).svg;
      }
      add([0, 0, 5], svg, 'ESC');
    }

    /* ---- motor wires ---- */
    if (has('WIRES')) {
      const F = U('WIRES');
      let svg = '';
      MPOS.forEach(([mx, my], i) => {
        const a: Vec3 = FR.pt(F, [mx * 0.84, my * 0.84, 8]);
        const b: Vec3 = FR.pt(F, [Math.sign(mx) * 17, Math.sign(my) * 17, 4]);
        const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 7];
        svg += tube([a, mid, b], 0.9, i % 2 ? WIRE.org : WIRE.blu);
      });
      add([0, 0, 6], svg, 'WIRES');
    }

    /* ---- flight controller ---- */
    if (has('FC')) {
      const F = U('FC');
      let svg = obox(F, -15.5, 15.5, -15.5, 15.5, 10, 11.6, PCB, 0.8).svg;
      svg += obox(F, -5, 5, -5, 5, 11.6, 14, TIN, 0.6).svg; // MCU
      svg += obox(F, 8, 14, -12, -6, 11.6, 12.4, SILK as unknown as Tone, 0.5).svg; // connector
      // direction arrow (flips with orientation)
      const flip = orient('FC') ? -1 : 1;
      const arrowPts: Vec3[] = FR.Ry(F, 0)
        ? [
            FR.pt(F, [12 * flip, 0, 12.6]),
            FR.pt(F, [4 * flip, 5, 12.6]),
            FR.pt(F, [4 * flip, -5, 12.6])
          ]
        : [];
      svg += fillPath(path3(arrowPts), '#fbf8ee') + ink(path3(arrowPts), 0.7);
      if (opt.power) {
        svg += odisc(F, 2.5, 12.6, '#3e86d9', 0, 10, -12, 10);
        svg += glowDot(FR.pt(F, [-12, 10, 12.6]), '#3e86d9', 6);
      }
      add([0, 0, 12], svg, 'FC');
    }

    /* ---- XT60 + cap ---- */
    if (has('XT60')) {
      const F = U('XT60');
      let svg = '';
      // red + black leads
      svg += tube([FR.pt(F, [-74, 4, 7]), FR.pt(F, [-95, 10, 7])], 1.4, WIRE.red);
      svg += tube([FR.pt(F, [-74, -4, 7]), FR.pt(F, [-95, -10, 7])], 1.4, WIRE.blk);
      // connector body
      svg += obox(F, -88, -74, -6, 6, 2, 12, GOLDMAT, 0.9).svg;
      // capacitor: cylinder lying across, stripe marks polarity
      const capF = FR.Rz(F, rad(90));
      const capMat = opt.fault ? ({ l: '#7a6a5a', m: '#5d5145', d: '#3d352c' } as Tone) : LEDBODY;
      svg += ocyl(capF, 5, -9, 9, capMat, 1, 16, -46, 13).svg;
      const stripeOff = orient('XT60') ? 3.6 : -3.6;
      svg += ocyl(capF, 5, -9, 9, { l: '#e8e3d0', m: '#cfc9b6', d: '#a39d8a' }, 0.6, 16, -46 + stripeOff, 13).svg;
      add([-80, 8, 7], svg, 'XT60');
    }

    /* ---- camera ---- */
    if (has('CAM')) {
      const F = U('CAM');
      let svg = '';
      // side plates
      svg += obox(F, 38, 54, 13, 17, 0, 26, CARBON, 0.8).svg;
      svg += obox(F, 38, 54, -17, -13, 0, 26, CARBON, 0.8).svg;
      // body
      svg += obox(F, 38, 54, -10, 10, 3, 21, m, 0.9).svg;
      // lens tilted up
      const lensF = FR.Ry(F, rad(-30));
      svg += ocyl(lensF, 6, 46, 62, CARBON, 0.9, 16, 0, 12).svg;
      svg += odisc(lensF, 5, 62, '#1c1c1e', 0.5, 16, 0, 12);
      add([46, 0, 14], svg, 'CAM');
    }

    /* ---- receiver ---- */
    if (has('RX')) {
      const F = U('RX');
      let svg = obox(F, -5, 5, -6, 6, 12, 13, PCB, 0.7).svg;
      svg += tube([FR.pt(F, [0, 0, 13]), FR.pt(F, [-14, 0, 26])], 0.5, WIRE.wht);
      svg += tube([FR.pt(F, [0, 0, 13]), FR.pt(F, [0, 14, 26])], 0.5, WIRE.wht);
      add([0, 4, 16], svg, 'RX');
    }

    /* ---- VTX ---- */
    if (has('VTX')) {
      const F = U('VTX');
      let svg = obox(F, -14, 14, -14, 14, 18, 19.5, PCB, 0.8).svg;
      svg += obox(F, -6, 6, -6, 6, 19.5, 22, TIN, 0.6).svg; // shield can
      // antenna tube sweeping back and up
      svg += tube([FR.pt(F, [-10, 0, 20]), FR.pt(F, [-45, 0, 40]), FR.pt(F, [-70, 0, 52])], 1.2, WIRE.wht);
      const tipF = FR.Rz(FR.T(F, -74, 0, 54), rad(90));
      svg += ocyl(tipF, 2.2, -4, 4, { l: '#ef6a4c', m: '#cf5038', d: '#4a2219' }, 0.8, 12).svg;
      if (opt.power) {
        svg += odisc(F, 2, 19.6, '#e2483d', 0, 10, 10, 10);
        svg += glowDot(FR.pt(F, [10, 10, 20]), '#e2483d', 5);
      }
      add([-10, 0, 22], svg, 'VTX');
    }

    /* ---- top plate ---- */
    if (has('TOP')) {
      const F = U('TOP');
      let svg = '';
      for (const [sx, sy] of [
        [-40, -16],
        [40, -16],
        [-40, 16],
        [40, 16]
      ]) {
        svg += ocyl(F, 2.6, 0, 30, TIN, 0.8, 10, sx, sy).svg;
      }
      svg += obox(F, -50, 50, -20, 20, 30, 32.5, CARBON, 0.9).svg;
      add([0, 0, 31], svg, 'TOP');
    }

    /* ---- battery ---- */
    if (has('BATT')) {
      const F = U('BATT');
      const batt = (opt.design as { batt: string }).batt;
      const long = batt === '6s1800' ? 44 : 38;
      const col = batt === '6s1800' ? '#2f5fa8' : batt === '4s1500' ? '#d9a520' : '#2b2a28';
      const label = batt === '6s1800' ? '6S 1800' : batt === '4s1500' ? '4S 1500' : '6S 1100';
      let svg = obox(F, -long, long, -18, 18, 32.5, 66, { l: col, m: '#413f3d', d: '#26241f' } as Tone, 1).svg;
      // strap tab
      svg += obox(F, -30, -22, -19, 19, 44, 47, { l: '#ef6a4c', m: '#cf5038', d: '#4a2219' }, 0.8).svg;
      svg += otext(F, 0, 0, 66.5, label, 9, SILK);
      if (opt.plugged && has('XT60')) {
        svg += tube([FR.pt(F, [long - 4, 6, 50]), FR.pt(F, [70, 10, 30]), FR.pt(F, [86, 10, 12])], 1.4, WIRE.red);
        svg += tube([FR.pt(F, [long - 4, -6, 50]), FR.pt(F, [70, -10, 30]), FR.pt(F, [86, -10, 12])], 1.4, WIRE.blk);
      }
      add([0, 0, 50], svg, 'BATT');
    }

    /* ---- motors ---- */
    if (has('MOTORS')) {
      const F = U('MOTORS');
      MPOS.forEach(([mx, my], i) => {
        const M = FR.T(F, mx, my, 0);
        let svg = ocyl(M, 13.5, 0, 5, CARBON, 1, 16).svg;
        svg += ocyl(M, 14, 5, 19, m, 1, 16).svg;
        // rotating bell marks
        const spin = opt.spin[i] || 0;
        for (let b = 0; b < 3; b++) {
          const a = spin * (i % 2 ? -1 : 1) + (b * Math.PI * 2) / 3;
          svg += odisc(M, 3, 19.5, INK, 0, 8, Math.cos(a) * 8, Math.sin(a) * 8);
        }
        svg += ocyl(M, 2.4, 19, 24, TIN, 0.7, 10).svg;
        add([mx, my, 12], svg, 'MOTORS');
      });
    }

    /* ---- props ---- */
    if (has('PROPS') && !opt.broken) {
      const F = U('PROPS');
      const swapped = orient('PROPS') === 1;
      MPOS.forEach(([mx, my, _id, dir], i) => {
        const ccw = (dir === 'CCW') !== swapped;
        const P = FR.T(F, mx, my, 24);
        const rate = opt.rpm[i] || 0;
        if (rate > 0.12) {
          // prop blur disc + ghost blades + tip streaks
          add([mx, my, 26], propDisc(P, 63, rate, opt.spin[i] * (ccw ? -1 : 1)), 'PROPS');
        } else {
          let svg = '';
          const spin = opt.spin[i] || 0;
          for (let b = 0; b < 3; b++) {
            const a = spin * (ccw ? -1 : 1) + (b * Math.PI * 2) / 3;
            const B = FR.Rz(FR.T(P, 0, 0, 0), a);
            const bladeF = FR.Rx(B, ccw ? rad(10) : rad(-10));
            svg += obox(bladeF, 6, 63, -4.5, 4.5, -0.7, 0.7, { l: '#f4b829', m: '#d49c1f', d: '#4e4a18' }, 0.7).svg;
          }
          svg += ocyl(P, 6, -1, 2, CARBON, 0.8, 10).svg;
          add([mx, my, 26], svg, 'PROPS');
        }
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
      pts.push(FR.pt(f, [56 * sx, 23 * sy, -3]));
      pts.push(FR.pt(f, [50 * sx, 20 * sy, 66]));
      pts.push(FR.pt(f, [79.5 * sx, 79.5 * sy, 24]));
    }
    return pts;
  },

  tags: [
    ['FC', [10, 0, 16], 46, -40],
    ['ESC', [16, -16, 5], 50, 20],
    ['CAM', [56, 0, 22], 40, -24],
    ['VTX', [-74, 0, 56], -40, -30],
    ['XT60', [-80, 0, 12], -46, 22],
    ['MOTORS', [79.5, -79.5, 19], 34, 20],
    ['BATT', [0, 0, 68], -30, -46]
  ],

  /* ---------------------------------------------------------------- */
  /* wiring                                                           */
  /* ---------------------------------------------------------------- */

  wiring: {
    nodes(d, c) {
      return {
        BATT: [20, 238, 'BATTERY', (c.battName as string) || '6S 1100 mAh', '#e2483d'],
        XT60: [190, 238, 'XT60 + CAP', '1000 uF 35 V', '#e2483d'],
        ESC: [360, 238, '4-IN-1 ESC', '45 A x 4, BLHeli_32', '#e2483d'],
        FC: [360, 70, 'FLIGHT CTRL', 'F7, gyro, Betaflight', '#3e86d9'],
        RX: [140, 70, 'RECEIVER', 'ELRS 2.4 GHz', '#8c4bd1'],
        CAM: [600, 14, 'CAMERA', 'analog, 30 deg', '#43a35a'],
        VTX: [600, 116, 'VTX', '5.8 GHz, 400 mW', '#8c4bd1'],
        MOTORS: [600, 238, 'MOTORS x4', (c.motorName as string) || '2306 1750KV', '#f08a2b']
      };
    },
    links: [
      { from: 'BATT', to: 'XT60', kind: 'power', label: 'XT60' },
      { from: 'XT60', to: 'ESC', kind: 'power', label: 'VBAT + GND' },
      { from: 'ESC', to: 'MOTORS', kind: 'motor', label: '3-phase x4' },
      { from: 'ESC', to: 'FC', kind: 'power', label: 'VBAT' },
      { from: 'ESC', to: 'FC', kind: 'data', label: 'M1-M4' },
      { from: 'FC', to: 'RX', kind: 'data', label: 'UART2', label2: '+ 5 V' },
      { from: 'CAM', to: 'VTX', kind: 'video', label: 'video in' },
      { from: 'FC', to: 'VTX', kind: 'data', label: 'SmartAudio' }
    ]
  },

  /* ---------------------------------------------------------------- */
  /* content                                                          */
  /* ---------------------------------------------------------------- */

  overview: `<p>A 5-inch freestyle quad is the default first FPV build: four brushless motors on a carbon true-X frame, a 4-in-1 ESC, a flight controller running Betaflight, an analog camera and video transmitter, and an ELRS radio link.</p>
<p>Five-inch because the props are five inches across — big enough to carry a battery and a camera through violent moves, small enough to survive learning. Freestyle means the flying is the point: punchouts, dives, and tight gaps around structures.</p>
<p>Everything on this page is real engineering. The calculator's thrust-to-weight and flight-time numbers come from the parts you pick. The build steps enforce the rules that keep fingers attached. The flight simulator flies with the same mass and thrust you designed.</p>`,

  buildCode: `# after the build, in the Betaflight CLI:
resource                      # check motor + UART mapping
set align_board_yaw = 0       # 180 if the arrow points back
set motor_pwm_protocol = DSHOT600
set yaw_motors_reversed = OFF # "props in"
serial 1 64 115200 57600 0 115200   # UART2 = ELRS
save`,

  quiz: [
    {
      q: 'Why do the props go on last?',
      a: ['They are fragile', 'A motor test or short with props on can throw the quad at your face', 'They block the camera'],
      ok: 1
    },
    {
      q: 'The arrow on the flight controller points backwards. What happens on takeoff?',
      a: ['Nothing, the gyro does not care', 'It corrects the wrong way and flips instantly', 'It flies slower'],
      ok: 1
    },
    {
      q: 'What does the big capacitor on the XT60 lead do?',
      a: ['Stores energy for longer flights', 'Soaks up voltage spikes from the ESCs', 'Filters video noise only'],
      ok: 1
    },
    {
      q: 'You let go of the sticks in acro mode. The quad...',
      a: ['levels itself', 'keeps whatever angle it had', 'lands'],
      ok: 1
    }
  ],

  practice:
    'Fly five laps of the gates in angle mode, then switch to acro and fly one. Then build it for real: smoke-stopper the first plug, check motor direction with props OFF, and write down your actual flight time against the calculator\'s estimate.',

  range: {
    title: 'Freestyle bando',
    brief: 'Thread the gap, fly through the bando, top the tower, dive it, land.',
    field: 40,
    pad: [20, 6],
    ground: '#dde3cc',
    keepGates: false,
    prims: [
      { t: 'flat', x: 20, y: 21, w: 3, d: 32, col: '#c9c4b4' }, // road
      { t: 'flat', x: 30, y: 22, w: 10, d: 14, col: '#d3cec0' }, // bando slab
      // bando: 6 pillars + two floors + back wall
      { t: 'box', x: 26.3, y: 16.3, w: 0.6, d: 0.6, h: 6.3, col: '#d9d3c4' },
      { t: 'box', x: 33.7, y: 16.3, w: 0.6, d: 0.6, h: 6.3, col: '#d9d3c4' },
      { t: 'box', x: 30, y: 16.3, w: 0.6, d: 0.6, h: 6.3, col: '#d9d3c4' },
      { t: 'box', x: 26.3, y: 27.7, w: 0.6, d: 0.6, h: 6.3, col: '#d9d3c4' },
      { t: 'box', x: 33.7, y: 27.7, w: 0.6, d: 0.6, h: 6.3, col: '#d9d3c4' },
      { t: 'box', x: 30, y: 27.7, w: 0.6, d: 0.6, h: 6.3, col: '#d9d3c4' },
      { t: 'box', x: 30, y: 22, z: 3, w: 8, d: 12, h: 0.3, col: '#cbc5b6' },
      { t: 'box', x: 30, y: 22, z: 6, w: 8, d: 12, h: 0.3, col: '#cbc5b6' },
      { t: 'box', x: 33.7, y: 22, w: 0.3, d: 11, h: 3, col: '#d9d3c4' },
      // the gap: two walls
      { t: 'box', x: 15, y: 20, w: 0.4, d: 6, h: 4, col: '#c2bcae' },
      { t: 'box', x: 16.6, y: 20, w: 0.4, d: 6, h: 4, col: '#c2bcae' },
      // dive tower
      { t: 'box', x: 8, y: 30, w: 3, d: 3, h: 10, col: '#c9c2b2' },
      { t: 'box', x: 8, y: 30, z: 10, w: 3.6, d: 3.6, h: 0.3, col: '#b7b0a0' },
      // power poles
      { t: 'pole', x: 5, y: 37, h: 8 },
      { t: 'pole', x: 12, y: 37, h: 8 },
      { t: 'pole', x: 19, y: 37, h: 8 },
      { t: 'pole', x: 26, y: 37, h: 8 },
      { t: 'pole', x: 33, y: 37, h: 8 },
      // trees
      { t: 'tree', x: 36, y: 8, h: 6 },
      { t: 'tree', x: 12, y: 10, h: 7 },
      { t: 'tree', x: 4, y: 18, h: 5 },
      { t: 'tree', x: 24, y: 34, h: 6 },
      // barrels
      { t: 'cyl', x: 23, y: 12, r: 0.5, h: 0.9, col: '#d4af37' },
      { t: 'cyl', x: 24.2, y: 12.4, r: 0.5, h: 0.9, col: '#5a82c6' }
    ],
    goals: [
      { x: 15.8, y: 20, z: 2, r: 0.8, heading: 90, label: 'THE GAP' },
      { x: 30, y: 22, z: 1.5, r: 1.1, heading: 90, label: 'BANDO' },
      { x: 8, y: 30, z: 11.6, r: 1.6, label: 'TOWER TOP' },
      { x: 8, y: 27.4, z: 1.6, r: 1.3, heading: -90, label: 'DIVE' },
      { x: 20, y: 6, z: 0.8, r: 1.6, label: 'LAND' }
    ]
  }
};

void poly3;
void PALETTES;
void REDBODY;
