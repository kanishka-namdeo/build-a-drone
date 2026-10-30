/// <reference types="vite/client" />

/**
 * Drone Lab — PWA registration helper.
 *
 * Registers the cache-first service worker (`./sw.js`, scope `./'`) in
 * production builds only. In dev the worker would fight Vite's HMR, and the
 * precache list would go stale instantly, so it is deliberately skipped.
 *
 * Registration happens after the page has loaded so it never competes with
 * the app's own boot requests. Failures are logged silently: offline support
 * is strictly best-effort and must never break the workshop.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (typeof window === 'undefined') return;

  const register = (): void => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      /* registration failed — the app still works online */
    });
  };

  if (window.document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}
