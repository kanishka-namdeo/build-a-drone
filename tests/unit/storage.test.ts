/**
 * Unit tests for the typed persistence layer.
 *
 * `localStorage` does not exist under Node, so every test stubs it with a
 * simple in-memory Map. Round-trip, shallow merge, corrupt-JSON fallback and
 * quota-error tolerance are all exercised against the stub.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Progress, Store, type CraftProgress } from '../../src/engine/storage';

/** A minimal in-memory `Storage` backed by a Map. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => {
      map.clear();
    },
    key: (index) => Array.from(map.keys())[index] ?? null,
    get length() {
      return map.size;
    },
  };
}

describe('Store', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips JSON values under the drone-lab: prefix', () => {
    Store.set('settings', { volume: 3, label: 'bench' });
    expect(Store.get('settings', null)).toEqual({ volume: 3, label: 'bench' });
    expect(localStorage.getItem('drone-lab:settings')).toBe(
      JSON.stringify({ volume: 3, label: 'bench' }),
    );
  });

  it('returns the fallback for missing keys', () => {
    expect(Store.get('missing', 42)).toBe(42);
    expect(Store.get('missing', { a: 1 })).toEqual({ a: 1 });
  });

  it('returns the fallback for corrupt JSON', () => {
    localStorage.setItem('drone-lab:corrupt', '{"unterminated');
    expect(Store.get('corrupt', 'fallback')).toBe('fallback');
  });

  it('removes values', () => {
    Store.set('gone', true);
    Store.remove('gone');
    expect(Store.get('gone', false)).toBe(false);
  });

  it('swallows quota errors on write', () => {
    localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    expect(() => Store.set('big', 'x'.repeat(64))).not.toThrow();
  });

  it('is a silent no-op without localStorage', () => {
    vi.unstubAllGlobals();
    expect(Store.get('anything', 'fb')).toBe('fb');
    expect(() => Store.set('anything', 1)).not.toThrow();
    expect(() => Store.remove('anything')).not.toThrow();
  });
});

describe('Progress', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns an empty record for an unknown craft', () => {
    expect(Progress.get('flying-crab')).toEqual({});
    expect(Progress.all()).toEqual({});
  });

  it('shallow-merges patches per craft', () => {
    Progress.set('flying-crab', { built: true, quiz: { 0: 1 } });
    Progress.set('flying-crab', { visited: true, bestLap: 41.2 });
    const p: CraftProgress = Progress.get('flying-crab');
    expect(p.built).toBe(true);
    expect(p.visited).toBe(true);
    expect(p.bestLap).toBe(41.2);
    expect(p.quiz).toEqual({ 0: 1 }); // untouched by the second patch
  });

  it('replaces nested records wholesale (no deep merge)', () => {
    Progress.set('boxy-bee', { quiz: { 0: 1, 1: 0 } });
    Progress.set('boxy-bee', { quiz: { 2: 3 } });
    expect(Progress.get('boxy-bee').quiz).toEqual({ 2: 3 });
  });

  it('keeps crafts independent and lists them all', () => {
    Progress.set('flying-crab', { built: true });
    Progress.set('boxy-bee', { bestRun: 63.5 });
    const all = Progress.all();
    expect(Object.keys(all).sort()).toEqual(['boxy-bee', 'flying-crab']);
    expect(all['flying-crab']?.built).toBe(true);
    expect(all['boxy-bee']?.bestRun).toBe(63.5);
  });

  it('reset clears every craft', () => {
    Progress.set('flying-crab', { built: true });
    Progress.reset();
    expect(Progress.all()).toEqual({});
    expect(Progress.get('flying-crab')).toEqual({});
  });

  it('tolerates corrupt progress payloads', () => {
    localStorage.setItem('drone-lab:progress', 'not json at all');
    expect(Progress.all()).toEqual({});
    expect(() => Progress.set('flying-crab', { built: true })).not.toThrow();
    expect(Progress.get('flying-crab').built).toBe(true);
  });
});
