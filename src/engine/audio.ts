/**
 * Drone Lab — WebAudio synth module.
 *
 * Every sound in the workshop is synthesised at runtime; there are no audio
 * files. One-shot effects (`sfx`) are built from oscillators and a shared 2s
 * white-noise buffer, the motor hum is a pair of detuned oscillators whose
 * frequency and level track the throttle, and the background music is a lo-fi
 * loop scheduler (~74 BPM, swung) playing a four-bar jazz progression (Dm9 →
 * G13 → Cmaj9 → Am9) on additive “rhodes” voices over a small drum machine
 * and looping vinyl crackle.
 *
 * Graph:
 *
 * ```
 *   [sfx sources] ────────────────► sfxBus(0.55) ─┐
 *   [hum] ► lowpass(1400) ► gain ──► sfxBus        ├► masterGain(0.9) ► compressor ► destination
 *   [music] ► lowpass(2400) ► musicGain(0 ↔ 0.9) ──┘
 * ```
 *
 * The module is a singleton ({@link AudioSys}) and safe to import anywhere:
 * in Node (unit tests, SSR) every WebAudio entry point is a silent no-op —
 * the `AudioContext` is only ever constructed when `window` exists.
 *
 * Preferences persist in localStorage key `drone-lab-audio` as
 * `{"music":boolean,"effects":boolean}` (defaults: music off, effects on).
 */

/** Identifiers for the synthesised one-shot sound effects. */
export type SfxName =
  | 'tick'
  | 'place'
  | 'snap'
  | 'solder'
  | 'plug'
  | 'unplug'
  | 'power'
  | 'upload'
  | 'ding'
  | 'chime'
  | 'buzz'
  | 'error'
  | 'pop'
  | 'sizzle'
  | 'whoosh'
  | 'click'
  | 'machine';

/** Public surface of the {@link AudioSys} singleton. */
export interface AudioSysApi {
  /** Create/resume the AudioContext lazily (must be triggered by a user gesture). */
  unlock(): void;
  /** Play a one-shot effect. No-op when effects are muted or WebAudio is unavailable. */
  sfx(name: SfxName): void;
  /**
   * Motor hum while flying; `level` is 0..1 (throttle). Smoothly transitions —
   * call every frame with 0 to fade out. No-op until the context exists.
   * The hum is *not* gated by the effects preference (only one-shot `sfx`
   * are); pass 0 to silence the motors.
   */
  hum(level: number): void;
  /** Toggle the lo-fi background loop (persists the preference). */
  setMusic(on: boolean): void;
  /** Whether background music is enabled. */
  readonly music: boolean;
  /** Toggle one-shot sound effects (persists the preference). */
  setEffects(on: boolean): void;
  /** Whether sound effects are enabled. */
  readonly effects: boolean;
}

/* ------------------------------------------------------------------ *
 * Preferences
 * ------------------------------------------------------------------ */

const PREF_KEY = 'drone-lab-audio';

interface AudioPrefs {
  music: boolean;
  effects: boolean;
}

/** Cached preferences — loaded lazily so tests can stub storage first. */
let prefsCache: AudioPrefs | null = null;

/** Load preferences once (defaults: music off, effects on). */
function readPrefs(): AudioPrefs {
  if (prefsCache) return prefsCache;
  const prefs: AudioPrefs = { music: false, effects: true };
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AudioPrefs>;
        if (typeof parsed.music === 'boolean') prefs.music = parsed.music;
        if (typeof parsed.effects === 'boolean') prefs.effects = parsed.effects;
      }
    }
  } catch {
    /* corrupt or unavailable storage — keep the defaults */
  }
  prefsCache = prefs;
  return prefs;
}

/** Persist the current preferences (best-effort). */
function writePrefs(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PREF_KEY, JSON.stringify(readPrefs()));
    }
  } catch {
    /* quota / private mode — preferences stay in memory for this session */
  }
}

/* ------------------------------------------------------------------ *
 * Audio graph
 * ------------------------------------------------------------------ */

/** Everything that only exists once a real AudioContext is running. */
interface AudioChain {
  readonly ctx: AudioContext;
  readonly master: GainNode;
  readonly compressor: DynamicsCompressorNode;
  readonly sfxBus: GainNode;
  /** Tonal input of the music bus: warm lowpass into `musicGain`. */
  readonly musicLP: BiquadFilterNode;
  /** Music bus gain — 0 when off, ramps to 0.9 when on. */
  readonly musicGain: GainNode;
}

let chain: AudioChain | null = null;

/**
 * Create (or return) the audio graph. Returns `null` in environments without
 * `window`/WebAudio — every caller must treat that as “stay silent”.
 */
function ensureCtx(): AudioChain | null {
  if (chain) return chain;
  if (typeof window === 'undefined') return null; // Node / SSR / test guard
  const win = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  const AC = win.AudioContext ?? win.webkitAudioContext;
  if (!AC) return null;

  let ctx: AudioContext;
  try {
    ctx = new AC();
  } catch {
    return null;
  }

  // master chain: masterGain -> DynamicsCompressor -> destination
  const master = ctx.createGain();
  master.gain.value = 0.9;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -14;
  compressor.knee.value = 24;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.24;
  master.connect(compressor);
  compressor.connect(ctx.destination);

  // sfx bus
  const sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.55;
  sfxBus.connect(master);

  // music bus: lowpass ~2400Hz into a gain that sits at 0 until music is on
  const musicLP = ctx.createBiquadFilter();
  musicLP.type = 'lowpass';
  musicLP.frequency.value = 2400;
  const musicGain = ctx.createGain();
  musicGain.gain.value = 0;
  musicLP.connect(musicGain);
  musicGain.connect(master);

  chain = { ctx, master, compressor, sfxBus, musicLP, musicGain };
  return chain;
}

/* ------------------------------------------------------------------ *
 * Shared synthesis helpers
 * ------------------------------------------------------------------ */

/** Default envelope attack for one-shots (~5ms, per spec). */
const ATTACK = 0.005;
/** Extra tail kept after a voice's nominal decay so release ramps complete. */
const TAIL = 0.05;

/**
 * A gain node that snaps to `vol` in `attack` seconds, then decays
 * exponentially to silence over `decay` seconds.
 */
function envGain(
  c: BaseAudioContext,
  at: number,
  vol: number,
  attack: number,
  decay: number,
): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(vol, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return g;
}

/**
 * A single enveloped oscillator. `sweepTo` glides the pitch exponentially
 * over the voice's duration (for thumps, drops and error tones).
 */
function tone(
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  at: number,
  dur: number,
  vol: number,
  sweepTo?: number,
): void {
  const c = dest.context;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (sweepTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, sweepTo), at + dur);
  }
  const g = envGain(c, at, vol, ATTACK, dur);
  osc.connect(g).connect(dest);
  osc.start(at);
  osc.stop(at + dur + TAIL);
}

/** Optional filter placed in front of a noise burst. */
interface NoiseFilter {
  readonly type: BiquadFilterType;
  readonly f0: number;
  /** Sweep the filter frequency to `f1` over the burst (e.g. whoosh). */
  readonly f1?: number;
  readonly q?: number;
}

/** 2s white-noise buffer, generated once and shared by every noise voice. */
let noiseBuf: AudioBuffer | null = null;

function noiseBuffer(c: BaseAudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const len = Math.floor(c.sampleRate * 2);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

/**
 * An enveloped burst of white noise, optionally filtered. Each burst starts
 * at a random offset into the shared buffer so repeats never sound identical.
 */
function noiseHit(
  dest: AudioNode,
  at: number,
  dur: number,
  vol: number,
  filter?: NoiseFilter,
): void {
  const c = dest.context;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  let head: AudioNode = src;
  if (filter) {
    const bq = c.createBiquadFilter();
    bq.type = filter.type;
    bq.frequency.setValueAtTime(filter.f0, at);
    if (filter.f1 !== undefined) {
      bq.frequency.exponentialRampToValueAtTime(filter.f1, at + dur);
    }
    bq.Q.value = filter.q ?? 1;
    head = head.connect(bq);
  }
  const g = envGain(c, at, vol, ATTACK, dur);
  head.connect(g).connect(dest);
  const offset = Math.random() * Math.max(0, src.buffer.duration - dur - TAIL);
  src.start(at, offset, dur + TAIL);
}

/* ------------------------------------------------------------------ *
 * One-shot effects
 * ------------------------------------------------------------------ */

/**
 * Dispatch table for every {@link SfxName}. All volumes live in the
 * 0.05–0.25 range and every envelope uses the shared ~5ms attack.
 */
function playSfx(ch: AudioChain, name: SfxName): void {
  const dest = ch.sfxBus;
  const t = ch.ctx.currentTime + 0.015;

  switch (name) {
    case 'tick': // short bright blip — UI nudge
      tone(dest, 'square', 1800, t, 0.03, 0.06);
      break;

    case 'click': // even shorter, slightly softer — button press
      tone(dest, 'square', 950, t, 0.02, 0.05);
      break;

    case 'place': // part laid on the bench — two quick descending sines
      tone(dest, 'sine', 523.25, t, 0.06, 0.11);
      tone(dest, 'sine', 392.0, t + 0.055, 0.07, 0.1);
      break;

    case 'snap': // part clicks home — harder/faster pair plus a tick of noise
      tone(dest, 'sine', 698.46, t, 0.045, 0.13);
      tone(dest, 'sine', 523.25, t + 0.04, 0.055, 0.12);
      noiseHit(dest, t, 0.02, 0.08, { type: 'highpass', f0: 3200 });
      break;

    case 'unplug': // connector pulled — descending three-note arpeggio
      tone(dest, 'triangle', 659.26, t, 0.08, 0.1);
      tone(dest, 'triangle', 493.88, t + 0.07, 0.08, 0.1);
      tone(dest, 'triangle', 329.63, t + 0.14, 0.11, 0.11);
      break;

    case 'power': // board boots — ascending three-note arpeggio
      tone(dest, 'sine', 392.0, t, 0.09, 0.11);
      tone(dest, 'sine', 523.25, t + 0.08, 0.09, 0.11);
      tone(dest, 'sine', 783.99, t + 0.16, 0.14, 0.12);
      break;

    case 'upload': // firmware flashing — 14 random square blips
      for (let i = 0; i < 14; i++) {
        tone(dest, 'square', 700 + Math.random() * 1600, t + i * 0.024, 0.016, 0.05);
      }
      break;

    case 'ding': // success — two consonant sines with long decay
      tone(dest, 'sine', 880, t, 0.6, 0.1);
      tone(dest, 'sine', 1318.5, t, 0.5, 0.07);
      break;

    case 'chime': // quiz passed — four-note arpeggio (C5 E5 G5 C6)
      tone(dest, 'sine', 523.25, t, 0.32, 0.08);
      tone(dest, 'sine', 659.26, t + 0.09, 0.32, 0.08);
      tone(dest, 'sine', 783.99, t + 0.18, 0.32, 0.08);
      tone(dest, 'sine', 1046.5, t + 0.27, 0.45, 0.09);
      break;

    case 'buzz': // rejected / warning — detuned saw pair beating at ~6Hz
      tone(dest, 'sawtooth', 110, t, 0.32, 0.07);
      tone(dest, 'sawtooth', 116, t, 0.32, 0.07);
      break;

    case 'error': // fault — triangle gliding 330 → 262Hz
      tone(dest, 'triangle', 330, t, 0.22, 0.13, 262);
      break;

    case 'pop': // balloon-ish pop — noise burst plus a sine thump
      noiseHit(dest, t, 0.035, 0.12, { type: 'highpass', f0: 900 });
      tone(dest, 'sine', 150, t, 0.09, 0.16, 55);
      break;

    case 'sizzle': // smoke test — filtered hiss sprinkled with crackle
      noiseHit(dest, t, 0.55, 0.07, { type: 'bandpass', f0: 3600, q: 1.2 });
      for (let i = 0; i < 6; i++) {
        noiseHit(dest, t + Math.random() * 0.5, 0.015, 0.09, {
          type: 'highpass',
          f0: 4200,
        });
      }
      break;

    case 'whoosh': // arm / launch — bandpass noise sweep 500 → 2600Hz
      noiseHit(dest, t, 0.4, 0.11, { type: 'bandpass', f0: 500, f1: 2600, q: 1.4 });
      break;

    case 'plug': // connector seated — click plus thump
      tone(dest, 'square', 900, t, 0.02, 0.06);
      tone(dest, 'sine', 130, t, 0.09, 0.12, 75);
      break;

    case 'solder': // iron on the pad — long hiss, low hum, sparse crackles
      noiseHit(dest, t, 0.7, 0.06, { type: 'bandpass', f0: 2600, q: 0.8 });
      tone(dest, 'sine', 210, t, 0.7, 0.05);
      for (let i = 0; i < 8; i++) {
        noiseHit(dest, t + Math.random() * 0.65, 0.012, 0.05, {
          type: 'highpass',
          f0: 3600,
        });
      }
      break;

    case 'machine': // bench tool — low churning saw + square + rumble
      tone(dest, 'sawtooth', 82, t, 0.75, 0.05);
      tone(dest, 'square', 164, t, 0.75, 0.05);
      noiseHit(dest, t, 0.75, 0.055, { type: 'lowpass', f0: 750 });
      break;
  }
}

/* ------------------------------------------------------------------ *
 * Motor hum
 * ------------------------------------------------------------------ */

/** Persistent hum voice — created lazily once, then reused forever. */
interface HumVoice {
  readonly osc1: OscillatorNode;
  readonly osc2: OscillatorNode;
  readonly gain: GainNode;
}

let humVoice: HumVoice | null = null;

/** setTargetAtTime time constant for hum moves (~45ms). */
const HUM_TC = 0.045;

function ensureHum(ch: AudioChain): HumVoice {
  if (humVoice) return humVoice;
  const c = ch.ctx;
  const osc1 = c.createOscillator(); // sawtooth fundamental
  osc1.type = 'sawtooth';
  osc1.frequency.value = 95;
  const osc2 = c.createOscillator(); // square overtone at ~2.01×
  osc2.type = 'square';
  osc2.frequency.value = 95 * 2.01;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  const gain = c.createGain();
  gain.gain.value = 0;
  osc1.connect(lp);
  osc2.connect(lp);
  lp.connect(gain).connect(ch.sfxBus);
  osc1.start();
  osc2.start();
  humVoice = { osc1, osc2, gain };
  return humVoice;
}

/* ------------------------------------------------------------------ *
 * Music — lo-fi swung loop scheduler
 * ------------------------------------------------------------------ */

const MUSIC_BPM = 74;
const MUSIC_BEAT = 60 / MUSIC_BPM;
/** Swung 8ths: on-beat → off-beat lasts 2/3 of a beat, off → next 1/3. */
const SWING_LONG = MUSIC_BEAT * (2 / 3);
const SWING_SHORT = MUSIC_BEAT * (1 / 3);
/** Scheduler cadence and how far ahead of `currentTime` we schedule. */
const MUSIC_TICK_MS = 40;
const MUSIC_LOOKAHEAD = 0.2;
/** Bus gain target while music is on. */
const MUSIC_LEVEL = 0.9;

/** One bar of the progression: a sine bass root plus rhodes chord voicing. */
interface BarVoicing {
  readonly bass: number;
  readonly chord: readonly number[];
}

/**
 * Four-bar progression: Dm9 → G13 → Cmaj9 → Am9. The Am9 bar reuses the
 * Cmaj9 voicing over an A bass (a classic rootless-voicing trick).
 */
const PROGRESSION: readonly BarVoicing[] = [
  { bass: 73.42, chord: [146.83, 174.61, 220.0, 261.63, 329.63] }, // Dm9
  { bass: 98.0, chord: [196.0, 246.94, 293.66, 329.63, 349.23] }, // G13
  { bass: 65.41, chord: [130.81, 164.81, 196.0, 246.94, 293.66] }, // Cmaj9
  { bass: 110.0, chord: [130.81, 164.81, 196.0, 246.94, 293.66] }, // Am9
];

let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicStopTimer: ReturnType<typeof setTimeout> | null = null;
let musicStep = 0;
let nextStepTime = 0;
let vinyl: AudioBufferSourceNode | null = null;

/** Sparse-pop buffer that, looped and bandpassed, sounds like vinyl crackle. */
let crackleBuf: AudioBuffer | null = null;

function crackleBuffer(c: BaseAudioContext): AudioBuffer {
  if (crackleBuf) return crackleBuf;
  const len = Math.floor(c.sampleRate * 2);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let i = 0;
  while (i < len) {
    if (Math.random() < 0.00025) {
      // a short, sharp pop with a squared-off decay
      const amp = 0.3 + Math.random() * 0.7;
      const pop = 6 + Math.floor(Math.random() * 26);
      for (let k = 0; k < pop && i + k < len; k++) {
        d[i + k] += (Math.random() * 2 - 1) * amp * (1 - k / pop) ** 2;
      }
      i += pop;
    } else {
      i++;
    }
  }
  crackleBuf = buf;
  return buf;
}

function startVinyl(ch: AudioChain): void {
  if (vinyl) return;
  const src = ch.ctx.createBufferSource();
  src.buffer = crackleBuffer(ch.ctx);
  src.loop = true;
  const bp = ch.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2600;
  bp.Q.value = 0.7;
  const g = ch.ctx.createGain();
  g.gain.value = 0.5;
  src.connect(bp).connect(g).connect(ch.musicLP);
  src.start();
  vinyl = src;
}

function stopVinyl(): void {
  if (!vinyl) return;
  try {
    vinyl.stop();
  } catch {
    /* already stopped */
  }
  try {
    vinyl.disconnect();
  } catch {
    /* already disconnected */
  }
  vinyl = null;
}

/** One additive partial of a rhodes voice, detuned by ±4 cents. */
function partial(
  c: BaseAudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  level: number,
  at: number,
  decay: number,
): void {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = Math.random() * 8 - 4;
  const g = c.createGain();
  g.gain.value = level;
  osc.connect(g).connect(dest);
  osc.start(at);
  osc.stop(at + decay + 0.1);
}

/**
 * Soft additive “rhodes” tone: sine + 0.18·sine(2f) + 0.05·triangle(3.01f),
 * each partial detuned ±4 cents, under one slow envelope.
 */
function rhodes(dest: AudioNode, freq: number, at: number, vol: number, decay: number): void {
  const c = dest.context;
  const g = envGain(c, at, vol, 0.012, decay);
  g.connect(dest);
  partial(c, g, 'sine', freq, 1, at, decay);
  partial(c, g, 'sine', freq * 2, 0.18, at, decay * 0.7);
  partial(c, g, 'triangle', freq * 3.01, 0.05, at, decay * 0.5);
}

/** Sine bass note with a tiny pitch settle at the attack. */
function bassNote(dest: AudioNode, freq: number, at: number, vol: number, decay: number): void {
  const c = dest.context;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq * 1.02, at);
  osc.frequency.exponentialRampToValueAtTime(freq, at + 0.04);
  const g = envGain(c, at, vol, 0.008, decay);
  osc.connect(g).connect(dest);
  osc.start(at);
  osc.stop(at + decay + 0.1);
}

/** Kick drum: sine dropping 110 → 42Hz with a fast exponential tail. */
function kick(dest: AudioNode, at: number): void {
  const c = dest.context;
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, at);
  osc.frequency.exponentialRampToValueAtTime(42, at + 0.11);
  const g = envGain(c, at, 0.25, 0.004, 0.16);
  osc.connect(g).connect(dest);
  osc.start(at);
  osc.stop(at + 0.25);
}

/** Soft noise snare with a hint of body. */
function snare(dest: AudioNode, at: number): void {
  noiseHit(dest, at, 0.13, 0.07, { type: 'bandpass', f0: 1900, q: 0.9 });
  tone(dest, 'triangle', 190, at, 0.06, 0.05, 120);
}

/** Highpassed noise hat, varying slightly in length each hit. */
function hat(dest: AudioNode, at: number): void {
  noiseHit(dest, at, 0.03 + Math.random() * 0.012, 0.05, { type: 'highpass', f0: 5500 });
}

/**
 * Schedule one 8th-note step (eight per bar). `at` is already swung — the
 * scheduler advances by 2/3 beat into off-beats and 1/3 beat back.
 */
function scheduleMusicStep(ch: AudioChain, step: number, at: number): void {
  const bus = ch.musicLP;
  const inBar = step % 8;
  const { bass, chord } = PROGRESSION[Math.floor(step / 8) % PROGRESSION.length];

  switch (inBar) {
    case 0: // bar downbeat: chord, bass and kick
      for (const f of chord) rhodes(bus, f, at, 0.05, 1.9);
      bassNote(bus, bass, at, 0.16, 1.6);
      kick(bus, at);
      break;
    case 2: // beat 2: snare
      snare(bus, at);
      break;
    case 3: // the swung “2.5-ish” kick
      kick(bus, at);
      break;
    case 5: // gentle re-strike of the upper chord voices
      for (const f of chord.slice(2)) rhodes(bus, f, at, 0.032, 1.1);
      break;
    case 6: // beat 4: snare plus a short bass answer (root or fifth)
      snare(bus, at);
      bassNote(bus, Math.random() < 0.5 ? bass : bass * 1.5, at, 0.09, 0.7);
      break;
    default:
      break;
  }

  if (inBar % 2 === 1) {
    // hats on every off-8th, plus a sparse random melody note
    hat(bus, at);
    if (Math.random() < 0.3) {
      const f = 2 * chord[1 + Math.floor(Math.random() * (chord.length - 1))];
      rhodes(bus, f, at, 0.045, 0.8);
    }
  }
}

/** Lookahead loop body — runs every ~40ms while music is playing. */
function tickMusic(): void {
  const ch = chain;
  if (!ch || musicTimer === null) return;
  const horizon = ch.ctx.currentTime + MUSIC_LOOKAHEAD;
  while (nextStepTime < horizon) {
    scheduleMusicStep(ch, musicStep, nextStepTime);
    nextStepTime += musicStep % 2 === 0 ? SWING_LONG : SWING_SHORT;
    musicStep += 1;
  }
}

/**
 * Actually start the loop (double-start guarded). Only called once the
 * context is running.
 */
function beginMusicLoop(ch: AudioChain): void {
  if (musicTimer !== null) return; // already playing — guard double-start
  if (musicStopTimer !== null) {
    clearTimeout(musicStopTimer); // a pending fade-out is cancelled
    musicStopTimer = null;
  }
  const now = ch.ctx.currentTime;
  ch.musicGain.gain.cancelScheduledValues(now);
  ch.musicGain.gain.setTargetAtTime(MUSIC_LEVEL, now, 0.18);
  startVinyl(ch);
  musicStep = 0;
  nextStepTime = now + 0.08;
  musicTimer = setInterval(tickMusic, MUSIC_TICK_MS);
}

/**
 * Bring the music up: create the context if possible, resume it if it is
 * suspended (e.g. called from a click handler), then start the loop.
 */
function startMusic(): void {
  const ch = ensureCtx();
  if (!ch) return;
  if (ch.ctx.state === 'running') {
    beginMusicLoop(ch);
    return;
  }
  void ch.ctx
    .resume()
    .then(() => {
      if (readPrefs().music) beginMusicLoop(ch);
    })
    .catch(() => undefined);
}

/** Fade the bus out, then stop the scheduler and the crackle loop. */
function stopMusic(): void {
  if (musicTimer === null && vinyl === null) return; // never started
  const ch = chain;
  if (ch) {
    const now = ch.ctx.currentTime;
    ch.musicGain.gain.cancelScheduledValues(now);
    ch.musicGain.gain.setTargetAtTime(0, now, 0.09);
  }
  if (musicStopTimer !== null) clearTimeout(musicStopTimer);
  musicStopTimer = setTimeout(() => {
    if (musicTimer !== null) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
    stopVinyl();
    musicStopTimer = null;
  }, 450);
}

/* ------------------------------------------------------------------ *
 * Singleton
 * ------------------------------------------------------------------ */

export const AudioSys: AudioSysApi = {
  unlock() {
    const ch = ensureCtx();
    if (!ch) return;
    if (ch.ctx.state === 'suspended') {
      void ch.ctx
        .resume()
        .then(() => {
          if (readPrefs().music) beginMusicLoop(ch);
        })
        .catch(() => undefined);
    } else if (readPrefs().music) {
      beginMusicLoop(ch);
    }
  },

  sfx(name) {
    if (!readPrefs().effects) return; // muted — return immediately
    const ch = ensureCtx();
    if (!ch) return;
    if (ch.ctx.state === 'suspended') {
      // usually a click handler — resume usually succeeds synchronously here
      void ch.ctx.resume().catch(() => undefined);
    }
    playSfx(ch, name);
  },

  hum(level) {
    const ch = chain; // deliberately does NOT create the context
    if (!ch) return; // no context yet — hum is a no-op
    const v = ensureHum(ch);
    const l = Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 0;
    const at = ch.ctx.currentTime;
    const freq = 95 + 430 * l;
    v.osc1.frequency.setTargetAtTime(freq, at, HUM_TC);
    v.osc2.frequency.setTargetAtTime(freq * 2.01, at, HUM_TC);
    // 0.02 + 0.05·level while armed, 0 when disarmed (level 0)
    v.gain.gain.setTargetAtTime(l <= 0 ? 0 : 0.02 + 0.05 * l, at, HUM_TC);
  },

  setMusic(on) {
    const p = readPrefs();
    p.music = on;
    writePrefs();
    if (on) startMusic();
    else stopMusic();
  },

  get music() {
    return readPrefs().music;
  },

  setEffects(on) {
    const p = readPrefs();
    p.effects = on;
    writePrefs();
  },

  get effects() {
    return readPrefs().effects;
  },
};
