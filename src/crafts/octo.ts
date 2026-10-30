/**
 * Fig. 13 — the heavy-lift octocopter: a flat octo X on 12S, a cinema camera
 * on a 3-axis gimbal, and the redundancy lesson: lose one motor and the
 * other seven carry it home.
 */

import { Vec3, Tone, INK } from '../engine/core';
import { FR, rad } from '../engine/frames';
import type { Frame } from '../engine/frames';
import { obox, ocyl, odisc, otext, tube } from '../engine/oshapes';
import { CARBON, PCB, SILK, WIRE, TIN } from '../engine/materials';
import type { CraftRecord, DrawOpt, DrawAdd, FlightState, PhysCtx } from '../types';

/** Bench draw scale: the 1.36 m craft at ~40%. */
const SC = 0.4;

const MPOS: Array<[number, number, string, 'CW' | 'CCW']> = (
  [
    [-260, -108, 'M1', 'CCW'],
    [-108, -260, 'M2', 'CW'],
    [108, -260, 'M3', 'CCW'],
    [260, -108, 'M4', 'CW'],
    [260, 108, 'M5', 'CCW'],
    [108, 260, 'M6', 'CW'],
    [-108, 260, 'M7', 'CCW'],
    [-260, 108, 'M8', 'CW']
  ] as Array<[number, number, string, 'CW' | 'CCW']>
).map(([x, y, n, d]) => [x * SC, y * SC, n, d] as [number, number, string, 'CW' | 'CCW']);

const GIMBAL_DARK: Tone = { l: '#55504a', m: '#3d3935', d: '#272421' };

export const octo: CraftRecord = {
  key: 'octo',
  fig: 13,
  name: 'Heavy-lift octocopter',
  sub: 'redundancy',
  hint: 'climb, lose a motor, bring it home on seven',
  noun: 'octocopter',
  palette: 'blush',
  log: 'ardupilot',
  mat: 420,
  benchH: 200,
  flyScale: 0.85,
  flyVB: 17000,
  hitR: 0.6,
  ceiling: 40,
  drag: 0.09,
  camZ: 0.7,
  fpvProps: false,
  kThrust: 52,
  gPerW: 9.5,
  minTW: 1.7,
  design: { batt: '2x6s16000', motor: '6010-170', prop: '20x5.5' },

  batts: {
    '2x6s16000': { name: '2x6S 16000 (series)', cells: 12, mah: 16000, g: 3900, price: 580, col: '#2b2a28', lab: '12S 16Ah' },
    '2x6s22000': { name: '2x6S 22000 (series)', cells: 12, mah: 22000, g: 5400, price: 760, col: '#2f5fa8', lab: '12S 22Ah' },
    '6s16000': { name: '1x6S 16000', cells: 6, mah: 16000, g: 1950, price: 290, col: '#8a5f2f', lab: '6S 16Ah' }
  },
  motors: {
    '6010-170': { name: '6010 170KV', kv: 170, g: 285, price: 120 },
    '6010-130': { name: '6010 130KV', kv: 130, g: 285, price: 120 },
    '6215-230': { name: '6215 230KV', kv: 230, g: 360, price: 160 }
  },
  props: {
    '20x5.5': { name: '20x5.5 folding', pf: 1.0, eff: 1.0, g: 62, price: 85 },
    '18x5.5': { name: '18x5.5 folding', pf: 0.82, eff: 1.02, g: 52, price: 70 },
    '22x5.5': { name: '22x5.5 folding', pf: 1.2, eff: 0.98, g: 74, price: 100 }
  },
  fixed: [
    { id: 'FRAME', name: '1360 mm flat octo X', g: 3200, price: 900, cat: 'Mechanical' },
    { id: 'ESC', name: '8x 80A ESCs', g: 640, price: 480, cat: 'Electrical' },
    { id: 'FC', name: 'Pixhawk 6X', g: 60, price: 380, cat: 'Electrical' },
    { id: 'GPS', name: 'dual GPS + mast', g: 70, price: 120, cat: 'Electrical' },
    { id: 'PDB', name: '12S power board + XT90-S', g: 180, price: 90, cat: 'Electrical' },
    { id: 'RT', name: 'RC + 900 MHz telemetry', g: 60, price: 150, cat: 'Electrical' },
    { id: 'RETRACT', name: 'retractable landing gear', g: 600, price: 350, cat: 'Mechanical' },
    { id: 'GIMBAL', name: '3-axis gimbal', g: 1400, price: 1800, cat: 'Electrical' },
    { id: 'CINE', name: 'cinema camera + lens', g: 2300, price: 0, cat: 'Mechanical' },
    { id: 'TRAY', name: 'battery tray + straps', g: 300, price: 60, cat: 'Mechanical' }
  ],

  parts: [
    {
      id: 'RETRACT',
      name: 'Retractable landing gear',
      short: 'RETRACTS',
      z: 0,
      what: 'Tall legs that fold UP after take-off: the 3-axis gimbal needs to pan a full 360 degrees under the craft without seeing a leg.'
    },
    {
      id: 'FRAME',
      name: 'Flat octo X, 1360 mm, twin octagonal plates',
      short: 'OCTO FRAME',
      z: 1,
      what: 'Eight arms, eight folding prop hubs, two big plates clamping them. Flat octo X: one motor per arm, all on one plane — simpler to inspect than coaxial X8.'
    },
    {
      id: 'MOTORS',
      name: '8x 6010 motors',
      short: 'MOTORS',
      z: 2,
      after: ['FRAME'],
      what: '170 KV on 12S: enormous, slow, sealed. 12S halves the current the same power would need on 6S — thinner wires, cooler ESCs.'
    },
    {
      id: 'ESC',
      name: '8x 80A arm ESCs',
      short: 'ESCS',
      z: 2,
      after: ['FRAME'],
      what: 'One per arm under the propwash. Telemetry on the CAN bus: the mixer sees a struggling motor before it becomes a missing motor.'
    },
    {
      id: 'WIRES',
      name: 'Motor + power wiring',
      short: 'WIRES',
      z: 3,
      after: ['MOTORS', 'ESC'],
      what: 'At 50 V the currents stay civilised — that is the whole reason for 12S on a 15 kg aircraft.'
    },
    {
      id: 'PDB',
      name: '12S power board + XT90-S anti-spark',
      short: 'XT90-S + PDB',
      z: 3,
      after: ['ESC'],
      polar: ['pins to the board', 'pins backwards'],
      what: 'A big power board and an anti-spark connector: 16 Ah into eight ESCs would weld anything less.'
    },
    {
      id: 'FC',
      name: 'Pixhawk 6X flight controller',
      short: 'PIXHAWK 6X',
      z: 4,
      after: ['ESC'],
      polar: ['arrow forward', 'arrow backward'],
      what: 'Triple IMU, the heavy-lift standard. The mixer can rebalance around a dead motor on the fly.'
    },
    {
      id: 'GPS',
      name: 'Dual GPS on a mast',
      short: 'DUAL GPS',
      z: 6,
      after: ['FC'],
      what: 'Two receivers, one mast: cross-checked position. This close to a gimbal motor, the compasses live up here too.'
    },
    {
      id: 'RT',
      name: 'RC + 900 MHz telemetry',
      short: 'RC + TELEM',
      z: 5,
      after: ['FC'],
      what: 'Two whips: control and the live-downlink for the camera team.'
    },
    {
      id: 'GIMBAL',
      name: '3-axis gimbal (pan / roll / tilt)',
      short: 'GIMBAL',
      z: 5,
      after: ['FC'],
      what: 'Its own IMU and three brushless motors counter-rotating the camera: the horizon stays level while the craft banks. Balance the camera BEFORE power-up.'
    },
    {
      id: 'CINE',
      name: 'Cinema camera + lens',
      short: 'CAMERA',
      z: 5,
      after: ['GIMBAL'],
      what: 'The payload that justifies all 15 kilograms. 2.3 kg of glass and sensor hanging under the nose.'
    },
    {
      id: 'BATT',
      name: '2x 6S packs in series',
      short: 'BATTERY',
      z: 7,
      after: ['PDB'],
      what: 'Two 6S packs in series make the 12S. Series pairs must be same age, same charge — the weaker cell decides the flight.'
    },
    {
      id: 'PROPS',
      name: '8x 20-inch folding props',
      short: 'PROPS',
      z: 8,
      after: ['MOTORS'],
      polar: ['props correct', 'swapped'],
      what: 'Check prop-to-prop clearance: two 22-inch props on this frame would overlap. Folding hubs so the craft packs small.'
    }
  ],

  mpos: MPOS,
  wrongMotor: 6,
  calLabel: 'Calibrate accelerometer + compasses',

  calc(d) {
    const batt = this.batts[d.batt] ?? Object.values(this.batts)[0];
    const motor = this.motors[d.motor] ?? Object.values(this.motors)[0];
    const prop = this.props[d.prop] ?? Object.values(this.props)[0];
    const n = 8;
    const V = batt.cells * 3.7;
    const krpm = (motor.kv * V) / 1000;
    const thrust = this.kThrust * prop.pf * krpm * krpm;
    const auw = this.fixed.reduce((s, f) => s + f.g, 0) + n * motor.g + n * prop.g + batt.g;
    const tw = (n * thrust) / auw;
    const hoverW = auw / (this.gPerW * prop.eff);
    const hoverA = hoverW / V;
    const hoverMin = ((batt.mah / 1000) * 0.8) / hoverA * 60;
    const flyMin = hoverMin * 0.78; // steady cine work
    const maxA = (n * thrust) / (2 * prop.eff) / V;
    const over = motor.kv * batt.cells > 1800 * 12 * 1.15;
    const weak = tw < 1.7;
    const hoverThr = Math.sqrt(auw / (n * thrust));
    let costE = 0;
    let costM = 0;
    let nE = 0;
    let nM = 0;
    for (const f of this.fixed) {
      if (f.cat === 'Electrical') {
        costE += f.price;
        nE++;
      } else {
        costM += f.price;
        nM++;
      }
    }
    costE += motor.price * n + batt.price;
    nE += 2;
    costM += prop.price * 4;
    nM += 1;
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
      nElect: nE,
      nMech: nM,
      n,
      cells: batt.cells,
      mah: batt.mah,
      battName: batt.name,
      motorName: motor.name,
      propName: prop.name
    };
  },

  calcRows(c) {
    return [
      { label: 'All-up weight', value: `${(c.auw / 1000).toFixed(1)} kg` },
      { label: 'Thrust : weight', value: `${c.tw.toFixed(2)} : 1` },
      { label: 'Hover throttle', value: `${Math.round(c.hoverThr * 100)} %` },
      { label: 'Max current', value: `${Math.round(c.maxA)} A` },
      { label: 'Hover time', value: `${c.hoverMin.toFixed(1)} min` },
      { label: 'Cine time', value: `${(c.flyMin as number).toFixed(1)} min` }
    ];
  },

  warnings(d, c) {
    if (d.prop === '22x5.5') {
      return ['Two 22-inch props on this frame OVERLAP: prop-to-prop clearance fails. 20-inch is the limit at 1360 mm.'];
    }
    if (d.motor === '6215-230' && d.batt !== '6s16000') {
      return [`230 KV on 12S is ${(230 * 12 * 3.7 / 1000).toFixed(0)}k rpm: ESC 6 will overheat and desync mid-air. This motor is a 6S part.`];
    }
    void c;
    return [];
  },

  /* ---------------------------------------------------------------- */
  /* motor-out redundancy demo                                         */
  /* ---------------------------------------------------------------- */

  physics(fl: FlightState, dt: number, ctx: PhysCtx): void {
    if (fl.dead === undefined) {
      fl.dead = 0; // 1-based index of the dead motor, 0 = none
      fl.retracted = false;
    }
    const s = ctx.stick;
    const mode = (fl.mode as string) ?? 'loiter';

    // retract gear above 1.2 m
    if (fl.armed && fl.pos[2] > 1.2 && !fl.retracted) {
      fl.retracted = true;
      ctx.say('Gear up: the gimbal can pan 360 now');
    } else if (fl.pos[2] < 0.6 && fl.retracted) {
      fl.retracted = false;
    }

    // motorfail mode: climb past 2 m and motor 3 dies
    if (mode === 'motorfail' && fl.armed && !fl.crashed && (fl.dead as number) === 0 && fl.pos[2] > 2) {
      fl.dead = 3;
      ctx.say('Motor 3 is OUT — the other seven carry it');
      // mixer rebalance: less total thrust, slight yaw drift
      const c = fl.c;
      const wet = { ...c, n: 7, thrust: (c.thrust as number) * 1.04 };
      fl.c = wet;
    }

    if ((fl.dead as number) > 0 && fl.armed && !fl.crashed) {
      // unbalanced torque: slow yaw drift
      fl.yaw += rad(9) * dt;
    }

    if (mode === 'rtl' && fl.armed && !fl.crashed) {
      const HOME = { x: 20, 6: 0 } as unknown as { x: number; y: number };
      HOME.y = 6;
      const dx = HOME.x - fl.pos[0];
      const dy = HOME.y - fl.pos[1];
      const dist = Math.hypot(dx, dy);
      if (fl.pos[2] < 10 && dist > 2) {
        s.thr = 0.6;
      } else if (dist > 2) {
        s.thr = 0;
        const bearing = Math.atan2(dy, dx);
        let err = bearing - fl.yaw;
        while (err > Math.PI) err -= 2 * Math.PI;
        while (err < -Math.PI) err += 2 * Math.PI;
        s.yaw = Math.max(-0.4, Math.min(0.4, err * 1.4));
        s.pitch = Math.min(0.22, dist * 0.08);
      } else {
        s.pitch = 0;
        s.yaw = 0;
        s.thr = -0.28;
        if (fl.pos[2] <= 0.16) {
          fl.armed = false;
          ctx.say('Home: landed and disarmed on seven motors');
        }
      }
    }
    ctx.stock(fl, dt);
  },

  flyStats(fl) {
    const dead = fl.dead as number;
    return [
      { label: 'Motors', value: dead ? `${9 - dead - 0}/8` : '8/8', small: true },
      { label: 'Gear', value: fl.retracted ? 'UP' : 'DOWN', small: true }
    ];
  },

  extraButtons: [
    {
      label: 'Kill motor 3 (demo)',
      inFlight: true,
      onClick(fl: FlightState | null): void {
        if (!fl || !fl.armed || fl.crashed) return;
        if ((fl.dead as number) > 0) return;
        fl.dead = 3;
      }
    }
  ],

  /* ---------------------------------------------------------------- */

  draw(f: Frame, add: DrawAdd, opt: DrawOpt): void {
    const m = opt.m;
    const has = opt.has;
    const U = opt.U;
    const s = (v: number): number => v * SC;
    const retracted = opt.fl ? (opt.fl.retracted as boolean) : false;
    const dead = opt.fl ? (opt.fl.dead as number) : 0;

    if (has('RETRACT')) {
      const F = U('RETRACT');
      for (const [gx, gy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1]
      ]) {
        const leg = retracted ? FR.Rx(FR.T(F, s(gx * 150), s(gy * 150), s(-8)), rad(gx * 78)) : FR.T(F, s(gx * 150), s(gy * 150), s(-8));
        add([s(gx * 160), s(gy * 160), s(-40)], tube([FR.pt(leg, [0, 0, 0]), FR.pt(leg, [0, s(gy * 30), s(-190)])], s(8), TIN), 'RETRACT');
      }
    }

    if (has('FRAME')) {
      const F = U('FRAME');
      let svg = '';
      for (const [mx, my] of MPOS) {
        const a = Math.atan2(my, mx);
        const A = FR.Rz(F, a);
        svg += obox(A, s(70), s(280), s(-13), s(13), s(28), s(44), CARBON, 0.9).svg;
      }
      svg += obox(F, s(-150), s(150), s(-150), s(150), s(6), s(30), CARBON, 1).svg;
      svg += obox(F, s(-130), s(130), s(-130), s(130), s(52), s(64), CARBON, 0.9).svg;
      add([0, 0, s(35)], svg, 'FRAME');
    }

    if (has('MOTORS')) {
      const F = U('MOTORS');
      MPOS.forEach(([mx, my, _n, _d], i) => {
        const M = FR.T(F, mx, my, s(44));
        const deadMat: Tone = dead === i + 1 ? { l: '#8a857e', m: '#6d6862', d: '#4a463f' } : m;
        let svg = ocyl(M, s(24), 0, s(14), CARBON, 1, 16).svg;
        svg += ocyl(M, s(25), s(14), s(40), deadMat, 1, 16).svg;
        if (dead === i + 1) {
          svg += otext(M, 0, 0, s(44), 'X', s(14), '#d6492c');
        }
        add([mx, my, s(30)], svg, 'MOTORS');
      });
    }

    if (has('ESC')) {
      const F = U('ESC');
      let svg = '';
      for (const [mx, my] of MPOS) {
        const a = Math.atan2(my, mx);
        svg += obox(FR.Rz(FR.T(F, mx * 0.7, my * 0.7, s(30)), a), s(-10), s(10), s(-22), s(22), 0, s(14), { l: '#dcbd8a', m: '#c4a06a', d: '#8f7146' }, 0.7).svg;
      }
      add([0, 0, s(34)], svg, 'ESC');
    }

    if (has('WIRES')) {
      const F = U('WIRES');
      let svg = '';
      MPOS.forEach(([mx, my], i) => {
        svg += tube([FR.pt(F, [mx, my, s(40)]), FR.pt(F, [mx * 0.62, my * 0.62, s(36)])], s(3), i % 2 ? WIRE.org : WIRE.blu);
      });
      add([0, 0, s(38)], svg, 'WIRES');
    }

    if (has('PDB')) {
      const F = U('PDB');
      let svg = obox(F, s(-60), s(60), s(-60), s(60), s(30), s(38), PCB, 0.9).svg;
      for (const cx of [-30, 0, 30]) {
        svg += ocyl(F, s(7), s(38), s(50), { l: '#e2483d', m: '#c23830', d: '#7d1f1a' }, 0.8, 10, cx, 0).svg;
      }
      svg += obox(F, s(66), s(84), s(-12), s(12), s(28), s(40), { l: '#d49c1f', m: '#b9861a', d: '#7d5a10' }, 0.8).svg;
      add([s(70), 0, s(36)], svg, 'PDB');
    }

    if (has('FC')) {
      const F = U('FC');
      let svg = obox(F, s(-26), s(26), s(-26), s(26), s(38), s(52), { l: '#f4b829', m: '#d49c1f', d: '#4e4a18' }, 0.9).svg;
      svg += otext(F, 0, 0, s(54), 'PIXHAWK 6X', s(9), INK);
      if (opt.power) svg += odisc(F, s(4), s(53), '#43c25c', 0, 10, s(-16), s(16));
      add([0, 0, s(46)], svg, 'FC');
    }

    if (has('GPS')) {
      const F = U('GPS');
      let svg = tube([FR.pt(F, [0, 0, s(64)]), FR.pt(F, [0, 0, s(130)])], s(3.4), CARBON);
      svg += ocyl(FR.T(F, 0, 0, s(130)), s(13), 0, s(9), CARBON, 0.8, 12).svg;
      svg += ocyl(FR.T(F, 0, 0, s(139)), s(13), 0, s(8), { l: '#ef6a4c', m: '#cf5038', d: '#4a2219' }, 0.7, 12).svg;
      add([0, 0, s(110)], svg, 'GPS');
    }

    if (has('RT')) {
      const F = U('RT');
      let svg = tube([FR.pt(F, [s(60), s(60), s(64)]), FR.pt(F, [s(60), s(60), s(120)])], s(2), WIRE.wht);
      svg += tube([FR.pt(F, [s(-60), s(60), s(64)]), FR.pt(F, [s(-60), s(60), s(120)])], s(2), WIRE.wht);
      add([0, s(60), s(100)], svg, 'RT');
    }

    if (has('GIMBAL')) {
      const F = U('GIMBAL');
      // hanging mount + level gimbal (own IMU: ignores craft attitude)
      const base = opt.fl ? FR.Rz(FR.I(f.o[0], f.o[1], f.o[2]), (opt.fl.yaw ?? 0)) : f;
      const G = FR.T(base, 0, 0, s(-20));
      let svg = tube([FR.pt(G, [0, 0, 0]), FR.pt(G, [0, 0, s(-60)])], s(4), TIN);
      // roll motor + tilt motor + camera
      svg += ocyl(FR.Rz(FR.T(G, s(-34), 0, s(-70)), rad(90)), s(11), s(-8), s(8), GIMBAL_DARK, 0.9, 14).svg;
      svg += obox(G, s(-34), s(34), s(-14), s(14), s(-84), s(-56), GIMBAL_DARK, 0.9).svg;
      svg += ocyl(FR.Rx(FR.T(G, 0, 0, s(-84)), rad(90)), s(11), s(-8), s(8), GIMBAL_DARK, 0.9, 14).svg;
      add([0, 0, s(-70)], svg, 'GIMBAL');
    }

    if (has('CINE')) {
      const F = U('CINE');
      const base = opt.fl ? FR.Rz(FR.I(f.o[0], f.o[1], f.o[2]), (opt.fl.yaw ?? 0)) : f;
      const C = FR.T(base, 0, 0, s(-100));
      let svg = obox(C, s(-30), s(24), s(-16), s(16), s(-14), s(10), { l: '#3a3a3c', m: '#2b2b2d', d: '#1c1c1e' }, 0.9).svg;
      // lens forward
      svg += ocyl(FR.Ry(C, rad(90)), s(10), s(-6), s(20), { l: '#26241f', m: '#1d1b18', d: '#141312' }, 0.8, 14, 0, 0).svg;
      // record dot
      svg += odisc(C, s(2.6), s(11), '#e2483d', 0, 10, s(-24), s(8));
      add([0, 0, s(-100)], svg, 'CINE');
    }

    if (has('BATT')) {
      const F = U('BATT');
      let svg = '';
      for (const bx of [-1, 1]) {
        svg += obox(F, s(bx * 42 - s(38)), s(bx * 42 + s(38)), s(-16), s(16), s(64), s(84), { l: '#2b2a28', m: '#413f3d', d: '#26241f' } as Tone, 0.9).svg;
      }
      svg += otext(F, -s(42), 0, s(88), '6S', s(10), SILK);
      svg += otext(F, s(42), 0, s(88), '6S', s(10), SILK);
      add([0, 0, s(74)], svg, 'BATT');
    }

    if (has('PROPS') && !opt.broken) {
      const F = U('PROPS');
      const swapped = opt.orient('PROPS') === 1;
      MPOS.forEach(([mx, my, _n, d], i) => {
        if (dead === i + 1) return; // dead motor: no prop drawn
        const ccw = (d === 'CCW') !== swapped;
        const P = FR.T(F, mx, my, s(44));
        const rate = (opt.rpm[i] as number) ?? 0;
        if (rate > 0.12) {
          add([mx, my, s(56)], `<circle cx="0" cy="0" r="${s(120)}" fill="#fff" opacity="${(0.14 + 0.18 * rate).toFixed(2)}" transform="translate(${P.o[0].toFixed(1)} ${P.o[1].toFixed(1)}) scale(0.02)"/>`, 'PROPS');
        } else {
          let svg = '';
          const spin = opt.spin[i] || 0;
          for (let b = 0; b < 2; b++) {
            const a = spin * (ccw ? -1 : 1) + (b * Math.PI) / 2;
            const B = FR.Rz(P, a);
            const bladeF = FR.Rx(B, ccw ? rad(7) : rad(-7));
            svg += obox(bladeF, s(26), s(122), s(-10), s(10), s(-1.4), s(1.4), CARBON, 0.8).svg;
          }
          add([mx, my, s(56)], svg, 'PROPS');
        }
      });
    }
  },

  hull(f: Frame): Vec3[] {
    const pts: Vec3[] = [];
    for (const [mx, my] of MPOS) {
      pts.push(FR.pt(f, [mx * 1.1, my * 1.1, 30]));
    }
    pts.push(FR.pt(f, [0, 0, 150]));
    pts.push(FR.pt(f, [0, 0, -120]));
    return pts;
  },

  tags: [
    ['FC', [0, 0, 54 * SC], 60, -60],
    ['GIMBAL', [0, 0, -80 * SC], -40, 40],
    ['MOTORS', [260 * SC, -108 * SC, 40 * SC], 50, -20],
    ['GPS', [0, 0, 145 * SC], 30, -50]
  ],

  wiring: {
    nodes(d, c) {
      return {
        BATT: [20, 238, '2x 6S SERIES', (c.battName as string) || '12S 16Ah', '#e2483d'],
        PDB: [190, 238, 'XT90-S + PDB', '12S board', '#e2483d'],
        ESC: [360, 238, 'ESC x8', '80A, CAN bus', '#e2483d'],
        MOTORS: [600, 238, 'MOTORS x8', (c.motorName as string) || '6010 170KV', '#f08a2b'],
        FC: [360, 70, 'PIXHAWK 6X', 'ArduPilot', '#3e86d9'],
        GPS: [140, 70, 'DUAL GPS', '+ compasses', '#8c4bd1'],
        GIMBAL: [600, 14, 'GIMBAL', '3-axis', '#43a35a'],
        CINE: [600, 116, 'CINE CAMERA', '2.3 kg payload', '#43b05c']
      };
    },
    links: [
      { from: 'BATT', to: 'PDB', kind: 'power', label: 'XT90-S' },
      { from: 'PDB', to: 'ESC', kind: 'power', label: '50 V bus' },
      { from: 'ESC', to: 'MOTORS', kind: 'motor', label: '3-phase x8' },
      { from: 'ESC', to: 'FC', kind: 'data', label: 'CAN' },
      { from: 'FC', to: 'GPS', kind: 'i2c', label: 'GPS x2' },
      { from: 'FC', to: 'GIMBAL', kind: 'data', label: 'gimbal control' },
      { from: 'GIMBAL', to: 'CINE', kind: 'video', label: 'mounted + power' }
    ]
  },

  overview: `<p>A heavy-lift octocopter is a camera crane that flies: eight 6010 motors on 12S, a 3-axis gimbal with its own IMU, and a cinema camera worth more than the aircraft. Fifteen kilograms all-up, and it hovers at half throttle.</p>
<p>Eight motors is about redundancy, not power. A quad that loses a motor falls; an octo rebalances the mixer and flies home on seven — with a slow yaw drift from the unbalanced torque, which is exactly what the demo shows. Flat octo X trades a little efficiency (all props in clean air) for simplicity against coaxial X8, which stacks pairs and loses 15-20% in the wash.</p>
<p>The retractable gear exists for one reason: the gimbal pans a full 360 degrees, and legs would photobomb every second shot. 12S exists for one reason too: at 15 kg, 6S would need currents that cook wires.</p>`,

  buildCode: `# heavy octo setup, ArduPilot params:
param set FRAME_CLASS 3        # OCTA
param set FRAME_TYPE 1         # X
param set MOT_THST_EXPO 0.82   # big slow props
param set MOT_THST_HOVER 0.5
param set ATC_INPUT_TC 0.25    # smooth, it is a crane
param set WPNAV_SPEED 400
param set RTL_ALT 1200
param set SERVOx_FUNCTION 29   # landing gear retract
param set MNT_TYPE 4           # 3-axis gimbal`,

  cliName: 'ArduPilot',
  logName: 'flight log',

  quiz: [
    {
      q: 'Why eight motors on a heavy lift?',
      a: ['More speed', 'Redundancy: lose one and the mixer flies it home on seven', 'Cheaper motors'],
      ok: 1
    },
    {
      q: 'Flat octo X vs coaxial X8?',
      a: ['X8 is more efficient', 'Flat X keeps every prop in clean air; X8 loses 15-20% in the coax wash', 'Identical'],
      ok: 1
    },
    {
      q: 'Why does the gear retract?',
      a: ['Aerodynamics', 'The 3-axis gimbal pans 360 degrees and would see a leg in shot', 'Weight saving'],
      ok: 1
    },
    {
      q: 'Why 12S on a 15 kg aircraft?',
      a: ['More thrust', 'Half the current for the same power: thinner wires, cooler ESCs', 'The radio needs it'],
      ok: 1
    }
  ],

  practice:
    'Climb, kill motor 3, and feel the yaw drift. Then fly the car orbit on seven motors and land — RTL brings it home either way.',

  modes: {
    loiter: {
      title: 'Loiter (heavy)',
      code: 'param set LOIT_SPEED 700',
      hint: 'GPS hold, gentle as a crane',
      alt: true
    },
    motorfail: {
      title: 'Motor-out demo',
      code: '# climb past 2 m: motor 3 dies',
      hint: 'Climb: motor 3 cuts out and the seven carry it',
      alt: true
    },
    rtl: {
      title: 'RTL',
      code: 'param set RTL_ALT 1200',
      hint: 'Home, land, disarm — on whatever motors remain',
      alt: true
    }
  },
  mode: 'loiter',

  range: {
    title: 'Desert film set',
    brief: 'Tracking shots along the road, orbit the hero car, reveal the mesa, land at base camp.',
    field: 50,
    pad: [20, 6],
    ground: '#e0d5b8',
    alt: true,
    keepGates: false,
    camTilt: 10,
    prims: [
      // winding road
      { t: 'flat', x: 24, y: 10, w: 2.6, d: 20, col: '#c9c0a8', label: 'ROAD' },
      { t: 'flat', x: 30, y: 18, w: 14, d: 2.6, col: '#c9c0a8' },
      // base camp
      { t: 'flat', x: 20, y: 6, w: 6, d: 5, col: '#c2b8a0', label: 'BASE CAMP' },
      { t: 'box', x: 16.5, y: 4.5, w: 1.6, d: 1.6, h: 1.6, col: '#d49c1f' },
      { t: 'box', x: 16.8, y: 8, w: 1.6, d: 1.6, h: 1.8, col: '#76a0e2' },
      { t: 'box', x: 24.5, y: 4, w: 2.6, d: 1.4, h: 1.2, col: '#8a857e' }, // camera truck
      { t: 'pole', x: 26, y: 3.2, h: 3, col: '#55504a' }, // light stand
      // hero car (red)
      { t: 'box', x: 24, y: 8, w: 2.2, d: 1.1, h: 0.7, col: '#c23830' },
      { t: 'box', x: 24, y: 8, z: 0.7, w: 1.2, d: 1.0, h: 0.5, col: '#8f2824' },
      // mesa + butte + rocks
      { t: 'cyl', x: 8, y: 30, r: 9, r1: 7, h: 14, col: '#c9a878', n: 8 },
      { t: 'cyl', x: 38, y: 34, r: 4, r1: 3, h: 9, col: '#c9a878', n: 8 },
      { t: 'cyl', x: 14, y: 42, r: 2, r1: 1.6, h: 4, col: '#b89868', n: 7 },
      // saguaro cacti
      { t: 'cyl', x: 30, y: 30, r: 0.35, h: 3, col: '#6aa86b', n: 8 },
      { t: 'cyl', x: 34, y: 24, r: 0.35, h: 2.5, col: '#6aa86b', n: 8 },
      { t: 'cyl', x: 12, y: 16, r: 0.35, h: 3.4, col: '#6aa86b', n: 8 },
      { t: 'cyl', x: 44, y: 12, r: 0.35, h: 2.8, col: '#6aa86b', n: 8 }
    ],
    goals: [
      { x: 24, y: 12, z: 6, r: 2.5, label: 'ROAD TRACK' },
      { x: 24, y: 8, z: 5, r: 2.5, label: 'CAR ORBIT' },
      { x: 8, y: 30, z: 16, r: 3, label: 'MESA REVEAL' },
      { x: 38, y: 34, z: 11, r: 2.5, label: 'THE BUTTE' },
      { x: 20, y: 6, z: 2, r: 2.5, label: 'LAND AT BASE' }
    ]
  }
};
