/**
 * Unit tests for the WebAudio synth module.
 *
 * WebAudio cannot run under Node, so these tests exercise the parts that are
 * environment-independent: module import, preference persistence and the
 * getter/setter surface. Every WebAudio entry point must be a silent no-op in
 * this environment (the module guards AudioContext creation on `window`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AudioModule = typeof import('../../src/engine/audio');

/** Minimal in-memory `Storage` stub. */
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

/** Re-import the module so its lazily-cached preferences start clean. */
async function freshAudio(): Promise<AudioModule> {
  vi.resetModules();
  return await import('../../src/engine/audio');
}

describe('AudioSys', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('imports cleanly in a Node environment', async () => {
    const { AudioSys } = await freshAudio();
    expect(typeof AudioSys.unlock).toBe('function');
    expect(typeof AudioSys.sfx).toBe('function');
    expect(typeof AudioSys.hum).toBe('function');
    expect(typeof AudioSys.setMusic).toBe('function');
    expect(typeof AudioSys.setEffects).toBe('function');
  });

  it('defaults to music off and effects on', async () => {
    const { AudioSys } = await freshAudio();
    expect(AudioSys.music).toBe(false);
    expect(AudioSys.effects).toBe(true);
  });

  it('persists preferences and a fresh module reads them back', async () => {
    const { AudioSys } = await freshAudio();
    AudioSys.setMusic(true);
    AudioSys.setEffects(false);

    const raw = localStorage.getItem('drone-lab-audio');
    expect(JSON.parse(raw ?? 'null')).toEqual({ music: true, effects: false });

    const reloaded = await freshAudio(); // new module instance, same storage
    expect(reloaded.AudioSys.music).toBe(true);
    expect(reloaded.AudioSys.effects).toBe(false);
  });

  it('toggle getters track the latest value', async () => {
    const { AudioSys } = await freshAudio();
    AudioSys.setMusic(true);
    expect(AudioSys.music).toBe(true);
    AudioSys.setMusic(false);
    expect(AudioSys.music).toBe(false);
    AudioSys.setEffects(false);
    expect(AudioSys.effects).toBe(false);
    AudioSys.setEffects(true);
    expect(AudioSys.effects).toBe(true);
  });

  it('WebAudio entry points are silent no-ops without a browser', async () => {
    const { AudioSys } = await freshAudio();
    expect(() => {
      AudioSys.unlock();
      AudioSys.sfx('tick');
      AudioSys.sfx('whoosh');
      AudioSys.sfx('upload');
      AudioSys.hum(0.8);
      AudioSys.hum(0);
      AudioSys.setMusic(true);
    }).not.toThrow();
    // no AudioContext was ever created, so music simply stayed unstarted
    expect(AudioSys.music).toBe(true);
  });

  it('sfx still returns early when effects are muted', async () => {
    const { AudioSys } = await freshAudio();
    AudioSys.setEffects(false);
    expect(AudioSys.effects).toBe(false);
    expect(() => AudioSys.sfx('ding')).not.toThrow();
  });
});
