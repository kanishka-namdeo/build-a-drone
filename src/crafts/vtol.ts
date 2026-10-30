/**
 * Fig. 10 — the VTOL tiltrotor: a tricopter-layout QuadPlane.
 *
 * Two front motors tilt from straight up (hover) to straight ahead (cruise)
 * on metal-gear servos; a third lifts at the tail. The signature is the
 * transition: below stall speed the quad system flies it, above it the wing
 * takes over, and the middle is where bad builds crash.
 */

import { Vec3, Tone, INK, tag as tagPill } from '../engine/core';
import { FR, rad } from '../engine/frames';
import type { Frame } from '../engine/frames';
import { obox, ocyl, odisc, otext, tube } from '../engine/oshapes';
import { CARBON, PCB, SILK, WIRE, TIN } from '../engine/materials';
import { craftAnim } from './anim';
import type { CraftRecord, DrawOpt, DrawAdd, FlightState, PhysCtx } from '../types';

const FOAM: Tone = { l: '#f6f2e8', m: '#ded8c8', d: '#b3ab97' };

/** Tilt-servo bench test window. */
let tiltT0 = 0;

/** Wing geometry (trim): level flight at ~1.35x stall. */
const VSTALL = 10;

export const vtol: CraftRecord = {
  key: 'vtol',
  fig: 10,
  name: 'VTOL tiltrotor',
  sub: 'hover to cruise',
  hint: 'test the tilt servos, then transition on the wing of it',
  noun: 'tiltrotor',
  palette: 'mustard',
  log: 'ardupilot',
  mat: 460,
  benchH: 190,
  flyScale: 1.6,
  flyVB: 13000,
  hitR: 0.24,
  ceiling: 100,
  drag: 0.03,
  camZ: 0.75,
  kThrust: 5.0,
  gPerW: 7,
  minTW: 1.6,
  design: { batt: '4s8000', motor: '2810-1000', prop: '9x5' },

  batts: {
    '4s8000': { name: '4S2P 8000 Li-ion', cells: 4, mah: 8000, g: 560, price: 70, col: '#2f5fa8', lab: '4S 8Ah' },
    '4s5000': { name: '4S 5000 LiPo', cells: 4, mah: 5000, g: 520, price: 55, col: '#2b2a28', lab: '4S 5Ah' },
    '6s4000': { name: '6S 4000 LiPo', cells: 6, mah: 4000, g: 600, price: 75, col: '#8a5f2f', lab: '6S 4Ah' }
  },
  motors: {
    '2810-1000': { name: '2810 1000KV tilt', kv: 1000, g: 72, price: 30 },
    '2814-700': { name: '2814 700KV tilt', kv: 700, g: 96, price: 38 },
    '2306-2400': { name: '2306 2400KV (racing!)', kv: 2400, g: 33, price: 20 }
  },
  props: {
    '9x5': { name: '9x5', pf: 1.0, eff: 1.0, g: 12, price: 8 },
    '10x5': { name: '10x5', pf: 1.12, eff: 1.05, g: 14, price: 9 },
    '7x4': { name: '7x4', pf: 0.72, eff: 0.92, g: 8, price: 6 }
  },
  fixed: [
    { id: 'FRAME', name: 'pod + boom + wire gear', g: 330, price: 90, cat: 'Mechanical' },
    { id: 'WING', name: '840 mm wing + spar', g: 190, price: 40, cat: 'Mechanical' },
    { id: 'TAIL', name: 'V-tail ruddervators', g: 40, price: 24, cat: 'Mechanical' },
    { id: 'TILT', name: '2 tilt servos + nacelles', g: 70, price: 46, cat: 'Electrical' },
    { id: 'ESC', name: '3x ESCs', g: 45, price: 60, cat: 'Electrical' },
    { id: 'FC', name: 'Matek H743-WING', g: 30, price: 95, cat: 'Electrical' },
    { id: 'GPS', name: 'GPS + mast', g: 18, price: 28, cat: 'Electrical' },
    { id: 'ASPD', name: 'airspeed sensor (pitot)', g: 8, price: 35, cat: 'Electrical' },
    { id: 'AV', name: 'camera + 800 mW VTX', g: 22, price: 55, cat: 'Electrical' },
    { id: 'PDB', name: 'XT60 + PDB', g: 20, price: 12, cat: 'Electrical' }
  ],

  parts: [
    {
      id: 'FRAME',
      name: 'Foam pod + carbon boom + wire landing gear',
      short: 'POD + BOOM',
      z: 0,
      what: 'The fuselage pod carries the battery at 25% chord; a slim boom reaches back to the V-tail on wire gear.'
    },
    {
      id: 'WING',
      name: '840 mm wing on a carbon spar',
      short: 'WING',
      z: 1,
      after: ['FRAME'],
      what: 'The wing is why a VTOL flies 3-4x longer than a quad: in cruise it carries the weight, and the motors only fight drag.'
    },
    {
      id: 'MOTORS',
      name: '2 tilting front motors + 1 rear lift motor',
      short: 'MOTORS',
      z: 2,
      after: ['WING'],
      what: 'The front pair tilts on servos; the tail motor only lifts. In cruise the front motors pull and the tail stops.'
    },
    {
      id: 'ESC',
      name: '3 ESCs (2 in the nacelles)',
      short: 'ESCS',
      z: 2,
      after: ['MOTORS'],
      what: 'The nacelle ESCs ride the tilt with their motors; the tail ESC lives in the boom.'
    },
    {
      id: 'WIRES',
      name: 'Power + servo wiring',
      short: 'WIRES',
      z: 3,
      after: ['ESC'],
      what: 'Slack loops at the pivots: tilt nacelles eat straight-cut wires.'
    },
    {
      id: 'FC',
      name: 'Matek H743-WING flight controller',
      short: 'FLIGHT CTRL',
      z: 4,
      after: ['ESC'],
      polar: ['arrow forward', 'arrow backward'],
      what: 'Runs ArduPilot QuadPlane: the quad system and the plane system at once, blended during transition.'
    },
    {
      id: 'TILT',
      name: '2 tilt servos + nacelles',
      short: 'TILT SERVOS',
      z: 5,
      after: ['FC'],
      polar: ['linkages correct', 'one servo reversed'],
      what: 'Metal-gear servos swing the nacelles 0 to 90 degrees. A REVERSED servo flips the craft over its tail at transition start — test on the bench first.'
    },
    {
      id: 'XT60',
      name: 'XT60 + PDB',
      short: 'XT60 + PDB',
      z: 3,
      after: ['ESC'],
      polar: ['stripe to minus', 'stripe to plus'],
      what: 'One pack feeds everything through a small power board.'
    },
    {
      id: 'GPS',
      name: 'GPS on a mast',
      short: 'GPS',
      z: 6,
      after: ['FC'],
      what: 'Navigation for QRTL: the craft has to find home as a plane, then as a quad.'
    },
    {
      id: 'ASPD',
      name: 'Airspeed sensor + pitot tube',
      short: 'PITOT',
      z: 5,
      after: ['FC'],
      what: 'Airspeed is NOT ground speed: with a tailwind you can be flying 12 m/s over the ground and still be stalled. The pitot knows the difference.'
    },
    {
      id: 'CAM',
      name: 'FPV camera + 800 mW VTX',
      short: 'CAM + VTX',
      z: 5,
      after: ['FC'],
      what: 'In the nose, tilted for cruise: a VTOL spends most of its flight going forward.'
    },
    {
      id: 'BATT',
      name: 'Battery at 25% chord',
      short: 'BATTERY',
      z: 7,
      after: ['XT60'],
      what: 'Li-ion for cruise: the amp draw in forward flight is about a third of hover.'
    },
    {
      id: 'PROPS',
      name: 'Props (front pair counter-rotating)',
      short: 'PROPS',
      z: 8,
      after: ['MOTORS'],
      polar: ['counter-rotating (correct)', 'both same way'],
      what: 'The front pair counter-rotates so the torque cancels in hover and the slipstream stays symmetric in cruise.'
    }
  ],

  mpos: [
    [-150, -18, 'M1', 'CW'],
    [150, -18, 'M2', 'CCW'],
    [-20, 210, 'M4', 'CCW']
  ] as Array<[number, number, string, 'CW' | 'CCW']>,
  wrongMotor: 0,
  calLabel: 'Calibrate accelerometer',

  calc(d) {
    const batt = this.batts[d.batt] ?? Object.values(this.batts)[0];
    const motor = this.motors[d.motor] ?? Object.values(this.motors)[0];
    const prop = this.props[d.prop] ?? Object.values(this.props)[0];
    const n = 3;
    const V = batt.cells * 3.7;
    const krpm = (motor.kv * V) / 1000;
    const thrust = this.kThrust * prop.pf * krpm * krpm;
    const auw = this.fixed.reduce((s, f) => s + f.g, 0) + n * motor.g + n * prop.g + batt.g;
    const tw = (n * thrust) / auw;
    const hoverW = auw / (this.gPerW * prop.eff);
    const hoverA = hoverW / V;
    const hoverMin = ((batt.mah / 1000) * 0.8) / hoverA * 60;
    // cruise: the wing carries the weight; thrust ~ 1/3 of hover power
    const cruiseA = hoverA * 0.34;
    const cruiseMin = ((batt.mah / 1000) * 0.85) / cruiseA * 60;
    const maxA = (n * thrust) / (2 * prop.eff) / V;
    const over = motor.kv * batt.cells > 1750 * 6 * 1.15;
    const weak = tw < 1.6;
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
    costM += prop.price * 2;
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
      flyMin: cruiseMin,
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
      { label: 'All-up weight', value: `${Math.round(c.auw)} g` },
      { label: 'Hover T : W', value: `${c.tw.toFixed(2)} : 1` },
      { label: 'Hover throttle', value: `${Math.round(c.hoverThr * 100)} %` },
      { label: 'Hover time', value: `${c.hoverMin.toFixed(1)} min` },
      { label: 'Cruise time', value: `${(c.flyMin as number).toFixed(0)} min` },
      { label: 'Cruise speed', value: `~47 km/h` }
    ];
  },

  warnings(d, c) {
    if (d.motor === '2306-2400') {
      return ['A 2400 KV racing motor on an 840 mm VTOL: the tilt bearings and the ESCs will not survive the heat. Pick a 2810-class motor.'];
    }
    if ((c.tw as number) < 1.8) {
      return [`Hover thrust-to-weight ${c.tw.toFixed(2)} is marginal: transitions need margin to pull out. Aim above 1.8.`];
    }
    return [];
  },

  /* ---------------------------------------------------------------- */
  /* hover <-> cruise physics                                          */
  /* ---------------------------------------------------------------- */

  physics(fl: FlightState, dt: number, ctx: PhysCtx): void {
    const G = 9.81;
    const s = ctx.stick;
    fl.step++;
    fl.t += dt;
    if (fl.tiltDeg === undefined) {
      fl.tiltDeg = 0; // 0 = hover (props up), 90 = cruise (props forward)
      fl.phase = 'hover'; // hover | transition | cruise | back
    }
    const c = fl.c;
    const mass = c.auw / 1000;
    const thrustMax = ((c.n as number) * (c.thrust as number)) / 1000 * G; // N total
    const mode = (fl.mode as string) ?? 'qhover';

    // tilt target by mode
    let tiltTarget = 0;
    if (mode === 'transition') tiltTarget = 90;
    if (mode === 'qrtl') tiltTarget = fl.pos[2] > 2 ? 90 : 0;
    // manual transition key T
    if (fl.manualTilt !== undefined) tiltTarget = fl.manualTilt as number;
    const tiltRate = 45; // deg/s
    const prevTilt = fl.tiltDeg as number;
    fl.tiltDeg = prevTilt + Math.sign(tiltTarget - prevTilt) * Math.min(Math.abs(tiltTarget - prevTilt), tiltRate * dt);
    const tilt = rad(fl.tiltDeg as number);

    // airspeed + speeds
    const cy = Math.cos(fl.yaw);
    const sy = Math.sin(fl.yaw);
    const cp = Math.cos(fl.pitch);
    const sp = Math.sin(fl.pitch);
    const fwd: Vec3 = [cy * cp, sy * cp, sp];
    const vTotal = Math.hypot(fl.vel[0], fl.vel[1], fl.vel[2]);
    const u = Math.max(0, fl.vel[0] * fwd[0] + fl.vel[1] * fwd[1] + fl.vel[2] * fwd[2]);

    // attitude control: quad system below stall, elevons above
    const wingAuth = Math.min(1, u / (VSTALL * 1.3));
    const quadAuth = 1 - Math.min(1, u / (VSTALL * 1.6));
    const reversed = ((fl.reversedServo as boolean) ?? false) && (fl.tiltDeg as number) > 10;
    if (!fl.crashed) {
      const rollRate = rad(160) * Math.max(0.25, wingAuth) + rad(220) * quadAuth;
      const pitchRate = rad(90) * Math.max(0.25, wingAuth) + rad(140) * quadAuth;
      fl.roll += s.roll * rollRate * dt * (reversed ? -1 : 1);
      fl.pitch += -s.pitch * pitchRate * dt;
      // self-level in hover only
      if (u < VSTALL * 0.7) {
        fl.roll += (0 - fl.roll) * Math.min(1, dt * 3);
      }
      // pitch stability in cruise
      if (u > VSTALL) {
        const pathAngle = Math.atan2(fl.vel[2], Math.hypot(fl.vel[0], fl.vel[1]));
        fl.pitch += (pathAngle - fl.pitch) * Math.min(1, dt * 1.4);
      }
      fl.roll = Math.max(rad(-50), Math.min(rad(50), fl.roll));
      fl.pitch = Math.max(rad(-30), Math.min(rad(28), fl.pitch));
      // coordinated turn when wingborne
      if (u > VSTALL * 0.8) {
        fl.yaw += ((G * Math.tan(fl.roll)) / Math.max(8, u)) * dt;
      } else {
        fl.yaw += -s.yaw * rad(200) * dt;
      }
    }

    // reversed tilt servo: flips over its tail at transition start
    if (reversed && !fl.crashed && fl.armed) {
      fl.pitch -= rad(160) * dt;
      if ((fl.tiltDeg as number) > 30) {
        ctx.crash(fl, 'a reversed tilt servo');
        ctx.say('Flipped over the tail: one tilt servo was reversed. The bench test catches this');
      }
    }

    const cr = Math.cos(fl.roll);
    const sr = Math.sin(fl.roll);
    const up: Vec3 = [cy * sp * cr - sy * sr, sy * sp * cr + cy * sr, cp * cr];

    // forces
    const a: Vec3 = [0, 0, -G];
    if (fl.armed && !fl.crashed) {
      // altitude-hold style throttle in every mode: W/S = climb rate
      const thrustAcc = thrustMax / (mass * G); // full-throttle accel in g
      const target = s.thr * 2.2; // m/s climb rate command
      const need = (1 + ((target - fl.vel[2]) * 3) / G) / Math.max(0.4, Math.cos(tilt) * 0.7 + 0.3) / Math.max(0.05, thrustAcc);
      let throttle = Math.min(1, Math.sqrt(Math.max(0, need)));
      if (fl.pos[2] <= 0 && s.thr <= 0) throttle = 0;
      // through the transition window keep the power on
      if ((mode === 'transition' || mode === 'qrtl') && tilt > rad(15)) {
        throttle = Math.max(throttle, 0.5);
      }
      fl.thrEff += (throttle - fl.thrEff) * Math.min(1, dt * 8);
      const T = thrustMax * fl.thrEff;
      // thrust tilts with the nacelles: hover = along body up, cruise = along nose
      for (let i = 0; i < 3; i++) {
        a[i] += (up[i] * Math.cos(tilt) + fwd[i] * Math.sin(tilt)) * (T / mass);
      }
      // Q_ASSIST: the tail motor helps below stall during transition
      const assist = Math.max(0, 1 - u / (VSTALL * 1.1));
      if (tilt > rad(20)) {
        for (let i = 0; i < 3; i++) a[i] += up[i] * (T / mass) * 0.35 * assist;
      }
    } else {
      fl.thrEff = Math.max(0, fl.thrEff - 3 * dt);
    }

    // wing lift (perpendicular to velocity) + drag
    const kDrag = 0.02;
    const D = kDrag * vTotal * vTotal + 0.3;
    const kl = (mass * G) / ((VSTALL * 1.35) ** 2);
    let L = kl * u * u;
    if (u < VSTALL) L *= Math.max(0.1, (u / VSTALL) ** 2) * 0.5;
    let lx = up[0];
    let ly = up[1];
    let lz = up[2];
    if (vTotal > 0.01) {
      const dd = (up[0] * fl.vel[0] + up[1] * fl.vel[1] + up[2] * fl.vel[2]) / vTotal;
      lx -= (dd * fl.vel[0]) / vTotal;
      ly -= (dd * fl.vel[1]) / vTotal;
      lz -= (dd * fl.vel[2]) / vTotal;
      const ll = Math.hypot(lx, ly, lz) || 1;
      lx /= ll;
      ly /= ll;
      lz /= ll;
    }
    for (let i = 0; i < 3; i++) {
      const liftDir: Vec3 = [lx, ly, lz];
      a[i] += liftDir[i] * (L / mass);
      if (vTotal > 0.01) a[i] -= (fl.vel[i] / vTotal) * (D / mass);
    }
    for (let i = 0; i < 3; i++) {
      fl.vel[i] += a[i] * dt;
      fl.pos[i] += fl.vel[i] * dt;
    }

    // battery
    if (fl.armed && !fl.crashed) {
      const amps = (c.hoverA as number) * (0.4 + fl.thrEff * 0.7 * (1 - (fl.tiltDeg as number) / 130)) + 0.5;
      fl.used += (amps * dt * 1000) / 3600;
      const soc = Math.max(0.01, 1 - fl.used / ((c.mah as number) ?? 8000));
      fl.volt = (c.cells as number) * (3.3 + 0.9 * Math.pow(soc, 0.7)) - amps * 0.01;
    }

    // ground
    if (fl.pos[2] <= 0) {
      const gentle = vTotal < 4 && Math.abs(fl.roll) < rad(25) && fl.vel[2] > -2.5;
      if (fl.t > 0.3 && !gentle) {
        ctx.crash(fl, 'the ground');
        fl.pos[2] = 0;
      } else {
        fl.pos[2] = 0;
        fl.vel[2] = Math.max(0, fl.vel[2]);
        fl.vel[0] *= 0.85;
        fl.vel[1] *= 0.85;
        if (fl.thrEff < 0.3) {
          fl.roll *= 0.8;
          fl.pitch *= 0.8;
        }
      }
    }

    // QRTL autopilot: fly home as a plane, back-transition, land as a quad
    if (mode === 'qrtl' && fl.armed && !fl.crashed) {
      const HOME = { x: 20, y: 6 };
      const dx = HOME.x - fl.pos[0];
      const dy = HOME.y - fl.pos[1];
      const dist = Math.hypot(dx, dy);
      const bearing = Math.atan2(dy, dx);
      let err = bearing - fl.yaw;
      while (err > Math.PI) err -= 2 * Math.PI;
      while (err < -Math.PI) err += 2 * Math.PI;
      if (dist > 6) {
        s.roll = Math.max(-0.45, Math.min(0.45, err * 1.5));
        s.thrAbs = 0.55;
        fl.manualTilt = 90;
      } else {
        // back-transition: tilt to hover, descend
        fl.manualTilt = 0;
        s.roll = 0;
        s.thrAbs = 0.35;
        s.pitch = 0;
      }
      if (dist < 1.5 && fl.pos[2] < 0.2) {
        fl.armed = false;
        ctx.say('QRTL complete: back on the pad as a quad');
      }
    }

    // transition bookkeeping
    fl.phase = u > VSTALL ? 'cruise' : (fl.tiltDeg as number) > 15 ? 'transition' : 'hover';

    // camera + spin
    fl.cam[0] += (fl.pos[0] - fl.cam[0]) * 0.14;
    fl.cam[1] += (fl.pos[1] - fl.cam[1]) * 0.14;
    fl.cam[2] += (fl.pos[2] * 0.75 - fl.cam[2]) * 0.14;
    for (let i = 0; i < (c.n as number); i++) fl.spin[i] += fl.thrEff * dt * (i % 2 ? -40 : 40);
    if (fl.crashed) fl.tumble += 8 * dt;
  },

  flyStats(fl) {
    return [
      { label: 'Tilt', value: `${Math.round(fl.tiltDeg as number)}°`, small: true },
      { label: 'Airspeed', value: `${(Math.max(0, fl.vel[0] * Math.cos(fl.yaw) + fl.vel[1] * Math.sin(fl.yaw)) * 3.6).toFixed(0)} km/h`, small: true },
      { label: 'Phase', value: String(fl.phase), small: true }
    ];
  },

  extraButtons: [
    {
      label: 'Tilt servo test',
      onClick(): void {
        tiltT0 = performance.now();
        craftAnim(4600);
        const reversed = ((window as unknown as { __st?: { placed?: { TILT?: { orient?: number } } } }).__st?.placed?.TILT?.orient ?? 0) === 1;
        setTimeout(() => {
          const toast = document.getElementById('toast');
          if (!toast) return;
          toast.textContent = reversed
            ? 'LEFT NACELLE SWINGS BACKWARDS: that servo is reversed. In the air it flips over the tail'
            : 'Both nacelles sweep 0 to 90 and back: servos correct';
          toast.classList.add('show');
        }, 4200);
      }
    },
    {
      label: 'Transition / back (T)',
      inFlight: true,
      onClick(fl: FlightState | null): void {
        if (!fl) return;
        fl.manualTilt = ((fl.manualTilt as number) ?? 0) > 45 ? 0 : 90;
      }
    }
  ],

  /* ---------------------------------------------------------------- */

  draw(f: Frame, add: DrawAdd, opt: DrawOpt): void {
    const m = opt.m;
    const has = opt.has;
    const U = opt.U;

    // tilt angle: bench test animation, or flight state
    let tiltDeg = 0;
    if (opt.fl && opt.fl.tiltDeg !== undefined) tiltDeg = opt.fl.tiltDeg as number;
    const tSince = tiltT0 ? (performance.now() - tiltT0) / 1000 : -1;
    if (tSince >= 0 && tSince < 4.6) {
      // 0 -> 90 -> 0 sweep
      tiltDeg = tSince < 2 ? (tSince / 2) * 90 : Math.max(0, 90 - ((tSince - 2) / 2) * 110);
      if (opt.orient('TILT') === 1 && tSince > 2.4) tiltDeg = -tiltDeg; // reversed!
    }
    const tilt = rad(tiltDeg);

    if (has('FRAME')) {
      const F = U('FRAME');
      add([0, 60, 8], obox(F, -80, 60, -16, 16, -8, 14, FOAM, 0.9).svg, 'FRAME');
      // boom
      add([0, 120, 8], obox(F, 60, 210, -4, 4, 2, 10, CARBON, 0.8).svg, 'FRAME');
      // wire gear
      add([0, 0, -14], tube([FR.pt(F, [-30, -12, -6]), FR.pt(F, [-52, 0, -34])], 2.4, TIN), 'FRAME');
    }

    if (has('WING')) {
      const F = U('WING');
      add([0, 0, 16], obox(F, -90, 90, -110, 110, 8, 20, FOAM, 0.9).svg, 'WING');
    }

    if (has('TAIL')) {
      const F = U('TAIL');
      for (const side of [-1, 1]) {
        const V = FR.Rz(FR.T(F, 210, side * 30, 14), side * rad(38));
        add([210, side * 40, 18], obox(V, -16, 16, 0, 56, -2, 8, m, 0.8).svg, 'TAIL');
      }
    }

    if (has('MOTORS')) {
      const F = U('MOTORS');
      // front tilting pair on nacelles
      for (const side of [-1, 1]) {
        const N = FR.T(F, side * 150, -18, 14);
        const sideSign = side === 1 && opt.orient('TILT') === 1 ? -1 : 1;
        const tilts = rad(tiltDeg * sideSign);
        const M = FR.Ry(N, tilts);
        let svg = ocyl(M, 11, 0, 16, { l: '#55504a', m: '#3d3935', d: '#272421' }, 0.9, 14).svg;
        svg += ocyl(M, 12, 16, 32, m, 0.9, 14).svg;
        // pivot block
        svg += obox(N, -6, 6, -14, -4, 8, 20, CARBON, 0.7).svg;
        add([side * 150, -18, 20], svg, 'MOTORS');
        // props on the tilting motors
        if (has('PROPS') && !opt.broken) {
          const P = FR.T(M, 0, 0, 34);
          const rate = (side === -1 ? (opt.rpm[0] ?? 0) : (opt.rpm[1] ?? 0)) as number;
          if (rate > 0.12) {
            add([side * 150, -18, 30], `<circle cx="0" cy="0" r="58" fill="#fff" opacity="${(0.16 + 0.2 * rate).toFixed(2)}" transform="translate(${P.o[0].toFixed(1)} ${P.o[1].toFixed(1)}) scale(0.06)"/>`, 'PROPS');
          } else {
            let psvg = '';
            for (let b = 0; b < 2; b++) {
              const B = FR.Rz(P, (opt.spin[side === -1 ? 0 : 1] || 0) + (b * Math.PI) / 2);
              psvg += obox(B, 6, 58, -5, 5, -0.8, 0.8, CARBON, 0.7).svg;
            }
            add([side * 150, -18, 30], psvg, 'PROPS');
          }
        }
      }
      // rear lift motor
      const R = FR.T(F, -20, 210, 18);
      let rsvg = ocyl(R, 11, 0, 14, { l: '#55504a', m: '#3d3935', d: '#272421' }, 0.9, 14).svg;
      rsvg += ocyl(R, 12, 14, 30, m, 0.9, 14).svg;
      add([-20, 210, 22], rsvg, 'MOTORS');
      if (has('PROPS') && !opt.broken) {
        const P = FR.T(R, 0, 0, 32);
        const rate = (opt.rpm[2] as number) ?? 0;
        if (rate > 0.12) {
          add([-20, 210, 30], `<circle cx="0" cy="0" r="58" fill="#fff" opacity="${(0.16 + 0.2 * rate).toFixed(2)}" transform="translate(${P.o[0].toFixed(1)} ${P.o[1].toFixed(1)}) scale(0.06)"/>`, 'PROPS');
        } else {
          let psvg = '';
          for (let b = 0; b < 2; b++) {
            const B = FR.Rz(P, (opt.spin[2] || 0) + (b * Math.PI) / 2);
            psvg += obox(B, 6, 58, -5, 5, -0.8, 0.8, CARBON, 0.7).svg;
          }
          add([-20, 210, 30], psvg, 'PROPS');
        }
      }
    }

    if (has('ESC')) {
      const F = U('ESC');
      add([-20, 200, 10], obox(F, -8, 8, -7, 7, 6, 12, PCB, 0.7).svg, 'ESC');
    }

    if (has('WIRES')) {
      const F = U('WIRES');
      let svg = tube([FR.pt(F, [-30, 0, 6]), FR.pt(F, [-120, -18, 12])], 1.2, WIRE.red);
      svg += tube([FR.pt(F, [-30, 0, 4]), FR.pt(F, [120, -18, 12])], 1.2, WIRE.red);
      svg += tube([FR.pt(F, [-24, 4, 8]), FR.pt(F, [-20, 190, 8])], 1, WIRE.blk);
      // slack loops at the pivots
      for (const side of [-1, 1]) {
        svg += tube([FR.pt(F, [side * 120, -18, 6]), FR.pt(F, [side * 130, -18, 20]), FR.pt(F, [side * 142, -18, 10])], 0.8, WIRE.blu);
      }
      add([-60, 0, 10], svg, 'WIRES');
    }

    if (has('FC')) {
      const F = U('FC');
      let svg = obox(F, -14, 14, -14, 14, 8, 13, PCB, 0.8).svg;
      const flip = opt.orient('FC') ? -1 : 1;
      svg += otext(F, 8 * flip, 0, 14.5, '▲', 8, SILK);
      add([0, 20, 12], svg, 'FC');
    }

    if (has('TILT')) {
      const F = U('TILT');
      for (const side of [-1, 1]) {
        const S = FR.T(F, side * 120, -30, 12);
        let svg = obox(S, -9, 9, -7, 7, -6, 6, { l: '#55504a', m: '#3d3935', d: '#272421' }, 0.7).svg;
        svg += odisc(FR.up(S, 6.5), 5, 0, TIN.l, 0.6, 10);
        add([side * 120, -30, 12], svg, 'TILT');
      }
    }

    if (has('XT60')) {
      const F = U('XT60');
      add([-70, 0, 4], obox(F, -84, -70, -5, 5, 0, 10, { l: '#f2c230', m: '#d9ad25', d: '#8f6f10' }, 0.8).svg, 'XT60');
    }

    if (has('GPS')) {
      const F = U('GPS');
      let svg = ocyl(F, 4, 14, 40, CARBON, 0.7, 10, 40, 90).svg;
      svg += ocyl(FR.T(F, 40, 90, 40), 9, 0, 6, { l: '#ef6a4c', m: '#cf5038', d: '#4a2219' }, 0.7, 12).svg;
      add([40, 90, 44], svg, 'GPS');
    }

    if (has('ASPD')) {
      const F = U('ASPD');
      let svg = ocyl(FR.Ry(F, rad(90)), 2, -10, 10, TIN, 0.7, 8, 66, -2).svg;
      svg += obox(F, -8, 0, -5, 5, 6, 12, PCB, 0.6).svg;
      add([66, -2, 12], svg, 'ASPD');
    }

    if (has('CAM')) {
      const F = U('CAM');
      let svg = obox(F, 46, 62, -8, 8, 4, 16, m, 0.8).svg;
      const lensF = FR.Ry(F, rad(-14));
      svg += ocyl(lensF, 4.5, 58, 66, CARBON, 0.7, 12, 0, 10).svg;
      svg += tube([FR.pt(F, [-40, 0, 18]), FR.pt(F, [-70, 0, 34])], 1.2, WIRE.wht);
      add([54, 0, 12], svg, 'CAM');
    }

    if (has('BATT')) {
      const F = U('BATT');
      const batt = opt.design.batt;
      const col = batt === '4s5000' ? '#2b2a28' : batt === '6s4000' ? '#8a5f2f' : '#2f5fa8';
      add([-20, 30, 4], obox(F, -46, 6, -16, 16, -4, 12, { l: col, m: '#413f3d', d: '#26241f' } as Tone, 0.9).svg, 'BATT');
    }
  },

  hull(f: Frame): Vec3[] {
    const pts: Vec3[] = [];
    for (const side of [-1, 1]) {
      pts.push(FR.pt(f, [side * 150, -18, 34]));
      pts.push(FR.pt(f, [side * 90, side * 110, 20]));
    }
    pts.push(FR.pt(f, [-20, 210, 32]));
    pts.push(FR.pt(f, [210, 40, 24]));
    pts.push(FR.pt(f, [-80, 0, -34]));
    return pts;
  },

  tags: [
    ['FC', [0, 20, 16], 40, -44],
    ['TILT', [-120, -30, 16], -44, -34],
    ['MOTORS', [150, -18, 34], 40, -28],
    ['ASPD', [66, -2, 14], 42, 22],
    ['BATT', [-20, 30, 14], -20, 36]
  ],

  wiring: {
    nodes(d, c) {
      return {
        BATT: [20, 238, 'BATTERY', (c.battName as string) || '4S2P 8000', '#e2483d'],
        XT60: [190, 238, 'XT60 + PDB', 'power board', '#e2483d'],
        ESC: [360, 238, 'ESC x3', '2 in nacelles', '#e2483d'],
        MOTORS: [600, 238, 'MOTORS x3', (c.motorName as string) || '2810 1000KV', '#f08a2b'],
        FC: [360, 70, 'FLIGHT CTRL', 'H743, QuadPlane', '#3e86d9'],
        TILT: [140, 70, 'TILT SERVOS', 'metal gear', '#f08a2b'],
        ASPD: [600, 14, 'PITOT', 'airspeed', '#43a35a'],
        GPS: [600, 116, 'GPS', 'on the mast', '#8c4bd1']
      };
    },
    links: [
      { from: 'BATT', to: 'XT60', kind: 'power', label: 'XT60' },
      { from: 'XT60', to: 'ESC', kind: 'power', label: 'VBAT' },
      { from: 'ESC', to: 'MOTORS', kind: 'motor', label: '3-phase x3' },
      { from: 'FC', to: 'TILT', kind: 'motor', label: 'SERVOx tilt' },
      { from: 'FC', to: 'ASPD', kind: 'i2c', label: 'airspeed' },
      { from: 'FC', to: 'GPS', kind: 'i2c', label: 'GPS' }
    ]
  },

  overview: `<p>A tiltrotor VTOL hovers like a tricopter and cruises like a small aeroplane. The two front motors swing from pointing up to pointing forward on metal-gear servos; the tail motor lifts only. ArduPilot calls the arrangement QuadPlane and flies it as two aircraft at once.</p>
<p>The payoff is endurance: in cruise the wing carries the weight and the props only fight drag, so the current drops to about a third of hover. A pack that hovers 8 minutes cruises half an hour.</p>
<p>The danger is the transition window. Below stall speed the quad system is holding it up; above it, the wing is. Through the middle neither is fully in charge — which is why Q_ASSIST keeps the tail motor blowing until the airspeed sensor says the wing can be trusted. And a reversed tilt servo, the classic build error, flips the craft over its tail the moment transition starts. Test the sweep on the bench.</p>`,

  buildCode: `# QuadPlane setup, ArduPilot params:
param set Q_ENABLE 1
param set Q_FRAME_CLASS 3        # tri
param set Q_TILT_MASK 3          # motors 1+2 tilt
param set Q_TILT_TYPE 1          # continuous tilt
param set Q_ASSIST_SPEED 12      # m/s: quad helps below this
param set Q_TRANSITION_MS 4000
param set ARSPD_TYPE 2           # pitot
param set WPNAV_SPEED 1300       # cm/s cruise
param set RTL_ALT 3000`,

  cliName: 'ArduPilot',
  logName: 'QuadPlane log',

  quiz: [
    {
      q: 'Why does a VTOL cruise 3-4x longer than the same battery in a quad?',
      a: ['Bigger props', 'The wing carries the weight; the motors only fight drag', 'It flies slower'],
      ok: 1
    },
    {
      q: 'A reversed tilt servo means...',
      a: ['It tilts 90 degrees the wrong way: the craft flips over its tail at transition', 'Nothing, the FC compensates', 'Slower cruise'],
      ok: 0
    },
    {
      q: 'Why a pitot tube instead of GPS speed?',
      a: ['GPS is illegal on planes', 'Airspeed is not ground speed: a tailwind can hide a stall', 'The pitot is cheaper'],
      ok: 1
    },
    {
      q: 'Q_ASSIST keeps the tail motor blowing because...',
      a: ['The battery needs load', 'Below stall speed the wing carries nothing: the quad system must hold it up', 'It cools the ESC'],
      ok: 1
    }
  ],

  practice:
    'Hover up, hit T to tilt, and ride the transition into cruise around the coast. Then QRTL: watch it fly home as a plane, tilt back, and land as a quad.',

  modes: {
    qhover: {
      title: 'Quad hover',
      code: 'param set Q_M_THST_HOVER 0.42',
      hint: 'Tricopter hover (altitude hold): tail motor + two tilted-up fronts',
      alt: true
    },
    transition: {
      title: 'Transition (auto)',
      code: 'param set Q_TRANSITION_MS 4000',
      hint: 'Tilt to 90, accelerate through the window, cruise',
      alt: false
    },
    qrtl: {
      title: 'QRTL',
      code: 'param set RTL_ALT 3000',
      hint: 'Fly home as a plane, back-transition, land as a quad',
      alt: false
    }
  },
  mode: 'qhover',

  controls: [
    ['W S', 'throttle (absolute)'],
    ['A D', 'yaw (hover)'],
    ['arrows', 'pitch + roll'],
    ['T', 'transition / back'],
    ['Space', 'arm / disarm'],
    ['R', 'reset to the pad'],
    ['V', 'FPV view']
  ],

  range: {
    title: 'Coast patrol',
    brief: 'Transition, cruise the coastline, top the turbine, QRTL home.',
    field: 55,
    pad: [20, 6],
    ground: '#d3d8c2',
    alt: false,
    keepGates: false,
    camTilt: 12,
    prims: [
      // sea + beach
      { t: 'flat', x: 50, y: 27, w: 12, d: 60, col: '#9ec4cc', label: 'SEA' },
      { t: 'flat', x: 42, y: 27, w: 5, d: 60, col: '#e2d8b8', label: 'BEACH' },
      // harbour cranes + containers
      { t: 'pole', x: 36, y: 10, h: 10, col: '#8a5f2f' },
      { t: 'box', x: 36, y: 10, z: 10, w: 6, d: 0.6, h: 0.6, col: '#8a5f2f' },
      { t: 'box', x: 33, y: 14, w: 2.4, d: 1.2, h: 1.2, col: '#c96a4e' },
      { t: 'box', x: 36, y: 14, w: 2.4, d: 1.2, h: 2.4, col: '#5a82c6' },
      { t: 'box', x: 39, y: 14, w: 2.4, d: 1.2, h: 1.2, col: '#d4af37' },
      // lighthouse
      { t: 'cyl', x: 46, y: 44, r: 1.2, r1: 0.9, h: 12, col: '#ece6d6' },
      { t: 'cyl', x: 46, y: 44, z: 12, r: 1.5, h: 1.2, col: '#ef6a4c' },
      // offshore wind turbine (the tower to top)
      { t: 'cyl', x: 30, y: 42, r: 0.8, h: 28, col: '#e8e3d0' },
      { t: 'box', x: 30, y: 42, z: 28, w: 3, d: 1, h: 1, col: '#e8e3d0' },
      // city towers inland
      { t: 'box', x: 8, y: 40, w: 4, d: 4, h: 14, col: '#c9c2b2' },
      { t: 'box', x: 14, y: 46, w: 3, d: 3, h: 10, col: '#b8b2a4' },
      { t: 'box', x: 4, y: 32, w: 3, d: 3, h: 8, col: '#d3cec0' },
      // rooftop helipad (the land spot)
      { t: 'box', x: 8, y: 40, z: 14, w: 4.4, d: 4.4, h: 0.4, col: '#76a0e2' },
      { t: 'disc', x: 8, y: 40, r: 1.6, col: '#e8e3d0', label: 'H' },
      // trees
      { t: 'tree', x: 16, y: 8, h: 9 },
      { t: 'tree', x: 28, y: 4, h: 7 },
      { t: 'tree', x: 10, y: 18, h: 8 }
    ],
    goals: [
      { x: 36, y: 12, z: 12, r: 3, label: 'OVER THE CRANES' },
      { x: 46, y: 44, z: 15, r: 3, label: 'LIGHTHOUSE' },
      { x: 30, y: 42, z: 31, r: 4, label: 'TURBINE TOP' },
      { x: 14, y: 46, z: 14, r: 3, label: 'CITY CANYON' },
      { x: 8, y: 40, z: 16.5, r: 2.5, label: 'LAND ON THE ROOF' }
    ]
  }
};

void tagPill;
void INK;
