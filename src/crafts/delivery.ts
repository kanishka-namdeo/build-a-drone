/**
 * Fig. 07 — the autonomous delivery drone.
 *
 * A 690 mm folding-frame quad with two computers: a Pixhawk 6C that flies
 * (real-time attitude loops + failsafes) and a Raspberry Pi 5 that thinks
 * (MAVSDK mission, stereo depth camera, LTE link). The signature move is the
 * delivery autopilot — a 10-phase state machine that takes off, cruises to the
 * address at 12 m, descends to 3.5 m, winches the 1 kg parcel down on a line
 * and releases it (the AUW — and the hover throttle — step down live), reels
 * the line back in, and flies home to land. The props stay well above people.
 */

import { Vec3, Tone, INK, path3, ink, fillPath, clamp, project } from '../engine/core';
import { FR, rad } from '../engine/frames';
import type { Frame } from '../engine/frames';
import { obox, ocyl, odisc, otext, tube, glowDot } from '../engine/oshapes';
import { CARBON, PCB, SILK, WIRE, TIN, CHIPC, BOOT, GOLD, LEDBODY, YEL } from '../engine/materials';
import type { CraftRecord, DrawOpt, DrawAdd, Design, CalcOut, FlightState, PhysCtx } from '../types';
import type { StatItem } from '../engine/shell';

const MPOS: Array<[number, number, string, 'CW' | 'CCW']> = [
  [-172, -172, 'M1', 'CW'],
  [172, -172, 'M2', 'CCW'],
  [-172, 172, 'M3', 'CCW'],
  [172, 172, 'M4', 'CW']
];

/**
 * The autopilot's home point — it must match `range.pad` below ([20, 6], the
 * depot pad on the suburb field).
 */
const HOME: [number, number] = [20, 6];

/** The mission's drop point: ADDRESS 1 on the suburb field. */
const DROP: [number, number] = [32, 26];

/** The parcel's mass in grams (it lives in `fixed` as PARCEL). */
const PARCEL_G = 1000;

/** Mission phase names for the HUD tile. */
const MISSION_PHASES = [
  'IDLE',
  'TAKEOFF',
  'CRUISE',
  'DESCEND',
  'LOWERING',
  'RELEASE',
  'WINCH UP',
  'CLIMB',
  'HOME',
  'LANDING',
  'DONE'
];

const PLASTIK: Tone = { l: '#4a5056', m: '#34393e', d: '#1f2327' };
const DARKCASE: Tone = { l: '#3e4a52', m: '#2c343a', d: '#1a2024' };
const RUBBER: Tone = { l: '#ef8a4c', m: '#cf6a38', d: '#7d3f1a' };
const STRAPTAB: Tone = { l: '#ef6a4c', m: '#cf5038', d: '#4a2219' };
const TAPE: Tone = { l: '#c9a86b', m: '#a8853f', d: '#6f5426' };
const PIGREEN: Tone = { l: '#2e8b57', m: '#1f6b42', d: '#12452a' };
const STRIPEMAT: Tone = { l: '#e8e3d0', m: '#cfc9b6', d: '#a39d8a' };

/** Re-copy `fl.c` with the parcel's mass removed (or added back on reload). */
function parcelMass(fl: FlightState, reload: boolean): void {
  const n = (fl.c.n as number) || 4;
  const target = fl.c.auw + (reload ? PARCEL_G : -PARCEL_G);
  if (!isFinite(target) || target < 500) return;
  const f = target / fl.c.auw;
  fl.c = {
    ...fl.c,
    auw: target,
    tw: (n * fl.c.thrust) / target,
    hoverThr: Math.sqrt(target / (n * fl.c.thrust)),
    hoverW: fl.c.hoverW * f,
    hoverA: fl.c.hoverA * f
  };
}

/* ------------------------------------------------------------------ */
/* the delivery autopilot (phases live in fl.phase:                    */
/* 0 idle, 1 takeoff, 2 cruise, 3 descend, 4 lowering, 5 release,      */
/* 6 winch-up, 7 climb, 8 home, 9 landing, 10 done). It writes         */
/* ctx.stick as if it were the pilot, then the stock multirotor        */
/* step does the flying.                                               */
/* ------------------------------------------------------------------ */

function deliveryStep(fl: FlightState, dt: number, ctx: PhysCtx): void {
  const s = ctx.stick;
  const hoverThr = Math.max(0.1, fl.c.hoverThr);

  // level + hold by default; pitch/roll commands are angle targets
  s.roll = clamp(-fl.roll * 3, -1, 1);
  s.pitch = clamp(-fl.pitch * 3, -1, 1);
  s.yaw = 0;
  s.thr = 0;
  s.thrAbs = hoverThr;

  // absolute-throttle altitude controller (non-alt modes use thrAbs)
  const altThr = (zT: number, vzT: number): number => {
    const dz = clamp(zT - fl.pos[2], -5, 5);
    return clamp(hoverThr + (dz * 0.6 + (vzT - fl.vel[2]) * 1.2) * 0.028, 0.05, 1);
  };

  // world -> body frame (forward, left)
  const cy = Math.cos(fl.yaw);
  const sy = Math.sin(fl.yaw);
  const body = (wx: number, wy: number): [number, number] => [cy * wx + sy * wy, -sy * wx + cy * wy];

  // hover over a point: body-frame position error + velocity damping
  const hold = (tx: number, ty: number): void => {
    const [bx, by] = body(tx - fl.pos[0], ty - fl.pos[1]);
    const [vx, vy] = body(fl.vel[0], fl.vel[1]);
    s.pitch = clamp(bx * 0.22 - vx * 0.32, -0.5, 0.5);
    s.roll = clamp(by * 0.22 - vy * 0.32, -0.5, 0.5);
  };

  // cruise toward a point: yaw at it, lean forward, brake near it
  const cruise = (tx: number, ty: number): number => {
    const dx = tx - fl.pos[0];
    const dy = ty - fl.pos[1];
    const dist = Math.hypot(dx, dy);
    const bearing = Math.atan2(dy, dx);
    const off = Math.atan2(Math.sin(fl.yaw - bearing), Math.cos(fl.yaw - bearing));
    s.yaw = clamp(off * 2, -1, 1);
    const [, by] = body(dx, dy);
    const [vx, vy] = body(fl.vel[0], fl.vel[1]);
    s.pitch = clamp(Math.min(0.4, 0.12 + dist * 0.042) - vx * 0.07, 0.05, 0.45);
    s.roll = clamp(by * 0.05 - vy * 0.1, -0.3, 0.3);
    return dist;
  };

  const ph = fl.phase as number;

  if (ph === 1) {
    if (fl.msnAnn !== 1) {
      fl.msnAnn = 1;
      ctx.say('Mission start: climbing to 12 m');
    }
    hold(HOME[0], HOME[1]);
    s.thr = fl.pos[2] < 11.5 ? 0.75 : 0;
    s.thrAbs = altThr(12, 1.6);
    if (fl.pos[2] >= 11.5) {
      fl.phase = 2;
      ctx.say('Cruise height 12 m — heading for ADDRESS 1');
    }
  } else if (ph === 2) {
    s.thrAbs = altThr(12, 0);
    if (cruise(DROP[0], DROP[1]) <= 2) {
      fl.phase = 3;
      ctx.say('Over the address: descending to 3.5 m');
    }
  } else if (ph === 3) {
    hold(DROP[0], DROP[1]);
    s.thr = -0.3;
    s.thrAbs = altThr(3.5, -0.7);
    if (fl.pos[2] <= 3.7) {
      fl.phase = 4;
      ctx.say('Hover: winching the parcel down');
    }
  } else if (ph === 4) {
    hold(DROP[0], DROP[1]);
    s.thrAbs = altThr(3.5, 0);
    fl.lineLen = Math.min(2.5, (fl.lineLen as number) + 2.5 * dt);
    if ((fl.lineLen as number) >= 2.5) {
      fl.phase = 5;
      fl.relT = fl.t;
    }
  } else if (ph === 5) {
    hold(DROP[0], DROP[1]);
    s.thrAbs = altThr(3.5, 0);
    if (fl.parcelAboard) {
      fl.parcelAboard = false;
      parcelMass(fl, false);
      ctx.say('Parcel released at the door — 1 kg lighter: watch the hover throttle');
    }
    if (fl.t - ((fl.relT as number) ?? 0) > 1.2) {
      fl.phase = 6;
      ctx.say('Winch up: stowing the line');
    }
  } else if (ph === 6) {
    hold(DROP[0], DROP[1]);
    s.thrAbs = altThr(3.5, 0);
    fl.lineLen = Math.max(0, (fl.lineLen as number) - 3 * dt);
    if ((fl.lineLen as number) <= 0) {
      fl.phase = 7;
      ctx.say('Line stowed: climbing back to cruise');
    }
  } else if (ph === 7) {
    hold(DROP[0], DROP[1]);
    s.thr = fl.pos[2] < 11.5 ? 0.7 : 0;
    s.thrAbs = altThr(12, 1.5);
    if (fl.pos[2] >= 11.5) {
      fl.phase = 8;
      ctx.say('Parcel away: heading for the depot');
    }
  } else if (ph === 8) {
    s.thrAbs = altThr(12, 0);
    if (cruise(HOME[0], HOME[1]) <= 2) {
      fl.phase = 9;
      ctx.say('Over the pad: landing');
    }
  } else if (ph === 9) {
    hold(HOME[0], HOME[1]);
    s.thr = fl.pos[2] > 3 ? -0.45 : -0.25;
    s.thrAbs = altThr(0.4, fl.pos[2] > 3 ? -1 : -0.55);
    if (fl.pos[2] <= 0.15) {
      fl.armed = false;
      fl.phase = 10;
      ctx.say('Delivery complete: landed and disarmed');
    }
  }
}

/* ------------------------------------------------------------------ */

export const delivery: CraftRecord = {
  key: 'delivery',
  fig: 7,
  name: 'Delivery drone',
  sub: 'Pixhawk + companion',
  hint: 'design it, build it, load the parcel, send it out',
  noun: 'delivery drone',
  palette: 'mint',
  log: 'mavsdk',
  mat: 560,
  benchH: 250,
  flyScale: 1.5,
  flyVB: 14000,
  ceiling: 60, // cruise is 12 m; the geofence sits far above
  drag: 0.07, // a big boxy frame with a bay hanging under it
  hitR: 0.3,
  kThrust: 26.4, // 4114 400KV on 6S: 8.88 krpm -> ~2.08 kg per motor
  gPerW: 9.5,
  minTW: 1.6,
  maxKvCells: 3400, // a 700 KV motor on 6S over-speeds the prop
  wrongMotor: 3,
  calLabel: 'Calibrate accelerometer + compass',
  design: { batt: 's6-10000', motor: '4114-400', prop: '15x5.5' },

  batts: {
    's6-10000': { name: '6S 10000', cells: 6, mah: 10000, g: 1350, price: 160, col: '#2b2a28', lab: '6S 10Ah' },
    's6-16000': { name: '6S 16000', cells: 6, mah: 16000, g: 2050, price: 245, col: '#2f5fa8', lab: '6S 16Ah' },
    's4-10000': { name: '4S 10000', cells: 4, mah: 10000, g: 880, price: 110, col: '#d9a520', lab: '4S 10Ah' }
  },
  motors: {
    '4114-400': { name: '4114 400KV', kv: 400, g: 140, price: 58 },
    '5010-360': { name: '5010 360KV', kv: 360, g: 118, price: 46 },
    '2814-700': { name: '2814 700KV', kv: 700, g: 105, price: 32, forCells: 4 }
  },
  props: {
    '15x5.5': { name: '15x5.5 folding', pf: 1.0, eff: 1.0, g: 28, price: 32 },
    '14x4.8': { name: '14x4.8 folding', pf: 0.9, eff: 1.04, g: 24, price: 26 },
    '16x5.4': { name: '16x5.4 folding', pf: 1.1, eff: 0.96, g: 34, price: 38 }
  },
  fixed: [
    { id: 'FRAME', name: '690mm folding frame', g: 1100, price: 189, cat: 'Mechanical' },
    { id: 'ESC', name: '4x arm-mounted 60A ESC', g: 180, price: 120, cat: 'Electrical' },
    { id: 'XT60', name: 'PDB + XT90 + caps + BECs', g: 70, price: 35, cat: 'Electrical' },
    { id: 'FC', name: 'Pixhawk 6C + damping mount', g: 60, price: 245, cat: 'Electrical' },
    { id: 'PI', name: 'Raspberry Pi 5 + fan + heatsinks', g: 55, price: 95, cat: 'Electrical' },
    { id: 'DEPTH', name: 'stereo depth camera', g: 75, price: 289, cat: 'Electrical' },
    { id: 'GPS', name: 'GPS + compass on mast', g: 60, price: 59, cat: 'Electrical' },
    { id: 'LTE', name: 'LTE modem + 2 antennas', g: 35, price: 69, cat: 'Electrical' },
    { id: 'RX', name: 'backup RC receiver', g: 5, price: 22, cat: 'Electrical' },
    { id: 'TELEM', name: 'SiK 433 telemetry radio', g: 25, price: 49, cat: 'Electrical' },
    { id: 'TOP', name: 'top plate + winch + cargo bay', g: 490, price: 114, cat: 'Mechanical' },
    { id: 'PARCEL', name: 'cardboard parcel (1 kg)', g: 1000, price: 0, cat: 'Mechanical' }
  ],

  parts: [
    {
      id: 'GEAR',
      name: 'Landing skids + struts',
      short: 'SKIDS',
      z: 0,
      what: 'Two aluminium rails on four struts. Delivery drones land on skids, not legs: the cargo bay hangs under the belly, and the parcel must never take the landing load.'
    },
    {
      id: 'FRAME',
      name: 'Folding frame: hub + 4 latched arms (690 mm motor to motor)',
      short: 'FRAME',
      z: 1,
      after: ['GEAR'],
      what: 'A 690 mm folding quad: four carbon arms on hinge pins with latch boxes. Folded it packs into a case half the size; latched out it swings 15-inch props. Arms this long flex — the latch is structural, not a convenience.'
    },
    {
      id: 'MOTORS',
      name: '4 brushless motors (4114 400KV)',
      short: 'MOTORS',
      z: 2,
      after: ['FRAME'],
      what: '4114 stators: 41 mm across, 14 mm tall, 400 KV. On 6S that is ~8 900 rpm at the prop — thrust from disc area, not tip speed. Big slow props are why this drone hovers at ~9.5 grams per watt.'
    },
    {
      id: 'ESC',
      name: '4 x arm-mounted ESC (60 A)',
      short: 'ARM ESCS',
      z: 2,
      after: ['FRAME'],
      what: 'One 60 A ESC bolted to each arm, right next to its motor: short phase wires mean less loss and less noise, and the arm doubles as a heatsink. Four separate ESCs also mean you can carry a spare.'
    },
    {
      id: 'WIRES',
      name: 'Motor phases + power runs',
      short: 'WIRING',
      z: 3,
      after: ['MOTORS', 'ESC'],
      what: 'Three phases per motor plus a 12 AWG power pair running inboard to the PDB. Keep the power and signal runs separated, or the compass will read the current instead of the earth.'
    },
    {
      id: 'XT60',
      name: 'XT90 + PDB + caps',
      short: 'PDB + XT90',
      z: 3,
      after: ['ESC'],
      polar: ['stripe to minus', 'stripe to plus'],
      what: 'The power distribution board: an XT90 input (this is a 100 A-class machine), electrolytic caps to soak up ESC spikes, and BECs making 5 V for the Pixhawk and 12 V for the Pi. The cap stripe goes to MINUS — backwards, it vents.'
    },
    {
      id: 'FC',
      name: 'Pixhawk 6C on damping balls',
      short: 'PIXHAWK',
      z: 4,
      after: ['XT60'],
      polar: ['arrow forward', 'arrow backward'],
      what: 'The Pixhawk 6C runs ArduPilot: attitude loops, EKF, geofence, failsafes — hard real time, no Linux involved. It sits on rubber damping balls so the gyros do not see motor vibration. The arrow points at the nose.'
    },
    {
      id: 'PI',
      name: 'Raspberry Pi 5 companion (fan + heatsinks)',
      short: 'PI 5',
      z: 5,
      after: ['FC'],
      what: 'The companion computer: it runs the MAVSDK mission, processes the depth camera and holds the LTE link. Heatsinks and a fan because vision is a full-time job. It talks MAVLink to the Pixhawk over a UART — and it is allowed to crash without taking the aircraft with it.'
    },
    {
      id: 'DEPTH',
      name: 'Stereo depth camera on the nose',
      short: 'DEPTH CAM',
      z: 5,
      after: ['PI'],
      what: 'Two lenses plus an IR projector that textures the scene with dots. GPS gets you to the street (~2 m); this gets you the last metre, because a doorstep is smaller than GPS error.'
    },
    {
      id: 'LTE',
      name: 'LTE modem + 2 antennas',
      short: 'LTE',
      z: 5,
      after: ['PI'],
      what: 'A cellular modem for command and telemetry beyond radio range — a data plan with antennas held clear of the carbon. The failsafe watches this link too.'
    },
    {
      id: 'RX',
      name: 'Backup RC receiver',
      short: 'BACKUP RC',
      z: 5,
      after: ['FC'],
      what: 'A conventional RC link as the human override. Autonomy is the plan; a stick you can grab is the insurance. It feeds straight into the Pixhawk.'
    },
    {
      id: 'TELEM',
      name: 'SiK 433 MHz telemetry radio',
      short: 'TELEM',
      z: 5,
      after: ['PI'],
      what: 'A long-range serial link for the ground crew: mission state, battery, position — it works when the cell network does not.'
    },
    {
      id: 'TOP',
      name: 'Top plate + standoffs',
      short: 'TOP PLATE',
      z: 6,
      after: ['FC', 'PI', 'DEPTH', 'LTE', 'RX', 'TELEM'],
      what: 'The lid ties the four corner posts into a box and carries the battery on straps. Everything underneath bolts to it, so it goes on after the stack.'
    },
    {
      id: 'GPS',
      name: 'GPS + compass on the mast',
      short: 'GPS + MAG',
      z: 6,
      after: ['FC', 'TOP'],
      polar: ['arrow forward', 'arrow backwards'],
      what: 'GNSS + compass lifted on a mast, up out of the magnetic mess of the power wiring. The white arrow must agree with the Pixhawk\u2019s — a backwards compass makes RTL toilet-bowl away from home.'
    },
    {
      id: 'BATT',
      name: '6S battery + straps',
      short: 'BATTERY',
      z: 7,
      after: ['TOP', 'XT60'],
      what: '6S 10 Ah lithium polymer: 22.2 V nominal, 1 350 g — a quarter of the aircraft. Land at 3.5 V per cell; the low-battery RTL failsafe is set above that.'
    },
    {
      id: 'WINCH',
      name: 'Servo winch + cargo bay + parcel',
      short: 'WINCH + BAY',
      z: 8,
      after: ['TOP'],
      what: 'A servo winch on SERVO9 and an open bay under the belly. The 1 kg parcel rides in the bay; at the address the winch pays out 2.5 m of line and lets go, so the props never come near anyone. Dropping the parcel is a kilogram of thrust you get back — watch the hover throttle step down.'
    },
    {
      id: 'PROPS',
      name: '15-inch folding props',
      short: 'PROPS',
      z: 9,
      after: ['MOTORS', 'TOP'],
      polar: ['props in (correct)', 'swapped CW/CCW'],
      what: 'Folding bi-blades: on any landing impact they swing back along the arms instead of shattering. They go on LAST — a motor test with props on is a trip to the emergency room.'
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

    /* ---- skids ---- */
    if (has('GEAR')) {
      const F = U('GEAR');
      let svg = '';
      for (const sy of [-1, 1]) {
        svg += obox(F, -66, 66, sy * 48 - 4, sy * 48 + 4, -8, -1, BOOT, 0.9).svg;
        for (const sx of [-1, 1]) {
          svg += obox(F, sx * 40 - 4, sx * 40 + 4, sy * 40, sy * 52, -1, 3, BOOT, 0.8).svg;
        }
      }
      add([0, 0, -4], svg, 'GEAR');
    }

    /* ---- folding frame: hub plate + corner posts + 4 latched arms ---- */
    if (has('FRAME')) {
      const F = U('FRAME');
      let svg = obox(F, -75, 75, -75, 75, 0, 3, CARBON, 0.9).svg;
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1]
      ]) {
        svg += ocyl(F, 3, 3, 46, TIN, 0.8, 10, sx * 62, sy * 62).svg;
        const A = FR.Rz(F, Math.atan2(sy, sx));
        svg += obox(A, 46, 252, -10, 10, 3, 15, CARBON, 0.9).svg;
        svg += obox(A, 54, 78, -13, 13, 15, 23, PLASTIK, 0.8).svg; // hinge + latch box
        svg += odisc(A, 1.6, 23.4, INK, 0.3, 8, 58, 0); // latch pin
      }
      add([0, 0, 12], svg, 'FRAME');
    }

    /* ---- 4114 motors: big bells ---- */
    if (has('MOTORS')) {
      const F = U('MOTORS');
      MPOS.forEach(([mx, my], i) => {
        const M = FR.T(F, mx, my, 0);
        let svg = ocyl(M, 22, 15, 20, CARBON, 1, 18).svg; // stator
        svg += ocyl(M, 24, 20, 42, m, 1, 18).svg; // bell (22 tall)
        const spin = opt.spin[i] || 0;
        for (let b = 0; b < 3; b++) {
          const a = spin * (i % 2 ? -1 : 1) + (b * Math.PI * 2) / 3;
          svg += odisc(M, 3.5, 42.5, INK, 0, 8, Math.cos(a) * 15, Math.sin(a) * 15);
        }
        svg += ocyl(M, 2.6, 42, 46, TIN, 0.7, 10).svg; // shaft
        add([mx, my, 28], svg, 'MOTORS');
      });
    }

    /* ---- arm-mounted ESCs ---- */
    if (has('ESC')) {
      const F = U('ESC');
      let svg = '';
      MPOS.forEach(([mx, my]) => {
        const A = FR.Rz(F, Math.atan2(my, mx));
        svg += obox(A, 114, 144, -11, 11, 15, 25, PCB, 0.8).svg;
        svg += obox(A, 120, 138, -11, 11, 25, 27, TIN, 0.6).svg; // heat-spreader lid
      });
      add([0, 0, 20], svg, 'ESC');
    }

    /* ---- motor phases + power runs ---- */
    if (has('WIRES')) {
      const F = U('WIRES');
      let svg = '';
      MPOS.forEach(([mx, my], i) => {
        // phases: ESC outboard end -> motor
        const a: Vec3 = FR.pt(F, [mx * 0.92, my * 0.92, 24]);
        const b: Vec3 = FR.pt(F, [mx * 0.61, my * 0.61, 22]);
        const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 29];
        svg += tube([a, mid, b], 1.1, i % 2 ? WIRE.org : WIRE.blu);
        // 12 AWG pair: ESC inboard -> hub
        const px = (-my / 243) * 2.6;
        const py = (mx / 243) * 2.6;
        const c: Vec3 = FR.pt(F, [mx * 0.47, my * 0.47, 20]);
        const d: Vec3 = FR.pt(F, [mx * 0.12, my * 0.12, 8]);
        const mid2: Vec3 = [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2, 13];
        svg += tube([c, mid2, d], 1.0, WIRE.red);
        svg += tube([[c[0] + px, c[1] + py, c[2]], [mid2[0] + px, mid2[1] + py, mid2[2]], [d[0] + px, d[1] + py, d[2]]], 1.0, WIRE.blk);
      });
      add([0, 0, 18], svg, 'WIRES');
    }

    /* ---- PDB + XT90 + caps + BECs (polar stripe) ---- */
    if (has('XT60')) {
      const F = U('XT60');
      const B = FR.T(F, -45, 0, 0);
      let svg = obox(B, -14, 14, -26, 26, 4, 6, PCB, 0.8).svg;
      const capMat = opt.fault ? ({ l: '#7a6a5a', m: '#5d5145', d: '#3d352c' } as Tone) : LEDBODY;
      const stripeOff = orient('XT60') ? 1.8 : -1.8;
      for (const cx of [-9, 0, 9]) {
        svg += ocyl(B, 3.6, 6, 14, capMat, 0.8, 12, cx, -12).svg;
        svg += ocyl(B, 3.6, 6, 14, STRIPEMAT, 0.5, 12, cx + stripeOff, -12).svg;
      }
      svg += obox(B, -14, -2, 6, 22, 6, 10, CHIPC, 0.7).svg; // BEC coil block
      svg += obox(B, -27, -15, -7, 7, 4, 13, GOLD, 0.9).svg; // XT90 housing
      svg += tube([FR.pt(B, [-27, 4, 8]), FR.pt(B, [-45, 10, 8])], 1.6, WIRE.red);
      svg += tube([FR.pt(B, [-27, -4, 8]), FR.pt(B, [-45, -10, 8])], 1.6, WIRE.blk);
      add([-45, 0, 8], svg, 'XT60');
    }

    /* ---- Pixhawk 6C on damping balls (polar arrow) ---- */
    if (has('FC')) {
      const F = U('FC');
      const B = FR.T(F, 52, 0, 0);
      let svg = '';
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1]
      ]) {
        svg += ocyl(B, 2.5, 3, 12, TIN, 0.7, 10, sx * 11, sy * 11).svg; // posts
        svg += ocyl(B, 3.6, 12, 16, RUBBER, 0.8, 10, sx * 11, sy * 11).svg; // damping balls
      }
      svg += obox(B, -18, 18, -18, 18, 16, 26, DARKCASE, 0.9).svg;
      svg += obox(B, -15, 15, -15, 15, 26, 27.5, PLASTIK, 0.7).svg;
      const flip = orient('FC') ? -1 : 1;
      const pts: Vec3[] = [
        FR.pt(B, [14 * flip, 0, 28]),
        FR.pt(B, [4 * flip, 5, 28]),
        FR.pt(B, [4 * flip, -5, 28])
      ];
      svg += fillPath(path3(pts), SILK) + ink(path3(pts), 0.7);
      if (opt.power) {
        svg += odisc(B, 2.5, 27.6, '#3e86d9', 0, 10, -10, 10);
        svg += glowDot(FR.pt(B, [-10, 10, 28]), '#3e86d9', 6);
      }
      add([52, 0, 20], svg, 'FC');
    }

    /* ---- Raspberry Pi 5: green board + heatsinks + fan ---- */
    if (has('PI')) {
      const F = U('PI');
      const B = FR.T(F, 0, 42, 0);
      let svg = obox(B, -23, 23, -16, 16, 29, 31, PIGREEN, 0.8).svg;
      svg += obox(B, -18, 2, -12, 12, 31, 34, TIN, 0.7).svg; // SoC heatsink base
      for (let i = 0; i < 5; i++) {
        svg += obox(B, -17 + i * 4, -13 + i * 4, -11, 11, 34, 38, TIN, 0.5).svg; // fins
      }
      svg += obox(B, 8, 20, -10, 10, 31, 34.5, TIN, 0.6).svg; // second heatsink
      svg += obox(B, -16, 16, -16, 16, 38, 40, PLASTIK, 0.7).svg; // fan frame
      svg += odisc(B, 13, 40.4, '#2c343a', 0.4, 18);
      svg += odisc(B, 4, 40.5, '#8f989b', 0.4, 10);
      svg += otext(B, 0, 0, 41.4, 'Pi 5', 7, SILK);
      if (opt.power) {
        svg += odisc(B, 2, 31.2, '#43b05c', 0, 10, 20, -13);
        svg += glowDot(FR.pt(B, [20, -13, 31.5]), '#43b05c', 5);
      }
      add([0, 42, 36], svg, 'PI');
    }

    /* ---- stereo depth camera on the nose ---- */
    if (has('DEPTH')) {
      const F = U('DEPTH');
      let svg = obox(F, 72, 78, -18, 18, 3, 8, CARBON, 0.8).svg; // pedestal
      svg += obox(F, 78, 96, -16, 16, 8, 26, PLASTIK, 0.9).svg;
      for (const ly of [-8, 8]) {
        const L = FR.Ry(FR.T(F, 90, ly, 20), rad(90));
        svg += ocyl(L, 5, 0, 9, CARBON, 0.9, 14).svg;
        svg += odisc(L, 3.6, 9.2, '#1c1c1e', 0.4, 12);
      }
      const IR = FR.Ry(FR.T(F, 90, 0, 12), rad(90));
      svg += ocyl(IR, 2.4, 0, 7, CARBON, 0.8, 10).svg;
      svg += odisc(IR, 1.5, 7.2, '#c23830', 0.3, 8); // IR projector dot
      add([85, 0, 17], svg, 'DEPTH');
    }

    /* ---- GPS mast + puck (own polar arrow) ---- */
    if (has('GPS')) {
      const F = U('GPS');
      const B = FR.T(F, -58, -28, 49);
      let svg = ocyl(B, 3, 0, 65, WIRE.org, 0.9, 10).svg;
      svg += ocyl(B, 11, 65, 77, PLASTIK, 1, 20).svg;
      svg += odisc(B, 6, 77.6, '#20262b', 0.4, 14, 3, 0);
      const flip = orient('GPS') ? -1 : 1;
      const pts: Vec3[] = [
        FR.pt(B, [8 * flip, 0, 78.5]),
        FR.pt(B, [-3 * flip, 4.5, 78.5]),
        FR.pt(B, [-3 * flip, -4.5, 78.5])
      ];
      svg += fillPath(path3(pts), SILK) + ink(path3(pts), 0.7);
      add([-58, -28, 92], svg, 'GPS');
    }

    /* ---- LTE modem + two whip antennas ---- */
    if (has('LTE')) {
      const F = U('LTE');
      const B = FR.T(F, 36, -36, 49);
      let svg = obox(B, -12, 12, -8, 8, 0, 6, PLASTIK, 0.8).svg;
      svg += tube([FR.pt(B, [-6, 0, 6]), FR.pt(B, [-14, -6, 22]), FR.pt(B, [-18, -10, 38])], 1, WIRE.wht);
      svg += tube([FR.pt(B, [6, 0, 6]), FR.pt(B, [14, 6, 22]), FR.pt(B, [18, 10, 38])], 1, WIRE.wht);
      if (opt.power) {
        svg += odisc(B, 2, 6.2, '#43b05c', 0, 10, 8, 5);
        svg += glowDot(FR.pt(B, [8, 5, 7]), '#43b05c', 5);
      }
      add([36, -36, 55], svg, 'LTE');
    }

    /* ---- backup RC receiver ---- */
    if (has('RX')) {
      const F = U('RX');
      const B = FR.T(F, -38, 46, 49);
      let svg = obox(B, -7, 7, -5, 5, 0, 4, PCB, 0.7).svg;
      svg += tube([FR.pt(B, [0, 0, 4]), FR.pt(B, [6, 4, 16]), FR.pt(B, [8, 6, 26])], 0.8, WIRE.wht);
      add([-38, 46, 53], svg, 'RX');
    }

    /* ---- SiK telemetry + whip ---- */
    if (has('TELEM')) {
      const F = U('TELEM');
      const B = FR.T(F, -42, -46, 49);
      let svg = obox(B, -9, 9, -7, 7, 0, 5, PCB, 0.7).svg;
      svg += obox(B, -4, 4, -4, 4, 5, 8, TIN, 0.6).svg;
      svg += tube([FR.pt(B, [0, 0, 8]), FR.pt(B, [-4, -6, 22]), FR.pt(B, [-6, -8, 34])], 0.8, WIRE.wht);
      if (opt.power) {
        svg += odisc(B, 2, 5.2, '#e2483d', 0, 10, 6, 4);
        svg += glowDot(FR.pt(B, [6, 4, 6]), '#e2483d', 5);
      }
      add([-42, -46, 54], svg, 'TELEM');
    }

    /* ---- top plate + strap keepers ---- */
    if (has('TOP')) {
      const F = U('TOP');
      let svg = obox(F, -75, 75, -75, 75, 46, 49, CARBON, 0.9).svg;
      svg += obox(F, -34, -28, -19, 19, 49, 52, STRAPTAB, 0.7).svg;
      svg += obox(F, 28, 34, -19, 19, 49, 52, STRAPTAB, 0.7).svg;
      add([0, 0, 47], svg, 'TOP');
    }

    /* ---- 6S brick + straps ---- */
    if (has('BATT')) {
      const F = U('BATT');
      const key = (opt.design as { batt: string }).batt;
      const B = delivery.batts[key] ?? delivery.batts['s6-10000'];
      const long = key === 's6-16000' ? 50 : key === 's4-10000' ? 36 : 43;
      let svg = obox(F, -long, long, -18, 18, 49, 81, { l: B.col ?? '#2b2a28', m: '#413f3d', d: '#26241f' } as Tone, 1).svg;
      svg += obox(F, long - 12, long - 4, -19, 19, 60, 63, STRAPTAB, 0.8).svg;
      svg += obox(F, -long + 4, -long + 12, -19, 19, 60, 63, STRAPTAB, 0.8).svg;
      svg += otext(F, 0, -11, 81.5, B.lab ?? '6S 10Ah', 8, SILK);
      if (opt.plugged && has('XT60')) {
        svg += tube([FR.pt(F, [-long + 3, 6, 60]), FR.pt(F, [-62, 9, 34]), FR.pt(F, [-68, 7, 12])], 1.6, WIRE.red);
        svg += tube([FR.pt(F, [-long + 3, -6, 60]), FR.pt(F, [-62, -9, 34]), FR.pt(F, [-68, -7, 12])], 1.6, WIRE.blk);
      }
      add([0, 0, 62], svg, 'BATT');
    }

    /* ---- servo winch + cargo bay + parcel ---- */
    if (has('WINCH')) {
      const F = U('WINCH');
      // parcel state (only meaningful in flight; on the bench it sits in the bay)
      const fl = opt.fl;
      const LL = fl && typeof fl.lineLen === 'number' ? fl.lineLen : 0;
      const aboard = !fl || fl.parcelAboard !== false;
      const k = opt.k || 1; // flyScale in flight
      const ll = LL * 1000 / k; // line length in craft-local mm

      let svg = '';
      if (aboard && LL > 0.05) {
        // winch line off the spool, parcel hanging at the end
        svg += tube(
          [
            FR.pt(F, [20, 0, -9]),
            FR.pt(F, [6, 0, -12]),
            FR.pt(F, [0, 0, -12]),
            FR.pt(F, [0, 0, -12 - ll])
          ],
          1.1,
          WIRE.blk
        );
        svg += obox(F, -15, 15, -15, 15, -12 - ll - 25, -12 - ll, CHIPC, 0.9).svg;
        svg += obox(F, -3, 3, -15.5, 15.5, -12 - ll - 25, -12 - ll, TAPE, 0.6).svg;
      } else if (aboard) {
        // parcel tucked in the bay under the belly
        svg += obox(F, -22, 8, -15, 15, -3, 22, CHIPC, 0.9).svg;
        svg += obox(F, -10, -4, -15.5, 15.5, -3, 22, TAPE, 0.6).svg;
      }
      // cargo bay cage
      svg += obox(F, -26, 26, 20, 24, -6, 22, CARBON, 0.8).svg;
      svg += obox(F, -26, 26, -24, -20, -6, 22, CARBON, 0.8).svg;
      svg += obox(F, -26, -22, -20, 20, -6, 22, CARBON, 0.8).svg;
      // servo + spool at the mouth of the bay
      svg += obox(F, 15, 29, 11, 21, -6, 6, { l: '#55504a', m: '#3d3935', d: '#272421' }, 0.8).svg;
      svg += odisc(F, 3, 6.2, '#c6ccce', 0.5, 10, 22, 16);
      const S = FR.Rx(FR.T(F, 20, 0, 1), rad(90));
      svg += ocyl(S, 10, -11, 11, TIN, 0.8, 16).svg;
      svg += ocyl(S, 12, 9, 11, CARBON, 0.8, 16).svg;
      svg += ocyl(S, 12, -11, -9, CARBON, 0.8, 16).svg;
      add([0, 0, -10], svg, 'WINCH');
    }

    /* ---- 15-inch folding props: 2 blades at a fold angle ---- */
    if (has('PROPS') && !opt.broken) {
      const F = U('PROPS');
      const swapped = orient('PROPS') === 1;
      MPOS.forEach(([mx, my, _id, dir], i) => {
        const ccw = (dir === 'CCW') !== swapped;
        const P = FR.T(F, mx, my, 47);
        const rate = opt.rpm[i] || 0;
        if (rate > 0.12) {
          // prop blur disc
          const c = project(FR.pt(P, [0, 0, 0]));
          add(
            [mx, my, 48],
            `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(95 * opt.k).toFixed(0)}" fill="#fff" opacity="${(0.16 + 0.2 * rate).toFixed(2)}"/>`,
            'PROPS'
          );
        } else {
          let svg = '';
          const spin = opt.spin[i] || 0;
          for (let b = 0; b < 2; b++) {
            // deployed would be 180 deg apart; folded 25 deg each -> 130 deg
            const a = spin * (ccw ? -1 : 1) + (b ? 1 : -1) * rad(65);
            const B = FR.Rz(FR.T(P, 0, 0, 0), a);
            const bladeF = FR.Rx(B, ccw ? rad(6) : rad(-6));
            svg += obox(bladeF, 8, 95, -7, 7, -1, 1, CARBON, 0.7).svg;
            svg += obox(bladeF, 86, 95, -7, 7, -1, 1.2, YEL, 0.5).svg; // tip mark
          }
          svg += ocyl(P, 7, -2, 3, TIN, 0.8, 12).svg; // spinner
          add([mx, my, 48], svg, 'PROPS');
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
      pts.push(FR.pt(f, [66 * sx, 48 * sy, -8]));
      pts.push(FR.pt(f, [40 * sx, 18 * sy, 82]));
      pts.push(FR.pt(f, [239 * sx, 239 * sy, 36]));
    }
    pts.push(FR.pt(f, [-58, -28, 126]));
    return pts;
  },

  tags: [
    ['FC', [64, 0, 28], 46, -40],
    ['PI', [0, 42, 41], -26, -50],
    ['DEPTH', [88, 0, 24], 42, -20],
    ['GPS', [-58, -28, 122], -52, -32],
    ['XT60', [-52, 0, 12], -48, 26],
    ['WINCH', [-7, 0, 12], -14, 46],
    ['BATT', [0, 0, 82], 34, -46],
    ['MOTORS', [172, -172, 34], 36, 18]
  ],

  /* ---------------------------------------------------------------- */
  /* wiring                                                           */
  /* ---------------------------------------------------------------- */

  wiring: {
    nodes(d, c) {
      void d;
      return {
        RX: [200, 4, 'BACKUP RC RX', '2.4 GHz, override', '#8c4bd1'],
        TELEM: [380, 4, 'SiK TELEM', '433 MHz, long range', '#8c4bd1'],
        GPS: [20, 94, 'GPS + COMPASS', 'M10, on the mast', '#3e86d9'],
        FC: [200, 94, 'PIXHAWK 6C', 'ArduPilot + PM', '#3e86d9'],
        WINCH: [560, 94, 'SERVO WINCH', 'SERVO9 + cargo bay', '#f08a2b'],
        BATT: [20, 182, 'BATTERY', (c.battName as string) || '6S 10000', '#e2483d'],
        XT60: [200, 182, 'PDB + XT90', 'caps + 5V/12V BECs', '#e2483d'],
        PI: [380, 182, 'RASPBERRY PI 5', 'companion computer', '#43a35a'],
        LTE: [560, 182, 'LTE MODEM', 'PPP, 2 antennas', '#8c4bd1'],
        MOTORS: [20, 270, 'MOTORS x4', (c.motorName as string) || '4114 400KV', '#f08a2b'],
        ESC: [200, 270, 'ARM ESCS x4', '60 A, DSHOT600', '#e2483d'],
        DEPTH: [380, 270, 'DEPTH CAMERA', 'stereo + IR proj', '#43a35a']
      };
    },
    links: [
      { from: 'BATT', to: 'XT60', kind: 'power', label: 'XT90 + 12 AWG' },
      { from: 'XT60', to: 'ESC', kind: 'power', label: 'VBAT + GND' },
      { from: 'ESC', to: 'MOTORS', kind: 'motor', label: '3-phase x4' },
      { from: 'XT60', to: 'FC', kind: 'power', label: 'PM 5V/12V' },
      { from: 'FC', to: 'PI', kind: 'data', label: 'MAVLink / UART' },
      { from: 'PI', to: 'DEPTH', kind: 'data', label: 'USB 3' },
      { from: 'PI', to: 'LTE', kind: 'data', label: 'PPP' },
      { from: 'PI', to: 'TELEM', kind: 'rf', label: 'SiK 433' },
      { from: 'FC', to: 'GPS', kind: 'i2c', label: 'GPS + compass' },
      { from: 'FC', to: 'RX', kind: 'data', label: 'backup RC' },
      { from: 'FC', to: 'WINCH', kind: 'data', label: 'SERVO9' }
    ]
  },

  /* ---------------------------------------------------------------- */
  /* content                                                          */
  /* ---------------------------------------------------------------- */

  overview: `<p>Fig. 07 is an autonomous delivery machine: a 690 mm folding quad on 6S with 4114 motors swinging 15-inch props — and two computers. The Pixhawk 6C <b>flies</b>: attitude loops, EKF, geofence and failsafes, hard real time. The Raspberry Pi 5 <b>thinks</b>: it runs the MAVSDK mission, reads the stereo depth camera and holds the LTE link. They gossip MAVLink over a UART, and the split is deliberate — a Linux hiccup must never take the aircraft down.</p>
<p>The delivery itself is a winch, not a landing. The drone holds 3.5 m over the doorstep and lowers the 1 kg parcel on a line, so the 15-inch props stay well above people and pets. Watch the HUD the moment the parcel lets go: the all-up weight drops a kilogram and the hover throttle steps down live — the calculator's numbers include the parcel, so what you designed is what let go. Flying beyond visual line of sight (BVLOS) is a paperwork exercise as much as an engineering one: geofences, observers on the ground, and an authority sign-off before the first revenue flight.</p>
<p>GPS gets the drone to the street — it is only ~2 m accurate, and doorsteps are smaller — so the depth camera handles the final approach. And if anything goes wrong, the failsafes fly it home: low battery or a lost link both command RTL.</p>`,

  buildCode: `#!/usr/bin/env python3
# delivery.py — the mission the Pi 5 runs (MAVSDK-Python)
import asyncio
from mavsdk import System

async def servo(us):
    # SERVO9_FUNCTION = 88 (winch): 1900 us pays out, 1100 us releases
    await asyncio.sleep(0.05)  # RC_CHANNELS_OVERRIDE, channel 9

async def main():
    drone = System()
    await drone.connect(system_address="serial:///dev/ttyAMA0:57600")
    async for s in drone.core.connection_state():
        if s.is_connected:
            break
    await drone.action.set_takeoff_altitude(12.0)   # cruise height
    await drone.action.set_airspeed(5.0)            # m/s
    await drone.action.arm()
    await drone.action.takeoff()
    await drone.action.goto_location(32.0, 26.0, 3.5, 0)  # the doorstep
    await servo(1900)       # winch the parcel down (2.5 m of line)
    await asyncio.sleep(9)
    await servo(1100)       # release: the parcel is at the door
    await servo(1500)       # reel the line back up
    await drone.action.goto_location(20.0, 6.0, 12.0, 0)  # home
    await drone.action.land()

asyncio.run(main())`,

  cliName: 'MAVSDK-Python',
  logName: 'mission log',

  quiz: [
    {
      q: 'Why two computers?',
      a: ['Redundancy: either one can fly the mission', 'The Pixhawk flies real-time; the Pi 5 runs the mission, vision and LTE', 'The Pi is cheaper'],
      ok: 1
    },
    {
      q: 'Why winch the parcel instead of landing?',
      a: ['It saves battery', 'The 15-inch props stay well above people and pets', 'GPS is not accurate enough to land'],
      ok: 1
    },
    {
      q: 'The parcel drops. The hover throttle...',
      a: ['Steps down: there is less mass to hold', 'Steps up', 'Stays the same'],
      ok: 0
    },
    {
      q: 'GPS alone can find the doorstep because...',
      a: ['It cannot: ~2 m accuracy; the depth camera handles the last metre', 'It can: RTK is built in', 'LTE corrects it'],
      ok: 0
    }
  ],

  practice: 'Run the delivery to all three addresses. Watch the hover throttle the moment the parcel releases.',

  /* ---------------------------------------------------------------- */
  /* flight                                                           */
  /* ---------------------------------------------------------------- */

  modes: {
    deliver: {
      title: 'Delivery run',
      code: '# the full MAVSDK mission script lives on the build page\n# arm with Space, then press Start delivery run',
      hint: 'Arm (Space), then Start delivery run: takeoff, cruise, winch down, release, home, land',
      alt: true
    },
    loiter: {
      title: 'Loiter (position hold)',
      code: '# ArduPilot: LOITER holds position + altitude on GPS\nparam set LOIT_SPEED 500\nparam set LOIT_BRK_ACCEL 250\nparam set LOIT_ACC_MAX 250',
      hint: 'Sticks centred: GPS + baro hold position and altitude',
      alt: true
    },
    rtl: {
      title: 'Return to launch (RTL)',
      code: '# failsafes: low battery or lost link -> RTL\nparam set RTL_ALT 1200      # cm: climb to 12 m\nparam set LAND_SPEED 50     # cm/s final descent',
      hint: 'Flies home and lands by itself — the failsafe action',
      alt: true
    }
  },

  mode: 'deliver',

  extraButtons: [
    {
      label: 'Start delivery run',
      inFlight: true,
      onClick(fl: FlightState | null): void {
        if (!fl || fl.crashed) return;
        if (fl.parcelAboard === false) {
          // reload the bay for another run: parcel back aboard, mass back on
          parcelMass(fl, true);
          fl.parcelAboard = true;
        }
        fl.lineLen = 0;
        fl.phase = 1;
        fl.msnAnn = 0;
      }
    }
  ],

  /** Stock model, but delivery duty: cruising burns ~75 % of hover current. */
  calc(d: Design): CalcOut {
    const batt = delivery.batts[d.batt] ?? Object.values(delivery.batts)[0];
    const motor = delivery.motors[d.motor] ?? Object.values(delivery.motors)[0];
    const prop = delivery.props[d.prop] ?? Object.values(delivery.props)[0];
    const n = delivery.mpos.length;

    const V = batt.cells * 3.7;
    const krpm = (motor.kv * V) / 1000;
    const sz = motor.sz ?? 1;
    const thrust = delivery.kThrust * sz * prop.pf * krpm * krpm; // grams per motor
    const auw = delivery.fixed.reduce((s, fx) => s + fx.g, 0) + n * motor.g + n * prop.g + batt.g;
    const tw = (n * thrust) / auw;
    const hoverW = auw / (delivery.gPerW * prop.eff);
    const hoverA = hoverW / V;
    const hoverMin = ((batt.mah / 1000) * 0.8) / hoverA * 60;
    const flyMin = hoverMin * 0.75; // steady delivery duty (incl. the 1 kg parcel)
    const maxA = (n * thrust) / (2 * prop.eff) / V;
    const over = motor.kv * batt.cells > (delivery.maxKvCells ?? 1750 * 6 * 1.15);
    const weak = tw < (delivery.minTW ?? 5);
    const hoverThr = Math.sqrt(auw / (n * thrust));

    let costE = 0;
    let costM = 0;
    let nElect = 0;
    let nMech = 0;
    for (const fx of delivery.fixed) {
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
      parcel: PARCEL_G
    };
  },

  calcRows(c: CalcOut): StatItem[] {
    return [
      { label: 'All-up weight', value: `${Math.round(c.auw)} g` },
      { label: 'Thrust : weight', value: `${c.tw.toFixed(1)} : 1` },
      { label: 'Hover throttle', value: `${Math.round(c.hoverThr * 100)} %` },
      { label: 'Max current', value: `${Math.round(c.maxA)} A` },
      { label: 'Hover time', value: `${c.hoverMin.toFixed(1)} min` },
      { label: 'Cruise time', value: `${c.flyMin.toFixed(1)} min` }
    ];
  },

  warnings(d: Design): string[] {
    const out: string[] = [];
    const motor = delivery.motors[d.motor];
    const batt = delivery.batts[d.batt];
    const prop = delivery.props[d.prop];
    if (motor && batt && motor.forCells === 4 && batt.cells === 6) {
      out.push(`A ${motor.kv} KV motor on 6S over-speeds a 15-inch prop: hot windings and burnt endurance — this airframe wants the 400 KV 4114.`);
    }
    if (motor && motor.kv >= 700 && prop && prop.pf >= 1) {
      out.push('A 2814 stator cannot swing a 15- or 16-inch prop: the calculator sees thrust, the motor sees smoke. Stator size sets the prop.');
    }
    return out;
  },

  /** Stock multirotor flight, plus the 10-phase delivery state machine. */
  physics(fl: FlightState, dt: number, ctx: PhysCtx): void {
    // lazy mission state (newFlight knows nothing about parcels)
    if (fl.parcelAboard === undefined) {
      fl.parcelAboard = true;
      fl.lineLen = 0;
      fl.phase = 0;
    }
    const ph = (fl.phase as number) || 0;

    if (fl.crashed) {
      if (ph >= 1 && ph <= 9) fl.phase = 0; // a crash ends the mission
    } else if (!fl.armed && ph >= 2 && ph <= 9) {
      fl.phase = 0;
      ctx.say('Mission aborted: disarmed');
    } else if (ph === 10 && fl.armed) {
      fl.phase = 0; // re-armed after DONE: back to manual, button starts a new run
    }

    const run = (fl.phase as number) || 0;
    if (run >= 1 && run <= 9) {
      if (fl.armed && !fl.crashed) {
        deliveryStep(fl, dt, ctx);
      } else {
        // waiting to arm: keep the sticks neutral so arming is allowed
        const s = ctx.stick;
        s.thr = 0;
        s.thrAbs = 0;
        s.yaw = 0;
        s.pitch = 0;
        s.roll = 0;
      }
    }
    ctx.stock(fl, dt);
  },

  flyStats(fl: FlightState): StatItem[] {
    const ph = (fl.phase as number) || 0;
    const aboard = fl.parcelAboard !== false;
    const line = typeof fl.lineLen === 'number' ? fl.lineLen : 0;
    return [
      { label: 'Mission', value: MISSION_PHASES[ph] ?? 'IDLE', small: true },
      { label: 'Parcel', value: aboard ? (line > 0.05 ? `${line.toFixed(1)} m down` : '1.0 kg aboard') : 'delivered', small: true },
      { label: 'Hover thr', value: `${Math.round(fl.c.hoverThr * 100)} %` }
    ];
  },

  range: {
    title: 'Suburb delivery',
    brief: 'Three addresses, one parcel: fly the run yourself, or press Start delivery run and let the Pi do it.',
    field: 55,
    pad: [20, 6], // must match HOME above
    ground: '#cdd6c4',
    keepGates: false,
    alt: true,
    camTilt: 8,
    prims: [
      // streets
      { t: 'flat', x: 27, y: 11, w: 48, d: 3.5, col: '#b8b2a4', label: 'MAIN ST' },
      { t: 'flat', x: 27, y: 24, w: 48, d: 3.5, col: '#b8b2a4', label: 'OAK AVE' },
      // the depot (the pad) + its loading bay
      { t: 'flat', x: 20, y: 6, w: 8, d: 6, col: '#c9c4b4', label: 'DEPOT' },
      { t: 'box', x: 23.5, y: 3.2, w: 1.6, d: 1.6, h: 0.9, col: '#a8a294' },
      { t: 'box', x: 16.6, y: 3.6, w: 1.1, d: 1.1, h: 0.7, col: '#c9a86b' },
      // houses south of MAIN ST (flanking the depot)
      { t: 'house', x: 8, y: 6.5, w: 5, d: 4, h: 3, col: '#e2dccb' },
      { t: 'house', x: 34, y: 6.5, w: 5, d: 4, h: 3.2, col: '#d8c8b8' },
      // houses between the streets
      { t: 'house', x: 14, y: 17, w: 6, d: 4.5, h: 3.2, col: '#e2dccb' },
      { t: 'house', x: 26, y: 17, w: 6, d: 4.5, h: 3, col: '#d8c8b8' },
      { t: 'house', x: 44, y: 21.5, w: 6, d: 4.5, h: 3.4, col: '#e2dccb' }, // ADDRESS 3
      // houses north of OAK AVE
      { t: 'house', x: 32, y: 30, w: 6, d: 5, h: 3, col: '#e2dccb' }, // ADDRESS 1
      { t: 'house', x: 12, y: 38, w: 6, d: 5, h: 3.4, col: '#d8c8b8' }, // ADDRESS 2
      { t: 'house', x: 38, y: 39, w: 6, d: 5, h: 3, col: '#d8c8b8' },
      // fenced backyards
      { t: 'box', x: 32, y: 34.5, w: 7, d: 0.25, h: 0.8, col: '#c9c2b2' },
      { t: 'box', x: 12, y: 42.5, w: 7, d: 0.25, h: 0.8, col: '#c9c2b2' },
      { t: 'box', x: 38, y: 43.5, w: 7, d: 0.25, h: 0.8, col: '#c9c2b2' },
      // power poles along MAIN ST (the wires are left to the imagination)
      { t: 'pole', x: 5, y: 14.2, h: 7, col: '#9c7a58' },
      { t: 'pole', x: 15, y: 14.2, h: 7, col: '#9c7a58' },
      { t: 'pole', x: 25, y: 14.2, h: 7, col: '#9c7a58' },
      { t: 'pole', x: 35, y: 14.2, h: 7, col: '#9c7a58' },
      { t: 'pole', x: 45, y: 14.2, h: 7, col: '#9c7a58' },
      // school
      { t: 'flat', x: 47, y: 32, w: 12, d: 9, col: '#d3cec0', label: 'SCHOOL' },
      { t: 'box', x: 47, y: 32, w: 9, d: 6, h: 4, col: '#d8d3c4' },
      // playground beside the school
      { t: 'box', x: 45, y: 41, w: 1.5, d: 1.5, h: 1, col: '#c96a4e' },
      { t: 'box', x: 49, y: 41, w: 1.5, d: 1.5, h: 1.2, col: '#c96a4e' },
      { t: 'disc', x: 47, y: 44.5, r: 1.5, col: '#d9a520' },
      // drop zones
      { t: 'disc', x: 32, y: 26, r: 1.2, col: '#ef6a4c', label: 'ADDRESS 1' },
      { t: 'disc', x: 12, y: 34, r: 1.2, col: '#76a0e2', label: 'ADDRESS 2' },
      { t: 'disc', x: 44, y: 18, r: 1.2, col: '#93d3b0', label: 'ADDRESS 3' },
      // trees
      { t: 'tree', x: 5, y: 47, h: 6 },
      { t: 'tree', x: 27, y: 46, h: 5.5 },
      { t: 'tree', x: 50, y: 5, h: 6.5 },
      { t: 'tree', x: 18, y: 28, h: 5 },
      { t: 'tree', x: 53, y: 44, h: 7 }
    ],
    goals: [
      { x: 32, y: 26, z: 3, r: 2, label: 'ADDRESS 1' },
      { x: 12, y: 34, z: 3, r: 2, label: 'ADDRESS 2' },
      { x: 44, y: 18, z: 3, r: 2, label: 'ADDRESS 3' },
      { x: 20, y: 6, z: 1, r: 2, label: 'HOME' }
    ]
  }
};
