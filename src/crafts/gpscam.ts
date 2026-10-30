/**
 * Fig. 06 — the GPS camera drone.
 *
 * An F450-class ArduPilot quad built for flying missions, not tricks: a
 * Pixhawk 6C fusing GPS + compass + baro, a 2-axis gimbal with its own IMU
 * slung under the nose, four separate ESCs zip-tied under the arms, a power
 * module that counts real mAh, 915 MHz telemetry with a whip — and the
 * autopilot modes that make it a camera platform: Loiter vs AltHold, RTL,
 * waypoint missions with photo triggers.
 */

import { Vec3, Tone, INK, path3, ink, fillPath, clamp, project, rod3, matOf, CERAMIC, DARK } from '../engine/core';
import { FR, rad } from '../engine/frames';
import type { Frame } from '../engine/frames';
import { obox, ocyl, odisc, otext, tube, glowDot } from '../engine/oshapes';
import { CARBON, PCB, SILK, WIRE, TIN, SLEEVE, GOLD, STRIPE } from '../engine/materials';
import type { CraftRecord, DrawOpt, DrawAdd, Design, CalcOut, FlightState, PhysCtx } from '../types';
import type { StatItem } from '../engine/shell';

/**
 * ArduCopter QuadX motor map (M1 CCW), modelled at 0.75x: the 450 mm
 * wheelbase becomes ±120 mm so 10-inch props (r 91) still fit the mat.
 */
const MPOS: Array<[number, number, string, 'CW' | 'CCW']> = [
  [-120, -120, 'M1', 'CCW'],
  [120, -120, 'M2', 'CW'],
  [-120, 120, 'M3', 'CW'],
  [120, 120, 'M4', 'CCW']
];

/** Home point for the RTL autopilot. A craft's physics hook gets no access
 *  to the world, so RTL flies back to THIS point — it must match `range.pad`
 *  below ([20, 6] on the inspection field). */
const HOME: [number, number] = [20, 6];

/** RTL_ALT 1200 cm: climb to 12 m before turning for home. */
const RTL_ALT = 12;

/** Auto-mission waypoints (m): a 6x6 square north of the pad, flown at 5 m. */
const MISSION: Array<[number, number]> = [
  [20, 14],
  [26, 14],
  [26, 20],
  [20, 20]
];
const MISSION_ALT = 5;

const REDARM: Tone = { l: '#e2483d', m: '#c23830', d: '#7d1f1a' }; // front arms (orientation)
const STRAPTAB: Tone = { l: '#ef6a4c', m: '#cf5038', d: '#4a2219' };
const PIXCASE: Tone = { l: '#4a5056', m: '#34393e', d: '#1f2327' };
const PIXLID: Tone = { l: '#5d646b', m: '#3d434a', d: '#24272c' };
const CAMBODY = matOf('#3a3f44');
const LENSMAT = matOf('#1c1c1e');

/* ------------------------------------------------------------------ */
/* flight-mode latch                                                   */
/* ------------------------------------------------------------------ */

/**
 * The physics hook gets no mode argument — the lab passes the current mode
 * only to ctx.stock — so the craft keeps its own copy of the selection. It
 * is seeded from the ?fly= URL param and updated by watching the Fly-menu
 * chips (mode titles are unique strings). Unrecognised = stock physics;
 * the default is 'loiter', this craft's own default mode.
 */
const MODE_TITLES: Record<string, string> = {
  loiter: 'Loiter (GPS hold)',
  althold: 'AltHold',
  rtl: 'RTL (return home)',
  auto: 'Auto mission'
};
const STOCK_MODE_TITLES = new Set([
  'Altitude hold (easy)',
  'Angle mode',
  'Acro (rate) mode',
  'Gate race'
]);

let apMode = 'loiter';

function reseedApMode(): void {
  apMode = 'loiter';
  if (typeof location === 'undefined') return;
  const q = location.hash.split('?')[1];
  const fly = q ? new URLSearchParams(q).get('fly') : null;
  if (fly) apMode = MODE_TITLES[fly] ? fly : '';
}
reseedApMode();

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  document.addEventListener(
    'click',
    (e) => {
      const chip = (e.target as Element | null)?.closest?.('.chip');
      if (!chip) return;
      const label = (chip.textContent || '').trim();
      if (MODE_TITLES[label]) apMode = MODE_TITLES[label];
      else if (STOCK_MODE_TITLES.has(label) || label.startsWith('Range:')) apMode = '';
    },
    true
  );
  window.addEventListener('hashchange', reseedApMode);
}

/* ------------------------------------------------------------------ */
/* the autopilots (they write ctx.stick as if they were the pilot,     */
/* then the stock multirotor step does the flying)                     */
/* ------------------------------------------------------------------ */

type ApStick = PhysCtx['stick'];

/** Loiter's fake GPS hold: a centred stick commands a brake, not a coast. */
function loiterBrake(fl: FlightState, s: ApStick): void {
  // body-frame velocity from the world velocity + current yaw
  const fwd = fl.vel[0] * Math.cos(fl.yaw) + fl.vel[1] * Math.sin(fl.yaw);
  const left = -fl.vel[0] * Math.sin(fl.yaw) + fl.vel[1] * Math.cos(fl.yaw);
  if (Math.abs(s.pitch) < 0.05) s.pitch = -clamp(fwd * 0.4, -0.6, 0.6);
  if (Math.abs(s.roll) < 0.05) s.roll = -clamp(left * 0.4, -0.6, 0.6);
}

/** Yaw toward (tx, ty), lean forward, hold tz. Returns the distance. */
function navStep(fl: FlightState, s: ApStick, tx: number, ty: number, tz: number, lean: number): number {
  const dx = tx - fl.pos[0];
  const dy = ty - fl.pos[1];
  const dist = Math.hypot(dx, dy);
  const bearing = Math.atan2(dy, dx);
  const off = Math.atan2(Math.sin(fl.yaw - bearing), Math.cos(fl.yaw - bearing));
  s.yaw = clamp(off * 2, -1, 1);
  const face = Math.max(0, Math.cos(off)); // only push once roughly facing
  s.pitch = clamp((lean * face - fl.pitch) * 3, -1, 1);
  s.roll = clamp(-fl.roll * 3, -1, 1);
  s.thr = clamp((tz - fl.pos[2]) * 0.4, -0.35, 0.6);
  return dist;
}

/** RTL state machine: fl.rtl 1 climb, 2 home, 3 land, 4 done. */
function rtlStep(fl: FlightState, s: ApStick, ctx: PhysCtx): void {
  const ph = fl.rtl as number;
  // level + hover by default
  s.roll = clamp(-fl.roll * 3, -1, 1);
  s.pitch = clamp(-fl.pitch * 3, -1, 1);
  s.yaw = 0;
  s.thr = 0;
  s.thrAbs = Math.max(0.1, fl.c.hoverThr);

  const dist = Math.hypot(HOME[0] - fl.pos[0], HOME[1] - fl.pos[1]);

  if (ph === 1) {
    s.thr = fl.pos[2] < RTL_ALT - 0.5 ? 0.7 : 0;
    if (fl.pos[2] >= RTL_ALT - 1) {
      fl.rtl = 2;
      ctx.say('RTL: turning for home');
    }
  } else if (ph === 2) {
    navStep(fl, s, HOME[0], HOME[1], RTL_ALT, 0.3);
    if (dist <= 2.5) {
      fl.rtl = 3;
      ctx.say('RTL: over home — landing');
    }
  } else if (ph === 3) {
    // gentle position hold while coming down
    const fwd = fl.vel[0] * Math.cos(fl.yaw) + fl.vel[1] * Math.sin(fl.yaw);
    const left = -fl.vel[0] * Math.sin(fl.yaw) + fl.vel[1] * Math.cos(fl.yaw);
    s.pitch = clamp(-fwd * 0.25, -0.35, 0.35);
    s.roll = clamp(-left * 0.25, -0.35, 0.35);
    s.thr = fl.pos[2] > 3 ? -0.5 : -0.25; // WPNAV_SPEED_DN, then LAND_SPEED
    if (fl.pos[2] <= 0.15) {
      fl.rtl = 4;
      fl.armed = false;
      ctx.say('RTL complete: landed and disarmed');
    }
  }
}

/** Auto mission: fl.wp 0 takeoff, 1..4 the square, 5 done (hands off to RTL). */
function autoStep(fl: FlightState, s: ApStick, ctx: PhysCtx): void {
  const wp = fl.wp as number;
  // level + hover by default
  s.roll = clamp(-fl.roll * 3, -1, 1);
  s.pitch = clamp(-fl.pitch * 3, -1, 1);
  s.yaw = 0;
  s.thr = 0;
  s.thrAbs = Math.max(0.1, fl.c.hoverThr);

  if (wp === 0) {
    // takeoff to mission altitude, yawing toward wp1 on the way up
    s.thr = fl.pos[2] < MISSION_ALT - 0.4 ? 0.7 : 0;
    const [wx, wy] = MISSION[0];
    const bearing = Math.atan2(wy - fl.pos[1], wx - fl.pos[0]);
    const off = Math.atan2(Math.sin(fl.yaw - bearing), Math.cos(fl.yaw - bearing));
    s.yaw = clamp(off * 2, -1, 1);
    if (fl.pos[2] >= MISSION_ALT - 0.5) {
      fl.wp = 1;
      ctx.say('Waypoint 1 of 4');
    }
  } else {
    const [wx, wy] = MISSION[wp - 1];
    const dist = navStep(fl, s, wx, wy, MISSION_ALT, 0.3);
    if (dist <= 1.5) {
      if (wp < 4) {
        fl.wp = wp + 1;
        ctx.say(`Waypoint ${wp} reached`); // + DO_DIGICAM_CONTROL: photo
      } else {
        fl.wp = 5;
        fl.rtl = 1;
        ctx.say('Mission complete: RTL');
      }
    }
  }
}

/* ------------------------------------------------------------------ */

export const gpscam: CraftRecord = {
  key: 'gpscam',
  fig: 6,
  name: 'GPS camera drone',
  sub: 'ArduPilot, gimbal',
  hint: 'design it, build it — then fly photo missions on autopilot',
  noun: 'camera drone',
  palette: 'mustard',
  log: 'ardupilot',
  mat: 520,
  benchH: 260,
  flyScale: 1.8,
  flyVB: 13000,
  ceiling: 50, // camera ops fly higher
  drag: 0.06,
  hitR: 0.22, // big craft
  kThrust: 4.5, // 2212 920KV on 4S: ~835 g/motor, T:W ~2.1
  gPerW: 9,
  minTW: 1.7,
  maxKvCells: 5000, // 1400KV is a 3S motor: on 4S it cooks the 30 A ESCs
  calLabel: 'Calibrate accelerometer + compass',
  design: { batt: '4s5000', motor: '2212-920', prop: '10x4.5' },

  batts: {
    '4s5000': { name: '4S 5000', cells: 4, mah: 5000, g: 500, price: 55, col: '#2b2a28', lab: '4S 5000' },
    '4s3300': { name: '4S 3300', cells: 4, mah: 3300, g: 340, price: 38, col: '#3a5f3a', lab: '4S 3300' },
    '3s5000': { name: '3S 5000', cells: 3, mah: 5000, g: 410, price: 40, col: '#d9a520', lab: '3S 5000' }
  },
  motors: {
    '2212-920': { name: '2212 920KV', kv: 920, g: 58, price: 18 },
    '2216-880': { name: '2216 880KV', kv: 880, g: 72, price: 24 },
    '2212-1400': { name: '2212 1400KV', kv: 1400, g: 56, price: 16, forCells: 3 }
  },
  props: {
    '10x4.5': { name: '10x4.5 SF', pf: 1.0, eff: 1.0, g: 13, price: 8 },
    '11x4.7': { name: '11x4.7', pf: 1.1, eff: 1.06, g: 16, price: 10 },
    '9.4x5': { name: '9.4x5.0', pf: 0.9, eff: 0.94, g: 11, price: 7 }
  },
  fixed: [
    { id: 'FRAME', name: 'F450 frame + landing gear', g: 330, price: 47, cat: 'Mechanical' },
    { id: 'ESC', name: '4x 30A ESC (on the arms)', g: 112, price: 48, cat: 'Electrical' },
    { id: 'XT60', name: 'power module + XT60', g: 22, price: 18, cat: 'Electrical' },
    { id: 'FC', name: 'Pixhawk 6C', g: 40, price: 165, cat: 'Electrical' },
    { id: 'GPS', name: 'GPS + compass (M10 + RM3100)', g: 52, price: 45, cat: 'Electrical' },
    { id: 'TELEM', name: '915 MHz telemetry radio', g: 24, price: 40, cat: 'Electrical' },
    { id: 'RX', name: 'ELRS 2.4 GHz receiver (backup)', g: 4, price: 18, cat: 'Electrical' },
    { id: 'CAM', name: '2-axis gimbal + camera', g: 190, price: 120, cat: 'Electrical' },
    { id: 'TOP', name: 'top plate + dome', g: 30, price: 8, cat: 'Mechanical' },
    { id: 'STRAP', name: 'battery straps', g: 12, price: 5, cat: 'Mechanical' }
  ],

  parts: [
    {
      id: 'GEAR',
      name: 'Landing gear: 4 legs + 2 skids',
      short: 'GEAR',
      z: 0,
      what: 'Tall gear: the gimbal and the battery hang underneath, so the legs set the ground clearance. Skids are lighter and simpler than retracting legs — until you land on a slope.'
    },
    {
      id: 'FRAME',
      name: 'F450 frame: bottom plate + 4 arms (450 mm wheelbase)',
      short: 'FRAME',
      z: 1,
      after: ['GEAR'],
      what: 'Two plastic plates sandwich four arms, 450 mm motor to motor. The FRONT arms are red with white tips — with a camera at the nose you never have to wonder which way it points.'
    },
    {
      id: 'MOTORS',
      name: '4 brushless motors (2212)',
      short: 'MOTORS',
      z: 2,
      after: ['FRAME'],
      what: '2212 stators swinging 10-inch props at ~13 600 rpm on 4S. Big slow props are why this build hovers at around 9 grams per watt — a freestyle quad manages half that.'
    },
    {
      id: 'ESC',
      name: '4x 30 A ESC, zip-tied under the arms',
      short: 'ESC x4',
      z: 2,
      after: ['FRAME'],
      what: 'Four separate speed controllers in the propwash under the arms. Cheaper to replace one at a time than a 4-in-1 board — and up there they get genuine cooling.'
    },
    {
      id: 'WIRES',
      name: 'Motor wires along the arms',
      short: 'MOTOR WIRES',
      z: 3,
      after: ['MOTORS', 'ESC'],
      what: 'Three wires per motor, routed along the arm to its ESC. Keep them tucked to the arm — a spinning prop will shave a loose wire in seconds.'
    },
    {
      id: 'FC',
      name: 'Pixhawk 6C (ArduPilot)',
      short: 'FLIGHT CTRL',
      z: 4,
      after: ['ESC', 'WIRES'],
      polar: ['arrow forward', 'arrow backward'],
      what: 'Gyro + accelerometer + barometer + compass, fused by the EKF into one attitude and position estimate. The arrow must point at the nose AND agree with the arrow on the GPS puck.'
    },
    {
      id: 'XT60',
      name: 'XT60 lead + power module',
      short: 'XT60 + PM',
      z: 2,
      after: ['ESC'],
      polar: ['stripe to minus', 'stripe to plus'],
      what: 'The power module sits in the battery lead measuring volts AND amps, so ArduPilot counts real mAh instead of guessing from voltage sag. Polarised: the stripe marks minus — backwards, it vents.'
    },
    {
      id: 'CAM',
      name: '2-axis gimbal + camera',
      short: 'GIMBAL',
      z: 5,
      after: ['FRAME'],
      what: 'Brushless roll and tilt motors with the gimbal\u2019s OWN IMU, slung under the nose. It counter-rotates against the airframe, so the footage stays level while the drone banks.'
    },
    {
      id: 'GPS',
      name: 'GPS + compass on the mast',
      short: 'GPS + MAG',
      z: 6,
      after: ['FC'],
      polar: ['arrow forward (matches FC)', 'arrow backwards'],
      what: 'GPS and compass ride 90 mm up a mast: the battery leads push tens of amps past the magnetometer, and their field bends the reading more than you would guess. Distance is the only fix — and the arrow must match the FC arrow, or Loiter toilet-bowls.'
    },
    {
      id: 'RX',
      name: 'ELRS receiver (backup RC)',
      short: 'RECEIVER',
      z: 5,
      after: ['FC'],
      what: 'ExpressLRS on 2.4 GHz as the BACKUP control link. The primary rides the 915 MHz telemetry channel — two independent radios, so losing either one is a non-event.'
    },
    {
      id: 'TELEM',
      name: '915 MHz telemetry radio + whip',
      short: 'TELEMETRY',
      z: 5,
      after: ['FC'],
      what: 'MAVLink to the ground station: position, battery, mission progress — and it can carry control too. The whip is a quarter-wave antenna: keep it vertical and clear of carbon.'
    },
    {
      id: 'TOP',
      name: 'Top plate + dome',
      short: 'TOP PLATE',
      z: 6,
      after: ['FC', 'RX', 'TELEM'],
      what: 'The top plate stiffens the stack into a sandwich and the dome sheds rain. GPS mast, telemetry whip and receiver all live up here, in clean sky away from the power wiring.'
    },
    {
      id: 'BATT',
      name: '4S battery + strap (underslung)',
      short: 'BATTERY',
      z: 7,
      after: ['GEAR', 'XT60'],
      what: 'The pack hangs between the gear under the frame: low centre of gravity, and it swaps without tools. It must sit centred — a nose-heavy camera drone fights its own gimbal.'
    },
    {
      id: 'PROPS',
      name: 'Propellers (10x4.5 slow-fly)',
      short: 'PROPS',
      z: 8,
      after: ['MOTORS', 'TOP'],
      polar: ['CW/CCW per motor map', 'two swapped'],
      what: 'Two fat blades, 10 inches, floppy on purpose. Spin directions must match the ArduCopter motor map — M1 is CCW here. They go on LAST: a motor test with props on throws the quad at your face.'
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

    /* ---- landing gear: 4 angled legs + 2 skids ---- */
    if (has('GEAR')) {
      const F = U('GEAR');
      let svg = '';
      for (const sy of [-1, 1]) {
        svg += rod3([-70, 55 * sy, 3.5], [70, 55 * sy, 3.5], 3.5, CERAMIC, 1);
        for (const sx of [-1, 1]) {
          svg += rod3([46 * sx, 55 * sy, 7], [27 * sx, 27 * sy, 46], 3, CERAMIC, 0.9);
        }
      }
      add([0, 0, 12], svg, 'GEAR');
    }

    /* ---- frame: bottom plate + 4 arms, front pair red with white tips ---- */
    if (has('FRAME')) {
      const F = U('FRAME');
      let svg = ocyl(F, 78, 46, 49, DARK, 1, 28).svg;
      for (const [mx, my] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1]
      ]) {
        const A = FR.Rz(F, rad((Math.atan2(my, mx) * 180) / Math.PI));
        const front = mx > 0; // nose is +x: the camera + gimbal live there
        svg += obox(A, 58, 172, -9, 9, 46, 54, front ? REDARM : CERAMIC, 0.9).svg;
        if (front) svg += obox(A, 148, 171, -9.6, 9.6, 45.7, 54.3, CERAMIC, 0.7).svg;
      }
      add([0, 0, 50], svg, 'FRAME');
    }

    /* ---- motors: 2212 with big bells ---- */
    if (has('MOTORS')) {
      const F = U('MOTORS');
      MPOS.forEach(([mx, my], i) => {
        const M = FR.T(F, mx, my, 0);
        let svg = ocyl(M, 16, 54, 62, CARBON, 1, 16).svg;
        svg += ocyl(M, 17, 62, 78, m, 1, 16).svg;
        const spin = opt.spin[i] || 0;
        for (let b = 0; b < 3; b++) {
          const a = spin * (i % 2 ? -1 : 1) + (b * Math.PI * 2) / 3;
          svg += odisc(M, 3, 78.5, INK, 0, 8, Math.cos(a) * 9, Math.sin(a) * 9);
        }
        svg += ocyl(M, 2.4, 78, 83, TIN, 0.7, 10).svg;
        add([mx, my, 68], svg, 'MOTORS');
      });
    }

    /* ---- 4 separate ESCs zip-tied under the arms ---- */
    if (has('ESC')) {
      const F = U('ESC');
      MPOS.forEach(([mx, my], i) => {
        const A = FR.Rz(F, rad((Math.atan2(my, mx) * 180) / Math.PI));
        let svg = obox(A, 96, 128, -10, 10, 37, 45, DARK, 0.8).svg;
        if (i === 1) svg += otext(A, 112, 0, 45.4, '30A', 6, SILK);
        add([mx * 0.66, my * 0.66, 41], svg, 'ESC');
      });
    }

    /* ---- motor wires ---- */
    if (has('WIRES')) {
      const F = U('WIRES');
      let svg = '';
      MPOS.forEach(([mx, my], i) => {
        const a: Vec3 = FR.pt(F, [mx * 0.78, my * 0.78, 44]);
        const b: Vec3 = FR.pt(F, [mx * 0.955, my * 0.955, 53]);
        const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 48.5];
        svg += tube([a, mid, b], 1.1, i % 2 ? WIRE.org : WIRE.blu);
      });
      add([0, 0, 48], svg, 'WIRES');
    }

    /* ---- Pixhawk 6C in its case (polar arrow) ---- */
    if (has('FC')) {
      const F = U('FC');
      let svg = obox(F, -25, 25, -25, 25, 51, 70.5, PIXCASE, 0.9).svg;
      svg += obox(F, -28, 28, -28, 28, 70.5, 73.5, PIXLID, 0.8).svg;
      // arrow on the lid (visible until the top plate goes on)
      const flip = orient('FC') ? -1 : 1;
      const pts: Vec3[] = [
        FR.pt(F, [20 * flip, 8, 73.9]),
        FR.pt(F, [8 * flip, 14, 73.9]),
        FR.pt(F, [8 * flip, 2, 73.9])
      ];
      svg += fillPath(path3(pts), SILK) + ink(path3(pts), 0.7);
      // name on the side face, readable with the top plate on
      const G = FR.Rx(F, rad(90));
      svg += otext(G, -2, 60, -25.4, 'PIXHAWK', 6.5, SILK);
      svg += otext(G, 10, 57, -25.4, '6C', 5, SILK);
      if (opt.power) {
        svg += odisc(F, 2.5, 73.8, '#3e86d9', 0, 10, -20, -20);
        svg += glowDot(FR.pt(F, [-20, -20, 74]), '#3e86d9', 6);
      }
      add([0, 0, 62], svg, 'FC');
    }

    /* ---- XT60 lead + power module (polar stripe) ---- */
    if (has('XT60')) {
      const F = U('XT60');
      let svg = '';
      svg += tube([FR.pt(F, [-66, 5, 57]), FR.pt(F, [-152, 10, 50])], 1.4, WIRE.red);
      svg += tube([FR.pt(F, [-66, -5, 57]), FR.pt(F, [-152, -10, 50])], 1.4, WIRE.blk);
      // the PM box on the lead (burnt when the bench fault fires)
      const pmMat = opt.fault ? ({ l: '#7a6a5a', m: '#5d5145', d: '#3d352c' } as Tone) : SLEEVE;
      svg += obox(F, -112, -84, -13, 13, 46, 62, pmMat, 0.9).svg;
      svg += obox(F, -108, -88, -6, 6, 62, 65, TIN, 0.6).svg; // 6-pin header
      const stripeY = orient('XT60') ? -13.6 : 11.9;
      svg += obox(F, -110, -86, stripeY, stripeY + 1.7, 47, 61, STRIPE, 0.5).svg;
      // V + I sense up to the FC
      svg += tube([FR.pt(F, [-95, 12, 62]), FR.pt(F, [-45, 22, 63]), FR.pt(F, [-27, 18, 60])], 0.8, WIRE.blu);
      svg += obox(F, -166, -152, -6, 6, 46, 58, GOLD, 0.9).svg;
      add([-110, 0, 55], svg, 'XT60');
    }

    /* ---- gimbal + camera: slung under the nose, level ALWAYS ---- */
    if (has('CAM')) {
      // the gimbal has its own IMU: in flight it follows yaw only, so build a
      // level sub-frame at the craft origin (scaled like the craft frame)
      const F = opt.fl ? FR.S(FR.Rz(FR.I(f.o[0], f.o[1], f.o[2]), opt.fl.yaw), opt.k) : U('CAM');
      let svg = '';
      svg += rod3([56, 0, 46], [56, 0, 33], 2.5, CARBON, 0.9); // mount arm
      svg += rod3([56, -14, 31], [56, 14, 31], 6, DARK, 0.9); // roll motor
      svg += rod3([56, -13, 29], [56, -13, 16], 2, TIN, 0.7); // yoke arms
      svg += rod3([56, 13, 29], [56, 13, 16], 2, TIN, 0.7);
      svg += rod3([56, 13, 22], [56, 17.5, 22], 5.5, DARK, 0.9); // tilt motor
      svg += obox(F, 44, 68, -10, 10, 12, 28, CAMBODY, 0.9).svg; // camera
      svg += rod3([68, 0, 20], [78, 0, 20], 5.5, CARBON, 0.9); // lens
      svg += rod3([76, 0, 20], [79.5, 0, 20], 4, LENSMAT, 0.7); // glass
      add([56, 0, 24], svg, 'CAM');
    }

    /* ---- GPS + compass on the mast (polar arrow) ---- */
    if (has('GPS')) {
      const F = U('GPS');
      let svg = ocyl(F, 3, 54, 144, CARBON, 0.9, 10, -52, 52).svg;
      svg += ocyl(F, 16, 144, 151, CERAMIC, 1, 20, -52, 52).svg;
      svg += odisc(F, 6.5, 151.2, '#20262b', 0.4, 14, -49, 52); // the patch
      const flip = orient('GPS') ? -1 : 1;
      const pts: Vec3[] = [
        FR.pt(F, [-52 + 9 * flip, 52, 151.6]),
        FR.pt(F, [-52 - 3 * flip, 56.5, 151.6]),
        FR.pt(F, [-52 - 3 * flip, 47.5, 151.6])
      ];
      svg += fillPath(path3(pts), SILK) + ink(path3(pts), 0.7);
      add([-52, 52, 148], svg, 'GPS');
    }

    /* ---- ELRS backup receiver ---- */
    if (has('RX')) {
      const F = U('RX');
      let svg = obox(F, -28, -16, -36, -28, 77, 80.5, PCB, 0.7).svg;
      svg += tube([FR.pt(F, [-22, -32, 80.5]), FR.pt(F, [-22, -32, 99])], 0.7, WIRE.wht);
      svg += tube([FR.pt(F, [-22, -32, 80.5]), FR.pt(F, [-40, -32, 87])], 0.7, WIRE.wht);
      add([-22, -32, 84], svg, 'RX');
    }

    /* ---- 915 MHz telemetry radio + whip ---- */
    if (has('TELEM')) {
      const F = U('TELEM');
      let svg = obox(F, 10, 26, -36, -24, 77, 85, PCB, 0.8).svg;
      svg += obox(F, 14, 22, -32, -28, 85, 88, TIN, 0.6).svg; // shield can
      svg += tube([FR.pt(F, [18, -30, 88]), FR.pt(F, [18, -30, 148])], 1.5, WIRE.blk);
      svg += odisc(F, 1.4, 148.5, '#ece6d6', 0.4, 10, 18, -30);
      if (opt.power) {
        svg += odisc(F, 2, 85.2, '#43b05c', 0, 10, 12, -26);
        svg += glowDot(FR.pt(F, [12, -26, 85.5]), '#43b05c', 5);
      }
      add([18, -30, 100], svg, 'TELEM');
    }

    /* ---- top plate + dome ---- */
    if (has('TOP')) {
      const F = U('TOP');
      let svg = '';
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1]
      ]) {
        svg += ocyl(F, 2.6, 49, 74, TIN, 0.8, 10, 38 * sx, 38 * sy).svg;
      }
      svg += ocyl(F, 60, 74, 77, DARK, 1, 26).svg;
      svg += ocyl(F, 32, 77, 89, m, 1, 22, 0, 0, 13).svg; // the dome
      add([0, 0, 78], svg, 'TOP');
    }

    /* ---- underslung battery + strap ---- */
    if (has('BATT')) {
      const F = U('BATT');
      const key = (opt.design as { batt: string }).batt;
      const B = gpscam.batts[key] ?? gpscam.batts['4s5000'];
      let svg = obox(F, -35, 35, -17.5, 17.5, 9, 44, matOf(B.col ?? '#2b2a28'), 1).svg;
      svg += obox(F, -8, 8, -19, 19, 8, 45, STRAPTAB, 0.8).svg;
      const G = FR.Rx(F, rad(90)); // label on the visible left face
      svg += otext(G, 0, 27, -17.8, B.lab ?? '4S 5000', 8, SILK);
      if (opt.plugged && has('XT60')) {
        svg += tube([FR.pt(F, [-32, 6, 40]), FR.pt(F, [-90, 9, 55]), FR.pt(F, [-102, 9, 54])], 1.4, WIRE.red);
        svg += tube([FR.pt(F, [-32, -6, 40]), FR.pt(F, [-90, -9, 55]), FR.pt(F, [-102, -9, 54])], 1.4, WIRE.blk);
      }
      add([0, 0, 26], svg, 'BATT');
    }

    /* ---- 10" slow-fly props ---- */
    if (has('PROPS') && !opt.broken) {
      const F = U('PROPS');
      const swapped = orient('PROPS') === 1;
      MPOS.forEach(([mx, my, _id, dir], i) => {
        const ccw = (dir === 'CCW') !== swapped;
        const P = FR.T(F, mx, my, 82);
        const rate = opt.rpm[i] || 0;
        if (rate > 0.12) {
          // prop blur disc
          const c = project(FR.pt(P, [0, 0, 0]));
          add(
            [mx, my, 84],
            `<circle cx="${c[0].toFixed(1)}" cy="${c[1].toFixed(1)}" r="${(91 * opt.k).toFixed(0)}" fill="#fff" opacity="${(0.16 + 0.2 * rate).toFixed(2)}"/>`,
            'PROPS'
          );
        } else {
          let svg = '';
          const spin = opt.spin[i] || 0;
          for (let b = 0; b < 2; b++) {
            const a = spin * (ccw ? -1 : 1) + b * Math.PI;
            const B = FR.Rz(FR.T(P, 0, 0, 0), a);
            const bladeF = FR.Rx(B, ccw ? rad(9) : rad(-9));
            svg += obox(bladeF, 12, 86, -5.2, 5.2, -0.8, 0.8, CARBON, 0.7).svg;
            svg += odisc(B, 5.2, 0.9, CARBON.l, 0, 14, 85, 0); // rounded tip
          }
          svg += ocyl(P, 6.5, -1, 2.5, CARBON, 0.8, 10).svg;
          add([mx, my, 84], svg, 'PROPS');
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
      pts.push(FR.pt(f, [70 * sx, 55 * sy, 0])); // skid ends
      pts.push(FR.pt(f, [184 * sx, 184 * sy, 82])); // prop tips
    }
    pts.push(FR.pt(f, [-52, 52, 151])); // GPS puck
    return pts;
  },

  tags: [
    ['GPS', [-52, 52, 152], -48, -44],
    ['FC', [26, 12, 74], 46, -46],
    ['CAM', [74, 0, 22], 44, 26],
    ['XT60', [-128, 0, 56], -48, 26],
    ['BATT', [6, 19, 28], -22, 48],
    ['TELEM', [18, -30, 122], 46, -30],
    ['ESC', [82, -82, 41], 42, 24]
  ],

  /* ---------------------------------------------------------------- */
  /* wiring                                                           */
  /* ---------------------------------------------------------------- */

  wiring: {
    nodes(d, c) {
      void d;
      return {
        BATT: [20, 238, 'BATTERY', (c.battName as string) || '4S 5000', '#e2483d'],
        XT60: [190, 238, 'POWER MODULE', 'V + I sense, XT60', '#e2483d'],
        ESC: [360, 238, 'ESC x4', '30 A, on the arms', '#e2483d'],
        MOTORS: [600, 238, 'MOTORS x4', (c.motorName as string) || '2212 920KV', '#f08a2b'],
        GPS: [140, 70, 'GPS + COMPASS', 'M10 + RM3100, mast', '#3e86d9'],
        TELEM: [140, 152, 'TELEMETRY', '915 MHz MAVLink', '#8c4bd1'],
        FC: [360, 111, 'PIXHAWK 6C', 'ArduPilot + EKF', '#3e86d9'],
        RX: [580, 70, 'RECEIVER', 'ELRS 2.4 (backup)', '#8c4bd1'],
        CAM: [580, 152, 'GIMBAL + CAM', '2-axis, own IMU', '#43a35a']
      };
    },
    links: [
      { from: 'BATT', to: 'XT60', kind: 'power', label: 'XT60' },
      { from: 'XT60', to: 'ESC', kind: 'power', label: 'VBAT + GND' },
      { from: 'ESC', to: 'MOTORS', kind: 'motor', label: '3-phase x4' },
      { from: 'XT60', to: 'FC', kind: 'power', label: 'PM: 5.3 V + I2C' },
      { from: 'FC', to: 'GPS', kind: 'i2c', label: 'GPS + compass' },
      { from: 'FC', to: 'TELEM', kind: 'data', label: 'MAVLink 915' },
      { from: 'FC', to: 'RX', kind: 'data', label: 'ELRS (backup)' },
      { from: 'FC', to: 'CAM', kind: 'data', label: 'gimbal control + PWM' }
    ]
  },

  /* ---------------------------------------------------------------- */
  /* content                                                          */
  /* ---------------------------------------------------------------- */

  overview: `<p>Camera drones fly missions, not tricks. This is an F450-class quad with a Pixhawk 6C running ArduPilot: GPS, compass and barometer fused by the EKF into one position estimate — and a flight computer that can hold that position, fly itself home, or fly a whole waypoint mission while you work the camera.</p>
<p>Loiter and AltHold feel the same until you let go of the sticks. Loiter brakes and holds its GPS position; AltHold only holds altitude, so it drifts downwind until you fly it back — that difference is the whole lesson. The compass lives on a mast because the battery leads push tens of amps past it: their magnetic field bends the reading by more than the earth&rsquo;s entire field, and centimetres of distance are the only fix. The gimbal has its OWN IMU and counter-rotates against the airframe, so the footage stays level while the drone banks. And the power module measures real amps, so the battery percentage is counted mAh, not a guess from voltage sag.</p>
<p>RTL climbs to 12 m before turning for home — so the return path clears the trees you flew out over. Auto missions chain waypoints with camera triggers (DO_DIGICAM_CONTROL): fly the square, take the photos at each corner, come home and land.</p>`,

  buildCode: `# after the build, in Mission Planner / QGC parameters:
param set INS_ACCEL_FILTER 20
param set ATC_INPUT_TC 0.2      # smooth sticks
param set MOT_THST_EXPO 0.65    # big slow props
param set WPNAV_SPEED 500       # cm/s cruise
param set RTL_ALT 1200          # cm
param set COMPASS_MOT_ESTM 4    # compass calibration w/ motors
param set BTN_ENABLE 1          # safety switch`,

  cliName: 'ArduPilot',
  logName: 'MAVLink',

  quiz: [
    {
      q: 'Loiter vs AltHold?',
      a: [
        'Same thing, different name',
        'Loiter holds position with GPS + braking; AltHold only holds altitude and drifts',
        'AltHold is safer'
      ],
      ok: 1
    },
    {
      q: 'Why is the GPS+compass on a mast?',
      a: [
        'Better view of the sky + away from battery currents that bend the magnetometer',
        'To look cool',
        'Weight balance'
      ],
      ok: 0
    },
    {
      q: 'The gimbal has its own IMU so...',
      a: ['It costs more', 'It counter-rotates: footage stays level while the drone banks', 'It flies faster'],
      ok: 1
    },
    {
      q: 'RTL climbs to 12 m first because...',
      a: ['Battery law', 'So the return path clears trees and buildings', 'Faster cruise'],
      ok: 1
    }
  ],

  practice: 'Fly the inspection photo points in loiter, then in AltHold: feel the drift. Then run the Auto mission and watch the log.',

  /* ---------------------------------------------------------------- */
  /* flight                                                           */
  /* ---------------------------------------------------------------- */

  modes: {
    loiter: {
      title: 'Loiter (GPS hold)',
      code: 'param set LOIT_SPEED 1250\nparam set LOIT_ACC_MAX 250',
      hint: 'GPS + baro hold: sticks command velocity, release = brake + hold',
      alt: true
    },
    althold: {
      title: 'AltHold',
      code: 'param set PILOT_SPEED_UP 250',
      hint: 'Baro only: no GPS, drifts with the wind',
      alt: true
    },
    rtl: {
      title: 'RTL (return home)',
      code: 'param set RTL_ALT 1200  # cm!\nparam set RTL_LOIT_TIME 5',
      hint: 'Fly anywhere, then press Space: climb to 12 m, fly home, land, disarm',
      alt: true
    },
    auto: {
      title: 'Auto mission',
      code: 'param set WPNAV_SPEED 500\n# 4-waypoint square + photos (see the log)',
      hint: 'Arm and step back: takeoff, square, photos, RTL',
      alt: true
    }
  },

  mode: 'loiter',

  /** Stock model, but camera duty is gentle: ~70 % of hover current. */
  calc(d: Design): CalcOut {
    const batt = gpscam.batts[d.batt] ?? Object.values(gpscam.batts)[0];
    const motor = gpscam.motors[d.motor] ?? Object.values(gpscam.motors)[0];
    const prop = gpscam.props[d.prop] ?? Object.values(gpscam.props)[0];
    const n = gpscam.mpos.length;

    const V = batt.cells * 3.7;
    const krpm = (motor.kv * V) / 1000;
    const thrust = gpscam.kThrust * prop.pf * krpm * krpm; // grams per motor
    const auw = gpscam.fixed.reduce((s, fx) => s + fx.g, 0) + n * motor.g + n * prop.g + batt.g;
    const tw = (n * thrust) / auw;
    const hoverW = auw / (gpscam.gPerW * prop.eff);
    const hoverA = hoverW / V;
    const hoverMin = ((batt.mah / 1000) * 0.8) / hoverA * 60;
    const flyMin = hoverMin * 0.7; // inspection duty: hover + slow transits
    const maxA = (n * thrust) / (2 * prop.eff) / V;
    const over = motor.kv * batt.cells > (gpscam.maxKvCells ?? 12075);
    const weak = tw < (gpscam.minTW ?? 5);
    const hoverThr = Math.sqrt(auw / (n * thrust));

    let costE = 0;
    let costM = 0;
    let nElect = 0;
    let nMech = 0;
    for (const fx of gpscam.fixed) {
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
      cruise: 18 // km/h, WPNAV_SPEED 500 cm/s
    };
  },

  calcRows(c: CalcOut): StatItem[] {
    const cruise = (c.cruise as number) ?? 18;
    return [
      { label: 'All-up weight', value: `${Math.round(c.auw)} g` },
      { label: 'Thrust : weight', value: `${c.tw.toFixed(1)} : 1` },
      { label: 'Hover throttle', value: `${Math.round(c.hoverThr * 100)} %` },
      { label: 'Max current', value: `${Math.round(c.maxA)} A` },
      { label: 'Inspection time', value: `${c.flyMin.toFixed(1)} min` },
      { label: 'Mission cruise', value: `${cruise} km/h` }
    ];
  },

  warnings(d: Design, c: CalcOut): string[] {
    const out: string[] = [];
    if (d.prop === '11x4.7' && c.maxA > 110) {
      out.push(
        `11-inch props pull ~${Math.round(c.maxA / 4)} A per ESC at full throttle — right at the 30 A limit. Camera drones rarely see full throttle, but check the ESC temps.`
      );
    }
    return out;
  },

  /**
   * Stock multirotor step, plus the ArduPilot layer:
   * - loiter: centred sticks command an active brake (GPS hold)
   * - althold: plain stock — no braking, it drifts (the lesson)
   * - rtl: Space in flight starts the return: climb 12 m -> home -> land
   * - auto: arming starts the mission: takeoff -> 4-waypoint square -> RTL
   */
  physics(fl: FlightState, dt: number, ctx: PhysCtx): void {
    const s = ctx.stick;

    if (fl.crashed) {
      fl.rtl = 0;
      fl.wp = 5; // mission aborted
    } else {
      // a finished RTL + a fresh arm on the ground: clear the tile
      if (typeof fl.rtl === 'number' && fl.rtl >= 4 && fl.armed && fl.pos[2] <= 0.05) fl.rtl = 0;

      // RTL mode: the disarm key in flight IS the mode switch
      if (
        apMode === 'rtl' &&
        !fl.armed &&
        fl.pos[2] > 0.5 &&
        (typeof fl.rtl !== 'number' || fl.rtl === 0 || fl.rtl >= 4)
      ) {
        fl.armed = true;
        fl.rtl = 1;
        ctx.say('RTL: climb to 12 m');
      }

      // AUTO mode: arming starts the mission
      if (apMode === 'auto' && fl.armed && typeof fl.wp !== 'number') {
        fl.wp = 0;
        ctx.say('AUTO: takeoff to 5 m');
      }

      const rtlRun = typeof fl.rtl === 'number' && fl.rtl >= 1 && fl.rtl <= 3 && fl.armed;
      const autoRun = !rtlRun && apMode === 'auto' && typeof fl.wp === 'number' && fl.wp >= 0 && fl.wp <= 4 && fl.armed;

      if (rtlRun) {
        rtlStep(fl, s, ctx);
      } else if (autoRun) {
        autoStep(fl, s, ctx);
      } else if (fl.armed && (apMode === 'loiter' || apMode === 'rtl')) {
        loiterBrake(fl, s);
      }
    }

    ctx.stock(fl, dt);
  },

  flyStats(fl: FlightState): StatItem[] {
    const rtl = typeof fl.rtl === 'number' ? fl.rtl : 0;
    if (rtl >= 1) {
      const dist = Math.hypot(HOME[0] - fl.pos[0], HOME[1] - fl.pos[1]);
      const phase = rtl === 1 ? 'CLIMB' : rtl === 2 ? 'HOME' : rtl === 3 ? 'LAND' : 'LANDED';
      return [
        { label: 'RTL', value: phase, small: true },
        { label: 'Home', value: `${Math.round(dist)} m` }
      ];
    }
    const wp = fl.wp;
    if (typeof wp === 'number' && wp >= 0 && wp <= 4) {
      const [wx, wy] = MISSION[Math.max(0, wp - 1)];
      const dist = Math.hypot(wx - fl.pos[0], wy - fl.pos[1]);
      return [
        { label: 'Mission', value: wp === 0 ? 'TAKEOFF' : `WP ${wp}/4`, small: true },
        { label: 'To WP', value: `${Math.round(dist)} m` }
      ];
    }
    return [];
  },

  range: {
    title: 'Roof + tower inspection',
    brief: 'Photograph the house roof, the cell tower, the barn ridge and the solar array — the gimbal stays level, you just fly.',
    field: 45,
    pad: [20, 6], // must match HOME above
    ground: '#d3dcc6',
    keepGates: false,
    alt: true,
    camTilt: 10,
    prims: [
      // the house under inspection
      { t: 'house', x: 12, y: 14, w: 9, d: 7, h: 4 },
      // the barn
      { t: 'house', x: 32, y: 30, w: 6, d: 8, h: 5, col: '#b05a4a', roofCol: '#8a4a3a' },
      // cell tower: 18 m mast, three crossarms, a sector panel, a beacon
      { t: 'pole', x: 36, y: 10, h: 18, r: 0.14, col: '#8a8f93' },
      { t: 'box', x: 36, y: 10, z: 13.4, w: 4.2, d: 0.34, h: 0.34, col: '#8a8f93' },
      { t: 'box', x: 36, y: 10, z: 15.4, w: 3.4, d: 0.34, h: 0.34, col: '#8a8f93' },
      { t: 'box', x: 36, y: 10, z: 17.4, w: 2.6, d: 0.34, h: 0.34, col: '#8a8f93' },
      { t: 'box', x: 36, y: 10, z: 12, w: 1.1, d: 0.24, h: 1.7, col: '#3a5f8a' },
      { t: 'cyl', x: 36, y: 10, z: 18.2, r: 0.18, h: 0.5, col: '#e2483d' },
      // parking lot + four cars
      { t: 'flat', x: 25, y: 20, w: 8, d: 6, col: '#c9c4b4', label: 'LOT' },
      { t: 'box', x: 23, y: 18.6, w: 1.7, d: 3.4, h: 1.25, col: '#c23830' },
      { t: 'box', x: 25.4, y: 18.6, w: 1.7, d: 3.4, h: 1.25, col: '#33589a' },
      { t: 'box', x: 23, y: 21.4, w: 1.7, d: 3.4, h: 1.25, col: '#e8e3d0' },
      { t: 'box', x: 25.4, y: 21.4, w: 1.7, d: 3.4, h: 1.25, col: '#4a5056' },
      // solar array: two dark ground panels
      { t: 'flat', x: 8, y: 30, w: 3, d: 5, col: '#3a5f8a' },
      { t: 'flat', x: 11.2, y: 30, w: 3, d: 5, col: '#3a5f8a' },
      // fence along the north edge
      { t: 'pole', x: 8, y: 42, h: 1.3, r: 0.06, col: '#9c7a58' },
      { t: 'pole', x: 14, y: 42, h: 1.3, r: 0.06, col: '#9c7a58' },
      { t: 'pole', x: 20, y: 42, h: 1.3, r: 0.06, col: '#9c7a58' },
      { t: 'pole', x: 26, y: 42, h: 1.3, r: 0.06, col: '#9c7a58' },
      { t: 'pole', x: 32, y: 42, h: 1.3, r: 0.06, col: '#9c7a58' },
      { t: 'box', x: 20, y: 42, z: 0.55, w: 25, d: 0.09, h: 0.09, col: '#9c7a58' },
      { t: 'box', x: 20, y: 42, z: 1.05, w: 25, d: 0.09, h: 0.09, col: '#9c7a58' },
      // trees
      { t: 'tree', x: 5, y: 12, h: 6 },
      { t: 'tree', x: 28, y: 5, h: 7 },
      { t: 'tree', x: 6, y: 22, h: 5 },
      { t: 'tree', x: 16, y: 35, h: 5 },
      { t: 'tree', x: 41, y: 24, h: 6 },
      { t: 'tree', x: 38, y: 38, h: 5 }
    ],
    goals: [
      { x: 12, y: 14, z: 5.5, r: 2, label: 'HOUSE TOP' },
      { x: 36, y: 10, z: 17, r: 2.5, label: 'TOWER TOP' },
      { x: 32, y: 30, z: 6, r: 2, label: 'BARN RIDGE' },
      { x: 8, y: 30, z: 3, r: 2, label: 'SOLAR ARRAY' },
      { x: 20, y: 6, z: 1, r: 2, label: 'HOME' }
    ]
  }
};
