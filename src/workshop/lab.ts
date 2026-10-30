/**
 * Drone Lab — the workshop engine: bench, build system, safety tests, flight.
 *
 * One craft is mounted per page load (hash routing). The state machine runs
 * part placement -> orientation mistakes -> smoke stopper -> motor direction
 * -> accelerometer calibration -> plug in -> fly, with the lesson panels
 * (calculator, wiring, CLI, log, quiz) syncing alongside.
 */

import {
  Vec3,
  Tone,
  PALETTES,
  setPan,
  getPan,
  inkScale,
  board3,
  castShadow,
  clipTo,
  path3,
  ink,
  fillPath,
  poly3,
  tag as tagPill,
  act,
  project,
  clamp01
} from '../engine/core';
import { FR, rad } from '../engine/frames';
import { drainGlows } from '../engine/oshapes';
import { mountFigure, esc } from '../engine/shell';
import type { ShellUi, ShellState } from '../engine/shell';
import { AudioSys } from '../engine/audio';
import { Progress } from '../engine/storage';
import type { CraftRecord, Design, CalcOut, FlightState, PhysCtx } from '../types';
import { calcCraft } from './calc';
import { buildRoster, buildLesson, recordQuiz, type RosterEntry, type LessonDom } from './lesson';
import { buildWorld, goalCheck, gateCheck, type World } from '../flight/world';
import { newFlight, multirotorStep, batteryStep } from '../flight/physics';
import type { StickState } from '../flight/controls';
import { drawWorldIso, drawCraftFlight, fpvScene, goalPointer, type FpvBox } from '../flight/render';
import { keyDown, keyUp, clearKeys, readSticks, makePad, type VStick, type PadHandle } from '../flight/controls';
import { craftAnimBusy } from '../crafts/anim';

/* ------------------------------------------------------------------ */
/* state                                                               */
/* ------------------------------------------------------------------ */

interface Placed {
  t: number; // 0..1 placement animation
  orient: number; // 0 normal, 1 flipped (polar parts)
  leave?: boolean; // sliding off the bench
}

interface LabState extends ShellState {
  design: Design;
  placed: Record<string, Placed>;
  ex: number;
  exT: number; // target explode amount
  sel: string | null;
  smokeOk: boolean;
  motorOk: boolean;
  accOk: boolean;
  plugged: boolean;
  fault: boolean;
  smoke: Array<{ x: number; y: number; z: number; age: number }>;
  serial: string[];
  quiz: Record<number, number>;
  queue: string[];
  queueT: number;
  test: { kind: 'smoke' | 'motor'; t: number; motor: number } | null;
  view: 'bench' | 'fly';
  flight: FlightState | null;
  mode: string;
  stick: StickState;
  vstick: VStick;
  fpv: boolean;
  wind: boolean;
  best: number;
  crashes: number;
  laps: number;
  auto: boolean;
  autoT: number;
}

let DR: CraftRecord;
let WORLD: World;
let D: LabState;
let MODES: Record<string, { title: string; code?: string; hint?: string; alt?: boolean }>;
let BENCH = { ox: 0, oy: 0, k: 1, vb: 100 };
let DGEN = 0;
let dui: ShellUi;
let lessonDom: LessonDom | null = null;
let padL: PadHandle | null = null;
let padR: PadHandle | null = null;

const DEF_MODES: Record<string, { title: string; code?: string; hint?: string; alt?: boolean }> = {
  alt: {
    title: 'Altitude hold (easy)',
    code: 'set alt_hold_throttle_deadband = 15\naux 1 ANGLE\naux 2 ALTHOLD',
    hint: 'The FC holds height: W/S climb + descend',
    alt: true
  },
  angle: {
    title: 'Angle mode',
    code: 'set angle_limit = 38\nset p_level = 50\nset i_level = 50',
    hint: 'Self-levelling; throttle stays where you put it'
  },
  acro: {
    title: 'Acro (rate) mode',
    code: 'set roll_rc_rate = 100\nset roll_srate = 70  # ~540 deg/s\nset p_roll = 45\nset d_roll = 40',
    hint: 'Sticks = rotation rate, no self-level'
  },
  race: {
    title: 'Gate race',
    code: 'set osd_timer_1 = ON\nset osd_stat_max_spd = ON',
    hint: '5 gates in order; the timer starts at gate 1'
  }
};

function freshState(): LabState {
  const placed: Record<string, Placed> = {};
  for (const p of DR.parts) placed[p.id] = { t: 1, orient: 0 };
  return {
    pal: DR.palette,
    design: { ...DR.design },
    placed,
    ex: 0,
    exT: 0,
    sel: null,
    smokeOk: false,
    motorOk: false,
    accOk: false,
    plugged: false,
    fault: false,
    smoke: [],
    serial: [`-- ${DR.log} --`],
    quiz: {},
    queue: [],
    queueT: 0,
    test: null,
    view: 'bench',
    flight: null,
    mode: DR.mode || 'alt',
    stick: { thr: 0, thrAbs: 0, yaw: 0, pitch: 0, roll: 0 },
    vstick: { thr: null, yaw: null, pitch: null, roll: null },
    fpv: false,
    wind: false,
    best: 0,
    crashes: 0,
    laps: 0,
    auto: false,
    autoT: 0
  };
}

const dlog = (line: string): void => {
  D.serial.push(line);
  if (D.serial.length > 40) D.serial.shift();
};
const say = (msg: string): void => dui?.flash(msg, 2400);
const isPhone = (): boolean => window.matchMedia('(max-width: 560px)').matches;

/* ------------------------------------------------------------------ */
/* craft helpers                                                       */
/* ------------------------------------------------------------------ */

const partById = (id: string) => DR.parts.find((p) => p.id === id);
const isPlaced = (id: string): boolean => !!D.placed[id] && D.placed[id].t > 0.02;
const fcReversed = (): boolean => (D.placed.FC?.orient ?? 0) === 1;
const propsSwapped = (): boolean => (D.placed.PROPS?.orient ?? 0) === 1;
const xt60Reversed = (): boolean => (D.placed.XT60?.orient ?? 0) === 1;
const motorChecked = (): boolean => D.motorOk;

function dropOf(id: string): number {
  const p = D.placed[id];
  if (!p) return 0;
  const part = partById(id);
  const layer = part?.z ?? 0;
  return (1 - p.t) * 70 + D.ex * layer * 16;
}

function allPlaced(): boolean {
  return DR.parts.every((p) => isPlaced(p.id));
}

/** A part is "on" the bench once placed (even mid drop animation). */
function isOn(id: string): boolean {
  const p = D.placed[id];
  return !!p && !p.leave;
}

function prereqMissing(id: string): string | null {
  const part = partById(id);
  if (!part?.after) return null;
  for (const a of part.after) {
    if (!isOn(a)) {
      const ap = partById(a);
      return `${part.short} goes on after ${ap?.short || a}`;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* tests                                                               */
/* ------------------------------------------------------------------ */

function runSmokeTest(): void {
  if (D.test) return;
  if (!isPlaced('XT60') || !isPlaced('ESC')) {
    say('Solder the power lead and the ESC first');
    AudioSys.sfx('error');
    return;
  }
  if (D.plugged) {
    D.plugged = false;
    dlog('battery unplugged');
  }
  if (D.ex > 0) {
    say('Close the exploded view first');
    return;
  }
  D.test = { kind: 'smoke', t: 0, motor: 0 };
  dlog('$ smoke stopper between battery and quad...');
  AudioSys.sfx('machine');
}

function runMotorTest(): void {
  if (D.test) return;
  if (!isPlaced('WIRES') || !isPlaced('FC')) {
    say('Wire the motors and mount the flight controller first');
    AudioSys.sfx('error');
    return;
  }
  if (isPlaced('PROPS')) {
    say('PROPS OFF! Never spin motors on the bench with props on');
    AudioSys.sfx('error');
    return;
  }
  if (isPlaced('BATT') && !D.plugged) {
    D.plugged = true;
    dlog(`battery plugged: ${calc().V.toFixed(1)} V`);
  }
  D.test = { kind: 'motor', t: 0, motor: 0 };
  dlog('$ motors tab: spin M1, M2, M3, M4 one at a time');
  AudioSys.sfx('machine');
}

function runAccCal(): void {
  if (!isPlaced('FC')) {
    say('Mount the flight controller first');
    AudioSys.sfx('error');
    return;
  }
  D.accOk = true;
  AudioSys.sfx('chime');
  if (fcReversed()) {
    say('Calibrated level. Note: the arrow on the FC points backwards...');
    dlog('acc calibrated (but board_align is wrong!)');
  } else {
    say('Accelerometer calibrated on a flat surface');
    dlog('$ calibrate accelerometer: done, level = 0.0 / 0.0');
  }
}

function togglePlug(): void {
  if (!isPlaced('BATT') || !isPlaced('XT60')) {
    say('Mount the battery and its power lead first');
    AudioSys.sfx('error');
    return;
  }
  if (D.plugged) {
    D.plugged = false;
    dlog('battery unplugged');
    AudioSys.sfx('unplug');
    if (D.fault) {
      D.fault = false;
      D.placed.XT60.orient = 0;
      say('Replaced the capacitor the right way round');
    }
    return;
  }
  if (xt60Reversed() && !D.smokeOk) {
    // POP: the capacitor vents
    D.fault = true;
    D.plugged = true;
    AudioSys.sfx('pop');
    setTimeout(() => AudioSys.sfx('sizzle'), 120);
    say('POP: the capacitor was in backwards and vented. A smoke stopper would have caught it. Unplug, replace it');
    dlog('fault: capacitor vented (reverse polarity)');
    for (let i = 0; i < 14; i++) {
      D.smoke.push({ x: -46 + (Math.random() - 0.5) * 14, y: 13 + (Math.random() - 0.5) * 10, z: 12 + Math.random() * 8, age: Math.random() * 0.4 });
    }
    return;
  }
  D.plugged = true;
  AudioSys.sfx('plug');
  setTimeout(() => AudioSys.sfx('power'), 260);
  dlog(`battery plugged: ${calc().V.toFixed(1)} V`);
  say('Beep beep beep: ESCs armed-ready, FC and VTX on');
}

/* ------------------------------------------------------------------ */
/* build actions                                                       */
/* ------------------------------------------------------------------ */

function addPart(id: string): void {
  const part = partById(id);
  if (!part) return;
  if (D.plugged) {
    say('Unplug the battery first: never work on a live quad');
    AudioSys.sfx('error');
    return;
  }
  if (D.ex > 0) {
    say('Close the exploded view first');
    AudioSys.sfx('error');
    return;
  }
  if (isPlaced(id)) {
    say(`${part.short} is already on`);
    return;
  }
  if (id === 'PROPS') {
    const needSmoke = !DR.noSmoke;
    const needMotor = DR.mpos.length > 0;
    if ((needSmoke && !D.smokeOk) || (needMotor && !D.motorOk)) {
      say('Props go on LAST: run the smoke stopper test and the motor direction check first');
      AudioSys.sfx('error');
      return;
    }
  }
  const miss = prereqMissing(id);
  if (miss) {
    say(miss);
    AudioSys.sfx('error');
    return;
  }
  D.placed[id] = { t: 0, orient: 0 };
  AudioSys.sfx('place');
  Progress.set(DR.key, { visited: true });
}

function flipPart(id: string): void {
  const p = D.placed[id];
  const part = partById(id);
  if (!p || !part) return;
  if (D.plugged) {
    say('Unplug the battery first: never work on a live quad');
    AudioSys.sfx('error');
    return;
  }
  p.orient = p.orient ? 0 : 1;
  AudioSys.sfx('snap');
}

function takeApart(): void {
  if (!Object.keys(D.placed).some((id) => isPlaced(id))) {
    say('Already a box of parts');
    return;
  }
  if (D.plugged) {
    D.plugged = false;
    dlog('battery unplugged');
  }
  // remove top-down, staggered
  const order = [...DR.parts].sort((a, b) => (b.z ?? 0) - (a.z ?? 0));
  order.forEach((p, i) => {
    const pl = D.placed[p.id];
    if (pl)
      window.setTimeout(() => {
        pl.leave = true;
      }, i * 70);
  });
  D.smokeOk = false;
  D.motorOk = false;
  D.accOk = false;
  AudioSys.sfx('whoosh');
}

function buildForMe(): void {
  if (allPlaced()) {
    say('Already built');
    return;
  }
  D.queue = DR.parts.filter((p) => !isPlaced(p.id)).map((p) => p.id);
  D.queueT = 0;
  D.smokeOk = true;
  D.motorOk = true;
  D.accOk = true;
  AudioSys.sfx('machine');
}

function toggleExplode(): void {
  if (D.plugged && D.exT === 0) {
    D.plugged = false;
    dlog('battery unplugged');
  }
  D.exT = D.exT === 0 ? 1 : 0;
  AudioSys.sfx('whoosh');
}

/* ------------------------------------------------------------------ */
/* flight                                                              */
/* ------------------------------------------------------------------ */

const calc = (): CalcOut => (DR.calc ? DR.calc(D.design) : calcCraft(DR, D.design));

const isAltMode = (): boolean => !!(MODES[D.mode]?.alt ?? (D.mode === 'range' && WORLD.alt));

function goFly(modeKey: string): void {
  if (!allPlaced()) {
    say('Finish building it first: Build it for me is fine');
    AudioSys.sfx('error');
    return;
  }
  if (D.fault) {
    say('Fix the fault first (unplug, replace the capacitor)');
    AudioSys.sfx('error');
    return;
  }
  if (!DR.noSmoke && !D.smokeOk) {
    say('Do the smoke stopper test first: a short on the first plug kills ESCs');
    AudioSys.sfx('error');
    return;
  }
  D.mode = modeKey;
  D.view = 'fly';
  // note: D.fpv is NOT reset here — the ?fpv param may pre-set it
  const c = calc();
  const cells = (c.cells as number) ?? 6;
  D.flight = newFlight(c, WORLD.pad, DR.mpos.length, cells);
  D.flight.mode = modeKey; // crafts' physics overrides can read it
  D.stick = { thr: 0, thrAbs: 0, yaw: 0, pitch: 0, roll: 0 };
  clearKeys();
  document.querySelector('.stage')?.classList.add('flying');
  document.querySelector('.stage')?.classList.remove('fpv');
  AudioSys.sfx('whoosh');
  const m = MODES[modeKey];
  if (m?.hint) say(m.hint);
  dlog(`-- field: ${m?.title || modeKey} --`);
  Progress.set(DR.key, { visited: true, built: true });
}

function backToBench(): void {
  D.view = 'bench';
  D.flight = null;
  D.auto = false;
  clearKeys();
  document.querySelector('.stage')?.classList.remove('flying', 'fpv');
  AudioSys.hum(0);
  AudioSys.sfx('whoosh');
  dui?.resetFrame();
}

function resetFlight(): void {
  if (!D.flight) return;
  const c = calc();
  const cells = (c.cells as number) ?? 6;
  D.flight = newFlight(c, WORLD.pad, DR.mpos.length, cells);
  D.stick = { thr: 0, thrAbs: 0, yaw: 0, pitch: 0, roll: 0 };
  clearKeys();
  AudioSys.sfx('whoosh');
}

function toggleArm(): void {
  const fl = D.flight;
  if (!fl) return;
  if (fl.crashed) {
    say('Crashed: press R to reset to the pad');
    return;
  }
  if (fl.armed) {
    fl.armed = false;
    dlog('disarmed');
    AudioSys.sfx('unplug');
    return;
  }
  if (fl.pos[2] > 0.05) {
    say('Land first: arming on the ground only');
    return;
  }
  if (!D.accOk) {
    say('Arming blocked: ACC not calibrated. Run Calibrate accelerometer on the bench');
    return;
  }
  if (!isAltMode() && D.stick.thrAbs > 0.08) {
    say('Arming blocked: throttle not at zero (that is a safety rule, not a bug)');
    return;
  }
  fl.armed = true;
  fl.t = 0;
  const m = MODES[D.mode];
  dlog(`ARMED  mode: ${m?.title || D.mode}`);
  AudioSys.sfx('power');
  say(m?.hint || 'Armed');
}

function toggleFpv(): void {
  D.fpv = !D.fpv;
  document.querySelector('.stage')?.classList.toggle('fpv', D.fpv);
  AudioSys.sfx('click');
}

function physCtx(): PhysCtx {
  const fl = D.flight!;
  return {
    stock: (f, dt) => multirotorStep(f, dt, D.stick, MODES[D.mode] || {}, hooks()),
    batteryStep: (f, dt) => batteryStep(f, dt, (m) => say(m)),
    crash: (f, why) => {
      f.crashed = true;
      f.armed = false;
      D.crashes++;
      dlog(`CRASH: ${why}`);
      AudioSys.sfx('pop');
      setTimeout(() => AudioSys.sfx('sizzle'), 110);
    },
    worldCollide: (f) => {
      void f;
    },
    goalCheck: (f) => {
      goalCheck(WORLD, f, goalCallbacks());
    },
    gateCheck: (f) => {
      gateCheck(WORLD, f, 1.6, 1.6, goalCallbacks());
    },
    say: (m) => say(m),
    stick: D.stick
  };
}

function hooks() {
  return {
    craft: DR,
    world: WORLD,
    say: (m: string) => say(m),
    onCrash: (why: string) => {
      const fl = D.flight!;
      fl.crashed = true;
      fl.armed = false;
      D.crashes++;
      dlog(`CRASH: ${why}`);
      AudioSys.sfx('pop');
      setTimeout(() => AudioSys.sfx('sizzle'), 110);
    },
    onLap: (t: number) => {
      D.laps++;
      if (!D.best || t < D.best) {
        D.best = t;
        Progress.set(DR.key, { bestLap: t });
        say(`Lap ${t.toFixed(2)} s (best!)`);
      }
    },
    onRun: (t: number) => {
      if (!(D as unknown as { bestRun?: number }).bestRun || t < ((D as unknown as { bestRun?: number }).bestRun ?? 1e9)) {
        (D as unknown as { bestRun?: number }).bestRun = t;
        Progress.set(DR.key, { bestRun: t });
      }
    },
    fcReversed,
    propsSwapped,
    motorChecked,
    accOk: () => D.accOk,
    wind: () => D.wind
  };
}

function goalCallbacks() {
  return {
    say: (m: string) => say(m),
    chime: () => AudioSys.sfx('chime'),
    ding: () => AudioSys.sfx('ding'),
    onLap: (t: number) => hooks().onLap(t),
    onRun: (t: number) => hooks().onRun(t)
  };
}

function flightTick(dt: number): void {
  const fl = D.flight;
  if (!fl) return;
  readSticks(D.stick, D.vstick, dt, isAltMode());

  // autopilot demo (?auto)
  if (D.auto) {
    D.autoT += dt;
    D.stick.thr = Math.min(1, D.autoT * 0.5);
    D.stick.thr = fl.pos[2] > 2.2 ? 0 : 0.9;
    if (!fl.armed && fl.pos[2] <= 0) toggleArm();
  }

  const n = Math.max(1, Math.ceil(dt / 0.01));
  for (let i = 0; i < n; i++) {
    const sdt = dt / n;
    if (DR.physics) {
      DR.physics(fl, sdt, physCtx());
    } else {
      multirotorStep(fl, sdt, D.stick, MODES[D.mode] || {}, hooks());
    }
    if (D.mode === 'race' && fl.armed) gateCheck(WORLD, fl, 1.6, 1.6, goalCallbacks());
    if (D.mode === 'range' && fl.armed) goalCheck(WORLD, fl, goalCallbacks());
  }
  AudioSys.hum(fl.armed && !fl.crashed ? fl.thrEff : 0);
  if (fl.msgT > 0) fl.msgT -= dt;
}

/* ------------------------------------------------------------------ */
/* animation driver                                                    */
/* ------------------------------------------------------------------ */

function dtick(dt: number): boolean {
  // placement animations
  for (const [id, p] of Object.entries(D.placed)) {
    if (p.leave) {
      p.t -= dt * 2.6;
      if (p.t <= 0) delete D.placed[id];
    } else if (p.t < 1) {
      p.t = Math.min(1, p.t + dt * 2.2);
    }
  }
  // explode tween
  if (D.ex !== D.exT) {
    const dir = D.exT > D.ex ? 1 : -1;
    D.ex = clamp01(D.ex + dir * dt * 1.5);
    if (Math.abs(D.ex - D.exT) < 0.01) D.ex = D.exT;
  }
  // build queue
  if (D.queue.length) {
    D.queueT += dt;
    if (D.queueT > 0.35) {
      D.queueT = 0;
      const id = D.queue.shift()!;
      D.placed[id] = { t: 0, orient: 0 };
      AudioSys.sfx('place');
    }
  }
  // tests
  if (D.test) {
    D.test.t += dt;
    if (D.test.kind === 'smoke' && D.test.t > 2.2) {
      const shorted = xt60Reversed();
      D.test = null;
      D.smokeOk = true;
      if (shorted) {
        say('The smoke stopper lamp lit up: something is shorted. The cap is in backwards: flip it before you plug in for real');
        dlog('smoke stopper: SHORT detected');
        AudioSys.sfx('buzz');
      } else {
        say('No short: the lamp only blinked. Safe to plug in');
        dlog('smoke stopper: no short, current ok');
        AudioSys.sfx('ding');
      }
    } else if (D.test.kind === 'motor') {
      const per = 1.2;
      const idx = Math.floor(D.test.t / per);
      if (idx >= DR.mpos.length) {
        const wrong = DR.wrongMotor && !D.motorOk;
        D.test = null;
        if (wrong) {
          D.motorOk = true;
          say(`M${DR.wrongMotor} spun the wrong way: reversed it in the ESC configurator. They all spin right now`);
          dlog(`M${DR.wrongMotor} direction reversed in ESC config`);
          AudioSys.sfx('chime');
        } else {
          D.motorOk = true;
          say('Every motor spins the right way');
          dlog('motor directions ok');
          AudioSys.sfx('ding');
        }
      } else {
        D.test.motor = idx;
      }
    }
  }
  // smoke puffs
  for (const s of D.smoke) s.age += dt;
  D.smoke = D.smoke.filter((s) => s.age < 2);

  // flight physics
  if (D.view === 'fly' && D.flight) flightTick(dt);

  const busy =
    D.view === 'fly' ||
    !!D.test ||
    D.queue.length > 0 ||
    D.smoke.length > 0 ||
    Object.values(D.placed).some((p) => (p.leave ? p.t > 0 : p.t < 1)) ||
    D.ex !== D.exT;
  return busy;
}

/* ------------------------------------------------------------------ */
/* scenes                                                              */
/* ------------------------------------------------------------------ */

function benchScene(_st: ShellState, m: Tone): string {
  // bench framing
  if (dui) {
    setPan(BENCH.ox, BENCH.oy);
    dui.setInkK(BENCH.k);
    dui.setViewBox(BENCH.vb);
  }

  const MAT = DR.mat ?? 280;
  const { svg: matSvg, top } = board3(0, 0, MAT, MAT, 4, 8);
  // 40 mm grid
  let grid = '';
  for (let v = 40; v < MAT; v += 40) {
    grid += ink(path3([[v, 0, 4.1], [v, MAT, 4.1]]), 0.6);
    grid += ink(path3([[0, v, 4.1], [MAT, v, 4.1]]), 0.6);
  }

  const benchZ = 0;
  const F = FR.Rz(FR.I(MAT / 2, MAT / 2, 4 + benchZ), rad(0));

  const parts: Array<{ at: Vec3; svg: string; id?: string }> = [];
  const add = (at: Vec3, svg: string, id?: string): void => {
    parts.push({ at, svg, id });
  };

  const opt = {
    has: (id: string) => isPlaced(id),
    U: (id: string) => FR.T(F, 0, 0, dropOf(id)),
    orient: (id: string) => D.placed[id]?.orient ?? 0,
    m,
    spin: benchSpin(),
    rpm: DR.mpos.map(() => 0),
    power: D.plugged,
    broken: false,
    k: 1,
    design: D.design,
    plugged: D.plugged,
    fault: D.fault,
    all: false,
    fl: undefined
  };
  DR.draw(F, add, opt);

  // shadow
  const hullPts = DR.hull(F);
  const shadow = castShadow(hullPts, 4);

  // parts: depth sort + click wrappers
  const wrapped = parts
    .sort((a, b) => a.at[0] + a.at[1] + a.at[2] - (b.at[0] + b.at[1] + b.at[2]))
    .map((p) => {
      const id = p.id;
      if (id && isPlaced(id)) {
        return { at: p.at, svg: act('part', p.svg, `data-id="${id}"`) };
      }
      return { at: p.at, svg: p.svg };
    });

  // test visuals
  let testSvg = '';
  const benchSpinArr = benchSpin();
  if (D.test?.kind === 'smoke') {
    // lamp box + lead at the rear of the mat
    const lx = MAT / 2;
    const ly = -34;
    testSvg +=
      poly3([[lx - 16, ly - 10, 4], [lx + 16, ly - 10, 4], [lx + 16, ly + 10, 22], [lx - 16, ly + 10, 22]], '#fbf6e4', 1) +
      `<text x="${project([lx, ly, 30])[0].toFixed(1)}" y="${project([lx, ly, 30])[1].toFixed(1)}" font-family="ui-monospace,Menlo,monospace" font-size="9" font-weight="800" fill="#231e16" text-anchor="middle">STOP</text>` +
      ink(path3([[lx, ly + 10, 12], [lx, 8, 12]], false), 3);
    const on = xt60Reversed() && D.test.t > 0.9;
    const [cx, cy] = project([lx, ly, 13]);
    testSvg += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7" fill="${on ? '#ff5a4d' : '#e8e3d0'}" stroke="#231e16" stroke-width="1.2"/>`;
    if (on) {
      testSvg += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="13" fill="rgba(255,90,77,0.35)"/>`;
    }
  }
  if (D.test?.kind === 'motor') {
    const i = D.test.motor;
    const mp = DR.mpos[i];
    if (mp) {
      const [mx, my] = [mp[0], mp[1]];
      const pos: Vec3 = [MAT / 2 + mx, MAT / 2 + my, 26];
      const wrong = DR.wrongMotor === i + 1 && !D.motorOk;
      const col = wrong ? '#d6492c' : '#231e16';
      // spiral arrow
      const pts: Vec3[] = [];
      for (let j = 0; j <= 22; j++) {
        const a = benchSpinArr[i] + (j / 22) * Math.PI * 1.7;
        const r = 10 + (j / 22) * 20;
        pts.push([pos[0] + Math.cos(a) * r, pos[1] + Math.sin(a) * r, pos[2] + 4]);
      }
      testSvg += `<path d="${path3(pts, false)}" fill="none" stroke="${col}" stroke-width="2.4"/>`;
      const [tx, ty] = project([pos[0], pos[1], pos[2] + 26]);
      testSvg += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" font-family="ui-monospace,Menlo,monospace" font-size="11" font-weight="800" fill="${col}" text-anchor="middle">M${i + 1} ${mp[3]}${wrong ? ' WRONG' : ''}</text>`;
    }
  }

  // smoke puffs
  let smokeSvg = '';
  for (const s of D.smoke) {
    const [sx, sy] = project([MAT / 2 + s.x, MAT / 2 + s.y, s.z + s.age * 14]);
    const r = 4 + s.age * 10;
    smokeSvg += `<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${r.toFixed(1)}" fill="rgba(90,86,80,${(0.4 * (1 - s.age / 2)).toFixed(2)})"/>`;
  }

  // tags
  let tags = '';
  if (DR.tags) {
    for (const [id, anchor, dx, dy] of DR.tags) {
      if (!isPlaced(id)) continue;
      const part = partById(id);
      const lift = dropOf(id);
      tags += tagPill([anchor[0] + MAT / 2, anchor[1] + MAT / 2, anchor[2] + 4 + lift], dx, dy, part?.short || id, D.sel === id);
    }
  }

  return matSvg + clipTo(top, grid + shadow) + wrapped.map((w) => w.svg).join('') + testSvg + smokeSvg + drainGlows() + tags;
}

function benchSpin(): number[] {
  const spin = DR.mpos.map(() => 0);
  if (D.test?.kind === 'motor') {
    const i = D.test.motor;
    if (spin[i] !== undefined) spin[i] = performance.now() / 300;
  }
  return spin;
}

function flyScene(_st: ShellState, m: Tone): string {
  const fl = D.flight!;
  const vb = isPhone() ? (DR.flyVB ?? 5200) * 0.8 : (DR.flyVB ?? 5200);
  dui.setViewBox(vb, isPhone() ? vb * 1.05 : vb * 0.75);
  dui.setInkK(vb / 585 / 4);
  const accent = (PALETTES[D.pal] || PALETTES.mustard).l;
  const world = drawWorldIso(WORLD, fl, accent);
  const craft = drawCraftFlight(DR, fl, m, D.design, true);
  return world + craft.svg + craft.groundDot + goalPointer(WORLD, fl, accent) + drainGlows();
}

function fpvSceneWrap(_st: ShellState, _m: Tone): string {
  const fl = D.flight!;
  dui.setViewBox(1000, 750);
  dui.setInkK(1.1);
  const B: FpvBox = isPhone() ? { x: 0, y: 0, w: 1000, h: 750 } : { x: 250, y: 0, w: 750, h: 562 };
  return fpvScene(WORLD, fl, DR, MODES[D.mode]?.title || D.mode, B, isPhone());
}

function dscene(st: ShellState, m: Tone): string {
  if (D.view === 'fly' && D.flight) {
    return D.fpv ? fpvSceneWrap(st, m) : flyScene(st, m);
  }
  return benchScene(st, m);
}

/* ------------------------------------------------------------------ */
/* stats                                                               */
/* ------------------------------------------------------------------ */

function stats(): Array<{ label: string; value: string; small?: boolean }> {
  const c = calc();
  const fl = D.flight;
  if (D.view === 'fly' && fl) {
    const cells = (c.cells as number) ?? 6;
    const out = [
      { label: 'Mode', value: (MODES[D.mode]?.title || D.mode).split(' ')[0], small: true },
      { label: 'Battery', value: `${(fl.volt / cells).toFixed(2)} V/c` },
      { label: 'Altitude', value: `${fl.pos[2].toFixed(1)} m` },
      { label: 'Speed', value: `${(Math.hypot(fl.vel[0], fl.vel[1], fl.vel[2]) * 3.6).toFixed(0)} km/h` }
    ];
    if (D.mode === 'race') {
      out.push({ label: 'Gate', value: `${fl.gate + 1}/${WORLD.gates.length || 5}`, small: true });
    } else {
      out.push({ label: fl.armed ? 'Armed' : fl.crashed ? 'Crashed' : 'Space', value: fl.armed ? 'GO' : fl.crashed ? 'R' : 'SPACE', small: true });
    }
    out.push({ label: 'Throttle', value: `${Math.round(Math.sqrt(fl.thrEff) * 100)} %` });
    if (D.best) out.push({ label: 'Best lap', value: `${D.best.toFixed(2)} s` });
    const extra = DR.flyStats?.(fl);
    if (extra) out.push(...extra);
    return out;
  }
  const placedN = DR.parts.filter((p) => isPlaced(p.id)).length;
  const out = [
    { label: 'Parts', value: `${placedN}/${DR.parts.length}`, small: true },
    { label: 'Weight', value: `${Math.round(c.auw)} g` },
    { label: 'Thrust : weight', value: `${c.tw.toFixed(1)} : 1` },
    { label: 'Flight time', value: `~${c.flyMin.toFixed(1)} min`, small: true }
  ];
  return out;
}

/* ------------------------------------------------------------------ */
/* buttons                                                             */
/* ------------------------------------------------------------------ */

function buttons(): Array<{ label: string; cls?: string; onClick?: () => void; choices?: () => Array<{ label: string; onClick?: () => void; current?: boolean; disabled?: boolean; why?: string }> }> {
  const list: ReturnType<typeof buttons> = [];
  list.push({ label: 'Take it apart', onClick: takeApart });
  list.push({
    label: 'Add next part',
    choices: () =>
      DR.parts.map((p) => {
        if (!isPlaced(p.id)) {
          const miss = prereqMissing(p.id);
          return { label: `Add ${p.short}`, onClick: () => addPart(p.id), disabled: !!miss, why: miss || undefined };
        }
        if (p.polar) {
          return { label: `${p.short}: ${D.placed[p.id].orient ? p.polar[1] : p.polar[0]} — flip`, onClick: () => flipPart(p.id) };
        }
        return { label: `${p.short} is on`, disabled: true, why: `${p.short} is already on` };
      })
  });
  list.push({ label: 'Build it for me', onClick: buildForMe });
  if (!DR.noSmoke) list.push({ label: 'Smoke stopper test', onClick: runSmokeTest });
  if (DR.mpos.length) list.push({ label: 'Check motor direction', onClick: runMotorTest });
  list.push({ label: DR.calLabel || 'Calibrate accelerometer', onClick: runAccCal });
  list.push({ label: 'Plug / unplug battery', onClick: togglePlug });
  list.push({
    label: 'Fly',
    cls: 'flyb',
    choices: () => {
      const out: Array<{ label: string; onClick: () => void; current?: boolean; disabled?: boolean }> = Object.entries(
        MODES
      ).map(([k, m]) => ({
        label: m.title,
        onClick: () => goFly(k),
        current: D.view === 'fly' && D.mode === k
      }));
      out.push({ label: D.fpv ? 'FPV view off (V)' : 'FPV view on (V)', onClick: toggleFpv, current: D.fpv });
      out.push({ label: D.wind ? 'Wind off' : 'Wind on', onClick: () => (D.wind = !D.wind), current: D.wind });
      out.push({ label: 'Back to the bench', onClick: backToBench, disabled: D.view !== 'fly' });
      return out;
    }
  });
  list.push({ label: 'Arm / disarm', cls: 'flyb', onClick: toggleArm });
  list.push({ label: 'Reset', cls: 'flyb', onClick: resetFlight });
  list.push({ label: 'Exploded view', onClick: toggleExplode });
  for (const eb of DR.extraButtons ?? []) {
    list.push({ label: eb.label, cls: eb.inFlight ? 'flyonly' : undefined, onClick: () => eb.onClick(D.flight) });
  }
  return list;
}

/* ------------------------------------------------------------------ */
/* keyboard + sticks                                                   */
/* ------------------------------------------------------------------ */

function inInput(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  return !!t && (!!t.closest && !!t.closest('input, select, textarea'));
}

function wireKeyboard(gen: number): void {
  const hooks = {
    onArm: () => toggleArm(),
    onReset: () => resetFlight(),
    onFpv: () => toggleFpv(),
    isFlying: () => gen === DGEN && D.view === 'fly',
    inInput
  };
  window.addEventListener('keydown', (e) => {
    if (gen !== DGEN) return;
    keyDown(e, hooks);
  });
  window.addEventListener('keyup', (e) => {
    if (gen !== DGEN) return;
    keyUp(e);
  });
}

function wireSticks(stage: HTMLElement, gen: number): void {
  const mk = (cls: string, label: string): HTMLElement => {
    const pad = document.createElement('div');
    pad.className = cls;
    pad.innerHTML = `<span>${label}</span><i></i>`;
    stage.appendChild(pad);
    return pad;
  };
  const pl = mk('pad padl', 'THROTTLE · YAW');
  const pr = mk('pad padr', 'PITCH · ROLL');
  padL = makePad(pl, (x, y) => {
    if (gen !== DGEN) return;
    D.vstick.yaw = x;
    D.vstick.thr = y;
  }, !isAltMode());
  padR = makePad(pr, (x, y) => {
    if (gen !== DGEN) return;
    D.vstick.roll = -x;
    D.vstick.pitch = y;
  }, false);
}

/* ------------------------------------------------------------------ */
/* mount                                                               */
/* ------------------------------------------------------------------ */

export interface LabBoot {
  crafts: CraftRecord[];
  roster: RosterEntry[];
}

let BOOT: LabBoot | null = null;

export function startLab(crafts: CraftRecord[], roster: RosterEntry[]): void {
  BOOT = { crafts, roster };
  const keyOf = (): string => (location.hash.replace(/^#\/?/, '').split('?')[0]) || (crafts[0]?.key ?? '');
  mountDrone(keyOf());
  window.addEventListener('hashchange', () => {
    mountDrone(keyOf());
  });
}

export function mountDrone(key: string): void {
  if (!BOOT) return;
  const dr = BOOT.crafts.find((c) => c.key === key) || BOOT.crafts.find((c) => c.fig === 1) || BOOT.crafts[0];
  DR = dr;
  DGEN++;
  MODES = { ...DEF_MODES };
  if (dr.range?.goals?.length) {
    MODES = {
      ...MODES,
      range: { title: `Range: ${dr.range.title}`, hint: dr.range.brief, alt: dr.range.alt !== false }
    };
  }
  if (dr.modes) MODES = { ...MODES, ...dr.modes };
  WORLD = buildWorld(dr.range ?? { title: 'The field', brief: 'Free flight' });
  D = freshState();
  // hydrate persisted quiz answers for this craft
  const savedQuiz = Progress.get(dr.key).quiz;
  if (savedQuiz) D.quiz = { ...savedQuiz };
  dui = null as unknown as ShellUi;
  lessonDom = null;

  const stage_flying = document.querySelector('.stage');
  stage_flying?.classList.remove('flying', 'fpv');

  dui = mountFigure({
    fig: String(dr.fig).padStart(2, '0'),
    title: dr.name,
    hint: dr.hint || 'design it, build it, then fly it',
    size: [dr.mat ?? 280, dr.mat ?? 280, dr.benchH ?? 120],
    palette: dr.palette,
    state: D as unknown as ShellState,
    scene: dscene,
    stats: () => stats(),
    buttons: buttons() as never,
    acts: {
      part: (_st, el) => {
        const id = el.getAttribute('data-id') || null;
        selectPart(id === D.sel ? null : id);
      }
    },
    params: (st, q) => {
      if (q.get('bare') === '1') {
        for (const p of dr.parts) delete D.placed[p.id];
      }
      if (q.get('ex') === '1') {
        D.exT = 1;
        (st as LabState).ex = 0.001;
      }
      const fly = q.get('fly');
      if (fly) {
        // demo/test hook: pretend the bench work is done
        D.smokeOk = true;
        D.motorOk = true;
        D.accOk = true;
        setTimeout(() => goFly(fly), 60);
      }
      if (q.has('fpv')) {
        D.fpv = true;
        if (fly) setTimeout(() => document.querySelector('.stage')?.classList.add('fpv'), 100);
      }
      if (q.get('auto') === '1') {
        D.auto = true;
      }
      const pose = q.get('pose');
      if (pose) {
        const [x, y, z, yaw] = pose.split(',').map(Number);
        setTimeout(() => {
          if (D.flight) {
            D.flight.pos = [x, y, z];
            D.flight.yaw = (yaw * Math.PI) / 180 || 0;
            D.flight.armed = true;
          }
        }, 120);
      }
    },
    frame: isPhone() ? undefined : { fill: 0.66, left: 0.3 },
    credit: true
  });

  // capture bench framing
  BENCH = { ox: getPan()[0], oy: getPan()[1], k: inkScale(), vb: parseFloat(dui.svg.getAttribute('viewBox')?.split(' ')[2] || '100') };

  // roster nav + lesson panels
  const main = document.querySelector('#app main.page') as HTMLElement;
  buildRoster(main, BOOT.roster, dr.key);

  const lessonCtx = {
    dr,
    D: D as unknown as Record<string, unknown>,
    ui: dui,
    calc: () => calc(),
    design: () => D.design,
    selectPart,
    setDesign: (patch: Partial<Design>) => {
      D.design = { ...D.design, ...patch };
      D.flight = null;
      if (D.view === 'fly') backToBench();
      dui.render(); // the calculator tiles + wiring update live
    },
    flying: () => D.view === 'fly',
    mode: () => D.mode,
    modes: () => MODES,
    isPlaced,
    partName: (id: string) => partById(id)?.name || id,
    onQuiz: (qi: number, ai: number) => {
      const q = dr.quiz[qi];
      if (!q) return;
      D.quiz[qi] = ai;
      const ok = recordQuiz(dr.key, qi, ai, q.ok);
      AudioSys.sfx(ok ? 'chime' : 'buzz');
      if (lessonDom) lessonDom.sync();
    }
  };
  lessonDom = buildLesson(lessonCtx, main);

  // sticks
  const stage = document.querySelector('.stage') as HTMLElement;
  wireSticks(stage, DGEN);

  // floating flight message bar
  const fmsg = document.createElement('div');
  fmsg.className = 'fmsg';
  fmsg.setAttribute('role', 'status');
  stage.appendChild(fmsg);

  // keyboard
  wireKeyboard(DGEN);

  // wire render chain: lesson sync
  dui.wrapRender(() => {
    lessonDom?.sync();
    // flight message bar
    const fl = D.flight;
    if (fl && D.view === 'fly') {
      fmsg.textContent = fl.msgT > 0 ? fl.msg : '';
      fmsg.classList.toggle('show', fl.msgT > 0 && !!fl.msg);
    } else {
      fmsg.classList.remove('show');
    }
  });

  // initial UI state
  dui.render();
  Progress.set(dr.key, { visited: true });
  window.scrollTo(0, 0);

  // kick the animation loop: poll cheaply, animate while busy
  const gen = DGEN;
  const needs = (): boolean =>
    gen === DGEN &&
    (D.view === 'fly' ||
      !!D.test ||
      D.queue.length > 0 ||
      D.smoke.length > 0 ||
      craftAnimBusy() ||
      Object.values(D.placed).some((p) => (p.leave ? p.t > 0 : p.t < 1)) ||
      D.ex !== D.exT);
  const kick = (): void => {
    if (gen !== DGEN) return;
    if (needs()) {
      dui.animate((dt) => {
        if (gen !== DGEN) return false;
        return dtick(dt);
      });
    }
    setTimeout(kick, 120);
  };
  kick();
}

function selectPart(id: string | null): void {
  D.sel = id;
  AudioSys.sfx('tick');
}
