/**
 * Drone Lab — multirotor flight physics + battery model.
 *
 * Direct-Euler attitude model with rate / angle / altitude-hold modes, a
 * spooled throttle, quadratic-ish drag, a soft geofence ceiling, build-fault
 * failure modes (flips, desync), a LiPo drain + sag model, and ground
 * contact / crash detection. Substeps of <= 10 ms keep it stable.
 */

import type { FlightState, CalcOut, CraftRecord } from '../types';
import { collideAt, type World } from './world';
import { AudioSys } from '../engine/audio';

export const G = 9.81;
export const ACRO_RATE = 540; // deg/s max roll/pitch rate
export const YAW_RATE = 200; // deg/s
export const ANGLE_LIMIT = 38; // deg self-level tilt limit
export const LEVEL_K = 9; // self-level first-order gain
export const SPOOL_K = 18; // throttle spool gain
export const STICK_K = 10; // keyboard stick smoothing

export interface StickInput {
  thr: number; // -1..1 (alt-hold climb rate) or 0..1 mapped outside
  thrAbs: number; // absolute throttle 0..1 (acro/angle)
  yaw: number;
  pitch: number;
  roll: number;
}

export interface PhysHooks {
  craft: CraftRecord;
  world: World;
  say(msg: string, dur?: number): void;
  onCrash(why: string): void;
  onLap(t: number): void;
  onRun(t: number): void;
  /** Fault inputs from the bench state. */
  fcReversed(): boolean;
  propsSwapped(): boolean;
  motorChecked(): boolean;
  accOk(): boolean;
  wind(): boolean;
}

export function newFlight(c: CalcOut, pad: [number, number], nMotors: number, cells: number): FlightState {
  return {
    pos: [pad[0], pad[1], 0],
    vel: [0, 0, 0],
    roll: 0,
    pitch: 0,
    yaw: 0,
    tumble: 0,
    thr: 0,
    thrEff: 0,
    armed: false,
    crashed: false,
    t: 0,
    volt: cells * 4.2,
    used: 0,
    heat: 0,
    spin: new Array(nMotors).fill(0),
    cam: [pad[0], pad[1], 0],
    gate: 0,
    goal: 0,
    lapStart: -1,
    runStart: -1,
    msg: '',
    msgT: 0,
    desync: false,
    lowWarned: false,
    outWarned: false,
    prevD: 0,
    c,
    step: 0
  };
}

/** One <= 10 ms physics substep for a multirotor. */
export function multirotorStep(
  fl: FlightState,
  dt: number,
  stick: StickInput,
  mode: { alt?: boolean; acro?: boolean },
  hooks: PhysHooks
): void {
  const c = fl.c as CalcOut & { n?: number; kThrust?: number; kv?: number; cells?: number };
  const craft = hooks.craft;
  const n = (c.n as number) ?? craft.mpos.length;
  const drag = craft.drag ?? 0.045;
  const ceiling = craft.ceiling ?? 12;
  const hitR = craft.hitR ?? 0.14;

  fl.step++;
  fl.t += dt;

  const wind = hooks.wind() ? windAt(fl.t) : [0, 0, 0];

  /* ---- attitude ---- */
  if (fl.pos[2] <= 0.02 && fl.thrEff < 0.3 && !fl.crashed) {
    fl.roll *= 0.8;
    fl.pitch *= 0.8;
  }
  const rad = (d: number): number => (d * Math.PI) / 180;

  if (!fl.crashed) {
    if (mode.acro) {
      fl.roll += stick.roll * rad(ACRO_RATE) * dt;
      fl.pitch += stick.pitch * rad(ACRO_RATE) * dt;
    } else {
      const k = Math.min(1, dt * LEVEL_K);
      fl.roll += (stick.roll * rad(ANGLE_LIMIT) - fl.roll) * k;
      fl.pitch += (stick.pitch * rad(ANGLE_LIMIT) - fl.pitch) * k;
      if (!hooks.accOk()) {
        // uncalibrated accelerometer: the level reference is tilted
        fl.roll += rad(6) * dt * 3;
      }
    }
    fl.yaw += -stick.yaw * rad(YAW_RATE) * dt;
  }

  /* ---- build-fault flips ---- */
  const flip =
    (hooks.fcReversed() || hooks.propsSwapped() || !hooks.motorChecked()) && fl.armed && fl.t > 0.25 && fl.thrEff > 0.05;
  if (flip && !fl.crashed) {
    const sign = hooks.fcReversed() ? 1 : -1;
    fl.roll += rad(900) * dt * sign;
    fl.pitch += rad(500) * dt;
    if (!fl.flipWhy) {
      fl.flipWhy = hooks.fcReversed()
        ? 'Flipped on take-off: the flight controller arrow points backwards — it corrects the wrong way'
        : hooks.propsSwapped()
          ? 'Flipped on take-off: two props are swapped — the motors push the wrong way'
          : 'Flipped on take-off: motor directions were never checked — the ESC spins one backwards';
      hooks.say(fl.flipWhy);
      hooks.onCrash('flipped');
      fl.crashed = true;
      fl.armed = false;
    }
  }

  /* ---- throttle ---- */
  let thr = 0;
  if (fl.armed && !fl.crashed) {
    if (mode.alt) {
      const target = stick.thr * 2.2; // m/s climb rate
      const tilt = Math.cos(fl.roll) * Math.cos(fl.pitch);
      const thrustAcc = (n * c.thrust) / 1000 / (c.auw / 1000); // g / g = accel in g at full throttle
      const need = (1 + ((target - fl.vel[2]) * 3) / G) / Math.max(0.4, tilt) / Math.max(0.05, thrustAcc);
      thr = Math.min(1, Math.sqrt(Math.max(0, need)));
      if (fl.pos[2] <= 0 && stick.thr <= 0) thr = 0;
    } else {
      thr = Math.min(1, Math.max(0, stick.thrAbs));
    }
  }
  fl.thr = thr;
  fl.thrEff += (thr * thr - fl.thrEff) * Math.min(1, dt * SPOOL_K);
  if (!fl.armed || fl.crashed) fl.thrEff = Math.max(0, fl.thrEff - 3 * dt);

  /* ---- over-KV heat ---- */
  if (c.over && fl.armed && !fl.crashed) {
    fl.heat += dt * fl.thrEff * 1.6;
    if (fl.heat > 9 && !fl.desync) {
      fl.desync = true;
      AudioSys.sfx('pop');
      hooks.say(`Desync! ${(c.kv as number)}KV on ${(c.cells as number)}S overheats: the ESC lost a motor`);
    }
  }
  if (fl.desync) {
    fl.thrEff *= 0.985;
    fl.roll += rad(120) * dt;
  }

  /* ---- forces ---- */
  const a: [number, number, number] = [0, 0, -G];
  if (!fl.crashed) {
    // body -> world: Rz(yaw) * Ry(pitch) * Rx(-roll); +roll banks toward +y (left)
    const cy = Math.cos(fl.yaw);
    const sy = Math.sin(fl.yaw);
    const cp = Math.cos(fl.pitch);
    const sp = Math.sin(fl.pitch);
    const cr = Math.cos(fl.roll);
    const sr = Math.sin(fl.roll);
    const ux = cy * sp * cr - sy * sr;
    const uy = sy * sp * cr + cy * sr;
    const uz = cp * cr;
    // full-throttle thrust accel = n * thrust_g / auw (in g), along body up
    let Tn = fl.thrEff * ((n * c.thrust) / c.auw) * G; // m/s^2
    // soft ceiling geofence
    if (fl.pos[2] > ceiling - 3) {
      Tn *= Math.max(0, 1 - (fl.pos[2] - (ceiling - 3)) / 3);
    }
    a[0] += ux * Tn;
    a[1] += uy * Tn;
    a[2] += uz * Tn;
  }
  // drag
  for (let i = 0; i < 3; i++) {
    const v = fl.vel[i] - wind[i];
    const sp = Math.hypot(fl.vel[0] - wind[0], fl.vel[1] - wind[1], fl.vel[2] - wind[2]);
    a[i] -= drag * v * (sp + 1);
  }

  for (let i = 0; i < 3; i++) {
    fl.vel[i] += a[i] * dt;
    fl.pos[i] += fl.vel[i] * dt;
  }

  /* ---- world collision ---- */
  if (!fl.crashed && fl.pos[2] > 0.05) {
    const what = collideAt(hooks.world, fl.pos[0], fl.pos[1], fl.pos[2], hitR);
    if (what) {
      hooks.say(`Hit ${what}. Press R to reset`);
      hooks.onCrash(what);
      fl.crashed = true;
      fl.armed = false;
      fl.tumble = 0;
    }
  }

  /* ---- ground contact ---- */
  if (fl.pos[2] <= 0) {
    fl.pos[2] = 0;
    const speed = Math.hypot(fl.vel[0], fl.vel[1], fl.vel[2]);
    const tilt = Math.abs(fl.roll) + Math.abs(fl.pitch);
    if (fl.t > 0.3 && !fl.crashed && (fl.vel[2] < -3.2 || (tilt > 0.96 && speed > 1.5) || speed > 6)) {
      hooks.say('Crashed. Press R to reset');
      hooks.onCrash('ground impact');
      fl.crashed = true;
      fl.armed = false;
    } else {
      fl.vel[2] = Math.max(0, fl.vel[2]);
      fl.vel[0] *= 0.8;
      fl.vel[1] *= 0.8;
      if (fl.thrEff < 0.3) {
        fl.roll *= 0.8;
        fl.pitch *= 0.8;
      }
    }
  }

  /* ---- out of field ---- */
  const F = hooks.world.field;
  if ((fl.pos[0] < -2 || fl.pos[0] > F + 2 || fl.pos[1] < -2 || fl.pos[1] > F + 2) && !fl.outWarned) {
    fl.outWarned = true;
    hooks.say('Out of the field: turn back (R resets to the pad)');
  } else if (fl.pos[0] > 0 && fl.pos[0] < F && fl.pos[1] > 0 && fl.pos[1] < F) {
    fl.outWarned = false;
  }

  /* ---- tumble ---- */
  if (fl.crashed) {
    fl.tumble += 8 * dt;
    fl.roll += 6 * dt;
  }

  /* ---- battery ---- */
  batteryStep(fl, dt, hooks.say);

  /* ---- camera smoothing + motor spin ---- */
  const camZ = hooks.craft.camZ ?? 0.8;
  fl.cam[0] += (fl.pos[0] - fl.cam[0]) * 0.14;
  fl.cam[1] += (fl.pos[1] - fl.cam[1]) * 0.14;
  fl.cam[2] += (fl.pos[2] * camZ - fl.cam[2]) * 0.14;
  for (let i = 0; i < n; i++) {
    fl.spin[i] += fl.thrEff * dt * (i % 2 ? -40 : 40);
  }
}

/** Gusty wind vector at time t. */
export function windAt(t: number): [number, number, number] {
  return [Math.sin(t * 0.7) * 1.2, Math.cos(t * 0.5) * 0.8, 0];
}

/** Battery drain + sag + warnings. */
export function batteryStep(fl: FlightState, dt: number, say: (m: string) => void): void {
  const c = fl.c as CalcOut & { cells?: number; mah?: number };
  if (!fl.armed || fl.crashed) return;
  const hoverThr2 = Math.max(0.05, fl.c.hoverThr ** 2);
  const amps = fl.c.hoverA * (fl.thrEff / hoverThr2) ** 1.25 + 0.4;
  fl.used += (amps * dt * 1000) / 3600;
  const mah = (c.mah as number) ?? 0;
  const cells = (c.cells as number) ?? 0;
  const soc = mah > 0 ? Math.max(0, 1 - fl.used / mah) : 0;
  const sag = amps * 0.012 * (cells / 6);
  fl.volt = cells * (3.3 + 0.9 * Math.pow(Math.max(0.01, soc), 0.7)) - sag;
  const vpc = cells > 0 ? fl.volt / cells : 0;
  if (vpc < 3.5 && !fl.lowWarned) {
    fl.lowWarned = true;
    AudioSys.sfx('error');
    say('LOW BATTERY: land now (3.5 V per cell)');
  }
  if (vpc < 3.2) {
    fl.armed = false;
    AudioSys.sfx('unplug');
    say('Battery empty: the ESCs cut out. Never fly a LiPo this low');
  }
}
