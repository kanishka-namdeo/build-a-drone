/**
 * Fig. 09 — the FPV flying wing: a 900 mm EPP swept wing on INAV, a rear
 * pusher motor, and two elevons.
 *
 * Its own flight model: airspeed along the nose, lift proportional to v²
 * (with a stall), coordinated turns, a hand launch, and belly landings that
 * only work when slow, level and gentle. Thrust needs only be a fraction of
 * weight — the wing carries the weight, the prop fights the drag.
 */

import { Vec3, Tone, INK } from '../engine/core';
import { FR, rad } from '../engine/frames';
import type { Frame } from '../engine/frames';
import { obox, ocyl, odisc, otext, tube } from '../engine/oshapes';
import { CARBON, PCB, SILK, WIRE, TIN } from '../engine/materials';
import { craftAnim } from './anim';
import type { CraftRecord, DrawOpt, DrawAdd, FlightState, PhysCtx } from '../types';

const FOAM: Tone = { l: '#f6f2e8', m: '#ded8c8', d: '#b3ab97' };

/** Elevon bench-check animation window (ms since epoch). */
let elevonT0 = 0;

export const wing9: CraftRecord = {
  key: 'wing9',
  fig: 9,
  name: 'FPV flying wing',
  sub: 'INAV, elevons',
  hint: 'check the elevons, check the CG, then throw it',
  noun: 'wing',
  palette: 'cobalt',
  log: 'inav',
  mat: 300,
  benchH: 110,
  flyScale: 3,
  flyVB: 12000,
  hitR: 0.18,
  ceiling: 120,
  drag: 0.02,
  camZ: 0.6,
  fpvProps: true,
  kThrust: 0.97,
  gPerW: 4,
  minTW: 0.4,
  noSmoke: true,
  design: { batt: '4s2200', motor: '2212-1400', prop: '8x6' },

  batts: {
    '4s2200': { name: '4S 2200 LiPo', cells: 4, mah: 2200, g: 235, price: 34, col: '#2b2a28', lab: '4S 2200' },
    '4s3000': { name: '4S 3000 Li-ion', cells: 4, mah: 3000, g: 270, price: 45, col: '#2f5fa8', lab: '4S 3000' },
    '3s1300': { name: '3S 1300 LiPo', cells: 3, mah: 1300, g: 115, price: 20, col: '#d9a520', lab: '3S 1300' }
  },
  motors: {
    '2212-1400': { name: '2212 1400KV pusher', kv: 1400, g: 55, price: 18 },
    '2810-1100': { name: '2810 1100KV pusher', kv: 1100, g: 80, price: 28 },
    '2306-2400': { name: '2306 2400KV (quad motor)', kv: 2400, g: 33, price: 20 }
  },
  props: {
    '8x6': { name: '8x6 pusher', pf: 1.0, eff: 1.0, g: 12, price: 3 },
    '7x5': { name: '7x5 pusher', pf: 0.86, eff: 1.08, g: 9, price: 3 },
    '9x6': { name: '9x6 pusher', pf: 1.16, eff: 0.92, g: 15, price: 4 }
  },
  fixed: [
    { id: 'FRAME', name: 'EPP wing + pod + hatch', g: 380, price: 55, cat: 'Mechanical' },
    { id: 'ESC', name: '30A ESC + 5V BEC', g: 30, price: 22, cat: 'Electrical' },
    { id: 'FC', name: 'F405 wing FC (INAV)', g: 10, price: 45, cat: 'Electrical' },
    { id: 'GPS', name: 'GPS puck', g: 15, price: 22, cat: 'Electrical' },
    { id: 'CAM', name: 'FPV camera', g: 12, price: 22, cat: 'Electrical' },
    { id: 'VTX', name: 'VTX 25-600 mW', g: 10, price: 25, cat: 'Electrical' },
    { id: 'RX', name: 'ELRS receiver', g: 3, price: 18, cat: 'Electrical' },
    { id: 'SERVO', name: '2x elevon servos', g: 20, price: 16, cat: 'Electrical' },
    { id: 'XT60', name: 'XT60 pigtail', g: 12, price: 4, cat: 'Electrical' },
    { id: 'LINK', name: 'linkages + pushrods', g: 25, price: 8, cat: 'Mechanical' },
    { id: 'WIRES', name: 'wiring', g: 6, price: 3, cat: 'Electrical' }
  ],

  parts: [
    {
      id: 'FRAME',
      name: 'EPP swept wing + centre pod (900 mm)',
      short: 'WING',
      z: 0,
      what: 'Expanded polypropylene foam: it bounces. Sweep plus a touch of up-twist (reflex) makes the wing stable in pitch without a tail.'
    },
    {
      id: 'MOTORS',
      name: 'Rear pusher motor',
      short: 'PUSHER',
      z: 1,
      after: ['FRAME'],
      what: 'A pusher behind the wing keeps the prop out of the camera and out of your launching hand. Its prop is a MIRRORED blade set — pusher props are not just backwards props.'
    },
    {
      id: 'ESC',
      name: '30A ESC + 5V BEC',
      short: 'ESC',
      z: 2,
      after: ['FRAME'],
      what: 'One ESC, and its BEC feeds the servos and FC — wings have no PDB, just one thick pair down the middle.'
    },
    {
      id: 'FC',
      name: 'F405 wing flight controller (INAV)',
      short: 'FLIGHT CTRL',
      z: 3,
      after: ['ESC'],
      polar: ['arrow forward', 'arrow backward'],
      what: 'INAV knows it is a wing: it mixes the two servos into elevons, watches airspeed, and can fly the wing home on GPS.'
    },
    {
      id: 'WIRES',
      name: 'Power + servo wiring',
      short: 'WIRES',
      z: 3,
      after: ['FC', 'ESC'],
      what: 'Thick pair to the ESC, servo leads forward, a Y for the camera and VTX.'
    },
    {
      id: 'XT60',
      name: 'XT60 pigtail',
      short: 'XT60',
      z: 2,
      after: ['ESC'],
      polar: ['stripe to minus', 'stripe to plus'],
      what: 'The battery plugs in under the hatch. The battery IS the ballast: its position sets the CG.'
    },
    {
      id: 'CAM',
      name: 'FPV camera in the nose',
      short: 'CAMERA',
      z: 2,
      after: ['FRAME'],
      what: 'Wings fly fast and level, so the camera looks almost straight ahead — a few degrees up at most.'
    },
    {
      id: 'GPS',
      name: 'GPS puck on a short mast',
      short: 'GPS',
      z: 4,
      after: ['FC'],
      what: 'On top, away from the ESC\'s noise, where the sky is widest. RTH on a wing needs a good fix: it glides a long way while it thinks.'
    },
    {
      id: 'RX',
      name: 'ELRS receiver',
      short: 'RECEIVER',
      z: 4,
      after: ['FC'],
      what: 'Same 2.4 GHz link as the quads. Long-range wings sometimes trade up to 900 MHz.'
    },
    {
      id: 'VTX',
      name: 'VTX + antenna out the top',
      short: 'VTX',
      z: 4,
      after: ['FC'],
      what: 'The antenna stands straight up on a wing: it never banks past 45°, so a vertical whip works.'
    },
    {
      id: 'SERVO',
      name: '2 elevon servos + pushrods',
      short: 'SERVOS',
      z: 5,
      after: ['FC'],
      polar: ['linkages correct', 'one servo reversed'],
      what: 'Two servos in the airflow behind the wing. Each elevon is half elevator, half aileron — hence the name. A reversed servo is the classic first flight of a new wing: into the ground.'
    },
    {
      id: 'BATT',
      name: 'Battery (ballast) under the hatch',
      short: 'BATTERY',
      z: 6,
      after: ['XT60'],
      what: 'The battery sits at the CG. Tail-heavy is unflyable; nose-heavy just flies badly. Move it until the wing balances at ~23% of the chord.'
    },
    {
      id: 'PROPS',
      name: '8x6 pusher prop (mirrored blades)',
      short: 'PROP',
      z: 7,
      after: ['MOTORS'],
      polar: ['pusher (correct)', 'tractor (mirrored)'],
      what: 'A pusher prop is a mirrored blade: mounting a normal prop backwards loses half its thrust and screams.'
    }
  ],

  // a tricopter-style motor map keeps the engine's motor test happy (1 motor)
  mpos: [[0, 0, 'M1', 'CW']] as Array<[number, number, string, 'CW' | 'CCW']>,
  wrongMotor: 0,
  calLabel: 'Calibrate accelerometer',

  /* ---------------------------------------------------------------- */
  /* fixed-wing flight model                                           */
  /* ---------------------------------------------------------------- */

  calc(d) {
    const batt = this.batts[d.batt] ?? Object.values(this.batts)[0];
    const motor = this.motors[d.motor] ?? Object.values(this.motors)[0];
    const prop = this.props[d.prop] ?? Object.values(this.props)[0];
    const V = batt.cells * 3.7;
    const krpm = (motor.kv * V) / 1000;
    const thrust = this.kThrust * prop.pf * krpm * krpm; // grams
    const auw = this.fixed.reduce((s, f) => s + f.g, 0) + motor.g + prop.g + batt.g;
    const tw = thrust / auw;
    const hoverW = auw / (this.gPerW * prop.eff); // cruise watts, roughly
    const cruiseA = hoverW / V;
    const cruiseMin = ((batt.mah / 1000) * 0.85) / cruiseA * 60;
    const maxA = (thrust * 1.6) / V;
    const over = motor.kv * batt.cells > 1750 * 6 * 1.15;
    const weak = tw < 0.4;
    const hoverThr = 0.4;
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
    costE += motor.price + batt.price;
    nE += 2;
    costM += prop.price;
    nM += 1;
    // fixed-wing speed estimates: pitch(in) * rpm -> m/s, stall from wing loading
    const wingArea = 23; // dm²
    const wl = auw / wingArea; // g/dm²
    const vstall = Math.sqrt((wl * 0.095) / 0.055); // ~11 m/s at 27 g/dm²
    const vcruise = Math.max(vstall * 1.3, 13);
    const vtop = (prop.name.includes('8x6') ? 8 : prop.name.includes('7x5') ? 7 : 9) * 0.0254 * krpm * 0.85 * 0.6;
    return {
      V,
      krpm,
      thrust,
      auw,
      tw,
      hoverW,
      hoverA: cruiseA,
      hoverMin: cruiseMin,
      flyMin: cruiseMin,
      maxA,
      over,
      weak,
      hoverThr,
      cost: { Electrical: costE, Mechanical: costM, Total: costE + costM },
      nElect: nE,
      nMech: nM,
      n: 1,
      cells: batt.cells,
      mah: batt.mah,
      battName: batt.name,
      motorName: motor.name,
      propName: prop.name,
      vstall,
      vcruise,
      vtop: Math.min(38, vtop)
    };
  },

  calcRows(c) {
    const vstall = (c.vstall as number) ?? 11;
    const vcruise = (c.vcruise as number) ?? 13;
    const vtop = (c.vtop as number) ?? 30;
    return [
      { label: 'All-up weight', value: `${Math.round(c.auw)} g` },
      { label: 'Thrust : weight', value: `${c.tw.toFixed(2)} : 1` },
      { label: 'Stall speed', value: `${(vstall * 3.6).toFixed(0)} km/h` },
      { label: 'Cruise speed', value: `${(vcruise * 3.6).toFixed(0)} km/h` },
      { label: 'Top speed', value: `${(vtop * 3.6).toFixed(0)} km/h` },
      { label: 'Cruise time', value: `${c.hoverMin.toFixed(0)} min` }
    ];
  },

  warnings(d) {
    if (d.batt === '4s3000') {
      return ['The 3000 Li-ion sits aft of the CG mark: expect a tail-heavy moment until you add nose weight.'];
    }
    return [];
  },

  physics(fl: FlightState, dt: number, ctx: PhysCtx): void {
    const G = 9.81;
    const s = ctx.stick;
    fl.step++;
    fl.t += dt;

    if (fl.phase === undefined) {
      fl.phase = 0; // 0 grounded, 1 flying, 2 landed
      fl.airborne = false;
    }
    const c = fl.c;
    const vstall = (c.vstall as number) ?? 11;
    const mass = c.auw / 1000;
    const thrustMax = (c.thrust / 1000) * G; // N

    // attitude: elevator + aileron authority scales with airspeed
    const u = Math.max(0, airspeed(fl));
    const auth = Math.min(1, u / (vstall * 1.2));
    const bankLimit = (fl.mode as string) === 'angle' ? rad(38) : rad(75);
    const rollRate = rad(150) * auth;
    const pitchRate = rad(80) * auth;
    fl.roll += s.roll * rollRate * dt;
    fl.pitch += -s.pitch * pitchRate * dt; // stick up (ArrowUp) = nose up
    if ((fl.mode as string) === 'angle') {
      // self-levelling in bank only (wings level, pitch untouched)
      fl.roll += (0 - fl.roll) * Math.min(1, dt * 2.5);
    }
    fl.roll = Math.max(-bankLimit, Math.min(bankLimit, fl.roll));
    fl.pitch = Math.max(rad(-35), Math.min(rad(30), fl.pitch));

    // coordinated turn: yaw rate from bank + airspeed
    const turn = (G * Math.tan(fl.roll)) / Math.max(6, u);
    fl.yaw += turn * dt;

    // hand launch: armed + full throttle on the ground = the throw
    if (!fl.airborne && fl.armed && s.thrAbs > 0.55) {
      fl.airborne = true;
      fl.pos[2] = 1.6;
      const fx = Math.cos(fl.yaw);
      const fy = Math.sin(fl.yaw);
      fl.vel = [fx * vstall * 1.5, fy * vstall * 1.5, 0.5];
      ctx.say('Launched! Nose up, let it build speed');
    }

    if (fl.airborne && !fl.crashed) {
      // body axes
      const cy = Math.cos(fl.yaw);
      const sy = Math.sin(fl.yaw);
      const cp = Math.cos(fl.pitch);
      const sp = Math.sin(fl.pitch);
      const cr = Math.cos(fl.roll);
      const sr = Math.sin(fl.roll);
      const fwd: Vec3 = [cy * cp, sy * cp, sp];
      // body up (roll about fwd): matches the engine convention (+roll banks left)
      const up: Vec3 = [cy * sp * cr - sy * sr, sy * sp * cr + cy * sr, cp * cr];

      // thrust + drag: thrust along the nose, drag opposing the velocity
      const throttle = fl.armed ? s.thrAbs : 0;
      const T = thrustMax * throttle;
      const vTotal = Math.hypot(fl.vel[0], fl.vel[1], fl.vel[2]);
      const kDrag = 0.022;
      const D = kDrag * vTotal * vTotal + 0.25;

      // lift: trimmed for level flight at ~1.25x stall speed
      const vTrim = vstall * 1.45;
      const kl = (mass * G) / (vTrim * vTrim);
      let stalled = false;
      let L: number;
      if (u < vstall) {
        stalled = true;
        L = kl * Math.max(0.12, (u / vstall) ** 2) * 0.5 * u * u; // lift collapses
        fl.pitch -= rad(14) * dt; // nose drops
        fl.roll += Math.sin(fl.t * 3.1) * rad(14) * dt; // wing rock
      } else {
        L = kl * u * u;
      }

      // pitch stability: the nose weathervanes toward the flight path
      // (static margin: a dive recovers, a climb settles)
      const pathAngle = Math.atan2(fl.vel[2], Math.hypot(fl.vel[0], fl.vel[1]));
      if (u >= vstall) {
        fl.pitch += (pathAngle - fl.pitch) * Math.min(1, dt * 1.6);
      }

      // accelerations: gravity, thrust along the nose, drag against the
      // velocity vector, lift perpendicular to the velocity (aerodynamic:
      // lift never does work, so the model cannot create energy)
      const a: Vec3 = [0, 0, -G];
      let lx = up[0];
      let ly = up[1];
      let lz = up[2];
      if (vTotal > 0.01) {
        const d = (up[0] * fl.vel[0] + up[1] * fl.vel[1] + up[2] * fl.vel[2]) / vTotal;
        lx -= (d * fl.vel[0]) / vTotal;
        ly -= (d * fl.vel[1]) / vTotal;
        lz -= (d * fl.vel[2]) / vTotal;
        const ll = Math.hypot(lx, ly, lz) || 1;
        lx /= ll;
        ly /= ll;
        lz /= ll;
      }
      for (let i = 0; i < 3; i++) {
        const liftDir: Vec3 = [lx, ly, lz];
        a[i] += fwd[i] * (T / mass) + liftDir[i] * (L / mass);
        if (vTotal > 0.01) a[i] -= (fl.vel[i] / vTotal) * (D / mass);
      }
      for (let i = 0; i < 3; i++) {
        fl.vel[i] += a[i] * dt;
      }
      fl.pos[0] += fl.vel[0] * dt;
      fl.pos[1] += fl.vel[1] * dt;
      fl.pos[2] += fl.vel[2] * dt;

      // battery: amps track throttle
      battery(fl, dt, throttle);

      // stall warning (fresh airspeed: the launch step itself sets velocity)
      const uNow = Math.max(0, airspeed(fl));
      if (uNow < vstall && !fl.stallWarned) {
        fl.stallWarned = true;
        ctx.say('STALL: nose down, let the speed build');
      } else if (uNow > vstall * 1.25) {
        fl.stallWarned = false;
      }

      // belly landing / crash
      if (fl.pos[2] <= 0) {
        const gentle =
          vTotal < vstall * 1.15 && Math.abs(fl.roll) < rad(22) && fl.pitch > rad(-18) && fl.vel[2] > -2.5;
        if (gentle) {
          fl.pos[2] = 0;
          fl.vel = [0, 0, 0];
          fl.armed = false;
          fl.airborne = false;
          ctx.say('Belly landed. That is how a wing lands: slow, level, gentle');
        } else {
          ctx.crash(fl, 'the ground');
        }
      }

      // out of field
      const F = 60;
      if (fl.pos[0] < -3 || fl.pos[0] > F + 3 || fl.pos[1] < -3 || fl.pos[1] > F + 3) {
        if (!fl.outWarned) {
          fl.outWarned = true;
          ctx.say('Way out of the field: RTH or turn back');
        }
      }

      // RTH autopilot
      if ((fl.mode as string) === 'rth' && fl.armed) {
        const HOME = { x: 20, y: 4 };
        const dx = HOME.x - fl.pos[0];
        const dy = HOME.y - fl.pos[1];
        const bearing = Math.atan2(dy, dx);
        let err = bearing - fl.yaw;
        while (err > Math.PI) err -= 2 * Math.PI;
        while (err < -Math.PI) err += 2 * Math.PI;
        // hold ~15 m, bank toward home, cruise throttle
        if (fl.pos[2] < 15) {
          s.pitch = 0.25;
          s.thrAbs = Math.max(s.thrAbs, 0.55);
        } else {
          s.pitch = 0;
          s.thrAbs = 0.42;
        }
        s.roll = Math.max(-0.5, Math.min(0.5, err * 1.4));
        if (Math.hypot(dx, dy) < 25 && fl.pos[2] < 15) {
          // circle the pad downwind
          s.roll = 0.35;
          s.pitch = -0.05;
        }
      }
    }

    // camera + spin
    fl.cam[0] += (fl.pos[0] - fl.cam[0]) * 0.14;
    fl.cam[1] += (fl.pos[1] - fl.cam[1]) * 0.14;
    fl.cam[2] += (fl.pos[2] * 0.7 - fl.cam[2]) * 0.14;
    fl.spin[0] += (fl.armed ? 400 * (0.2 + s.thrAbs) : 0) * dt;
    if (fl.crashed) {
      fl.tumble += 8 * dt;
      fl.roll += 6 * dt;
    }
  },

  flyStats(fl) {
    const u = Math.max(0, airspeed(fl));
    return [
      { label: 'Airspeed', value: `${(u * 3.6).toFixed(0)} km/h`, small: true },
      { label: 'L/D', value: `~${(u / 9.81 / 0.16).toFixed(0)}`.replace('~0', '~6'), small: true }
    ];
  },

  extraButtons: [
    {
      label: 'Check elevons',
      onClick(): void {
        elevonT0 = performance.now();
        craftAnim(5200);
        const reversed = ((window as unknown as { __st?: { placed?: { SERVO?: { orient?: number } } } }).__st?.placed?.SERVO?.orient ?? 0) === 1;
        setTimeout(() => {
          const toast = document.getElementById('toast');
          if (!toast) return;
          toast.textContent = reversed
            ? 'ONE ELEVON REVERSED — swap that servo\'s leads before you launch'
            : 'Elevons correct: stick back = both up, stick right = differential';
          toast.classList.add('show');
        }, 4600);
      }
    },
    {
      label: 'CG check',
      onClick(): void {
        craftAnim(1600);
        // verdicts per battery: the 3S 1300 sits aft = tail-heavy
        // (the selected battery decides; read it from the mounted state)
        const st = (window as unknown as { __st?: { design?: { batt?: string } } }).__st;
        const batt = st?.design?.batt ?? '4s2200';
        if (batt === '3s1300') {
          setTimeout(() => {
            const toast = document.getElementById('toast');
            if (toast) {
              toast.textContent = 'Tail-heavy: the 3S 1300 sits behind the mark. The wing would stall at every launch.';
              toast.classList.add('show');
            }
          }, 700);
        } else if (batt === '4s3000') {
          setTimeout(() => {
            const toast = document.getElementById('toast');
            if (toast) {
              toast.textContent = 'Nose-heavy: safe but sluggish — add a little aft position until it balances at 23% chord.';
              toast.classList.add('show');
            }
          }, 700);
        } else {
          setTimeout(() => {
            const toast = document.getElementById('toast');
            if (toast) {
              toast.textContent = 'Balanced at 23% chord: launch it.';
              toast.classList.add('show');
            }
          }, 700);
        }
      }
    }
  ],

  /* ---------------------------------------------------------------- */

  draw(f: Frame, add: DrawAdd, opt: DrawOpt): void {
    const m = opt.m;
    const has = opt.has;
    const U = opt.U;

    // elevon deflection from the bench check animation
    const tSince = elevonT0 ? (performance.now() - elevonT0) / 1000 : -1;
    let elev = 0;
    let ail = 0;
    if (tSince >= 0 && tSince < 5.2) {
      if (tSince < 1.2) elev = Math.sin(tSince * 3) * 18; // stick back: both up
      else if (tSince < 2.4) ail = Math.sin((tSince - 1.2) * 3) * 14; // stick right: differential
      else if (tSince < 3.6) {
        elev = Math.sin((tSince - 2.4) * 3) * 18;
        ail = Math.sin((tSince - 2.4) * 3) * 14;
      } else if (tSince < 4.4 && opt.orient('SERVO') === 1) {
        ail = -14; // reversed servo: detected!
      }
    }
    const reversed = opt.orient('SERVO') === 1 && tSince >= 4.4 && tSince < 5.2;

    if (has('FRAME')) {
      const F = U('FRAME');
      // swept foam wing: two panels + centre section
      for (const side of [-1, 1]) {
        const P = FR.Rz(FR.T(F, 0, side * 14, 6), side * rad(24));
        add([side * 40, side * 55, 8], obox(P, -42, 42, 0, 200, -8, 8, FOAM, 0.9).svg, 'FRAME');
        // winglet
        const W = FR.Rz(FR.T(F, side * 84, side * 96, 10), side * rad(24));
        add([side * 84, side * 96, 16], obox(W, -12, 12, 0, 26, -2, 22, m, 0.8).svg, 'FRAME');
      }
      // centre pod
      add([0, 0, 6], obox(F, -34, 30, -13, 13, -6, 16, FOAM, 0.9).svg, 'FRAME');
      add([0, 0, 18], obox(F, -24, 26, -10, 10, 16, 20, m, 0.8).svg, 'FRAME'); // hatch
    }

    if (has('MOTORS')) {
      const F = U('MOTORS');
      const M = FR.T(F, -44, 0, 8);
      let svg = obox(F, -52, -40, -6, 6, 2, 14, CARBON, 0.8).svg; // mount
      svg += ocyl(FR.Rz(M, rad(90)), 7, -8, 8, { l: '#55504a', m: '#3d3935', d: '#272421' }, 0.9, 12).svg;
      add([-46, 0, 8], svg, 'MOTORS');
    }

    if (has('ESC')) {
      const F = U('ESC');
      add([0, 0, 10], obox(F, -8, 8, -6, 6, 8, 12, PCB, 0.7).svg, 'ESC');
    }

    if (has('FC')) {
      const F = U('FC');
      let svg = obox(F, -10, 10, -10, 10, 8, 11, PCB, 0.8).svg;
      const flip = opt.orient('FC') ? -1 : 1;
      svg += otext(F, 6 * flip, 0, 12, '▲', 8, SILK);
      if (opt.power) svg += odisc(F, 2, 11.4, '#3e86d9', 0, 10, -6, 6);
      add([4, 0, 10], svg, 'FC');
    }

    if (has('WIRES')) {
      const F = U('WIRES');
      let svg = tube([FR.pt(F, [-10, 0, 10]), FR.pt(F, [-42, 0, 10])], 1.1, WIRE.red);
      svg += tube([FR.pt(F, [-10, 0, 9]), FR.pt(F, [-42, 0, 9])], 1.1, WIRE.blk);
      svg += tube([FR.pt(F, [10, 4, 10]), FR.pt(F, [30, 12, 8])], 0.7, WIRE.wht);
      svg += tube([FR.pt(F, [10, -4, 10]), FR.pt(F, [30, -12, 8])], 0.7, WIRE.wht);
      add([-20, 0, 10], svg, 'WIRES');
    }

    if (has('XT60')) {
      const F = U('XT60');
      let svg = tube([FR.pt(F, [8, 0, 8]), FR.pt(F, [20, 0, 6])], 1.3, WIRE.red);
      svg += obox(F, 20, 30, -4, 4, 4, 12, { l: '#f2c230', m: '#d9ad25', d: '#8f6f10' }, 0.8).svg;
      add([25, 0, 8], svg, 'XT60');
    }

    if (has('CAM')) {
      const F = U('CAM');
      let svg = obox(F, 26, 36, -7, 7, 2, 12, m, 0.8).svg;
      const lensF = FR.Ry(F, rad(-6));
      svg += ocyl(lensF, 4, 33, 39, CARBON, 0.7, 12, 0, 7).svg;
      add([31, 0, 8], svg, 'CAM');
    }

    if (has('GPS')) {
      const F = U('GPS');
      let svg = ocyl(F, 7, 12, 18, CARBON, 0.8, 12).svg;
      svg += ocyl(FR.up(F, 2), 8, 0, 4, { l: '#ef6a4c', m: '#cf5038', d: '#4a2219' }, 0.7, 12).svg;
      add([10, 0, 20], svg, 'GPS');
    }

    if (has('RX')) {
      const F = U('RX');
      let svg = obox(F, -6, 6, -5, 5, 8, 10, PCB, 0.6).svg;
      svg += tube([FR.pt(F, [0, 0, 10]), FR.pt(F, [-8, 10, 20])], 0.5, WIRE.wht);
      add([0, 8, 12], svg, 'RX');
    }

    if (has('VTX')) {
      const F = U('VTX');
      let svg = obox(F, -6, 6, -6, 6, 8, 11, PCB, 0.7).svg;
      svg += tube([FR.pt(F, [0, 0, 11]), FR.pt(F, [-20, 0, 26])], 1, WIRE.wht);
      add([-6, 0, 12], svg, 'VTX');
    }

    if (has('SERVO')) {
      const F = U('SERVO');
      for (const side of [-1, 1]) {
        const S = FR.T(F, side * 18, side * 26, 4);
        let svg = obox(S, -7, 7, -12, 12, -8, 8, { l: '#55504a', m: '#3d3935', d: '#272421' }, 0.7).svg;
        svg += odisc(FR.up(S, 8.5), 5, 0, TIN.l, 0.6, 10);
        // pushrod to the elevon
        svg += tube([FR.pt(S, [0, side * 12, 4]), FR.pt(S, [side * 16, side * 46, 2])], 0.6, TIN);
        add([side * 18, side * 26, 6], svg, 'SERVO');
      }
    }

    if (has('BATT')) {
      const F = U('BATT');
      const batt = opt.design.batt;
      const col = batt === '4s3000' ? '#2f5fa8' : batt === '3s1300' ? '#d9a520' : '#2b2a28';
      add([8, 0, 6], obox(F, -16, 34, -11, 11, -2, 12, { l: col, m: '#413f3d', d: '#26241f' } as Tone, 0.9).svg, 'BATT');
    }

    if (has('PROPS') && !opt.broken) {
      const F = U('PROPS');
      const P = FR.Rz(FR.T(F, -62, 0, 8), rad(90));
      const rate = opt.rpm[0] || 0;
      if (rate > 0.12) {
        add([-62, 0, 8], `<circle cx="0" cy="0" r="52" fill="#fff" opacity="${(0.16 + 0.2 * rate).toFixed(2)}" transform="translate(${P.o[0].toFixed(1)} ${P.o[1].toFixed(1)}) scale(0.06)"/>`, 'PROPS');
      } else {
        let svg = '';
        const spin = opt.spin[0] || 0;
        for (let b = 0; b < 2; b++) {
          const a = spin + (b * Math.PI) / 2;
          const B = FR.Rz(P, a);
          // mirrored pusher blade: opposite pitch
          const bladeF = FR.Rx(B, opt.orient('PROPS') ? rad(10) : rad(-10));
          svg += obox(bladeF, 6, 52, -5, 5, -0.8, 0.8, CARBON, 0.7).svg;
        }
        add([-62, 0, 8], svg, 'PROPS');
      }
    }

    // elevons: trailing-edge surfaces that deflect with the check animation
    if (has('SERVO')) {
      const F = f;
      for (const side of [-1, 1]) {
        const base = FR.Rz(FR.T(F, side * 28, side * 46, 6), side * rad(24));
        const defl = rad(elev + (side === 1 ? -ail : ail)); // differential
        const E = FR.Rx(base, defl);
        add([side * 30, side * 52, 6], obox(E, -3, 3, -16, 16, -1.5, 1.5, m, 0.7).svg, 'SERVO');
      }
      if (reversed) {
        add([0, 0, 40], `<text x="0" y="0" font-family="ui-monospace,Menlo,monospace" font-size="11" font-weight="800" fill="#d6492c" text-anchor="middle" transform="translate(${FR.pt(f, [0, -60, 30]).map((v) => v.toFixed(0)).join(' ')})">ONE ELEVON REVERSED — swap the servo leads</text>`, 'SERVO');
      }
    }
  },

  hull(f: Frame): Vec3[] {
    const pts: Vec3[] = [];
    for (const side of [-1, 1]) {
      pts.push(FR.pt(f, [side * 40, side * 100, 0]));
      pts.push(FR.pt(f, [side * 84, side * 96, 30]));
    }
    pts.push(FR.pt(f, [-62, 0, 8]));
    pts.push(FR.pt(f, [36, 0, 14]));
    return pts;
  },

  tags: [
    ['FC', [4, 0, 14], 46, -38],
    ['SERVO', [18, 26, 8], 40, -24],
    ['MOTORS', [-46, 0, 14], -42, -28],
    ['GPS', [10, 0, 22], 26, -34],
    ['BATT', [8, 0, 12], -20, 34]
  ],

  wiring: {
    nodes(d, c) {
      return {
        BATT: [20, 238, 'BATTERY', (c.battName as string) || '4S 2200', '#e2483d'],
        XT60: [190, 238, 'XT60', 'pigtail', '#e2483d'],
        ESC: [360, 238, 'ESC + BEC', '30A, 5V out', '#e2483d'],
        FC: [360, 70, 'FLIGHT CTRL', 'F405, INAV', '#3e86d9'],
        SERVO: [140, 70, 'SERVOS x2', 'elevons', '#f08a2b'],
        CAM: [600, 14, 'CAMERA', 'in the nose', '#43a35a'],
        VTX: [600, 116, 'VTX', '25-600 mW', '#8c4bd1'],
        GPS: [600, 238, 'GPS', 'on the mast', '#8c4bd1']
      };
    },
    links: [
      { from: 'BATT', to: 'XT60', kind: 'power', label: 'XT60' },
      { from: 'XT60', to: 'ESC', kind: 'power', label: 'VBAT' },
      { from: 'ESC', to: 'FC', kind: 'power', label: '5V BEC' },
      { from: 'FC', to: 'SERVO', kind: 'motor', label: 'elevon mix' },
      { from: 'FC', to: 'CAM', kind: 'video', label: 'camera' },
      { from: 'FC', to: 'VTX', kind: 'data', label: 'SmartAudio' },
      { from: 'FC', to: 'GPS', kind: 'i2c', label: 'GPS + RTH' }
    ]
  },

  overview: `<p>A flying wing is what you get when you delete everything that is not wing: no tail, no fuselage to speak of, two control surfaces doing four jobs. Sweep and a little reflex make it stable; a pusher motor leaves the nose free for the camera.</p>
<p>The physics flips from a quad: thrust only has to beat drag, not weight — half the wing's weight in thrust is plenty. The wing itself carries the load, and it flies on energy, not on constant power. That is why a 900 mm foam wing crosses valleys that eat 5-inch quads.</p>
<p>Three things ruin first flights: an elevon plugged backwards (it steers into the ground), a tail-heavy battery (it stalls at every launch), and a tractor prop where a mirrored pusher belongs. Check all three on the bench — the buttons are right there.</p>`,

  buildCode: `# wing setup, in the INAV CLI:
mixer FLYING_WING          # elevon mixing
mmix reset
smix reset
smix 0 3 5  1000 0 -1 100 0   # elevon L: aileron
smix 1 4 5 -1000 0 -1 100 0   # elevon R
smix 2 3 6  1000 0  1 100 0   # both: elevator
smix 3 4 6  1000 0  1 100 0
set align_board_yaw = 0
set small_angle = 180      # a wing launches at any attitude
set nav_rth_altitude = 1500
save`,

  cliName: 'INAV',
  logName: 'INAV log',

  quiz: [
    {
      q: 'Why do the elevons exist?',
      a: ['Each one is half elevator, half aileron — the wing has no other surfaces', 'They slow the wing down', 'They hold the hatch on'],
      ok: 0
    },
    {
      q: 'Thrust only needs to be half the wing\'s weight because...',
      a: ['The motor is small', 'The wing carries the weight; the prop only fights drag', 'INAV helps push'],
      ok: 1
    },
    {
      q: 'A tail-heavy wing...',
      a: ['Flies fine, just slower', 'Is unflyable: it stalls at every launch', 'Lands better'],
      ok: 1
    },
    {
      q: 'The wing stalls. You...',
      a: ['Pull up harder', 'Push the nose down and let the speed build', 'Cut the throttle and wait'],
      ok: 1
    }
  ],

  practice:
    'Hand-launch, climb to altitude, and land on the belly: slow, level, gentle. Then try the pylon course — three laps without stalling.',

  modes: {
    angle: {
      title: 'Angle (bank limit)',
      code: 'set nav_bank_mode = ALTITUDE',
      hint: 'Wings-level helper: bank limited, self-levelling',
      alt: false
    },
    manual: {
      title: 'Manual',
      code: 'set nav_extra_arming_safety = OFF',
      hint: 'Raw elevons: you are the stability',
      alt: false
    },
    rth: {
      title: 'RTH',
      code: 'set nav_rth_altitude = 1500',
      hint: 'Climb to 15 m and come home on GPS',
      alt: false
    }
  },
  mode: 'angle',

  controls: [
    ['W S', 'throttle (absolute)'],
    ['A D', 'none (turn with the roll stick)'],
    ['arrows', 'elevator + aileron'],
    ['Space', 'arm / disarm'],
    ['R', 'reset to the pad'],
    ['V', 'FPV view']
  ],

  range: {
    title: 'The airfield',
    brief: 'Hand-launch, climb, pylon race, belly land on the strip.',
    field: 60,
    pad: [20, 4],
    ground: '#d4dcc2',
    alt: false,
    keepGates: false,
    camTilt: 6,
    prims: [
      // runway
      { t: 'flat', x: 20, y: 10, w: 4, d: 26, col: '#c9c4b4', label: 'RUNWAY' },
      { t: 'flat', x: 20, y: 6, w: 2, d: 0.8, col: '#e8e3d0', ink: true },
      { t: 'flat', x: 20, y: 12, w: 2, d: 0.8, col: '#e8e3d0', ink: true },
      // pilot box + hangar
      { t: 'flat', x: 26, y: 4, w: 3, d: 3, col: '#c2bcae', label: 'PILOT' },
      { t: 'box', x: 30, y: 5, w: 6, d: 4, h: 3, col: '#b8b2a4' },
      // windsock
      { t: 'pole', x: 14, y: 8, h: 4, col: '#ef6a4c' },
      // car park
      { t: 'flat', x: 33, y: 10, w: 4, d: 5, col: '#c9c4b4', label: 'PARK' },
      { t: 'box', x: 32, y: 9, w: 1.6, d: 0.9, h: 0.7, col: '#76a0e2' },
      { t: 'box', x: 34, y: 11, w: 1.6, d: 0.9, h: 0.7, col: '#ef6a4c' },
      // pylons for the course
      { t: 'pole', x: 20, y: 24, h: 6, col: '#ef6a4c' },
      { t: 'pole', x: 34, y: 34, h: 6, col: '#ef6a4c' },
      { t: 'pole', x: 8, y: 36, h: 6, col: '#ef6a4c' },
      { t: 'pole', x: 20, y: 44, h: 6, col: '#ef6a4c' },
      // trees along the edge
      { t: 'tree', x: 50, y: 20, h: 10 },
      { t: 'tree', x: 52, y: 34, h: 12 },
      { t: 'tree', x: 46, y: 48, h: 9 },
      { t: 'tree', x: 6, y: 50, h: 11 },
      { t: 'tree', x: 30, y: 54, h: 10 }
    ],
    goals: [
      { x: 20, y: 24, z: 8, r: 4, label: 'PYLON 1' },
      { x: 34, y: 34, z: 8, r: 4, label: 'PYLON 2' },
      { x: 8, y: 36, z: 8, r: 4, label: 'PYLON 3' },
      { x: 20, y: 44, z: 8, r: 4, label: 'PYLON 4' },
      { x: 20, y: 6, z: 1.5, r: 3, label: 'LAND ON THE STRIP' }
    ]
  }
};

/** Airspeed: velocity projected along the nose. */
function airspeed(fl: FlightState): number {
  const cy = Math.cos(fl.yaw);
  const sy = Math.sin(fl.yaw);
  const cp = Math.cos(fl.pitch);
  const sp = Math.sin(fl.pitch);
  const fwd: Vec3 = [cy * cp, sy * cp, sp];
  return fl.vel[0] * fwd[0] + fl.vel[1] * fwd[1] + fl.vel[2] * fwd[2];
}

/** Simple battery drain for the wing (amps track throttle). */
function battery(fl: FlightState, dt: number, throttle: number): void {
  if (!fl.armed || fl.crashed) return;
  const c = fl.c;
  const mah = (c.mah as number) ?? 2200;
  const cells = (c.cells as number) ?? 4;
  const amps = (c.hoverA as number) * (0.35 + throttle * 0.9) + 0.3;
  fl.used += (amps * dt * 1000) / 3600;
  const soc = Math.max(0.01, 1 - fl.used / mah);
  fl.volt = cells * (3.3 + 0.9 * Math.pow(soc, 0.7)) - amps * 0.01;
}
