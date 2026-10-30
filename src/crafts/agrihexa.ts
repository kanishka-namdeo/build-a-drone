/**
 * Fig. 08 — the agricultural spray hexacopter: 6 big motors, a 10 L tank,
 * a pump and a spray boom, RTK GPS and a terrain radar.
 *
 * Drawn at 1/4 scale on the bench (SC = 0.25); the field view undoes it.
 * The signature mode is a lawn-mower spray mission: the tank drains, the
 * swath paints the field, and the AUW drops as it empties.
 */

import { Vec3, Tone, INK } from '../engine/core';
import { FR, rad } from '../engine/frames';
import type { Frame } from '../engine/frames';
import { obox, ocyl, odisc, otext, tube } from '../engine/oshapes';
import { CARBON, PCB, SILK, WIRE, TIN } from '../engine/materials';
import type { CraftRecord, DrawOpt, DrawAdd, FlightState, PhysCtx } from '../types';

/** Bench draw scale: the 1.8 m craft at quarter size. */
const SC = 0.25;

const MPOS: Array<[number, number, string, 'CW' | 'CCW']> = (
  [
    [-172, -100, 'M1', 'CW'],
    [172, -100, 'M2', 'CCW'],
    [345, 0, 'M3', 'CW'],
    [172, 100, 'M4', 'CCW'],
    [-172, 100, 'M5', 'CCW'],
    [-345, 0, 'M6', 'CW']
  ] as Array<[number, number, string, 'CW' | 'CCW']>
).map(([x, y, n, d]) => [x * SC, y * SC, n, d] as [number, number, string, 'CW' | 'CCW']);

const TANKMAT: Tone = { l: '#e8f0f2', m: '#c4d5da', d: '#93aab2' };
const LIQUID: Tone = { l: '#93d3b0', m: '#71b693', d: '#1f4034' };

export const agrihexa: CraftRecord = {
  key: 'agrihexa',
  fig: 8,
  name: 'Agri hexacopter',
  sub: 'spray + RTK',
  hint: 'fill it, spray the field, watch the tank drain',
  noun: 'sprayer',
  palette: 'mint',
  log: 'ardupilot',
  mat: 400,
  benchH: 220,
  flyScale: 0.9,
  flyVB: 16000,
  hitR: 0.55,
  ceiling: 30,
  drag: 0.08,
  camZ: 0.75,
  fpvProps: false,
  kThrust: 300,
  gPerW: 9,
  minTW: 1.5,
  design: { batt: '12s22000', motor: '8120-100', prop: '30x9.9' },

  batts: {
    '12s22000': { name: '12S 22000 smart', cells: 12, mah: 22000, g: 5600, price: 620, col: '#2b2a28', lab: '12S 22Ah' },
    '12s16000': { name: '12S 16000 (2x6S)', cells: 12, mah: 16000, g: 4300, price: 480, col: '#2f5fa8', lab: '12S 16Ah' },
    '14s30000': { name: '14S 30000 smart', cells: 14, mah: 30000, g: 9800, price: 1150, col: '#8a5f2f', lab: '14S 30Ah' }
  },
  motors: {
    '8120-100': { name: '8120 100KV', kv: 100, g: 760, price: 180 },
    '10025-80': { name: '10025 80KV', kv: 80, g: 980, price: 260 },
    '6215-180': { name: '6215 180KV', kv: 180, g: 520, price: 120 }
  },
  props: {
    '30x9.9': { name: '30x9.9 folding', pf: 1.0, eff: 1.0, g: 160, price: 70 },
    '28x9.2': { name: '28x9.2 folding', pf: 0.9, eff: 1.04, g: 140, price: 60 },
    '32x11': { name: '32x11 folding', pf: 1.12, eff: 0.96, g: 190, price: 85 }
  },
  fixed: [
    { id: 'FRAME', name: 'folding hexa hub + arms', g: 5200, price: 650, cat: 'Mechanical' },
    { id: 'GEAR', name: 'tall skids', g: 1100, price: 110, cat: 'Mechanical' },
    { id: 'ESC', name: '6x arm FOC ESCs', g: 1800, price: 480, cat: 'Electrical' },
    { id: 'FC', name: 'Cube Orange+ FC', g: 75, price: 400, cat: 'Electrical' },
    { id: 'RTK', name: 'dual RTK GNSS', g: 350, price: 700, cat: 'Electrical' },
    { id: 'RADAR', name: 'terrain radar', g: 250, price: 300, cat: 'Electrical' },
    { id: 'RADIO', name: '900 MHz radio', g: 120, price: 250, cat: 'Electrical' },
    { id: 'AS150', name: 'AS150 anti-spark', g: 150, price: 40, cat: 'Electrical' },
    { id: 'TANK', name: '10 L tank + plumbing', g: 1300, price: 90, cat: 'Mechanical' },
    { id: 'PUMP', name: 'diaphragm pump', g: 900, price: 180, cat: 'Electrical' },
    { id: 'BOOM', name: 'spray boom + 4 nozzles', g: 900, price: 120, cat: 'Mechanical' }
  ],

  parts: [
    {
      id: 'GEAR',
      name: 'Tall landing skids',
      short: 'SKIDS',
      z: 0,
      what: 'Long skids that keep the 30-inch props a metre off the ground: the boom sprays below them, and the craft lands in mud it should not suck into its motors.'
    },
    {
      id: 'FRAME',
      name: 'Folding hexa hub + 6 arms (1.8 m motor to motor)',
      short: 'FRAME',
      z: 1,
      what: 'Six aluminium arms fold along the boom for transport. Six motors = lift, and survival: an octo or hexa loses one and rebalances; a quad loses one and falls.'
    },
    {
      id: 'MOTORS',
      name: '6 sealed 8120 motors',
      short: 'MOTORS',
      z: 2,
      after: ['FRAME'],
      what: '100 KV on 12S: big, slow, sealed against mist. High voltage keeps the current (and the heat) down for the same power.'
    },
    {
      id: 'ESC',
      name: '6 arm-mounted FOC ESCs',
      short: 'ESCS',
      z: 2,
      after: ['FRAME'],
      what: 'Field-oriented control: smoother, quieter current into big motors, and per-motor telemetry — the mixer can see a struggling motor before it dies.'
    },
    {
      id: 'WIRES',
      name: 'Motor wires',
      short: 'WIRES',
      z: 3,
      after: ['MOTORS', 'ESC'],
      what: 'Thick three-phase runs down each arm. At 50 V the currents stay civilised; at 6S they would be monstrous.'
    },
    {
      id: 'XT60',
      name: 'AS150 anti-spark connector',
      short: 'AS150',
      z: 3,
      after: ['ESC'],
      polar: ['pins to the PDB', 'pins backwards'],
      what: 'A 22 Ah pack into six ESCs would weld a plain connector on plug-in. The anti-spark plug passes current through a resistor first, then locks.'
    },
    {
      id: 'FC',
      name: 'Cube Orange+ flight controller',
      short: 'CUBE',
      z: 4,
      after: ['ESC'],
      polar: ['arrow forward', 'arrow backward'],
      what: 'Triple-redundant IMU agriculture standard. Runs the spray mission, the terrain radar and the RTK position loop.'
    },
    {
      id: 'RTK',
      name: 'Dual-antenna RTK GNSS',
      short: 'RTK',
      z: 6,
      after: ['FC'],
      what: 'Centimetre positioning from carrier-phase corrections, and heading from the two antennas — immune to the magnetometer errors a steel shed causes.'
    },
    {
      id: 'RADAR',
      name: 'Terrain radar',
      short: 'RADAR',
      z: 5,
      after: ['FC'],
      what: 'A downward millimetre-radar holding exact altitude over the crop — through dust and mist where a lidar blind and a barometer drifts.'
    },
    {
      id: 'RADIO',
      name: '900 MHz telemetry radio',
      short: 'RADIO',
      z: 5,
      after: ['FC'],
      what: 'Long, slow link to the ground station: mission upload, live tank telemetry, the map.'
    },
    {
      id: 'TANK',
      name: '10 L tank',
      short: 'TANK',
      z: 5,
      after: ['FRAME'],
      what: 'Ten litres of spray is ten kilograms — a third of the craft. Watch the hover throttle step down as the tank empties.'
    },
    {
      id: 'PUMP',
      name: 'Diaphragm pump',
      short: 'PUMP',
      z: 6,
      after: ['TANK'],
      what: 'A pump rate matched to ground speed so every square metre gets the same dose: flow / speed = litres per hectare, held constant.'
    },
    {
      id: 'BOOM',
      name: 'Spray boom + 4 nozzles',
      short: 'BOOM',
      z: 6,
      after: ['PUMP'],
      what: 'The boom hangs under the prop wash on purpose: downwash pushes droplets into the canopy instead of letting them drift to the neighbour\'s field.'
    },
    {
      id: 'BATT',
      name: '12S battery pack',
      short: 'BATTERY',
      z: 7,
      after: ['XT60'],
      what: '22 Ah of smart pack: it reports its own health, because a farm fleet runs on packs, not soldering irons.'
    },
    {
      id: 'PROPS',
      name: '30-inch folding props',
      short: 'PROPS',
      z: 8,
      after: ['MOTORS'],
      polar: ['props out (correct)', 'swapped CW/CCW'],
      what: 'Two big blades each, folding hubs. Slow props are efficient props: this is a lift truck, not a dancer.'
    }
  ],

  mpos: MPOS,
  wrongMotor: 5,
  calLabel: 'Calibrate accelerometer + compass',

  /* ---------------------------------------------------------------- */

  calc(d) {
    const batt = this.batts[d.batt] ?? Object.values(this.batts)[0];
    const motor = this.motors[d.motor] ?? Object.values(this.motors)[0];
    const prop = this.props[d.prop] ?? Object.values(this.props)[0];
    const n = 6;
    const V = batt.cells * 3.7;
    const krpm = (motor.kv * V) / 1000;
    const thrust = this.kThrust * prop.pf * krpm * krpm;
    // full tank = 10 kg of liquid aboard at takeoff
    const auw =
      this.fixed.reduce((s, f) => s + f.g, 0) + n * motor.g + n * prop.g + batt.g + 10000;
    const tw = (n * thrust) / auw;
    const hoverW = auw / (this.gPerW * prop.eff);
    const hoverA = hoverW / V;
    const hoverMin = ((batt.mah / 1000) * 0.8) / hoverA * 60;
    const flyMin = hoverMin * 0.8; // steady spraying, not freestyle
    const maxA = (n * thrust) / (2 * prop.eff) / V;
    const over = motor.kv * batt.cells > 1800 * 12 * 1.15;
    const weak = tw < (this.minTW ?? 1.6);
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
    costM += prop.price * Math.ceil(n / 2);
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
      { label: 'All-up weight (full)', value: `${(c.auw / 1000).toFixed(1)} kg` },
      { label: 'Thrust : weight', value: `${c.tw.toFixed(1)} : 1` },
      { label: 'Hover throttle', value: `${Math.round(c.hoverThr * 100)} %` },
      { label: 'Max current', value: `${Math.round(c.maxA)} A` },
      { label: 'Spray time (full tank)', value: `${c.flyMin.toFixed(1)} min` },
      { label: 'Area per tank', value: `${Math.round(c.flyMin * 60 * 5 * 2.4 / 10000 * 10000) / 10000} ha`.replace(' ha', ' ha') }
    ];
  },

  warnings(d, c) {
    if ((c.maxA as number) > 45 && d.batt !== '14s30000') {
      return [`Li-ion style smart packs sag past ~45 A: this build draws ${Math.round(c.maxA as number)} A at full throttle — check the pack's burst rating.`];
    }
    return [];
  },

  /* ---------------------------------------------------------------- */

  draw(f: Frame, add: DrawAdd, opt: DrawOpt): void {
    const m = opt.m;
    const has = opt.has;
    const U = opt.U;
    const s = (v: number): number => v * SC;

    if (has('GEAR')) {
      const F = U('GEAR');
      let svg = '';
      for (const [gx, gy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1]
      ]) {
        svg += tube([FR.pt(F, [s(gx * 180), s(gy * 60), 0]), FR.pt(F, [s(gx * 260), s(gy * 90), s(-420)])], s(9), TIN);
      }
      svg += tube([FR.pt(F, [s(-270), s(95), s(-430)]), FR.pt(F, [s(270), s(95), s(-430)])], s(10), TIN);
      svg += tube([FR.pt(F, [s(-270), s(-95), s(-430)]), FR.pt(F, [s(270), s(-95), s(-430)])], s(10), TIN);
      add([0, 0, s(-200)], svg, 'GEAR');
    }

    if (has('FRAME')) {
      const F = U('FRAME');
      let svg = obox(F, s(-120), s(120), s(-100), s(100), s(30), s(60), CARBON, 1).svg;
      for (const [mx, my] of MPOS) {
        const a = Math.atan2(my, mx);
        const A = FR.Rz(F, a);
        svg += obox(A, s(90), s(360), s(-16), s(16), s(30), s(48), TIN, 0.9).svg;
      }
      add([0, 0, s(45)], svg, 'FRAME');
    }

    if (has('MOTORS')) {
      const F = U('MOTORS');
      MPOS.forEach(([mx, my], i) => {
        const M = FR.T(F, mx, my, s(48));
        let svg = ocyl(M, s(30), 0, s(20), CARBON, 1, 16).svg;
        svg += ocyl(M, s(32), s(20), s(52), m, 1, 16).svg;
        const spin = opt.spin[i] || 0;
        for (let b = 0; b < 3; b++) {
          const a = spin * (i % 2 ? -1 : 1) + (b * Math.PI * 2) / 3;
          svg += odisc(M, s(6), s(53), INK, 0, 8, Math.cos(a) * s(18), Math.sin(a) * s(18));
        }
        add([mx, my, s(35)], svg, 'MOTORS');
      });
    }

    if (has('ESC')) {
      const F = U('ESC');
      let svg = '';
      for (const [mx, my] of MPOS) {
        const a = Math.atan2(my, mx);
        const E = FR.Rz(FR.T(F, mx * 0.62, my * 0.62, s(40)), a);
        svg += obox(E, s(-14), s(14), s(-30), s(30), 0, s(18), { l: '#dcbd8a', m: '#c4a06a', d: '#8f7146' }, 0.7).svg;
      }
      add([0, 0, s(45)], svg, 'ESC');
    }

    if (has('WIRES')) {
      const F = U('WIRES');
      let svg = '';
      MPOS.forEach(([mx, my], i) => {
        svg += tube([FR.pt(F, [mx, my, s(48)]), FR.pt(F, [mx * 0.6, my * 0.6, s(44)])], s(3.4), i % 2 ? WIRE.org : WIRE.blu);
      });
      add([0, 0, s(46)], svg, 'WIRES');
    }

    if (has('XT60')) {
      const F = U('XT60');
      let svg = tube([FR.pt(F, [s(120), 0, s(20)]), FR.pt(F, [s(230), 0, s(6)])], s(8), WIRE.red);
      svg += obox(F, s(230), s(262), s(-14), s(14), 0, s(26), { l: '#d49c1f', m: '#b9861a', d: '#7d5a10' }, 0.9).svg;
      add([s(240), 0, s(14)], svg, 'XT60');
    }

    if (has('FC')) {
      const F = U('FC');
      let svg = obox(F, s(-22), s(22), s(-22), s(22), s(60), s(78), { l: '#f4b829', m: '#d49c1f', d: '#4e4a18' }, 0.9).svg;
      svg += otext(F, 0, 0, s(80), 'CUBE+', s(9), INK);
      if (opt.power) svg += odisc(F, s(4), s(79), '#43c25c', 0, 10, s(14), s(-14));
      add([0, 0, s(70)], svg, 'FC');
    }

    if (has('RTK')) {
      const F = U('RTK');
      let svg = '';
      for (const [ax, ay] of [
        [-1, -1],
        [1, 1]
      ]) {
        svg += tube([FR.pt(F, [s(ax * 60), s(ay * 60), s(60)]), FR.pt(F, [s(ax * 60), s(ay * 60), s(150)])], s(3), CARBON);
        svg += ocyl(FR.T(F, s(ax * 60), s(ay * 60), s(150)), s(9), 0, s(20), CARBON, 0.8, 12).svg;
      }
      add([0, 0, s(110)], svg, 'RTK');
    }

    if (has('RADAR')) {
      const F = U('RADAR');
      let svg = obox(F, s(-12), s(12), s(-12), s(12), s(-2), s(10), { l: '#55504a', m: '#3d3935', d: '#272421' }, 0.8).svg;
      add([s(80), 0, s(4)], svg, 'RADAR');
    }

    if (has('RADIO')) {
      const F = U('RADIO');
      let svg = obox(F, s(-10), s(10), s(-10), s(10), s(60), s(72), PCB, 0.7).svg;
      svg += tube([FR.pt(F, [0, 0, s(72)]), FR.pt(F, [s(-30), 0, s(120)])], s(2), WIRE.wht);
      add([s(-60), 0, s(70)], svg, 'RADIO');
    }

    if (has('TANK')) {
      const F = U('TANK');
      let svg = obox(F, s(-90), s(90), s(-50), s(50), s(55), s(115), TANKMAT, 1).svg;
      // liquid-level window follows the tank level in flight
      const lvl = opt.fl && typeof opt.fl.tank === 'number' ? opt.fl.tank : 1;
      const z0 = s(58);
      const z1 = s(58 + 54 * lvl);
      if (lvl > 0.02) {
        svg += obox(F, s(-80), s(80), s(-52), s(-46), z0, z1, LIQUID, 0.5).svg;
      }
      svg += otext(F, 0, 0, s(120), '10 L', s(11), INK);
      add([0, 0, s(85)], svg, 'TANK');
    }

    if (has('PUMP')) {
      const F = U('PUMP');
      let svg = ocyl(FR.Rz(F, rad(90)), s(16), s(-14), s(14), { l: '#5d5954', m: '#423e3a', d: '#292623' }, 0.9, 14, s(70), 0).svg;
      svg += tube([FR.pt(F, [s(-90), 0, s(70)]), FR.pt(F, [s(54), 0, s(70)])], s(4), LIQUID);
      add([s(70), 0, s(70)], svg, 'PUMP');
    }

    if (has('BOOM')) {
      const F = U('BOOM');
      let svg = tube([FR.pt(F, [s(-140), 0, s(30)]), FR.pt(F, [s(140), 0, s(30)])], s(5), TIN);
      for (const nx of [-1, -0.33, 0.33, 1]) {
        svg += ocyl(F, s(7), s(16), s(30), { l: '#ef6a4c', m: '#cf5038', d: '#4a2219' }, 0.7, 10, s(nx * 140), 0).svg;
      }
      add([0, 0, s(24)], svg, 'BOOM');
    }

    if (has('BATT')) {
      const F = U('BATT');
      let svg = obox(F, s(-70), s(70), s(-45), s(45), s(-120), s(-50), { l: '#2b2a28', m: '#413f3d', d: '#26241f' } as Tone, 1).svg;
      svg += otext(F, 0, 0, s(-53), '12S 22Ah', s(10), SILK);
      add([0, 0, s(-85)], svg, 'BATT');
    }

    if (has('PROPS') && !opt.broken) {
      const F = U('PROPS');
      const swapped = opt.orient('PROPS') === 1;
      MPOS.forEach(([mx, my, _n, dir], i) => {
        const ccw = (dir === 'CCW') !== swapped;
        const P = FR.T(F, mx, my, s(52));
        const rate = opt.rpm[i] || 0;
        if (rate > 0.12) {
          add([mx, my, s(60)], `<circle cx="0" cy="0" r="${s(150)}" fill="#fff" opacity="${(0.15 + 0.2 * rate).toFixed(2)}" transform="translate(${P.o[0].toFixed(1)} ${P.o[1].toFixed(1)}) scale(0.02)"/>`, 'PROPS');
        } else {
          let svg = '';
          const spin = opt.spin[i] || 0;
          for (let b = 0; b < 2; b++) {
            const a = spin * (ccw ? -1 : 1) + (b * Math.PI) / 2;
            const B = FR.Rz(P, a);
            const bladeF = FR.Rx(B, ccw ? rad(8) : rad(-8));
            svg += obox(bladeF, s(30), s(150), s(-11), s(11), s(-1.5), s(1.5), CARBON, 0.8).svg;
          }
          add([mx, my, s(60)], svg, 'PROPS');
        }
      });
    }
  },

  hull(f: Frame): Vec3[] {
    const pts: Vec3[] = [];
    for (const [mx, my] of MPOS) {
      pts.push(FR.pt(f, [mx, my, 10]));
      pts.push(FR.pt(f, [mx * 1.1, my * 1.1, 30 * SC]));
    }
    pts.push(FR.pt(f, [0, 0, 120 * SC]));
    return pts;
  },

  tags: [
    ['FC', [0, 0, 80 * SC], 60, -50],
    ['TANK', [0, -50, 120 * SC], -40, -60],
    ['RTK', [60 * SC, 60 * SC, 160 * SC], 50, -30],
    ['BOOM', [140 * SC, 0, 30 * SC], 44, 30],
    ['MOTORS', [345 * SC, 0, 60 * SC], 40, -20]
  ],

  wiring: {
    nodes(d, c) {
      return {
        BATT: [20, 238, 'BATTERY', (c.battName as string) || '12S 22000', '#e2483d'],
        XT60: [190, 238, 'AS150', 'anti-spark', '#e2483d'],
        ESC: [360, 238, 'FOC ESC x6', 'arm-mounted', '#e2483d'],
        MOTORS: [600, 238, 'MOTORS x6', (c.motorName as string) || '8120 100KV', '#f08a2b'],
        FC: [360, 70, 'CUBE ORANGE+', 'ArduPilot', '#3e86d9'],
        RTK: [140, 70, 'RTK GNSS', 'dual antenna', '#8c4bd1'],
        PUMP: [600, 14, 'PUMP', 'diaphragm', '#43a35a'],
        BOOM: [600, 116, 'BOOM x4', 'nozzles', '#43b05c']
      };
    },
    links: [
      { from: 'BATT', to: 'XT60', kind: 'power', label: 'AS150' },
      { from: 'XT60', to: 'ESC', kind: 'power', label: '50 V bus' },
      { from: 'ESC', to: 'MOTORS', kind: 'motor', label: '3-phase x6' },
      { from: 'ESC', to: 'FC', kind: 'data', label: 'CAN bus' },
      { from: 'FC', to: 'RTK', kind: 'i2c', label: 'RTK + heading' },
      { from: 'FC', to: 'PUMP', kind: 'data', label: 'SERVOx pump' },
      { from: 'PUMP', to: 'BOOM', kind: 'video', label: 'liquid' }
    ]
  },

  overview: `<p>An agricultural hexacopter is a flying spray boom: six big motors, a 10-litre tank, a pump, and RTK positioning good to a centimetre. It treats the field in lanes, the way a tractor would.</p>
<p>Six motors are not for speed — they are for survival and disk area. Big slow props make lift per watt that a freestyle quad can only dream about, and losing one motor on a hexa means the mixer rebalances and flies on.</p>
<p>The physics you can watch: the tank is a third of the mass, so the hover throttle steps down as it empties. The dose must stay constant, so the pump rate tracks ground speed. And the boom rides in the prop wash on purpose — downwash pushes droplets into the canopy. Drift, not dosage, is how spray jobs go wrong.</p>`,

  buildCode: `# spray hexa setup, ArduPilot params:
param set FRAME_CLASS 3        # hexa
param set FRAME_TYPE 1         # X
param set MOT_THST_EXPO 0.78   # big slow props
param set SPRAY_ENABLE 1
param set SPRAY_PUMP_RATE 420  # mL/s at cruise
param set RNGFND1_TYPE 25      # radar altimeter
param set RNGFND1_MIN_CM 20
param set WPNAV_SPEED 500      # cm/s lane speed
param set RTL_ALT 1500`,

  cliName: 'ArduPilot',
  logName: 'spray log',

  quiz: [
    {
      q: 'Why six motors on a sprayer?',
      a: ['More speed', 'Lift plus survival: the mixer rebalances around a dead motor', 'Quieter'],
      ok: 1
    },
    {
      q: 'The tank empties. The hover throttle...',
      a: ['Steps down: 10 L was a third of the mass', 'Stays the same', 'Steps up'],
      ok: 0
    },
    {
      q: 'Why does the boom sit in the prop wash?',
      a: ['It was easier to mount', 'Downwash pushes droplets into the canopy', 'To cool the pump'],
      ok: 1
    },
    {
      q: 'What is the real failure mode of spraying?',
      a: ['Empty battery', 'Drift: droplets landing on the neighbour\'s field', 'GPS loss'],
      ok: 1
    }
  ],

  practice:
    'Spray the whole crop block in the auto mission. Watch the tank tile drain and the throttle with it. Land, refill (reset), and fly it again with the 16 Ah pack: which covers more per charge?',

  modes: {
    spray: {
      title: 'Spray mission',
      code: '# 4 lanes x 2 waypoints (see the log)',
      hint: 'Auto lawn-mower: lanes 2.4 m apart, pump on in the block',
      alt: true
    },
    loiter: {
      title: 'Loiter (RTK hold)',
      code: 'param set LOIT_SPEED 700',
      hint: 'Centimetre hold on RTK',
      alt: true
    },
    rtl: {
      title: 'RTL',
      code: 'param set RTL_ALT 1500',
      hint: 'Climb, home, land — for refills',
      alt: true
    }
  },
  mode: 'spray',

  /* ---------------------------------------------------------------- */
  /* the spray mission                                                */
  /* ---------------------------------------------------------------- */

  physics(fl: FlightState, dt: number, ctx: PhysCtx): void {
    const HOME = { x: 20, y: 6 };
    if (fl.tank === undefined) {
      fl.tank = 1; // 0..1
      fl.lane = 0;
      fl.sprayOn = false;
      fl.area = 0;
      fl.refill = 0;
    }
    const s = ctx.stick;

    // tank drains while spraying; AUW drops with it
    if (fl.sprayOn && fl.armed) {
      fl.tank = Math.max(0, (fl.tank as number) - 0.042 * dt);
      fl.area = (fl.area as number) + Math.hypot(fl.vel[0], fl.vel[1]) * dt * 2.4;
      const dry = (fl.c.auw as number) - 10000;
      const wet = dry + 10000 * (fl.tank as number);
      fl.c = { ...fl.c, auw: wet, hoverThr: Math.sqrt(wet / ((fl.c.n as number) * fl.c.thrust)) };
      if ((fl.tank as number) <= 0) {
        fl.sprayOn = false;
        ctx.say('Tank empty: RTL to the refill pad');
        fl.refill = 1;
      }
    }

    if (fl.refill === 1) {
      // climb then home then land
      autopilotHome(fl, s, HOME, ctx, 12, () => {
        if (fl.pos[2] < 0.15) {
          fl.armed = false;
          fl.refill = 2;
          fl.tank = 1;
          ctx.say('Refilled: 10 L aboard. Fly again');
        }
      });
    } else if ((fl.mode as string) === 'rtl' && fl.armed) {
      autopilotHome(fl, s, HOME, ctx, 12, () => {
        if (fl.pos[2] < 0.15) {
          fl.armed = false;
          ctx.say('RTL complete: landed and disarmed');
        }
      });
      ctx.stock(fl, dt);
    } else if ((fl.mode as string) === 'spray' && fl.armed && !fl.crashed) {
      // lawn-mower: 4 lanes over the crop block at 24,26..34
      const lanes: Array<[number, number, number, number]> = [
        [24, 20, 24, 32],
        [26.4, 32, 26.4, 20],
        [28.8, 20, 28.8, 32],
        [31.2, 32, 31.2, 20]
      ];
      const lane = lanes[Math.min(fl.lane as number, lanes.length - 1)];
      const forward = lane[3] > lane[1] ? 1 : -1;
      const target = fl.laneTarget === undefined ? 0 : (fl.laneTarget as number);
      const tx = lane[0];
      const ty = lane[1] + (lane[3] - lane[1]) * target;
      const dx = tx - fl.pos[0];
      const dy = ty - fl.pos[1];
      const dist = Math.hypot(dx, dy);
      if (fl.pos[2] < 2.4) {
        s.thr = 0.65;
      } else {
        s.thr = 0;
        // steer toward the lane point
        const bearing = Math.atan2(dy, dx);
        let err = bearing - fl.yaw;
        while (err > Math.PI) err -= 2 * Math.PI;
        while (err < -Math.PI) err += 2 * Math.PI;
        s.yaw = Math.max(-0.5, Math.min(0.5, err * 1.6));
        s.pitch = Math.min(0.28, dist * 0.1);
        s.roll = 0;
        if (dist < 1.2) {
          if (target < 1) {
            fl.laneTarget = 1;
          } else {
            fl.lane = (fl.lane as number) + 1;
            fl.laneTarget = 0;
            if ((fl.lane as number) >= lanes.length) {
              fl.lane = 0;
              ctx.say('Block sprayed: RTL for refill');
              fl.refill = 1;
              fl.sprayOn = false;
            }
          }
        }
      }
      fl.sprayOn = fl.pos[2] > 1 && fl.armed;
    }
    ctx.stock(fl, dt);
  },

  flyStats(fl) {
    return [
      { label: 'Tank', value: `${((fl.tank as number) ?? 1 * 10).toFixed(1)} L`, small: true },
      { label: 'Sprayed', value: `${Math.round((fl.area as number) ?? 0)} m²`, small: true }
    ];
  },

  range: {
    title: 'Crop block',
    brief: 'Four lanes, 2.4 m apart, pump on, land for refill.',
    field: 42,
    pad: [20, 6],
    ground: '#cdd8b0',
    alt: true,
    keepGates: false,
    camTilt: 10,
    prims: [
      // striped crop rows
      { t: 'flat', x: 27, y: 26, w: 12, d: 16, col: '#c8d6a0', label: '' },
      { t: 'flat', x: 24, y: 26, w: 0.5, d: 16, col: '#a8ba78' },
      { t: 'flat', x: 26.4, y: 26, w: 0.5, d: 16, col: '#a8ba78' },
      { t: 'flat', x: 28.8, y: 26, w: 0.5, d: 16, col: '#a8ba78' },
      { t: 'flat', x: 31.2, y: 26, w: 0.5, d: 16, col: '#a8ba78' },
      // farmhouse + barn + silo
      { t: 'house', x: 8, y: 14, w: 5, d: 4, h: 3, col: '#e2dccb' },
      { t: 'house', x: 10, y: 30, w: 4, d: 6, h: 4, col: '#b05a4a' },
      { t: 'cyl', x: 14.5, y: 32, r: 1.2, h: 7, col: '#c9c2b2' },
      // water tank + refill pad
      { t: 'cyl', x: 17, y: 9, r: 1.5, h: 3, col: '#76a0e2' },
      { t: 'disc', x: 20, y: 6, r: 1.6, col: '#ef6a4c', label: 'REFILL' },
      // windbreak trees + power line
      { t: 'tree', x: 4, y: 20, h: 8 },
      { t: 'tree', x: 4, y: 26, h: 9 },
      { t: 'tree', x: 4, y: 32, h: 7 },
      { t: 'tree', x: 38, y: 12, h: 8 },
      { t: 'pole', x: 36, y: 38, h: 8 },
      { t: 'pole', x: 28, y: 38, h: 8 },
      { t: 'pole', x: 20, y: 38, h: 8 }
    ],
    goals: []
  }
};

/** Climb-fly home-land autopilot used by refill/RTL. */
function autopilotHome(
  fl: FlightState,
  s: { thr: number; yaw: number; pitch: number; roll: number },
  home: { x: number; y: number },
  ctx: PhysCtx,
  alt: number,
  done: () => void
): void {
  if (fl.pos[2] < alt - 0.5 && Math.hypot(fl.pos[0] - home.x, fl.pos[1] - home.y) > 3) {
    s.thr = 0.6;
    return;
  }
  const dx = home.x - fl.pos[0];
  const dy = home.y - fl.pos[1];
  const dist = Math.hypot(dx, dy);
  if (dist > 1.2) {
    s.thr = 0;
    const bearing = Math.atan2(dy, dx);
    let err = bearing - fl.yaw;
    while (err > Math.PI) err -= 2 * Math.PI;
    while (err < -Math.PI) err += 2 * Math.PI;
    s.yaw = Math.max(-0.5, Math.min(0.5, err * 1.6));
    s.pitch = Math.min(0.3, dist * 0.1);
  } else {
    s.pitch = 0;
    s.yaw = 0;
    s.thr = -0.3;
    if (fl.pos[2] <= 0.16) done();
  }
  void ctx;
}
