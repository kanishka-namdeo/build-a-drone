/**
 * Fig. 02 — the Tiny Whoop 65 mm: 1S, ducted, one AIO board.
 *
 * A 65 mm ducted micro quad for flying around the living room when the
 * weather is bad. The AIO board is the FC + 4 ESCs + ELRS in one PCB; the
 * battery lives in a clip under the frame with a BT2.0 plug.
 */

import { Vec3, Tone, INK, path3, ink, fillPath } from '../engine/core';
import { FR, rad } from '../engine/frames';
import type { Frame } from '../engine/frames';
import { obox, ocyl, odisc, otext, tube, glowDot, propDisc } from '../engine/oshapes';
import { CARBON, PCB, SILK, WIRE, TIN } from '../engine/materials';
import type { CraftRecord, DrawOpt, DrawAdd } from '../types';

const MPOS: Array<[number, number, string, 'CW' | 'CCW']> = [
  [-31.5, -31.5, 'M1', 'CW'],
  [31.5, -31.5, 'M2', 'CCW'],
  [-31.5, 31.5, 'M3', 'CCW'],
  [31.5, 31.5, 'M4', 'CW']
];

const TPU: Tone = { l: '#f2e8dc', m: '#d8cbb8', d: '#a3978a' };

export const whoop65: CraftRecord = {
  key: 'whoop65',
  fig: 2,
  name: 'Tiny Whoop 65 mm',
  sub: 'indoor, brushless',
  hint: 'build it, mind the sag, fly the couch',
  noun: 'whoop',
  palette: 'blush',
  log: 'betaflight',
  mat: 170,
  benchH: 110,
  flyScale: 5,
  flyVB: 5200,
  hitR: 0.09,
  noSmoke: true,
  kThrust: 0.0022,
  gPerW: 3.6,
  minTW: 2.6,
  maxKvCells: 43700,
  design: { batt: '1s300', motor: '0702-23000', prop: '31mm-4b' },

  batts: {
    '1s300': { name: '1S 300 BT2.0', cells: 1, mah: 300, g: 7.5, price: 6, col: '#2b2a28', lab: '1S 300' },
    '1s450': { name: '1S 450 HV', cells: 1, mah: 450, g: 11, price: 7, col: '#8a5f2f', lab: '1S 450' },
    '2s300': { name: '2S 300 XT30', cells: 2, mah: 300, g: 16, price: 9, col: '#2f5fa8', lab: '2S 300' }
  },
  motors: {
    '0702-23000': { name: '0702 23000KV', kv: 23000, g: 1.9, price: 9 },
    '0702-25000': { name: '0702 25000KV', kv: 25000, g: 1.9, price: 9 },
    '0702-27000': { name: '0702 27000KV', kv: 27000, g: 1.9, price: 10 }
  },
  props: {
    '31mm-4b': { name: '31mm 4-blade', pf: 1.0, eff: 1.0, g: 0.25, price: 1.5 },
    '31mm-3b': { name: '31mm 3-blade', pf: 0.9, eff: 1.08, g: 0.22, price: 1.5 },
    '31mm-2b': { name: '31mm 2-blade (efficient)', pf: 0.78, eff: 1.2, g: 0.2, price: 1.5 }
  },
  fixed: [
    { id: 'FRAME', name: 'one-piece ducted frame', g: 3.6, price: 6, cat: 'Mechanical' },
    { id: 'AIO', name: 'AIO board (F4 + 4 ESC + ELRS)', g: 2.6, price: 40, cat: 'Electrical' },
    { id: 'CAM', name: 'nano camera', g: 1.6, price: 15, cat: 'Electrical' },
    { id: 'VTX', name: 'VTX 25-400 mW', g: 0.4, price: 3, cat: 'Electrical' },
    { id: 'RX', name: 'ELRS antenna tips', g: 0.2, price: 2, cat: 'Electrical' },
    { id: 'CANOPY', name: 'TPU canopy', g: 1.2, price: 4, cat: 'Mechanical' },
    { id: 'SCREWS', name: 'screws + hardware', g: 0.6, price: 2, cat: 'Mechanical' }
  ],

  parts: [
    {
      id: 'FRAME',
      name: 'One-piece ducted frame (65 mm, injected plastic)',
      short: 'FRAME',
      z: 0,
      what: 'The whole airframe is one moulded piece: four ducts on a plate. The ducts protect the props, the furniture, and your fingers — and they add thrust when hovering slowly.'
    },
    {
      id: 'MOTORS',
      name: '4 brushless 0702 motors',
      short: 'MOTORS',
      z: 1,
      after: ['FRAME'],
      what: '0702 brushless motors, 23 000 KV-class. On 1S that is ~85 000 rpm of whoop. They plug into the board with 3-pin connectors — no soldering.'
    },
    {
      id: 'ESC',
      name: '4-in-1 ESC section of the AIO',
      short: 'ESC',
      z: 2,
      after: ['FRAME'],
      what: 'Four 5 A blheli_32 ESCs live on the same PCB as the FC: one board, no wiring harness, a third of the whoop\'s weight is electronics.'
    },
    {
      id: 'WIRES',
      name: 'Motor plugs to the AIO',
      short: 'PLUGS',
      z: 2,
      after: ['MOTORS', 'ESC'],
      what: 'Three little wires per motor with a plug. Any order at the plug: direction is set in the configurator.'
    },
    {
      id: 'FC',
      name: 'AIO board: F4 FC + ESCs + ELRS',
      short: 'AIO BOARD',
      z: 3,
      after: ['ESC'],
      polar: ['arrow forward', 'arrow backward'],
      what: 'Flight controller, ESCs and ELRS receiver on one PCB. The printed arrow must point at the nose, or it corrects the wrong way.'
    },
    {
      id: 'CAM',
      name: 'Nano FPV camera (20° tilt)',
      short: 'CAMERA',
      z: 2,
      after: ['FRAME'],
      what: 'A 1.4 g camera in the canopy nose. 20° of tilt: whoops fly slow and level, so the lens barely needs to look up.'
    },
    {
      id: 'VTX',
      name: 'VTX + antenna tips out the back',
      short: 'VTX + TIPS',
      z: 4,
      after: ['FC'],
      what: '25-400 mW on 5.8 GHz. Two little antenna tips stick out the back at 90° to each other so one is never in the carbon shadow.'
    },
    {
      id: 'CANOPY',
      name: 'TPU canopy',
      short: 'CANOPY',
      z: 5,
      after: ['CAM'],
      what: 'A printed TPU shell that holds the camera and takes the hits. TPU bends instead of breaking — the whoop version of a crash structure.'
    },
    {
      id: 'XT60',
      name: 'BT2.0 pigtail',
      short: 'BT2.0',
      z: 2,
      after: ['ESC'],
      polar: ['pins to the board', 'pins backwards'],
      what: 'The 1S battery plug. BT2.0 handles the amps better than the old PH2.0 — less sag on punchouts.'
    },
    {
      id: 'BATT',
      name: '1S battery in the under-frame clip',
      short: 'BATTERY',
      z: 6,
      after: ['XT60'],
      what: 'A 300 mAh 1S sits in a clip under the frame. Under, not on top: it lowers the centre of mass into the duct plane, which is what makes a whoop feel planted.'
    },
    {
      id: 'PROPS',
      name: '31 mm 4-blade props',
      short: 'PROPS',
      z: 7,
      after: ['MOTORS', 'CANOPY'],
      polar: ['props in (correct)', 'swapped CW/CCW'],
      what: 'Four blades each, tiny and dull-edged. They still go on last: a bench motor test with props on is how whoops get launched across rooms.'
    }
  ],

  mpos: MPOS,
  wrongMotor: 3,

  draw(f: Frame, add: DrawAdd, opt: DrawOpt): void {
    const m = opt.m;
    const has = opt.has;
    const U = opt.U;

    /* ---- one-piece frame: plate + 4 ducts ---- */
    if (has('FRAME')) {
      const F = U('FRAME');
      add([0, 0, 0], obox(F, -30, 30, -30, 30, -2, 1, CARBON, 0.8).svg, 'FRAME');
      MPOS.forEach(([mx, my]) => {
        const D = FR.T(F, mx, my, 0);
        // duct: outer wall + inner dark ring + 3 struts
        add([mx, my, 7], ocyl(D, 21, -2, 14, TPU, 1, 18).svg, 'FRAME');
        add([mx, my, 12], odisc(D, 15, 12.4, '#26241f', 0.5, 18), 'FRAME');
        for (let s = 0; s < 3; s++) {
          const a = (s * Math.PI * 2) / 3 + 0.5;
          const S = FR.Rz(D, a);
          add([mx + Math.cos(a) * 24, my + Math.sin(a) * 24, 2], obox(S, 19, 26, -2, 2, 0, 12, TPU, 0.7).svg, 'FRAME');
        }
      });
    }

    /* ---- ESC section (drawn as a thin board under the FC spot) ---- */
    if (has('ESC')) {
      const F = U('ESC');
      add([0, 0, 3], obox(F, -12, 12, -14, 14, 1, 2.4, PCB, 0.7).svg, 'ESC');
    }

    /* ---- motor plugs (wires) ---- */
    if (has('WIRES')) {
      const F = U('WIRES');
      let svg = '';
      MPOS.forEach(([mx, my], i) => {
        const a: Vec3 = FR.pt(F, [mx * 0.7, my * 0.7, 6]);
        const b: Vec3 = FR.pt(F, [Math.sign(mx) * 7, Math.sign(my) * 8, 4]);
        svg += tube([a, b], 0.5, i % 2 ? WIRE.org : WIRE.blu);
      });
      add([0, 0, 5], svg, 'WIRES');
    }

    /* ---- AIO board (FC) ---- */
    if (has('FC')) {
      const F = U('FC');
      let svg = obox(F, -10, 10, -12, 12, 2.4, 5, PCB, 0.8).svg;
      svg += obox(F, -3.5, 3.5, -3.5, 3.5, 5, 6.6, TIN, 0.6).svg;
      // 4 motor sockets
      for (const [sx, sy] of [[-6, -7], [6, -7], [-6, 7], [6, 7]]) {
        svg += obox(F, sx - 1.5, sx + 1.5, sy - 1, sy + 1, 5, 5.8, SILK as unknown as Tone, 0.4).svg;
      }
      // direction arrow
      const flip = opt.orient('FC') ? -1 : 1;
      const arrow: Vec3[] = [FR.pt(F, [9 * flip, 0, 6.8]), FR.pt(F, [3 * flip, 3.4, 6.8]), FR.pt(F, [3 * flip, -3.4, 6.8])];
      svg += fillPath(path3(arrow), SILK) + ink(path3(arrow), 0.6);
      if (opt.power) {
        svg += glowDot(FR.pt(F, [-7, 9, 6]), '#3e86d9', 5);
      }
      add([0, 0, 5], svg, 'FC');
    }

    /* ---- camera in the nose ---- */
    if (has('CAM')) {
      const F = U('CAM');
      const lensF = FR.Ry(F, rad(-20));
      let svg = obox(F, 22, 30, -6, 6, 1, 8, m, 0.8).svg;
      svg += ocyl(lensF, 3.4, 27, 34, CARBON, 0.7, 14, 0, 4).svg;
      svg += odisc(lensF, 2.8, 34, '#1c1c1e', 0.4, 14, 0, 4);
      add([26, 0, 6], svg, 'CAM');
    }

    /* ---- VTX + antenna tips ---- */
    if (has('VTX')) {
      const F = U('VTX');
      let svg = obox(F, -6, 6, -6, 6, 2.4, 3.8, PCB, 0.7).svg;
      svg += tube([FR.pt(F, [-4, 0, 4]), FR.pt(F, [-16, 0, 14])], 0.5, WIRE.wht);
      svg += tube([FR.pt(F, [-4, 2, 4]), FR.pt(F, [-10, 12, 6])], 0.5, WIRE.wht);
      if (opt.power) {
        svg += glowDot(FR.pt(F, [4, -4, 4.4]), '#e2483d', 4);
      }
      add([-8, 4, 6], svg, 'VTX');
    }

    /* ---- TPU canopy ---- */
    if (has('CANOPY')) {
      const F = U('CANOPY');
      let svg = ocyl(F, 24, 1, 11, TPU, 0.9, 20).svg;
      svg += otext(F, 0, 0, 12, 'TPU', 6, '#857d6e');
      // nose cut for the camera
      svg += obox(F, 22, 32, -7, 7, 2, 10, { l: '#f2efe7', m: '#ddd6c8', d: '#b3ab97' }, 0).svg.replace(/stroke="[^"]*"/g, '');
      add([0, 0, 8], svg, 'CANOPY');
    }

    /* ---- BT2.0 pigtail ---- */
    if (has('XT60')) {
      const F = U('XT60');
      let svg = tube([FR.pt(F, [-14, 0, -3]), FR.pt(F, [-24, 0, -6])], 0.8, WIRE.red);
      svg += obox(F, -28, -24, -2, 2, -8, -3, { l: '#f2c230', m: '#d9ad25', d: '#8f6f10' }, 0.8).svg;
      add([-26, 0, -5], svg, 'XT60');
    }

    /* ---- battery under the frame ---- */
    if (has('BATT')) {
      const F = U('BATT');
      const batt = opt.design.batt;
      const col = batt === '1s450' ? '#8a5f2f' : batt === '2s300' ? '#2f5fa8' : '#2b2a28';
      const lab = batt === '1s450' ? '1S 450' : batt === '2s300' ? '2S 300' : '1S 300';
      let svg = obox(F, -11, 11, -6, 6, -12, -2, { l: col, m: '#413f3d', d: '#26241f' } as Tone, 0.9).svg;
      svg += otext(F, 0, 0, -12.6, lab, 5, SILK);
      // clip strap
      svg += obox(F, -2, 2, -7, 7, -8, -6, m, 0.6).svg;
      if (opt.plugged && has('XT60')) {
        svg += tube([FR.pt(F, [-10, 0, -6]), FR.pt(F, [-22, 0, -6])], 0.8, WIRE.red);
      }
      add([0, 0, -7], svg, 'BATT');
    }

    /* ---- motors in the duct hubs ---- */
    if (has('MOTORS')) {
      const F = U('MOTORS');
      MPOS.forEach(([mx, my], i) => {
        const M = FR.T(F, mx, my, 2);
        let svg = ocyl(M, 5.5, 0, 4, CARBON, 0.8, 12).svg;
        svg += ocyl(M, 6, 4, 9, m, 0.8, 12).svg;
        const spin = opt.spin[i] || 0;
        for (let b = 0; b < 2; b++) {
          const a = spin * (i % 2 ? -1 : 1) + (b * Math.PI) / 2;
          svg += odisc(M, 1.6, 9.4, INK, 0, 8, Math.cos(a) * 3.2, Math.sin(a) * 3.2);
        }
        add([mx, my, 6], svg, 'MOTORS');
      });
    }

    /* ---- props ---- */
    if (has('PROPS') && !opt.broken) {
      const F = U('PROPS');
      const swapped = opt.orient('PROPS') === 1;
      MPOS.forEach(([mx, my, _id, dir], i) => {
        const ccw = (dir === 'CCW') !== swapped;
        const P = FR.T(F, mx, my, 11);
        const rate = opt.rpm[i] || 0;
        if (rate > 0.12) {
          // prop blur disc + ghost blades + tip streaks
          add([mx, my, 12], propDisc(P, 15, rate, opt.spin[i] * (ccw ? -1 : 1)), 'PROPS');
        } else {
          let svg = '';
          const spin = opt.spin[i] || 0;
          for (let b = 0; b < 4; b++) {
            const a = spin * (ccw ? -1 : 1) + (b * Math.PI) / 2;
            const B = FR.Rz(P, a);
            const bladeF = FR.Rx(B, ccw ? rad(14) : rad(-14));
            svg += obox(bladeF, 2, 15, -2.2, 2.2, -0.4, 0.4, { l: '#5d5954', m: '#423e3a', d: '#292623' }, 0.5).svg;
          }
          add([mx, my, 12], svg, 'PROPS');
        }
      });
    }
  },

  hull(f: Frame): Vec3[] {
    const pts: Vec3[] = [];
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      pts.push(FR.pt(f, [31.5 * sx + 22 * sx, 31.5 * sy + 22 * sy, -2]));
      pts.push(FR.pt(f, [31.5 * sx, 31.5 * sy, 14]));
    }
    pts.push(FR.pt(f, [0, 0, -12]));
    return pts;
  },

  tags: [
    ['FC', [0, 0, 8], 44, -36],
    ['CAM', [26, 0, 10], 38, -28],
    ['BATT', [0, 0, -10], -34, 30],
    ['PROPS', [31.5, -31.5, 12], 30, 22],
    ['FRAME', [-31.5, 31.5, 7], -40, -30]
  ],

  wiring: {
    nodes(d, c) {
      return {
        BATT: [20, 238, 'BATTERY', (c.battName as string) || '1S 300', '#e2483d'],
        XT60: [190, 238, 'BT2.0 PLUG', '2-pin, 1S', '#e2483d'],
        FC: [360, 238, 'AIO BOARD', 'F4 + 4x5A + ELRS', '#3e86d9'],
        MOTORS: [600, 238, 'MOTORS x4', (c.motorName as string) || '0702 23000KV', '#f08a2b'],
        CAM: [600, 14, 'CAMERA', 'nano, 20 deg', '#43a35a'],
        VTX: [600, 116, 'VTX', '25-400 mW', '#8c4bd1']
      };
    },
    links: [
      { from: 'BATT', to: 'XT60', kind: 'power', label: 'BT2.0' },
      { from: 'XT60', to: 'FC', kind: 'power', label: 'VBAT' },
      { from: 'FC', to: 'MOTORS', kind: 'motor', label: '3-phase x4' },
      { from: 'FC', to: 'CAM', kind: 'video', label: 'camera port' },
      { from: 'FC', to: 'VTX', kind: 'data', label: 'SmartAudio' }
    ]
  },

  overview: `<p>A Tiny Whoop is a 65 mm ducted micro quad: 25 grams — about five sheets of paper — with a brushless motor in each ducted corner. It flies the living room when the weather says no.</p>
<p>The ducts are the whole point. Around the house you fly slow and touch things: the ducts keep props, fingers, lampshades and television sets on speaking terms, and they even add a little thrust in slow flight. The tax is weight, drag and noise once you push past a stroll.</p>
<p>Everything electronic is one board: flight controller, four ESCs and the ELRS receiver on a single PCB — the AIO board. The 1S battery rides in a clip under the frame, which drops the centre of mass into the prop plane and makes the whoop feel planted. Mind the sag: a 300 mAh single cell drops voltage hard on punchouts, and the quad sinks right with it.</p>`,

  buildCode: `# tiny whoop defaults, in the Betaflight CLI:
resource
set align_board_yaw = 0
set motor_pwm_protocol = DSHOT300   # 0702 motors like it gentler
set vbat_warning_cell_voltage = 330
set bat_capacity = 300
serial 1 64 115200 57600 0 115200   # UART2 = ELRS
# turtle mode on a switch (flip over after a crash):
aux 3 FLIP_OVER_AFTER_CRASH
save`,

  quiz: [
    {
      q: 'What do the ducts around the props buy you?',
      a: ['Top speed at full throttle', 'Prop, finger and furniture protection — plus thrust at low speed', 'Longer flight time'],
      ok: 1
    },
    {
      q: 'The whoop punches up, then sags back on a 1S 300. Why?',
      a: ['The motor is getting tired', 'A tiny pack sags under load: voltage drops and thrust drops with it', 'The antenna drags'],
      ok: 1
    },
    {
      q: 'Upside down under the sofa. What is turtle mode?',
      a: ['A firmware flip that spins the props backwards to roll the quad over', 'A failsafe that flies it home', 'A camera filter'],
      ok: 0
    },
    {
      q: 'Why does the battery ride under the frame?',
      a: ['It cools better down there', 'It lowers the centre of mass into the prop plane, so the whoop feels planted', 'The canopy needs the space'],
      ok: 1
    }
  ],

  practice:
    'Fly the living-room course without touching anything, then try it on the 450 pack: write down both run times against the calculator.',

  range: {
    title: 'The living room',
    indoor: true,
    brief: 'Under the table, between the chairs, round the lamp, over the sofa, land.',
    field: 8,
    pad: [4, 1.2],
    ground: '#e8ddc4',
    alt: true,
    keepGates: false,
    camTilt: 20,
    prims: [
      { t: 'flat', x: 4, y: 3.4, w: 2.6, d: 1.9, col: '#d8a05a', label: 'RUG' },
      // sofa
      { t: 'box', x: 6.7, y: 3, w: 0.9, d: 2.2, h: 0.45, col: '#7a8a96' },
      { t: 'box', x: 7.05, y: 3, w: 0.25, d: 2.2, h: 0.95, col: '#6d7d89' },
      { t: 'box', x: 6.7, y: 1.7, w: 0.9, d: 0.25, h: 0.65, col: '#6d7d89' },
      { t: 'box', x: 6.7, y: 4.3, w: 0.9, d: 0.25, h: 0.65, col: '#6d7d89' },
      // coffee table
      { t: 'box', x: 5.2, y: 3.2, w: 1.1, d: 0.7, h: 0.42, col: '#a9825a' },
      // dining table + chairs
      { t: 'box', x: 2.4, y: 5.8, w: 1.6, d: 0.9, h: 0.72, col: '#a9825a' },
      { t: 'box', x: 2.4, y: 5.0, w: 0.45, d: 0.45, h: 0.9, col: '#8a6a4a' },
      { t: 'box', x: 2.4, y: 6.6, w: 0.45, d: 0.45, h: 0.9, col: '#8a6a4a' },
      { t: 'box', x: 1.4, y: 5.8, w: 0.45, d: 0.45, h: 0.9, col: '#8a6a4a' },
      { t: 'box', x: 3.4, y: 5.8, w: 0.45, d: 0.45, h: 0.9, col: '#8a6a4a' },
      // TV
      { t: 'box', x: 0.4, y: 3, w: 0.5, d: 1.8, h: 0.5, col: '#5a5248' },
      { t: 'box', x: 0.35, y: 3, w: 0.08, d: 1.4, h: 0.8, z: 0.5, col: '#26241f' },
      // bookshelf
      { t: 'box', x: 4, y: 7.6, w: 2.2, d: 0.4, h: 1.9, col: '#8a6a4a' },
      // floor lamp
      { t: 'pole', x: 6.8, y: 6.4, h: 1.6, col: '#8a8f93' },
      { t: 'cyl', x: 6.8, y: 6.4, z: 1.4, r: 0.25, h: 0.3, col: '#f2e2b0' },
      // plants
      { t: 'cyl', x: 0.8, y: 7.2, r: 0.22, h: 0.3, col: '#b05a4a' },
      { t: 'tree', x: 0.8, y: 7.2, h: 1.0 },
      { t: 'cyl', x: 7.4, y: 0.8, r: 0.22, h: 0.3, col: '#b05a4a' },
      { t: 'tree', x: 7.4, y: 0.8, h: 0.9 }
    ],
    goals: [
      { x: 2.4, y: 5.8, z: 0.35, r: 0.5, label: 'UNDER THE TABLE' },
      { x: 2.4, y: 5.0, z: 1.0, r: 0.45, heading: 0, label: 'BETWEEN CHAIRS' },
      { x: 6.8, y: 6.4, z: 1.4, r: 0.7, label: 'ROUND THE LAMP' },
      { x: 6.7, y: 3, z: 1.0, r: 0.45, heading: 90, label: 'OVER THE SOFA' },
      { x: 4, y: 1.2, z: 0.4, r: 0.5, label: 'LAND ON THE RUG' }
    ]
  },

  warnings(d, c) {
    if (d.batt === '2s300' && (c.kv as number) >= 23000) {
      return ['25 000 KV-class motors on 2S cook the windings: a 2S whoop runs ~19 000 KV 0802 motors.'];
    }
    return [];
  }
};
