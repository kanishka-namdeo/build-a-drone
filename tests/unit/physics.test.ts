import { describe, it, expect } from 'vitest';
import { multirotorStep, newFlight, windAt, type PhysHooks } from '../../src/flight/physics';
import { buildWorld, collideAt, goalCheck, gateCheck } from '../../src/flight/world';
import type { FlightState, CraftRecord, CalcOut } from '../../src/types';

const craft: CraftRecord = {
  key: 't',
  fig: 1,
  name: 't',
  sub: '',
  palette: 'mustard',
  log: 'betaflight',
  kThrust: 1,
  gPerW: 5,
  mpos: [
    [1, 1, 'M1', 'CW'],
    [1, 1, 'M2', 'CCW'],
    [1, 1, 'M3', 'CCW'],
    [1, 1, 'M4', 'CW']
  ],
  batts: {},
  motors: {},
  props: {},
  fixed: [],
  parts: [],
  draw: () => {},
  hull: () => [],
  wiring: { nodes: () => ({}), links: [] },
  overview: '',
  buildCode: '',
  quiz: []
} as unknown as CraftRecord;

const calc: CalcOut = {
  V: 22.2,
  krpm: 38.85,
  thrust: 1600,
  auw: 514,
  tw: 12.5,
  hoverW: 95,
  hoverA: 4.3,
  hoverMin: 12.3,
  flyMin: 5.2,
  maxA: 144,
  over: false,
  weak: false,
  hoverThr: 0.28,
  cost: { Electrical: 0, Mechanical: 0, Total: 0 },
  nElect: 0,
  nMech: 0,
  n: 4,
  cells: 6,
  mah: 1100
};

const world = buildWorld({ title: 'T', brief: 'b', field: 30 });

const hooks = (over: Partial<PhysHooks> = {}): PhysHooks => ({
  craft,
  world,
  say: () => {},
  onCrash: () => {},
  onLap: () => {},
  onRun: () => {},
  fcReversed: () => false,
  propsSwapped: () => false,
  motorChecked: () => true,
  accOk: () => true,
  wind: () => false,
  ...over
});

const stick = { thr: 0, thrAbs: 0, yaw: 0, pitch: 0, roll: 0 };

describe('multirotor physics', () => {
  it('holds still on the pad when disarmed', () => {
    const fl = newFlight(calc, [15, 15], 4, 6);
    for (let i = 0; i < 60; i++) multirotorStep(fl, 0.01, stick, {}, hooks());
    expect(fl.pos).toEqual([15, 15, 0]);
    expect(fl.armed).toBe(false);
  });

  it('thrust is straight up when level: no lateral drift', () => {
    const fl = newFlight(calc, [15, 15], 4, 6);
    fl.armed = true;
    fl.pos[2] = 2; // airborne
    for (let i = 0; i < 100; i++) {
      multirotorStep(fl, 0.01, { ...stick, thr: 0.02 }, { alt: true }, hooks());
    }
    // a level quad in alt-hold with a small climb request must not translate
    expect(Math.abs(fl.pos[0] - 15)).toBeLessThan(0.3);
    expect(Math.abs(fl.pos[1] - 15)).toBeLessThan(0.3);
  });

  it('climbs in altitude-hold when W is held', () => {
    const fl = newFlight(calc, [15, 15], 4, 6);
    fl.armed = true;
    for (let i = 0; i < 200; i++) {
      multirotorStep(fl, 0.01, { ...stick, thr: 1 }, { alt: true }, hooks());
    }
    expect(fl.pos[2]).toBeGreaterThan(1);
    expect(fl.pos[2]).toBeLessThan(12.5); // soft ceiling
  });

  it('respects the soft geofence ceiling', () => {
    const fl = newFlight(calc, [15, 15], 4, 6);
    fl.armed = true;
    for (let i = 0; i < 3000; i++) {
      multirotorStep(fl, 0.01, { ...stick, thr: 1 }, { alt: true }, hooks());
    }
    expect(fl.pos[2]).toBeLessThanOrEqual(12.01);
  });

  it('crashes on hard ground impact', () => {
    const fl = newFlight(calc, [15, 15], 4, 6);
    fl.armed = true;
    fl.pos[2] = 10;
    fl.vel[2] = -8;
    let crashed = false;
    const h = hooks({ onCrash: () => (crashed = true) });
    for (let i = 0; i < 200; i++) multirotorStep(fl, 0.01, stick, {}, h);
    expect(crashed).toBe(true);
    expect(fl.crashed).toBe(true);
  });

  it('flips on take-off when the FC arrow is backwards', () => {
    const fl = newFlight(calc, [15, 15], 4, 6);
    fl.armed = true;
    const h = hooks({ fcReversed: () => true });
    for (let i = 0; i < 100; i++) multirotorStep(fl, 0.01, { ...stick, thr: 0.8 }, { alt: true }, h);
    expect(fl.crashed).toBe(true);
    expect(fl.flipWhy).toMatch(/arrow points backwards/);
  });

  it('drifts when the accelerometer was never calibrated (angle modes)', () => {
    const fl = newFlight(calc, [15, 15], 4, 6);
    fl.armed = true;
    fl.pos[2] = 2;
    const h = hooks({ accOk: () => false });
    for (let i = 0; i < 200; i++) multirotorStep(fl, 0.01, { ...stick, thr: 0.02 }, { alt: true }, h);
    // a small persistent bank from the bad level reference translates the quad
    expect(Math.hypot(fl.pos[0] - 15, fl.pos[1] - 15)).toBeGreaterThan(0.3);
  });

  it('drains the battery and warns at 3.5 V/cell', () => {
    const fl = newFlight(calc, [15, 15], 4, 6);
    fl.armed = true;
    fl.pos[2] = 2;
    const msgs: string[] = [];
    const h = hooks({ say: (m) => msgs.push(m) });
    for (let i = 0; i < 90000; i++) {
      multirotorStep(fl, 0.01, { ...stick, thr: 0.6 }, { alt: true }, h);
    }
    expect(fl.used).toBeGreaterThan(500);
    expect(msgs.some((m) => /LOW BATTERY/.test(m))).toBe(true);
  });

  it('battery cuts out at 3.2 V/cell (forced disarm)', () => {
    const fl = newFlight(calc, [15, 15], 4, 6);
    fl.armed = true;
    fl.pos[2] = 2;
    const h = hooks();
    let steps = 0;
    for (; steps < 60000 && fl.armed; steps++) {
      multirotorStep(fl, 0.01, { ...stick, thrAbs: 0.9 }, {}, h);
    }
    expect(fl.armed).toBe(false);
    expect(steps).toBeLessThan(60000);
  });

  it('wind is gusty but bounded', () => {
    for (let t = 0; t < 100; t += 0.5) {
      const w = windAt(t);
      expect(Math.abs(w[0])).toBeLessThanOrEqual(1.21);
      expect(Math.abs(w[1])).toBeLessThanOrEqual(0.81);
      expect(w[2]).toBe(0);
    }
  });
});

describe('world collision', () => {
  it('detects box hits and reports what was hit', () => {
    const w = buildWorld({
      title: 'T',
      brief: 'b',
      prims: [{ t: 'box', x: 10, y: 10, w: 2, d: 2, h: 4 }],
      goals: []
    });
    expect(collideAt(w, 10, 10, 2, 0.14)).toBeTruthy();
    expect(collideAt(w, 20, 20, 2, 0.14)).toBeNull();
    // above the box
    expect(collideAt(w, 10, 10, 5, 0.14)).toBeNull();
  });

  it('goal rings only count when crossed flying the heading', () => {
    const w = buildWorld({
      title: 'T',
      brief: 'b',
      prims: [],
      goals: [{ x: 10, y: 10, z: 2, r: 1, heading: 90 }]
    });
    let chimes = 0;
    const cb = { say: () => {}, chime: () => chimes++, ding: () => {}, onLap: () => {}, onRun: () => {} };
    const fl = newFlight(calc, [5, 5], 4, 6);
    fl.armed = true;
    // fly through the ring heading +y (90 deg)
    for (let i = 0; i < 100; i++) {
      fl.pos = [10, 8 + i * 0.05, 2];
      goalCheck(w, fl as FlightState, cb);
    }
    expect(chimes).toBe(1);
    // flying the wrong way does not score
    const fl2 = newFlight(calc, [5, 5], 4, 6);
    for (let i = 0; i < 100; i++) {
      fl2.pos = [10, 12 - i * 0.05, 2];
      goalCheck(w, fl2 as FlightState, cb);
    }
    expect(chimes).toBe(1);
  });

  it('gate check counts a lap only after the full course', () => {
    const w = buildWorld({ title: 'T', brief: 'b' }); // default 5 gates
    let laps = 0;
    const cb = { say: () => {}, chime: () => {}, ding: () => {}, onLap: (t: number) => void laps++, onRun: () => {} };
    const fl = newFlight(calc, [18.5, 15], 4, 6);
    const flyThrough = (gate: { x: number; y: number; heading: number }): void => {
      const hd = (gate.heading * Math.PI) / 180;
      const nx = Math.cos(hd);
      const ny = Math.sin(hd);
      for (let i = 0; i < 40; i++) {
        fl.pos = [gate.x - nx * (2 - i * 0.1), gate.y - ny * (2 - i * 0.1), 0.8];
        gateCheck(w, fl as FlightState, 1.6, 1.6, cb);
      }
    };
    for (let r = 0; r < 2; r++) {
      for (const gate of w.gates) flyThrough(gate);
    }
    expect(laps).toBe(1); // second crossing of the finish completes one lap
  });
});
