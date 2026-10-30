/**
 * Fig. 12 — the tricopter: three motors in a Y, and a servo that tilts the
 * tail motor to yaw. The tail tilt is the whole personality of the craft.
 */

import { Vec3, Tone, INK } from '../engine/core';
import { FR, rad } from '../engine/frames';
import type { Frame } from '../engine/frames';
import { obox, ocyl, odisc, otext, tube, servoPiece, propDisc } from '../engine/oshapes';
import { CARBON, PCB, SILK, WIRE, TIN } from '../engine/materials';
import { craftAnim } from './anim';
import type { CraftRecord, DrawOpt, DrawAdd, FlightState, PhysCtx } from '../types';

const MPOS: Array<[number, number, string, 'CW' | 'CCW']> = [
  [-150, -90, 'M1', 'CW'], // tail (Betaflight TRI: M1 = tail)
  [150, -90, 'M2', 'CCW'], // front-right
  [0, 180, 'M3', 'CCW'] // front-left
];

/** Servo bench-sweep window. */
let servoT0 = 0;

const GOLDMAT: Tone = { l: '#f3d679', m: '#d6b04a', d: '#9c7a26' };

export const tricopter: CraftRecord = {
  key: 'tricopter',
  fig: 12,
  name: 'Tricopter',
  sub: 'servo yaw',
  hint: 'test the tail servo, then fly the slalom',
  noun: 'tricopter',
  palette: 'tomato',
  log: 'betaflight',
  mat: 380,
  benchH: 120,
  flyScale: 2.6,
  flyVB: 10000,
  hitR: 0.16,
  kThrust: 0.62,
  gPerW: 6.8,
  minTW: 3.5,
  design: { batt: '4s2200', motor: '2306-2450', prop: '5x4.3x3' },

  batts: {
    '4s2200': { name: '4S 2200', cells: 4, mah: 2200, g: 250, price: 34, col: '#2b2a28', lab: '4S 2200' },
    '4s1800': { name: '4S 1800', cells: 4, mah: 1800, g: 210, price: 30, col: '#3a5f3a', lab: '4S 1800' },
    '4s1500': { name: '4S 1500', cells: 4, mah: 1500, g: 182, price: 28, col: '#8a5f2f', lab: '4S 1500' }
  },
  motors: {
    '2306-2450': { name: '2306 2450KV', kv: 2450, g: 32, price: 20 },
    '2207-2150': { name: '2207 2150KV', kv: 2150, g: 34, price: 22 },
    '2205-2300': { name: '2205 2300KV', kv: 2300, g: 28, price: 16 }
  },
  props: {
    '5x4.3x3': { name: '5x4.3x3 tri-blade', pf: 1.0, eff: 1.0, g: 4.4, price: 4 },
    '6x4x2': { name: '6x4x2 bi-blade (efficient)', pf: 1.15, eff: 1.15, g: 5.0, price: 4 },
    '5x5x3': { name: '5x5x3 (aggressive)', pf: 1.1, eff: 0.88, g: 4.8, price: 4 }
  },
  fixed: [
    { id: 'FRAME', name: 'Y frame (2 front arms + tail boom)', g: 190, price: 45, cat: 'Mechanical' },
    { id: 'ESC', name: '3x 30A single ESCs', g: 21, price: 36, cat: 'Electrical' },
    { id: 'FC', name: 'F4 FC + PDB', g: 8, price: 35, cat: 'Electrical' },
    { id: 'SERVO', name: 'tail servo + hinge', g: 22, price: 14, cat: 'Electrical' },
    { id: 'CAM', name: 'FPV camera', g: 7, price: 25, cat: 'Electrical' },
    { id: 'VTX', name: 'VTX + antenna', g: 9, price: 30, cat: 'Electrical' },
    { id: 'RX', name: 'ELRS receiver', g: 2, price: 18, cat: 'Electrical' },
    { id: 'XT60', name: 'XT60 + cap', g: 12, price: 4, cat: 'Electrical' },
    { id: 'TOP', name: 'top plate', g: 20, price: 7, cat: 'Mechanical' },
    { id: 'STRAP', name: 'battery strap', g: 5, price: 4, cat: 'Mechanical' }
  ],

  parts: [
    {
      id: 'FRAME',
      name: 'Y frame: two front arms + a long tail boom',
      short: 'Y FRAME',
      z: 0,
      what: 'Three arms at 120 degrees. The tail boom is long because the tail motor needs leverage: its thrust tilts for yaw, so the arm buys authority.'
    },
    {
      id: 'MOTORS',
      name: '3 brushless motors',
      short: 'MOTORS',
      z: 1,
      after: ['FRAME'],
      what: 'The front pair counter-rotates; the tail balances their leftover torque by tilting.'
    },
    {
      id: 'ESC',
      name: '3 single 30A ESCs',
      short: 'ESCS',
      z: 2,
      after: ['FRAME'],
      what: 'Singles zip-tied in the airflow under the arms — tricopters predate 4-in-1 boards and stay air-cooled.'
    },
    {
      id: 'WIRES',
      name: 'Motor wires',
      short: 'WIRES',
      z: 3,
      after: ['MOTORS', 'ESC'],
      what: 'Three runs down the arms. Any order at the ESC; direction is configured.'
    },
    {
      id: 'FC',
      name: 'F4 flight controller + PDB',
      short: 'FLIGHT CTRL',
      z: 4,
      after: ['ESC'],
      polar: ['arrow forward', 'arrow backward'],
      what: 'Runs Betaflight with mixer TRI. The arrow points between the front arms — not at the tail!'
    },
    {
      id: 'SERVO',
      name: 'Tail servo + hinge + tilting motor mount',
      short: 'TAIL SERVO',
      z: 5,
      after: ['FC'],
      polar: ['linkage correct', 'servo reversed'],
      what: 'A servo tilts the tail motor +/-35 degrees to yaw: smooth, rudder-like turns instead of torque-yaw. A REVERSED servo is positive feedback: yaw one way, it tilts to help you keep yawing — a pirouette you cannot stop.'
    },
    {
      id: 'XT60',
      name: 'XT60 + cap',
      short: 'XT60 + CAP',
      z: 2,
      after: ['ESC'],
      polar: ['stripe to minus', 'stripe to plus'],
      what: 'Same pigtail, same capacitor job as a quad.'
    },
    {
      id: 'CAM',
      name: 'FPV camera',
      short: 'CAMERA',
      z: 2,
      after: ['FRAME'],
      what: 'A little more upright than a quad: tricopters cruise more than they race.'
    },
    {
      id: 'RX',
      name: 'ELRS receiver',
      short: 'RECEIVER',
      z: 4,
      after: ['FC'],
      what: 'One extra channel rides along: the tail servo needs a real PWM output.'
    },
    {
      id: 'VTX',
      name: 'VTX + antenna',
      short: 'VTX',
      z: 4,
      after: ['FC'],
      what: 'The antenna stands off the tail boom where the prop wash is thin.'
    },
    {
      id: 'TOP',
      name: 'Top plate',
      short: 'TOP PLATE',
      z: 6,
      after: ['FC', 'CAM', 'RX', 'VTX'],
      what: 'A small plate pinches the stack — the battery sits in the Y cradle.'
    },
    {
      id: 'BATT',
      name: 'Battery',
      short: 'BATTERY',
      z: 7,
      after: ['TOP', 'XT60'],
      what: 'Sits further back than a quad\'s pack: the tail motor needs weight on its side of the CG.'
    },
    {
      id: 'PROPS',
      name: 'Props (front pair counter-rotating)',
      short: 'PROPS',
      z: 8,
      after: ['MOTORS', 'TOP'],
      polar: ['props correct', 'swapped'],
      what: 'The front pair must counter-rotate; the tail prop direction only matters to the servo\'s trim.'
    }
  ],

  mpos: MPOS,
  wrongMotor: 2,

  /* ---------------------------------------------------------------- */

  physics(fl: FlightState, dt: number, ctx: PhysCtx): void {
    if (fl.servo === undefined) {
      fl.servo = 0; // tail tilt, degrees (+ = yaw right)
      fl.pir = 0; // pirouette runaway detector
    }
    const s = ctx.stick;
    // stock multirotor, then the tail-servo yaw on top
    ctx.stock(fl, dt);
    if (fl.armed && !fl.crashed) {
      const reversed = ((window as unknown as { __st?: { placed?: { SERVO?: { orient?: number } } } }).__st?.placed?.SERVO?.orient ?? 0) === 1;
      // tail tilt follows the yaw command (reversed = wrong direction)
      const target = (reversed ? -s.yaw * 30 : s.yaw * 30) as number;
      fl.servo = ((fl.servo as number) ?? 0) + (target - ((fl.servo as number) ?? 0)) * Math.min(1, dt * 6);
      if (reversed) {
        // positive feedback: the wrong tilt accelerates the yaw it was correcting
        fl.yaw += s.yaw * rad(140) * dt;
        fl.pir = (fl.pir as number) + dt;
        if ((fl.pir as number) > 1.2 && (fl.pir as number) < 1.4) {
          ctx.say('Pirouette runaway: the tail servo is REVERSED — it helps the yaw it should fight');
        }
      }
    } else {
      fl.servo = 0;
    }
  },

  flyStats(fl) {
    return [{ label: 'Tail tilt', value: `${Math.round(fl.servo as number)}°`, small: true }];
  },

  extraButtons: [
    {
      label: 'Servo test (tail sweep)',
      onClick(): void {
        servoT0 = performance.now();
        craftAnim(4200);
        const reversed = ((window as unknown as { __st?: { placed?: { SERVO?: { orient?: number } } } }).__st?.placed?.SERVO?.orient ?? 0) === 1;
        setTimeout(() => {
          const toast = document.getElementById('toast');
          if (!toast) return;
          toast.textContent = reversed
            ? 'REVERSED: the tail sweeps the WRONG way. In flight that is a pirouette you cannot stop'
            : 'Tail sweeps both ways and centres: servo correct';
          toast.classList.add('show');
        }, 3800);
      }
    }
  ],

  /* ---------------------------------------------------------------- */

  draw(f: Frame, add: DrawAdd, opt: DrawOpt): void {
    const m = opt.m;
    const has = opt.has;
    const U = opt.U;

    // tail tilt: bench sweep animation or flight state
    let servoDeg = 0;
    if (opt.fl && opt.fl.servo !== undefined) servoDeg = opt.fl.servo as number;
    const tSince = servoT0 ? (performance.now() - servoT0) / 1000 : -1;
    if (tSince >= 0 && tSince < 4.2) {
      servoDeg = Math.sin(tSince * 2.4) * 28;
      if (opt.orient('SERVO') === 1 && tSince > 2) servoDeg = -servoDeg;
    }
    const reversedNow = opt.orient('SERVO') === 1 && tSince >= 2 && tSince < 4.2;

    if (has('FRAME')) {
      const F = U('FRAME');
      // Y: two front arms + tail boom
      add([0, 90, 0], obox(F, -8, 8, 20, 190, -5, 0, CARBON, 0.9).svg, 'FRAME');
      for (const side of [-1, 1]) {
        const A = FR.Rz(F, side * rad(60));
        add([side * 90, -60, 0], obox(A, -8, 8, 20, 190, -5, 0, CARBON, 0.9).svg, 'FRAME');
      }
      // centre plate
      add([0, 0, 0], obox(F, -24, 24, -24, 24, -6, 0, CARBON, 0.8).svg, 'FRAME');
    }

    if (has('MOTORS')) {
      const F = U('MOTORS');
      // front pair
      for (const [mx, my] of [[150, -90], [-150, -90]]) {
        const M = FR.T(F, mx, my, 0);
        let svg = ocyl(M, 12, 0, 5, CARBON, 1, 14).svg;
        svg += ocyl(M, 12.5, 5, 18, m, 1, 14).svg;
        add([mx, my, 12], svg, 'MOTORS');
      }
      // tail motor on the tilting mount
      const TF = FR.Rz(FR.T(F, 0, 20, 6), rad(servoDeg));
      let tsvg = ocyl(TF, 12, 0, 5, CARBON, 1, 14).svg;
      tsvg += ocyl(TF, 12.5, 5, 18, m, 1, 14).svg;
      add([0, 8, 14], tsvg, 'MOTORS');
    }

    if (has('ESC')) {
      const F = U('ESC');
      let svg = '';
      for (const [mx, my] of [[110, -70], [-110, -70]]) {
        svg += obox(FR.Rz(FR.T(F, mx, my, -2), rad(Math.atan2(my, mx) * 57.3)), -6, 6, -12, 12, -4, 4, { l: '#dcbd8a', m: '#c4a06a', d: '#8f7146' }, 0.7).svg;
      }
      svg += obox(FR.T(F, 0, 60, -2), -6, 6, -12, 12, -4, 4, { l: '#dcbd8a', m: '#c4a06a', d: '#8f7146' }, 0.7).svg;
      add([0, 0, 0], svg, 'ESC');
    }

    if (has('WIRES')) {
      const F = U('WIRES');
      let svg = '';
      for (const [mx, my] of [[150, -90], [-150, -90]]) {
        svg += tube([FR.pt(F, [mx, my, 4]), FR.pt(F, [mx * 0.5, my * 0.5, 2])], 0.9, WIRE.blu);
      }
      svg += tube([FR.pt(F, [0, 20, 8]), FR.pt(F, [0, 80, 4])], 0.9, WIRE.org);
      add([0, 0, 4], svg, 'WIRES');
    }

    if (has('FC')) {
      const F = U('FC');
      let svg = obox(F, -16, 16, -16, 16, 8, 10, PCB, 0.8).svg;
      const flip = opt.orient('FC') ? -1 : 1;
      svg += otext(F, 10 * flip, -10, 11, '▲', 7, SILK);
      if (opt.power) svg += odisc(F, 2.5, 10.4, '#3e86d9', 0, 10, -12, 12);
      add([0, 0, 10], svg, 'FC');
    }

    if (has('SERVO')) {
      const F = U('SERVO');
      // servo at the tail boom + pushrod + hinge block
      const S = FR.T(F, 0, 34, 4);
      let svg = servoPiece(FR.Rz(S, rad(90)), false).svg;
      svg += tube([FR.pt(S, [0, -8, 2]), FR.pt(F, [10, 12, 8])], 0.7, TIN);
      svg += obox(F, -8, 8, 14, 22, 2, 10, CARBON, 0.7).svg;
      add([0, 30, 6], svg, 'SERVO');
      if (reversedNow) {
        add([0, -40, 40], `<text x="0" y="0" font-family="ui-monospace,Menlo,monospace" font-size="11" font-weight="800" fill="#d6492c" text-anchor="middle" transform="translate(${FR.pt(f, [0, -30, 34]).map((v) => v.toFixed(0)).join(' ')})">WRONG WAY</text>`, 'SERVO');
      }
    }

    if (has('XT60')) {
      const F = U('XT60');
      let svg = tube([FR.pt(F, [-20, 0, 6]), FR.pt(F, [-56, 0, 2])], 1.3, WIRE.red);
      svg += tube([FR.pt(F, [-20, -3, 5]), FR.pt(F, [-56, -6, 2])], 1.3, WIRE.blk);
      svg += obox(F, -58, -44, -6, 6, 0, 12, GOLDMAT, 0.8).svg;
      add([-50, 0, 6], svg, 'XT60');
    }

    if (has('CAM')) {
      const F = U('CAM');
      const lensF = FR.Ry(F, rad(-22));
      let svg = obox(F, 34, 48, -10, 10, 4, 20, m, 0.8).svg;
      svg += ocyl(lensF, 5, 44, 52, CARBON, 0.7, 12, 0, 12).svg;
      add([42, 0, 14], svg, 'CAM');
    }

    if (has('RX')) {
      const F = U('RX');
      let svg = obox(F, -6, 6, -8, 8, 10, 12, PCB, 0.6).svg;
      svg += tube([FR.pt(F, [0, 0, 12]), FR.pt(F, [-14, 0, 26])], 0.5, WIRE.wht);
      add([-8, 6, 14], svg, 'RX');
    }

    if (has('VTX')) {
      const F = U('VTX');
      let svg = obox(F, -10, 10, -10, 10, 10, 12, PCB, 0.7).svg;
      svg += tube([FR.pt(F, [0, 8, 12]), FR.pt(F, [0, 60, 30])], 1.1, WIRE.wht);
      add([0, 4, 13], svg, 'VTX');
    }

    if (has('TOP')) {
      const F = U('TOP');
      let svg = '';
      for (const [sx, sy] of [[-18, -18], [18, -18], [-18, 18], [18, 18]]) {
        svg += ocyl(F, 2.4, 0, 28, TIN, 0.7, 10, sx, sy).svg;
      }
      svg += obox(F, -30, 30, -30, 30, 28, 31, CARBON, 0.9).svg;
      add([0, 0, 30], svg, 'TOP');
    }

    if (has('BATT')) {
      const F = U('BATT');
      const batt = opt.design.batt;
      const col = batt === '4s1800' ? '#3a5f3a' : batt === '4s1500' ? '#8a5f2f' : '#2b2a28';
      add([0, 10, 20], obox(F, -36, 36, -16, 16, 31, 60, { l: col, m: '#413f3d', d: '#26241f' } as Tone, 0.9).svg, 'BATT');
    }

    if (has('PROPS') && !opt.broken) {
      const F = U('PROPS');
      const swapped = opt.orient('PROPS') === 1;
      const positions: Array<[number, number, number, 'CW' | 'CCW', number]> = [
        [150, -90, 18, 'CCW', 1],
        [-150, -90, 18, 'CW', 0],
        [0, 20, 24, 'CW', 2]
      ];
      positions.forEach(([px, py, pz, dir, spinIdx]) => {
        const ccw = (dir === 'CCW') !== swapped;
        const P = FR.Rz(FR.T(F, px, py, pz), rad(px === 0 ? servoDeg : 0));
        const rate = (opt.rpm[spinIdx] as number) ?? 0;
        if (rate > 0.12) {
          // prop blur disc + ghost blades + tip streaks
          add([px, py, pz + 2], propDisc(P, 63, rate, opt.spin[spinIdx] * (ccw ? -1 : 1)), 'PROPS');
        } else {
          let svg = '';
          const spin = opt.spin[spinIdx] || 0;
          for (let b = 0; b < 3; b++) {
            const a = spin * (ccw ? -1 : 1) + (b * Math.PI * 2) / 3;
            const B = FR.Rz(P, a);
            const bladeF = FR.Rx(B, ccw ? rad(10) : rad(-10));
            svg += obox(bladeF, 6, 63, -4.5, 4.5, -0.7, 0.7, { l: '#f4b829', m: '#d49c1f', d: '#4e4a18' }, 0.7).svg;
          }
          add([px, py, pz + 2], svg, 'PROPS');
        }
      });
    }
  },

  hull(f: Frame): Vec3[] {
    const pts: Vec3[] = [];
    for (const [mx, my] of MPOS) {
      pts.push(FR.pt(f, [mx, my, 20]));
    }
    pts.push(FR.pt(f, [0, 10, 60]));
    pts.push(FR.pt(f, [42, 0, 20]));
    return pts;
  },

  tags: [
    ['FC', [0, 0, 12], 44, -38],
    ['SERVO', [0, 34, 10], -30, 40],
    ['MOTORS', [150, -90, 20], 40, -20],
    ['BATT', [0, 10, 62], 24, -40]
  ],

  wiring: {
    nodes(d, c) {
      return {
        BATT: [20, 238, 'BATTERY', (c.battName as string) || '4S 2200', '#e2483d'],
        XT60: [190, 238, 'XT60 + CAP', 'low-ESR', '#e2483d'],
        ESC: [360, 238, 'ESC x3', '30A singles', '#e2483d'],
        MOTORS: [600, 238, 'MOTORS x3', (c.motorName as string) || '2306 2450KV', '#f08a2b'],
        FC: [360, 70, 'FLIGHT CTRL', 'F4, mixer TRI', '#3e86d9'],
        SERVO: [140, 70, 'TAIL SERVO', 'PWM output 5', '#f08a2b'],
        CAM: [600, 14, 'CAMERA', 'in the nose', '#43a35a'],
        VTX: [600, 116, 'VTX', '5.8 GHz', '#8c4bd1']
      };
    },
    links: [
      { from: 'BATT', to: 'XT60', kind: 'power', label: 'XT60' },
      { from: 'XT60', to: 'ESC', kind: 'power', label: 'VBAT' },
      { from: 'ESC', to: 'MOTORS', kind: 'motor', label: '3-phase x3' },
      { from: 'XT60', to: 'FC', kind: 'power', label: '5V + VBAT' },
      { from: 'FC', to: 'SERVO', kind: 'motor', label: 'PWM + 5V' },
      { from: 'FC', to: 'CAM', kind: 'video', label: 'camera' },
      { from: 'FC', to: 'VTX', kind: 'data', label: 'SmartAudio' }
    ]
  },

  overview: `<p>A tricopter is three motors in a Y with one trick: the tail motor sits on a hinge, and a servo tilts it sideways to yaw. The front pair counter-rotates; the tail trims whatever torque is left over — with a real moving surface, not motor-speed tricks.</p>
<p>The reward is yaw that feels like a rudder: smooth, constant, reversible. Quads yaw by speeding up two motors and slowing the others, which costs authority; a tilted tail just pushes. The cost is the servo — the one mechanical part on an otherwise brushless airframe, and the first thing to check when a tri spins.</p>
<p>Betaflight flies it with mixer TRI: M1 is the tail, and servo output 5 follows the yaw command. The CG sits further back than a quad's — the tail motor wants some weight to work against.</p>`,

  buildCode: `# tricopter setup, in the Betaflight CLI:
mixer TRI
resource MOTOR 1 A08      # tail
resource MOTOR 2 A09      # front-right
resource MOTOR 3 A10      # front-left
resource SERVO 1 A11      # tail tilt on servo 1
set servo_center_pulse = 1500
set servo_endpoints 1 1250 1750
set tri_unarmed_servo = OFF
save`,

  quiz: [
    {
      q: 'How does a tricopter yaw?',
      a: ['A servo tilts the tail motor sideways', 'One motor spins faster', 'The props change pitch'],
      ok: 0
    },
    {
      q: 'The tail servo is plugged in reversed. What happens?',
      a: ['Nothing, the FC notices', 'Positive feedback: a pirouette you cannot stop', 'It only yaws left'],
      ok: 1
    },
    {
      q: 'Compared with quad yaw, tail-tilt yaw feels...',
      a: ['Weaker', 'Like a rudder: smooth and constant', 'Faster but drifty'],
      ok: 1
    },
    {
      q: 'What is the weak point of the design?',
      a: ['The servo: the only mechanical part on an otherwise brushless airframe', 'The props', 'The radio'],
      ok: 0
    }
  ],

  practice:
    'Run the servo test, then fly the park slalom. Yaw through the lamp-posts with the tail and feel the difference from torque-yaw.',

  modes: {
    alt: {
      title: 'Altitude hold (easy)',
      code: 'aux 1 ANGLE\naux 2 ALTHOLD',
      hint: 'The FC holds height',
      alt: true
    },
    angle: { title: 'Angle mode', code: 'set angle_limit = 40', hint: 'Self-levelling' },
    acro: { title: 'Acro (rate) mode', code: 'set roll_srate = 70', hint: 'Sticks = rates' }
  },

  range: {
    title: 'Park slalom',
    brief: 'Slalom the lamp posts, orbit the fountain, thread the gazebo.',
    field: 34,
    pad: [17, 5],
    ground: '#d5dfc5',
    alt: true,
    keepGates: false,
    camTilt: 22,
    prims: [
      // paths
      { t: 'flat', x: 17, y: 16, w: 2.4, d: 22, col: '#c9c4b4' },
      { t: 'flat', x: 17, y: 16, w: 22, d: 2.4, col: '#c9c4b4' },
      // pond + fountain
      { t: 'disc', x: 17, y: 24, r: 4.5, col: '#9ec4cc', label: 'POND' },
      { t: 'cyl', x: 17, y: 24, r: 0.5, h: 1.6, col: '#c9c2b2' },
      // lamp-post slalom
      { t: 'pole', x: 12, y: 10, h: 3.2, col: '#55504a' },
      { t: 'pole', x: 22, y: 12, h: 3.2, col: '#55504a' },
      { t: 'pole', x: 12, y: 16, h: 3.2, col: '#55504a' },
      { t: 'pole', x: 22, y: 18, h: 3.2, col: '#55504a' },
      { t: 'pole', x: 12, y: 22, h: 3.2, col: '#55504a' },
      // gazebo with pyramid roof
      { t: 'box', x: 27, y: 27, w: 3, d: 3, h: 2.4, col: '#e2dccb' },
      { t: 'house', x: 27, y: 27, w: 0.1, d: 0.1, h: 2.4, roof: 1.6, roofCol: '#b05a4a' },
      // benches + oak + playground
      { t: 'box', x: 8, y: 12, w: 1.2, d: 0.4, h: 0.45, col: '#a9825a' },
      { t: 'tree', x: 7, y: 24, h: 9 },
      { t: 'box', x: 8, y: 30, w: 2, d: 2, h: 1.6, col: '#d49c1f' },
      { t: 'pole', x: 9, y: 31, h: 2.4, col: '#ef6a4c' }
    ],
    goals: [
      { x: 17, y: 11, z: 1.4, r: 1, heading: 0, label: 'SLALOM START' },
      { x: 17, y: 20, z: 1.4, r: 1, heading: 0, label: 'SLALOM END' },
      { x: 17, y: 24, z: 2.4, r: 1.6, label: 'ORBIT FOUNTAIN' },
      { x: 27, y: 27, z: 3.2, r: 1.4, label: 'OVER GAZEBO' },
      { x: 17, y: 5, z: 0.8, r: 1.4, label: 'LAND' }
    ]
  }
};

void INK;
