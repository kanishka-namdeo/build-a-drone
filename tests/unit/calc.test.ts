import { describe, it, expect } from 'vitest';
import { calcCraft, calcTiles, calcWarnings } from '../../src/workshop/calc';
import { quad5 } from '../../src/crafts/quad5';
import type { CraftRecord, Design, CalcOut } from '../../src/types';

/** A minimal fake craft for calculator edge cases. */
const fakeCraft = (over: Partial<CraftRecord>): CraftRecord =>
  ({
    key: 'fake',
    fig: 99,
    name: 'fake',
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
    batts: { b: { name: '4S', cells: 4, mah: 1000, g: 100, price: 20 } },
    motors: { m: { name: 'M', kv: 1000, g: 10, price: 10 } },
    props: { p: { name: 'P', pf: 1, eff: 1, g: 5, price: 2 } },
    fixed: [{ id: 'F', name: 'frame', g: 50, price: 30, cat: 'Mechanical' }],
    parts: [],
    draw: () => {},
    hull: () => [],
    wiring: { nodes: () => ({}), links: [] },
    overview: '',
    buildCode: '',
    quiz: [],
    ...over
  }) as CraftRecord;

describe('calcCraft (stock model)', () => {
  const c = calcCraft(quad5, quad5.design);

  it('computes the reference numbers for the default 5-inch build', () => {
    expect(c.V).toBeCloseTo(22.2, 1);
    expect(c.krpm).toBeCloseTo(38.85, 1);
    expect(Math.round(c.thrust)).toBeGreaterThan(1500);
    expect(Math.round(c.thrust)).toBeLessThan(1700);
    expect(Math.round(c.auw)).toBe(514);
    expect(c.tw).toBeCloseTo(12.5, 0);
    expect(c.hoverThr).toBeCloseTo(0.28, 1);
    expect(Math.round(c.maxA)).toBe(144);
    expect(c.hoverMin).toBeCloseTo(12.3, 0);
    expect(c.flyMin).toBeCloseTo(5.2, 0);
    expect(c.over).toBe(false);
    expect(c.weak).toBe(false);
  });

  it('splits cost into electrical + mechanical and totals', () => {
    expect(c.cost.Electrical + c.cost.Mechanical).toBe(c.cost.Total);
    expect(Math.round(c.cost.Total)).toBe(346);
  });

  it('flags over-KV builds (kv x cells past the limit)', () => {
    const bad: Design = { batt: '6s1800', motor: '2306-2450', prop: '5x4.3x3' };
    const cb = calcCraft(quad5, bad);
    expect(cb.over).toBe(true); // 2450 * 6 > 12075
    const warns = calcWarnings(quad5, bad, cb);
    expect(warns.some((w) => w.warn && /KV/.test(w.text))).toBe(true);
  });

  it('flags weak thrust-to-weight builds', () => {
    const weakCraft = fakeCraft({ minTW: 5, kThrust: 0.05 });
    const cw = calcCraft(weakCraft, { batt: 'b', motor: 'm', prop: 'p' });
    expect(cw.weak).toBe(true);
  });

  it('produces six tiles', () => {
    const tiles = calcTiles(c);
    expect(tiles).toHaveLength(6);
    expect(tiles.map((t) => t.label)).toEqual([
      'All-up weight',
      'Thrust : weight',
      'Hover throttle',
      'Max current',
      'Hover time',
      'Freestyle time'
    ]);
  });

  it('flies less time on the smaller battery', () => {
    const small: Design = { batt: '4s1500', motor: '2306-1750', prop: '5x4.3x3' };
    const cs = calcCraft(quad5, small);
    expect(cs.hoverMin).toBeLessThan(c.hoverMin);
  });
});

describe('calcCraft overrides', () => {
  it('respects a custom calc()', () => {
    const custom: CraftRecord = fakeCraft({
      calc: () =>
        ({
          V: 1,
          krpm: 1,
          thrust: 1,
          auw: 1,
          tw: 1,
          hoverW: 1,
          hoverA: 1,
          hoverMin: 1,
          flyMin: 1,
          maxA: 1,
          over: false,
          weak: false,
          hoverThr: 0.5,
          cost: { Electrical: 1, Mechanical: 1, Total: 2 },
          nElect: 1,
          nMech: 1
        }) as CalcOut
    });
    expect(calcCraft(custom, { batt: 'b', motor: 'm', prop: 'p' }).auw).toBe(1);
  });
});
