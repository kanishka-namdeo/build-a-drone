/**
 * Fig. 11 — the swarm micro quad: a Crazyflie 2.1-style research nano where
 * the PCB is the frame. Brushed coreless motors, stacking decks, and a
 * Crazyradio. The signature: a four-drone formation that flies itself.
 */

import { Vec3, Tone, INK } from '../engine/core';
import { FR, rad } from '../engine/frames';
import type { Frame } from '../engine/frames';
import { obox, ocyl, odisc, otext, tube, propDisc } from '../engine/oshapes';
import { CARBON, PCB, SILK, WIRE, TIN } from '../engine/materials';
import type { CraftRecord, DrawOpt, DrawAdd, FlightState, PhysCtx } from '../types';

const MPOS: Array<[number, number, string, 'CW' | 'CCW']> = [
  [-46, -46, 'M1', 'CW'],
  [46, -46, 'M2', 'CCW'],
  [-46, 46, 'M3', 'CCW'],
  [46, 46, 'M4', 'CW']
];

const DECK: Tone = { l: '#d49c1f', m: '#b9861a', d: '#7d5a10' };

export const swarm: CraftRecord = {
  key: 'swarm',
  fig: 11,
  name: 'Swarm micro',
  sub: 'Crazyflie, mocap',
  hint: 'stack the decks, then fly the formation',
  noun: 'nano quad',
  palette: 'cobalt',
  log: 'crazyflie',
  mat: 150,
  benchH: 90,
  flyScale: 6,
  flyVB: 4800,
  hitR: 0.06,
  noSmoke: true,
  kThrust: 0.0011,
  gPerW: 4.4,
  minTW: 1.65,
  design: { batt: '1s250', motor: '7x16', prop: '45mm' },

  batts: {
    '1s250': { name: '1S 250 (stock)', cells: 1, mah: 250, g: 7.1, price: 8, col: '#2b2a28', lab: '1S 250' },
    '1s350': { name: '1S 350', cells: 1, mah: 350, g: 9.6, price: 10, col: '#3a5f3a', lab: '1S 350' },
    '1s450': { name: '1S 450 (heavy)', cells: 1, mah: 450, g: 12.5, price: 11, col: '#8a5f2f', lab: '1S 450' }
  },
  motors: {
    '7x16': { name: '7x16 coreless (stock)', kv: 0, g: 1.6, price: 4 },
    '7x16hp': { name: '7x16 HP', kv: 0, g: 1.7, price: 6 },
    '8x20': { name: '8x20 (big!)', kv: 0, g: 3.4, price: 6 }
  },
  props: {
    '45mm': { name: '45 mm', pf: 1.0, eff: 1.0, g: 0.3, price: 2 },
    '47mm': { name: '47 mm', pf: 1.06, eff: 1.03, g: 0.35, price: 3 }
  },
  fixed: [
    { id: 'FRAME', name: 'PCB frame (the quad itself)', g: 9.5, price: 195, cat: 'Electrical' },
    { id: 'FLOW', name: 'Flow deck v2', g: 1.6, price: 50, cat: 'Electrical' },
    { id: 'LH', name: 'Lighthouse deck', g: 1.8, price: 75, cat: 'Electrical' },
    { id: 'HDR', name: 'pin headers', g: 0.6, price: 4, cat: 'Electrical' },
    { id: 'RADIO', name: 'Crazyradio PA', g: 6, price: 35, cat: 'Electrical' },
    { id: 'STRAP', name: 'battery velcro', g: 0.2, price: 1, cat: 'Mechanical' }
  ],

  parts: [
    {
      id: 'FRAME',
      name: 'Crazyflie PCB: the frame IS the board',
      short: 'PCB FRAME',
      z: 0,
      what: 'The X-shaped PCB is the airframe: STM32F405 + nRF51822, motor driver MOSFETs, and four corner mounts. Weight is the whole game at 27 grams.'
    },
    {
      id: 'MOTORS',
      name: '4 coreless 7x16 motors',
      short: 'MOTORS',
      z: 1,
      after: ['FRAME'],
      what: 'Brushed coreless motors on plastic mounts — the legs ARE the motor mounts. Driven by MOSFETs, not ESCs: no timing, just voltage. They wear out and the drift begins.'
    },
    {
      id: 'WIRES',
      name: 'Motor wires to the MOSFETs',
      short: 'WIRES',
      z: 2,
      after: ['MOTORS'],
      what: 'Two wires per motor, soldered to the board. Polarity matters here: swapping = reversed motor, and brushed motors have no configurator.'
    },
    {
      id: 'BATT',
      name: '1S battery under the board',
      short: 'BATTERY',
      z: 3,
      after: ['FRAME'],
      what: 'The 250 mAh 1S tucks under on velcro. The 450 is a trap: 3 extra grams eats the thrust margin on a 27-gram aircraft.'
    },
    {
      id: 'FLOW',
      name: 'Flow deck v2 (below)',
      short: 'FLOW DECK',
      z: 4,
      after: ['BATT'],
      what: 'An optical-flow sensor + a time-of-flight rangefinder: position hold indoors with no GPS, no motion capture. It needs floor texture — over a blank desk it drifts.'
    },
    {
      id: 'FC',
      name: 'Flight controller (on the PCB)',
      short: 'FLIGHT CTRL',
      z: 2,
      after: ['WIRES'],
      polar: ['arrow forward', 'arrow backward'],
      what: 'The IMU and MCU on the main PCB. The arrow matters as much as on any quad.'
    },
    {
      id: 'LH',
      name: 'Lighthouse deck (on top)',
      short: 'LIGHTHOUSE',
      z: 5,
      after: ['FC'],
      what: 'Four photodiodes that see SteamVR base stations: millimetre positioning in a shared coordinate frame — which is exactly what a swarm needs.'
    },
    {
      id: 'RADIO',
      name: 'Crazyradio PA USB dongle',
      short: 'CRADYRADIO',
      z: 6,
      what: 'One USB dongle talks to many drones by address: the swarm shares one radio.'
    },
    {
      id: 'PROPS',
      name: '45 mm props',
      short: 'PROPS',
      z: 7,
      after: ['MOTORS'],
      polar: ['props correct', 'swapped'],
      what: 'Tiny press-fit props. They go on last like always.'
    }
  ],

  mpos: MPOS,
  wrongMotor: 2,

  calc(d) {
    const batt = this.batts[d.batt] ?? Object.values(this.batts)[0];
    const motor = this.motors[d.motor] ?? Object.values(this.motors)[0];
    const prop = this.props[d.prop] ?? Object.values(this.props)[0];
    const n = 4;
    // coreless motors: thrust from a fixed per-motor figure scaled by size
    const perMotor = motor.name.includes('8x20') ? 18 : motor.name.includes('HP') ? 14.5 : 13.5;
    const thrust = perMotor * prop.pf;
    const auw = this.fixed.reduce((s, f) => s + f.g, 0) + n * motor.g + n * prop.g + batt.g + 9.5;
    const tw = (n * thrust) / auw;
    const V = batt.cells * 3.7;
    const hoverW = auw / (this.gPerW * prop.eff);
    const hoverA = hoverW / V;
    const hoverMin = ((batt.mah / 1000) * 0.8) / hoverA * 60;
    const maxA = (n * thrust) / (2 * prop.eff) / V;
    const weak = tw < 1.65;
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
    nE += 1;
    nM += 1;
    return {
      V,
      krpm: 0,
      thrust,
      auw,
      tw,
      hoverW,
      hoverA,
      hoverMin,
      flyMin: hoverMin,
      maxA,
      over: false,
      weak,
      hoverThr: Math.sqrt(auw / (n * thrust)),
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

  warnings(d, c) {
    if (d.motor === '8x20') {
      return ['The 8x20 motor does not fit the stock mounts and its stall current is past the MOSFET rating: stick to 7x16 on this PCB.'];
    }
    if ((c.tw as number) < 1.75 && d.batt === '1s450') {
      return ['The 450 pack leaves almost no thrust margin: on a 27 g aircraft, 3 g is 11% of the weight.'];
    }
    return [];
  },

  /* the swarm: wingmates fly formation, drawn by recursive draw() calls */
  physics(fl: FlightState, dt: number, ctx: PhysCtx): void {
    if (fl.mates === undefined) {
      fl.mates = [
        { off: [-1, -1], phase: 0 },
        { off: [1, -1], phase: 0 },
        { off: [-1, 1], phase: 0 }
      ];
      fl.formT = 0;
    }
    const mode = (fl.mode as string) ?? 'hover';
    const s = ctx.stick;
    if ((mode === 'swarm' || mode === 'figure8') && fl.armed && !fl.crashed) {
      fl.formT = (fl.formT as number) + dt;
      const t = fl.formT as number;
      if (mode === 'swarm') {
        // takeoff, then rotate the square, then a circle, then a wave
        let cx = 20;
        let cy = 12;
        if (t > 3) {
          const a = (t - 3) * 0.6;
          cx = 20 + Math.cos(a) * 4;
          cy = 12 + Math.sin(a) * 4;
        }
        const r0 = t < 1.5 ? 0.2 : 1.4;
        const wave = t > 10 ? Math.sin(t * 1.2) * 0.7 : 0;
        fl.pos[0] = cx;
        fl.pos[1] = cy;
        fl.pos[2] = Math.min(1.2, t * 0.8);
        const mates = fl.mates as Array<{ off: number[]; phase: number }>;
        for (let i = 0; i < mates.length; i++) {
          const [ox, oy] = mates[i].off;
          mates[i].phase = t;
          void ox;
          void oy;
        }
        if (t > 24) {
          fl.pos[0] = 20;
          fl.pos[1] = 6;
          fl.pos[2] = Math.max(0, 1.2 - (t - 24));
          if (fl.pos[2] <= 0.02) {
            fl.armed = false;
            ctx.say('Formation complete: all four down');
          }
        }
      } else {
        // figure 8 (Lissajous)
        fl.pos[0] = 20 + Math.sin(t * 0.7) * 6;
        fl.pos[1] = 14 + Math.sin(t * 1.4) * 4;
        fl.pos[2] = 1.5 + Math.sin(t * 0.35) * 0.6;
      }
      fl.yaw += 0.6 * dt;
      fl.thrEff = 0.3;
      for (let i = 0; i < 4; i++) fl.spin[i] += dt * (i % 2 ? -50 : 50);
      fl.t += dt;
      fl.step++;
      fl.cam[0] += (fl.pos[0] - fl.cam[0]) * 0.14;
      fl.cam[1] += (fl.pos[1] - fl.cam[1]) * 0.14;
      fl.cam[2] += (fl.pos[2] * 0.8 - fl.cam[2]) * 0.14;
      // battery
      fl.used += (((fl.c.hoverA as number) * 0.5 + 0.2) * dt * 1000) / 3600;
      return;
    }
    ctx.stock(fl, dt);
  },

  flyStats(fl) {
    return [
      { label: 'Swarm', value: `${((fl.mates as unknown[])?.length ?? 0) + 1}/4`, small: true },
      { label: 'Form', value: `${(fl.formT as number)?.toFixed(0) ?? 0} s`, small: true }
    ];
  },

  draw(f: Frame, add: DrawAdd, opt: DrawOpt): void {
    const m = opt.m;
    const has = opt.has;
    const U = opt.U;

    // the lead craft (or the bench craft) is drawn by the normal flow; this
    // draw() also renders the wingmates in swarm mode by calling itself
    drawNano(f, add, opt, this);

    if (opt.fl && (opt.fl.mates as unknown[] | undefined) && ((fl2) => fl2.armed && !fl2.crashed)(opt.fl)) {
      const fl = opt.fl;
      const t = (fl.formT as number) ?? 0;
      const mates = fl.mates as Array<{ off: number[]; phase: number }>;
      for (const mate of mates) {
        const [ox, oy] = mate.off;
        const r0 = t < 1.5 ? 0.25 : 1.2;
        const a = t > 3 ? (t - 3) * 0.6 : 0;
        const wx = fl.pos[0] + ox * r0 * Math.cos(a) - oy * r0 * Math.sin(a);
        const wy = fl.pos[1] + ox * r0 * Math.sin(a) + oy * r0 * Math.cos(a);
        const wz = fl.pos[2] + (t > 10 ? Math.sin(t * 1.2 + ox * 2) * 0.5 : 0);
        const F = FR.S(FR.Rz(FR.I(wx * 1000, wy * 1000, 40 + wz * 1000), fl.yaw), (opt.k || 1) * 0.92);
        drawNano(F, add, { ...opt, all: true, has: () => true }, this, true);
      }
    }
  },

  hull(f: Frame): Vec3[] {
    const pts: Vec3[] = [];
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      pts.push(FR.pt(f, [46 * sx, 46 * sy, 6]));
    }
    pts.push(FR.pt(f, [0, 0, -10]));
    return pts;
  },

  tags: [
    ['FRAME', [0, 0, 8], 46, -36],
    ['LH', [0, 0, 22], 34, -34],
    ['FLOW', [0, 0, -8], -40, 26],
    ['MOTORS', [46, -46, 12], 30, 22]
  ],

  wiring: {
    nodes(d, c) {
      return {
        BATT: [20, 238, 'BATTERY', (c.battName as string) || '1S 250', '#e2483d'],
        XT60: [190, 238, 'PIN HEADER', '2-pin', '#e2483d'],
        FC: [360, 238, 'PCB FRAME', 'STM32 + nRF51', '#3e86d9'],
        MOTORS: [600, 238, 'MOTORS x4', 'coreless + MOSFETs', '#f08a2b'],
        FLOW: [140, 70, 'FLOW DECK', 'optical flow + ToF', '#43a35a'],
        LH: [600, 14, 'LIGHTHOUSE', '4 photodiodes', '#8c4bd1'],
        RADIO: [600, 116, 'CRADYRADIO', 'USB, 1 dongle', '#8c4bd1']
      };
    },
    links: [
      { from: 'BATT', to: 'XT60', kind: 'power', label: '1S' },
      { from: 'XT60', to: 'FC', kind: 'power', label: 'VBAT' },
      { from: 'FC', to: 'MOTORS', kind: 'motor', label: 'MOSFET x4' },
      { from: 'FC', to: 'FLOW', kind: 'i2c', label: 'deck port' },
      { from: 'FC', to: 'LH', kind: 'i2c', label: 'deck port' },
      { from: 'RADIO', to: 'FC', kind: 'rf', label: '2.4 GHz' }
    ]
  },

  overview: `<p>The Crazyflie is a 27-gram research quad where the PCB is the frame and everything else stacks on pin headers: a Flow deck below for optical position, a Lighthouse deck on top for millimetre tracking from SteamVR base stations.</p>
<p>Brushed coreless motors explain most of its behaviour: no ESC timing, just MOSFETs and voltage. The motors wear, thrust drifts, and the position loop quietly compensates until they do not.</p>
<p>The swarm trick is the coordinate frame. Lighthouse gives every drone its position in the SAME frame, and one Crazyradio talks to all of them by address — so formations are just per-drone setpoints from one script.</p>`,

  buildCode: `# the swarm script (cflib, runs on the laptop):
import asyncio
from cflib.crazyflie import Swarm
from cflib.crazyflie.swarm import CachedCfFactory

async def swarm_sequence(swarm):
    swarm.parallel(lambda cf: cf.param.set_value('commander.en_high_level', 1))
    await swarm.parallel_safe(
        lambda cf: cf.high_level.takeoff(1.2, 1.0))
    await asyncio.sleep(3)
    # rotating square -> circle -> altitude wave
    for t in range(...):
        swarm.parallel(positions[t])
    await swarm.parallel_safe(lambda cf: cf.high_level.land(0.0, 1.5))

factory = CachedCfFactory(rw_cache='./cache')
swarm = Swarm(SWARM_URI, factory)
swarm.open_links()
asyncio.run(swarm_sequence(swarm))
swarm.close_links()`,

  cliName: 'cflib',
  logName: 'cflib console',

  quiz: [
    {
      q: 'The PCB is the frame. Why?',
      a: ['It looks good', 'At 27 grams, a separate frame would double the weight', 'It conducts better'],
      ok: 1
    },
    {
      q: 'What does the Flow deck do?',
      a: ['Optical flow + ToF: position hold indoors without GPS — if the floor has texture', 'It cools the MCU', 'It logs flights'],
      ok: 0
    },
    {
      q: 'Why does the whole swarm share one coordinate frame?',
      a: ['Cheaper GPS', 'Lighthouse gives every drone its position in the same frame: formations are just setpoints', 'The radio requires it'],
      ok: 1
    },
    {
      q: 'A motor wears out. You notice...',
      a: ['Nothing, brushed motors are sealed', 'Drift the position loop keeps correcting — until it cannot', 'The props unbalance'],
      ok: 1
    }
  ],

  practice:
    'Fly the swarm formation. Then fly the figure-8 alone and imagine three more of you in the same room at 1.5 metres.',

  modes: {
    hover: {
      title: 'Position hold (Flow)',
      code: "cf.param.set_value('stabilizer.controller', 1)",
      hint: 'Flow-deck hold: it stays where you leave it',
      alt: true
    },
    swarm: {
      title: 'Swarm formation',
      code: '# takeoff -> rotating square -> circle -> wave',
      hint: 'Four fly the choreography: watch the wingmates',
      alt: true
    },
    figure8: {
      title: 'Figure 8',
      code: '# Lissajous setpoints from the script',
      hint: 'One drone, a figure-8 trajectory',
      alt: true
    }
  },
  mode: 'hover',

  range: {
    title: 'The robotics cage',
    brief: 'Through the hoop, round the pillar, land on the desk.',
    field: 7,
    pad: [3.5, 1],
    ground: '#ddd8c8',
    alt: true,
    keepGates: false,
    camTilt: 20,
    prims: [
      // crash mats
      { t: 'flat', x: 2, y: 4, w: 2, d: 2, col: '#c9b8a8' },
      { t: 'flat', x: 5, y: 4, w: 2, d: 2, col: '#c9b8a8' },
      // netted cage posts
      { t: 'pole', x: 0.5, y: 0.5, h: 2.6, col: '#8a8f93' },
      { t: 'pole', x: 6.5, y: 0.5, h: 2.6, col: '#8a8f93' },
      { t: 'pole', x: 0.5, y: 6.5, h: 2.6, col: '#8a8f93' },
      { t: 'pole', x: 6.5, y: 6.5, h: 2.6, col: '#8a8f93' },
      // base stations in the corners
      { t: 'box', x: 1.2, y: 1.2, z: 2.2, w: 0.25, d: 0.25, h: 0.25, col: '#26241f' },
      { t: 'box', x: 5.8, y: 5.8, z: 2.2, w: 0.25, d: 0.25, h: 0.25, col: '#26241f' },
      // foam pillar
      { t: 'cyl', x: 3.5, y: 4, r: 0.4, h: 1.8, col: '#d8a05a' },
      // hoop
      { t: 'gate', x: 5, y: 3, heading: 90, w: 0.8, h: 0.8, col: '#ef6a4c' },
      // desk with laptops
      { t: 'box', x: 1.5, y: 6, w: 1.6, d: 0.8, h: 0.75, col: '#a9825a' },
      { t: 'box', x: 1.2, y: 6, z: 0.75, w: 0.35, d: 0.3, h: 0.05, col: '#55504a' },
      { t: 'box', x: 1.9, y: 6, z: 0.75, w: 0.35, d: 0.3, h: 0.05, col: '#55504a' }
    ],
    goals: [
      { x: 5, y: 3, z: 1, r: 0.45, heading: 90, label: 'THE HOOP' },
      { x: 3.5, y: 4, z: 2.2, r: 0.6, label: 'PILLAR TOP' },
      { x: 2, y: 4, z: 0.8, r: 0.5, label: 'THE MAT' },
      { x: 3.5, y: 1, z: 0.4, r: 0.5, label: 'HOME' }
    ]
  }
};

/** Draw one nano quad (shared by the lead craft + wingmates). */
function drawNano(f: Frame, add: DrawAdd, opt: DrawOpt, self: CraftRecord, mate = false): void {
  const m = opt.m;
  const has = mate ? () => true : opt.has;
  const U = opt.U;

  if (has('FRAME')) {
    const F = mate ? f : U('FRAME');
    let svg = '';
    // X-shaped PCB: two crossed bars
    for (const a of [45, -45]) {
      const B = FR.Rz(F, rad(a));
      svg += obox(B, -60, 60, -7, 7, 0, 2.4, PCB, 0.7).svg;
    }
    if (!mate) {
      svg += otext(F, 0, 0, 5, 'crazyflie', 6, SILK);
      // corner LEDs: front red/green
      svg += odisc(F, 3, 2.6, '#e2483d', 0.4, 8, -46, -46);
      svg += odisc(F, 3, 2.6, '#43c25c', 0.4, 8, 46, -46);
    }
    add([0, 0, 2], svg, 'FRAME');
  }

  if (has('MOTORS')) {
    const F = mate ? f : U('MOTORS');
    MPOS.forEach(([mx, my], i) => {
      const M = FR.T(F, mx, my, 0);
      let svg = ocyl(M, 4, -2, 6, { l: '#d49c1f', m: '#b9861a', d: '#7d5a10' }, 0.7, 10).svg;
      const spin = opt.spin[i] || 0;
      svg += odisc(M, 1.4, 6.4, INK, 0, 6, Math.cos(spin) * 2, Math.sin(spin) * 2);
      add([mx, my, 5], svg, 'MOTORS');
    });
  }

  if (has('WIRES')) {
    const F = mate ? f : U('WIRES');
    let svg = '';
    MPOS.forEach(([mx, my], i) => {
      svg += tube([FR.pt(F, [mx, my, 2]), FR.pt(F, [mx * 0.7, my * 0.7, 1.5])], 0.4, i % 2 ? WIRE.red : WIRE.blk);
    });
    add([0, 0, 2], svg, 'WIRES');
  }

  if (has('FC')) {
    const F = mate ? f : U('FC');
    let svg = obox(F, -6, 6, -6, 6, 2.4, 4.4, PCB, 0.6).svg;
    const flip = opt.orient('FC') ? -1 : 1;
    if (!mate) svg += otext(F, 4 * flip, 0, 5.4, '▲', 5, SILK);
    add([0, 0, 4], svg, 'FC');
  }

  if (has('BATT')) {
    const F = mate ? f : U('BATT');
    const batt = mate ? '1s250' : opt.design.batt;
    const col = batt === '1s350' ? '#3a5f3a' : batt === '1s450' ? '#8a5f2f' : '#2b2a28';
    add([0, 0, -4], obox(F, -11, 11, -7, 7, -8, -2, { l: col, m: '#413f3d', d: '#26241f' } as Tone, 0.7).svg, 'BATT');
  }

  if (has('FLOW')) {
    const F = mate ? f : U('FLOW');
    let svg = obox(F, -11, 11, -11, 11, -11, -9, DECK, 0.7).svg;
    svg += odisc(F, 3, -11.2, '#26241f', 0.4, 10, 0, 0);
    add([0, 0, -10], svg, 'FLOW');
  }

  if (has('LH')) {
    const F = mate ? f : U('LH');
    let svg = obox(F, -11, 11, -11, 11, 6, 8, DECK, 0.7).svg;
    for (const [hx, hy] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) {
      svg += odisc(F, 2, 8.4, '#c6ccce', 0.3, 8, hx, hy);
    }
    add([0, 0, 8], svg, 'LH');
  }

  if (has('RADIO') && !mate) {
    const F = U('RADIO');
    let svg = obox(F, -8, 8, -5, 5, 0, 8, { l: '#d49c1f', m: '#b9861a', d: '#7d5a10' }, 0.7).svg;
    svg += tube([FR.pt(F, [0, 0, 8]), FR.pt(F, [0, 0, 22])], 0.8, TIN);
    svg += otext(F, 0, 0, 12, 'USB', 5, SILK);
    add([70, 50, 8], svg, 'RADIO');
  }

  if (has('PROPS') && !opt.broken) {
    const F = mate ? f : U('PROPS');
    const swapped = opt.orient('PROPS') === 1;
    MPOS.forEach(([mx, my, _n, dir], i) => {
      const ccw = (dir === 'CCW') !== swapped;
      const P = FR.T(F, mx, my, 7);
      const rate = (opt.rpm[i] as number) ?? 0;
      if (rate > 0.12) {
        // prop blur disc + ghost blades + tip streaks
        add([mx, my, 8], propDisc(P, 23, rate, opt.spin[i] * (ccw ? -1 : 1)), 'PROPS');
      } else {
        let svg = '';
        const spin = opt.spin[i] || 0;
        for (let b = 0; b < 2; b++) {
          const a = spin * (ccw ? -1 : 1) + (b * Math.PI) / 2;
          const B = FR.Rz(P, a);
          svg += obox(B, 2, 23, -2.2, 2.2, -0.4, 0.4, { l: '#5d5954', m: '#423e3a', d: '#292623' }, 0.5).svg;
        }
        add([mx, my, 8], svg, 'PROPS');
      }
    });
  }
  void self;
}
