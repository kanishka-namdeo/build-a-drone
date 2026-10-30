/**
 * Drone Lab — the performance calculator.
 *
 * Estimates thrust, weight, hover throttle, current draw and flight time from
 * the chosen battery / motors / props. The model is deliberately simple (the
 * sort you find on the back of an envelope at a fly-in): thrust scales with
 * (KV x V)^2, hover power follows AUW / grams-per-watt, and freestyle flying
 * burns about 2.4x hover current.
 */

import type { CraftRecord, Design, CalcOut } from '../types';

/** Run the performance model for a craft + design (honours craft overrides). */
export function calcCraft(dr: CraftRecord, d: Design): CalcOut {
  if (dr.calc) return dr.calc(d);
  const batt = dr.batts[d.batt] ?? Object.values(dr.batts)[0];
  const motor = dr.motors[d.motor] ?? Object.values(dr.motors)[0];
  const prop = dr.props[d.prop] ?? Object.values(dr.props)[0];
  const n = dr.mpos.length;

  const V = batt.cells * 3.7;
  const krpm = (motor.kv * V) / 1000;
  const sz = motor.sz ?? 1;
  const thrust = dr.kThrust * sz * prop.pf * krpm * krpm; // grams per motor
  const auw =
    dr.fixed.reduce((s, f) => s + f.g, 0) + n * motor.g + n * prop.g + batt.g;
  const tw = (n * thrust) / auw;
  const hoverW = auw / (dr.gPerW * prop.eff);
  const hoverA = hoverW / V;
  const hoverMin = ((batt.mah / 1000) * 0.8) / hoverA * 60;
  const flyMin = hoverMin * 0.42;
  const maxA = (n * thrust) / (2 * prop.eff) / V;
  const over = motor.kv * batt.cells > (dr.maxKvCells ?? 1750 * 6 * 1.15);
  const weak = tw < (dr.minTW ?? 5);
  const hoverThr = Math.sqrt(auw / (n * thrust));

  let costE = 0;
  let costM = 0;
  let nElect = 0;
  let nMech = 0;
  for (const f of dr.fixed) {
    if (f.cat === 'Electrical') {
      costE += f.price;
      nElect++;
    } else {
      costM += f.price;
      nMech++;
    }
  }
  costE += motor.price * n + batt.price;
  nElect += 2; // motors + battery
  costM += prop.price * Math.ceil(n / 2); // props come in pairs
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
    propName: prop.name
  };
}

/** Standard calculator tile rows (crafts may override). */
export function calcTiles(c: CalcOut): Array<{ label: string; value: string }> {
  return [
    { label: 'All-up weight', value: `${Math.round(c.auw)} g` },
    { label: 'Thrust : weight', value: `${c.tw.toFixed(1)} : 1` },
    { label: 'Hover throttle', value: `${Math.round(c.hoverThr * 100)} %` },
    { label: 'Max current', value: `${Math.round(c.maxA)} A` },
    { label: 'Hover time', value: `${c.hoverMin.toFixed(1)} min` },
    { label: 'Freestyle time', value: `${c.flyMin.toFixed(1)} min` }
  ];
}

/** Standard warnings (crafts may add their own). */
export function calcWarnings(dr: CraftRecord, d: Design, c: CalcOut): Array<{ warn: boolean; text: string }> {
  const out: Array<{ warn: boolean; text: string }> = [];
  if (c.over) {
    out.push({
      warn: true,
      text: `${(c.kv as number)} KV on ${(c.cells as number)}S spins the props far past what the motors and ESC can take: expect hot motors and a desync.`
    });
  }
  if (c.weak) {
    out.push({
      warn: true,
      text: `Thrust to weight ${c.tw.toFixed(1)}:1 is too low for this kind of flying.`
    });
  }
  if (!out.length) {
    out.push({
      warn: false,
      text: c.tw > 10 ? 'Parts match. Plenty of punch.' : 'Parts match. Good all-round build.'
    });
  }
  const extra = dr.warnings?.(d, c) ?? [];
  for (const t of extra) out.push({ warn: true, text: t });
  return out;
}
