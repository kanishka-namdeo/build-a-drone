/**
 * Drone Lab — flight controls: keyboard + on-screen dual virtual sticks.
 *
 * Keyboard: W/S throttle (climb/descend in alt-hold, absolute throttle ramp
 * otherwise), A/D yaw, arrows pitch + roll, Space arm/disarm, R reset, V FPV.
 * Touch/mouse sticks: left = throttle+yaw, right = pitch+roll, spring-centred
 * except the absolute throttle.
 */

export interface StickState {
  thr: number;
  thrAbs: number;
  yaw: number;
  pitch: number;
  roll: number;
}

export interface VStick {
  thr: number | null;
  yaw: number | null;
  pitch: number | null;
  roll: number | null;
}

export interface ControlsHooks {
  onArm(): void;
  onReset(): void;
  onFpv(): void;
  isFlying(): boolean;
  inInput(el: EventTarget | null): boolean;
}

const KEYS = new Set<string>();

export function keyDown(e: KeyboardEvent, hooks: ControlsHooks): boolean {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (hooks.inInput(e.target)) return false;
  if (!hooks.isFlying()) return false;
  if (KEYS.has(k)) return false;
  KEYS.add(k);
  if (k === ' ') {
    e.preventDefault();
    hooks.onArm();
    return true;
  }
  if (k === 'r') {
    hooks.onReset();
    return true;
  }
  if (k === 'v') {
    hooks.onFpv();
    return true;
  }
  if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) {
    e.preventDefault();
    return true;
  }
  return false;
}

export function keyUp(e: KeyboardEvent): void {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  KEYS.delete(k);
}

export function clearKeys(): void {
  KEYS.clear();
}

/** Merge keyboard state + virtual stick overrides into the stick values. */
export function readSticks(stick: StickState, vstick: VStick, dt: number, altMode: boolean): void {
  const target = (pos: boolean, neg: boolean): number => (pos ? 1 : neg ? -1 : 0);
  const k = Math.min(1, dt * 10);
  const smooth = (cur: number, t: number): number => cur + (t - cur) * k;

  // throttle
  if (altMode) {
    const t = target(KEYS.has('w'), KEYS.has('s'));
    stick.thr = smooth(stick.thr, t);
  } else {
    const dir = target(KEYS.has('w'), KEYS.has('s'));
    stick.thrAbs = Math.min(1, Math.max(0, stick.thrAbs + dir * 0.32 * dt));
  }
  // yaw
  const ty = target(KEYS.has('d'), KEYS.has('a'));
  stick.yaw = smooth(stick.yaw, ty);
  // pitch (up arrow = nose down? no: up = fly forward = pitch forward)
  const tp = target(KEYS.has('ArrowUp'), KEYS.has('ArrowDown'));
  stick.pitch = smooth(stick.pitch, tp);
  // roll (right arrow banks right)
  const tr = target(KEYS.has('ArrowRight'), KEYS.has('ArrowLeft'));
  stick.roll = smooth(stick.roll, -tr);

  // virtual stick overrides
  if (vstick.thr != null) {
    if (altMode) stick.thr = vstick.thr;
    else stick.thrAbs = Math.min(1, Math.max(0, (vstick.thr + 1) / 2));
  }
  if (vstick.yaw != null) stick.yaw = vstick.yaw;
  if (vstick.pitch != null) stick.pitch = vstick.pitch;
  if (vstick.roll != null) stick.roll = vstick.roll;
}

/* ------------------------------------------------------------------ */
/* virtual sticks                                                      */
/* ------------------------------------------------------------------ */

export interface PadHandle {
  el: HTMLElement;
  destroy(): void;
}

/** Wire up one round stick pad. `cb` receives [-1..1, -1..1] or null on release. */
export function makePad(el: HTMLElement, cb: (x: number, y: number | null, released: boolean) => void, keepY: boolean): PadHandle {
  const knob = el.querySelector('i') as HTMLElement | null;
  const R = 40;
  let activeId: number | null = null;
  let grabDy = 0;

  const setKnob = (x: number, y: number): void => {
    if (knob) knob.style.transform = `translate(${x * R}px, ${y * R}px)`;
  };

  const handle = (e: PointerEvent): void => {
    const r = el.getBoundingClientRect();
    let x = ((e.clientX - r.left) / r.width) * 2 - 1;
    let y = ((e.clientY - r.top) / r.height) * 2 - 1;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    setKnob(x, y);
    cb(x, y, false);
  };

  const down = (e: PointerEvent): void => {
    if (activeId !== null) return;
    activeId = e.pointerId;
    el.setPointerCapture?.(e.pointerId);
    if (keepY && knob) {
      const cur = knob.style.transform.match(/-?[\d.]+/g);
      grabDy = cur && cur.length >= 2 ? parseFloat(cur[1]) / R : 0;
    }
    handle(e);
    e.preventDefault();
  };
  const move = (e: PointerEvent): void => {
    if (e.pointerId !== activeId) return;
    if (keepY) {
      // absolute throttle: shift the grab offset so the knob doesn't jump
      const r = el.getBoundingClientRect();
      let y = ((e.clientY - r.top) / r.height) * 2 - 1 + grabDy;
      let x = ((e.clientX - r.left) / r.width) * 2 - 1;
      const l = Math.hypot(x, y);
      if (l > 1) {
        x /= l;
        y /= l;
      }
      setKnob(x, y);
      cb(x, y, false);
    } else {
      handle(e);
    }
  };
  const up = (e: PointerEvent): void => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    if (keepY) {
      // park the knob where the throttle is; only x recentres
      if (knob) {
        const cur = knob.style.transform.match(/-?[\d.]+/g);
        const yv = cur && cur.length >= 2 ? parseFloat(cur[1]) / R : 0;
        setKnob(0, yv);
      }
      cb(0, null, true);
    } else {
      setKnob(0, 0);
      cb(0, null, true);
    }
  };

  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);

  return {
    el,
    destroy() {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    }
  };
}
