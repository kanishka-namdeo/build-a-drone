import { wing9 } from '../src/crafts/wing9';
import type { FlightState, PhysCtx } from '../src/types';
import { newFlight } from '../src/flight/physics';
import { buildWorld } from '../src/flight/world';

const calc = wing9.calc!({ batt: '4s2200', motor: '2212-1400', prop: '8x6' });
console.log('calc:', {
  auw: Math.round(calc.auw),
  tw: calc.tw.toFixed(2),
  thrust: Math.round(calc.thrust),
  vstall: (calc.vstall as number).toFixed(1),
  vcruise: (calc.vcruise as number).toFixed(1)
});

const world = buildWorld({ title: 'T', brief: 'b', field: 60 });
const stick = { thr: 0, thrAbs: 0, yaw: 0, pitch: 0, roll: 0 };
const logs: string[] = [];
const ctx: PhysCtx = {
  stock: () => {},
  batteryStep: () => {},
  crash: (fl, why) => {
    fl.crashed = true;
    fl.armed = false;
    logs.push(`CRASH ${why}`);
  },
  worldCollide: () => {},
  goalCheck: () => {},
  gateCheck: () => {},
  say: (m) => logs.push(m),
  stick
};

const fl = newFlight(calc, [20, 4], 1, 4) as FlightState;
fl.mode = 'angle';
fl.armed = true;

let last = '';
for (let i = 0; i < 1200; i++) {
  // throttle ramp like holding W
  if (i > 20 && i < 200) stick.thrAbs = Math.min(1, stick.thrAbs + 0.32 * 0.01);
  if (i === 200) stick.thrAbs = 1;
  wing9.physics!(fl, 0.01, ctx);
  if (!isFinite(fl.pos[0] + fl.pos[1] + fl.pos[2] + fl.vel[0] + fl.vel[1] + fl.vel[2])) {
    console.log('NaN at step', i, 't=', fl.t.toFixed(2));
    console.log('prev:', last);
    break;
  }
  if (i % 50 === 0) {
    last = `t=${fl.t.toFixed(1)} z=${fl.pos[2].toFixed(1)} v=${Math.hypot(...fl.vel).toFixed(1)} pitch=${((fl.pitch * 180) / Math.PI).toFixed(0)} u=${(fl.vel[0] * Math.cos(fl.yaw) + fl.vel[1] * Math.sin(fl.yaw)).toFixed(1)} airborne=${fl.airborne}`;
    console.log(last);
  }
}
console.log('final:', `z=${fl.pos[2].toFixed(1)} v=${Math.hypot(...fl.vel).toFixed(1)} crashed=${fl.crashed}`);
console.log('log:', logs.slice(0, 6));
void world;
