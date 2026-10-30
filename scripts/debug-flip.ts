import { multirotorStep, newFlight, type PhysHooks } from '../src/flight/physics';
import { buildWorld } from '../src/flight/world';
import type { CraftRecord, CalcOut } from '../src/types';

const craft = { key: 't', mpos: [[1,1,'M1','CW'],[1,1,'M2','CCW'],[1,1,'M3','CCW'],[1,1,'M4','CW']], log: 'betaflight' } as unknown as CraftRecord;
const calc = { thrust: 1600, auw: 514, hoverA: 4.3, hoverThr: 0.28, over: false, cells: 6, mah: 1100 } as unknown as CalcOut;
const world = buildWorld({ title: 'T', brief: 'b', field: 30 });
const hooks: PhysHooks = {
  craft, world, say: (m) => console.log('SAY:', m),
  onCrash: (w) => console.log('CRASH:', w),
  onLap: () => {}, onRun: () => {},
  fcReversed: () => true, propsSwapped: () => false, motorChecked: () => true,
  accOk: () => true, wind: () => false
};
const fl = newFlight(calc, [15, 15], 4, 6);
fl.armed = true;
const stick = { thr: 0.8, thrAbs: 0, yaw: 0, pitch: 0, roll: 0 };
for (let i = 0; i < 100; i++) {
  multirotorStep(fl, 0.01, stick, { alt: true }, hooks);
  if (i % 10 === 0) console.log(i, 't=', fl.t.toFixed(2), 'thrEff=', fl.thrEff.toFixed(3), 'z=', fl.pos[2].toFixed(2), 'crashed=', fl.crashed, 'roll=', fl.roll.toFixed(2));
}
console.log('FINAL crashed=', fl.crashed, 'flipWhy=', fl.flipWhy);
