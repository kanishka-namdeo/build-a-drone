/**
 * Drone Lab — tiny typed persistence layer.
 *
 * A thin, dependency-free wrapper around `localStorage`:
 *
 * - {@link Store} reads/writes JSON values under a `drone-lab:` key prefix and
 *   never throws (corrupt payloads fall back, quota errors are swallowed) so
 *   the workshop keeps running in private mode or on full disks.
 * - {@link Progress} stores per-craft progress (build state, quiz answers,
 *   best times) in a single namespaced record and shallow-merges patches.
 *
 * The module is environment-safe: when `localStorage` is unavailable (Node,
 * SSR, sandboxed iframes) reads return their fallback and writes are no-ops.
 */

/** Namespace prefix applied to every key this app persists. */
const PREFIX = 'drone-lab:';

/**
 * Return the platform `localStorage`, or `null` when it does not exist or
 * merely touching it throws (some privacy modes throw on access).
 */
function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Low-level JSON persistence. Values are stored under `drone-lab:${key}`.
 */
export const Store = {
  /**
   * Read and JSON-parse a value.
   *
   * @param key      Key without the `drone-lab:` prefix.
   * @param fallback Returned when the key is missing, unparsable, or storage
   *                 is unavailable.
   */
  get<T>(key: string, fallback: T): T {
    const s = storage();
    if (!s) return fallback;
    try {
      const raw = s.getItem(PREFIX + key);
      if (raw === null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },

  /**
   * JSON-stringify and write a value. Quota/private-mode errors are swallowed
   * so a full disk can never break the app.
   */
  set(key: string, value: unknown): void {
    const s = storage();
    if (!s) return;
    try {
      s.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* QuotaExceededError (or private mode) — drop the write, keep playing */
    }
  },

  /** Remove a key (missing keys are fine). */
  remove(key: string): void {
    const s = storage();
    if (!s) return;
    try {
      s.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },
};

/** How far a player has got with one craft (all fields optional). */
export interface CraftProgress {
  /** Completed a full build on the bench. */
  built?: boolean;
  /** questionIndex -> chosen answer index (latest pick). */
  quiz?: Record<number, number>;
  /** Best race lap, in seconds. */
  bestLap?: number;
  /** Best range run, in seconds. */
  bestRun?: number;
  /** Whether this craft has been opened on the bench. */
  visited?: boolean;
}

/** All per-craft progress, keyed by craft key. */
export type ProgressMap = Record<string, CraftProgress>;

/** Key under which the whole progress map is stored. */
const PROGRESS_KEY = 'progress';

/**
 * Read the whole progress map, defending against corrupt or non-object
 * payloads that may have been written by older versions.
 */
function readAll(): ProgressMap {
  const all = Store.get<ProgressMap>(PROGRESS_KEY, {});
  if (all === null || typeof all !== 'object' || Array.isArray(all)) return {};
  return all;
}

/**
 * Per-craft progress records, persisted under `drone-lab:progress`.
 */
export const Progress = {
  /** Every craft's progress (keyed by craft key). */
  all(): ProgressMap {
    return readAll();
  },

  /** Progress for one craft — `{}` when nothing is recorded yet. */
  get(craft: string): CraftProgress {
    return readAll()[craft] ?? {};
  },

  /**
   * Shallow-merge a patch into a craft's record and persist immediately.
   * Nested values (like `quiz`) are replaced wholesale, not deep-merged.
   */
  set(craft: string, patch: Partial<CraftProgress>): void {
    const all = readAll();
    all[craft] = { ...all[craft], ...patch };
    Store.set(PROGRESS_KEY, all);
  },

  /** Wipe all progress for every craft. */
  reset(): void {
    Store.remove(PROGRESS_KEY);
  },
};
