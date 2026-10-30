/**
 * Craft-requested bench animations.
 *
 * A craft's extraButtons (elevon sweep, CG check...) can ask the workshop to
 * keep animating for a while: `craftAnim(4000)` keeps the render loop alive
 * for 4 s so `draw()` can read elapsed time and animate a check sequence.
 */

let busyUntil = 0;

export function craftAnim(ms: number): void {
  busyUntil = Math.max(busyUntil, performance.now() + ms);
}

export function craftAnimBusy(): boolean {
  return performance.now() < busyUntil;
}
