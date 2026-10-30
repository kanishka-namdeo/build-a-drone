/**
 * Drone Lab — figure page shell.
 *
 * Builds the page chrome around an interactive SVG scene: header, stage,
 * workshop button column, stats overlay, toast, chips popovers, and the
 * controls row (hand-drawn wobble slider, palette swatches, labels toggle).
 *
 * The shell is deliberately framework-free: scenes are SVG strings produced by
 * the engine, re-rendered into `<g id="art">` on demand.
 */

import {
  Vec2,
  Vec3,
  Tone,
  PALETTES,
  INK,
  project,
  setPan,
  handInkFilter,
  inkScaleSvg,
  setInkScaleRef,
  inkScale,
  paperGrainDataUri
} from './core';
import { AudioSys } from './audio';

export interface ShellState {
  pal: string;
  [key: string]: unknown;
}

export interface ShellChoice {
  label: string;
  onClick?(st: ShellState, ui: ShellUi): void;
  current?: boolean;
  disabled?: boolean;
  why?: string;
}

export interface ShellButton {
  label: string;
  onClick?(st: ShellState, ui: ShellUi): void;
  choices?(st: ShellState): ShellChoice[];
  /** Extra class names on the button (e.g. 'flyb'). */
  cls?: string;
}

export interface StatItem {
  label: string;
  value: string;
  small?: boolean;
}

export interface ShellUi {
  st: ShellState;
  render(): void;
  animate(step: (dt: number) => boolean | void): void;
  flash(text: string, ms?: number): void;
  drawStats(): void;
  /** Wrap render with an extra sync pass (used by the workshop panels). */
  wrapRender(fn: () => void): void;
  /** Change the viewBox width (flight scenes reframe every frame). */
  setViewBox(w: number, h?: number): void;
  /** Change the ink scale (flight scenes zoom in/out). */
  setInkK(k: number): void;
  /** Restore the framing computed at mount (back to the bench). */
  resetFrame(): void;
  /** The scene svg root (for direct attribute tweaks). */
  svg: SVGSVGElement;
  /** The filtered art group. */
  art: SVGGElement;
}

export interface ShellCfg {
  fig: string;
  title: string;
  hint?: string;
  size: Vec3;
  palette?: string;
  state: ShellState;
  scene(st: ShellState, m: Tone): string;
  readout?(st: ShellState): string;
  buttons?: ShellButton[];
  buttonsLabel?: string;
  stats?(st: ShellState): StatItem[];
  acts?: Record<string, (st: ShellState, el: Element, ui: ShellUi) => void>;
  params?(st: ShellState, q: URLSearchParams): void;
  frame?: { fill?: number; left?: number };
  center?: Vec2;
  credit?: boolean;
}

/* ------------------------------------------------------------------ */

const errorLog: string[] = [];
function trackError(msg: string): void {
  errorLog.push(msg);
  document.documentElement.setAttribute('data-errors', errorLog.join('|'));
}

window.addEventListener('error', (e) => trackError(String(e.message)));

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

let pressTimers: number[] = [];
function clearPressTimers(): void {
  pressTimers.forEach((t) => clearTimeout(t));
  pressTimers = [];
}

/** Mount the figure shell into `#app` and return the ui handle. */
export function mountFigure(cfg: ShellCfg): ShellUi {
  clearPressTimers();
  const st = cfg.state;
  st.pal = st.pal || cfg.palette || 'mustard';

  // ---- framing ---------------------------------------------------------
  let OX = 0;
  let OY = 0;
  let INKK = 1;
  let vbW = 100;
  const computeFrame = (): void => {
    const [W, D, H] = cfg.size;
    const ctr = cfg.center || [W / 2, D / 2];
    setPan(0, 0);
    const corners: Vec3[] = [
      [0, 0, 0],
      [W, 0, 0],
      [0, D, 0],
      [W, D, 0],
      [0, 0, H],
      [W, 0, H],
      [0, D, H],
      [W, D, H]
    ];
    let minX = 1e9;
    let minY = 1e9;
    let maxX = -1e9;
    let maxY = -1e9;
    // project corners about the rotation centre with pan 0
    for (const c of corners) {
      const x = c[0] - ctr[0];
      const y = c[1] - ctr[1];
      const [sx, sy] = [(x - y) * Math.cos(Math.PI / 6), (x + y) * Math.sin(Math.PI / 6) - c[2]];
      minX = Math.min(minX, sx);
      maxX = Math.max(maxX, sx);
      minY = Math.min(minY, sy);
      maxY = Math.max(maxY, sy);
    }
    const bw = maxX - minX;
    const bh = maxY - minY;
    const fill = cfg.frame?.fill ?? 0.74;
    vbW = Math.max(bw / fill, bh / 0.88 / 0.75);
    const vbH = vbW * 0.75;
    OX = (cfg.frame?.left != null ? vbW * cfg.frame.left : (vbW - bw) / 2 + vbW * 0.06) - minX;
    OY = vbH * 0.04 - minY;
    INKK = vbW / 585;
    void ctr;
  };
  computeFrame();

  const applyPan = (): void => setPan(OX, OY);
  setInkScaleRef(INKK);

  // ---- dom ---------------------------------------------------------------
  const app = document.getElementById('app')!;
  app.innerHTML = '';
  document.title = `${cfg.title} — Drone Lab`;

  const main = el('main', 'page');
  app.appendChild(main);

  const header = el('header');
  header.appendChild(el('h1', '', `Fig. ${cfg.fig} — ${esc(cfg.title)}`));
  if (cfg.hint) header.appendChild(el('span', '', esc(cfg.hint)));
  main.appendChild(header);

  const stage = el('div', 'stage');
  main.appendChild(stage);

  const actions = el('div', 'actions');
  actions.id = 'btns';
  const cap = el('div', 'cap', esc(cfg.buttonsLabel || 'Try it'));
  actions.appendChild(cap);
  stage.appendChild(actions);

  const statsBox = el('div', 'stats');
  statsBox.id = 'stats';
  stage.appendChild(statsBox);

  const toast = el('div', 'toast');
  toast.id = 'toast';
  toast.setAttribute('role', 'status');
  stage.appendChild(toast);

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.id = 'fig';
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', cfg.title);
  svg.setAttribute('viewBox', `0 0 ${vbW.toFixed(1)} ${(vbW * 0.75).toFixed(1)}`);
  const defs = document.createElementNS(svgNS, 'defs');
  defs.id = 'fdefs';
  svg.appendChild(defs);
  const art = document.createElementNS(svgNS, 'g');
  art.id = 'art';
  art.setAttribute('filter', 'url(#handink)');
  svg.appendChild(art);
  stage.appendChild(svg);

  const readout = el('div');
  readout.id = 'readout';
  main.appendChild(readout);

  // ---- ui object -----------------------------------------------------------
  let extraRender: (() => void) | null = null;
  let flashUntil = 0;
  let animBusy = false;
  let prevStats = new Map<string, string>();

  const ui: ShellUi = {
    st,
    svg,
    art,
    render() {
      const m = PALETTES[st.pal] || PALETTES.mustard;
      document.documentElement.style.setProperty('--accent', m.l);
      document.documentElement.style.setProperty('--lab-accent', m.l);
      applyPan();
      setInkScaleRef(INKK);
      const sceneSvg = cfg.scene(st, m); // may reframe via ui.setViewBox / setInkK
      defs.innerHTML = handInkFilter(INKK);
      art.innerHTML = inkScaleSvg(sceneSvg, INKK);
      const ro = cfg.readout?.(st) ?? '';
      if (!flashUntil && ro) readout.textContent = ro;
      ui.drawStats();
      if (extraRender) extraRender();
    },
    animate(step) {
      if (animBusy) return;
      animBusy = true;
      let last = performance.now();
      const loop = (): void => {
        const now = performance.now();
        const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
        last = now;
        const busy = step(dt);
        ui.render();
        if (busy !== false) {
          setTimeout(loop, 16);
        } else {
          animBusy = false;
        }
      };
      setTimeout(loop, 16);
    },
    flash(text, ms = 1600) {
      toast.textContent = text;
      toast.classList.add('show');
      if (cfg.readout) readout.textContent = text;
      flashUntil = performance.now() + ms;
      setTimeout(() => {
        if (performance.now() >= flashUntil - 1) {
          toast.classList.remove('show');
          flashUntil = 0;
          ui.render();
        }
      }, ms);
    },
    drawStats() {
      const items = cfg.stats?.(st) ?? [];
      const key = JSON.stringify(items);
      const prev = statsBox.getAttribute('data-sig') || '';
      if (key === prev) return;
      statsBox.setAttribute('data-sig', key);
      statsBox.innerHTML = '';
      for (const it of items) {
        const d = el('div', 'stat');
        const v = el('div', 'v' + (it.small ? ' small' : ''), esc(it.value));
        if (prevStats.get(it.label) !== it.value) {
          v.classList.add('bump');
          setTimeout(() => v.classList.remove('bump'), 380);
        }
        d.appendChild(v);
        d.appendChild(el('div', 'k', esc(it.label)));
        statsBox.appendChild(d);
        prevStats.set(it.label, it.value);
      }
    },
    wrapRender(fn) {
      extraRender = fn;
    },
    setViewBox(w, h) {
      vbW = w;
      svg.setAttribute('viewBox', `0 0 ${w.toFixed(1)} ${(h ?? w * 0.75).toFixed(1)}`);
    },
    setInkK(k) {
      INKK = k;
      setInkScaleRef(k);
    },
    resetFrame() {
      computeFrame();
      ui.setInkK(INKK);
      ui.setViewBox(vbW);
    }
  };

  // ---- buttons ------------------------------------------------------------
  const closeChips = (): void => {
    actions.querySelectorAll('.stepwrap.open').forEach((n) => n.classList.remove('open'));
  };
  document.addEventListener('click', (e) => {
    if (!(e.target as Element).closest?.('.stepwrap')) closeChips();
  });

  const rebuildButtons = (): void => {
    actions.innerHTML = '';
    actions.appendChild(cap);
    for (const b of cfg.buttons || []) {
      const wrap = el('div', 'stepwrap');
      const btn = el('button', `act${b.cls ? ' ' + b.cls : ''}`, esc(b.label));
      btn.type = 'button';
      wrap.appendChild(btn);
      if (b.choices) {
        btn.classList.add('car');
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const wasOpen = wrap.classList.contains('open');
          closeChips();
          if (wasOpen) return;
          const chips = el('div', 'chips');
          for (const c of b.choices!(st)) {
            const chip = el('button', 'chip' + (c.current ? ' current' : '') + (c.disabled ? ' off' : ''), esc(c.label));
            chip.type = 'button';
            if (c.disabled) chip.setAttribute('aria-disabled', 'true');
            chip.addEventListener('click', (ev) => {
              ev.stopPropagation();
              if (c.disabled) {
                ui.flash(c.why || 'Not available right now');
                return;
              }
              AudioSys.sfx('tick');
              c.onClick?.(st, ui);
              closeChips();
              ui.render();
            });
            chips.appendChild(chip);
          }
          wrap.appendChild(chips);
          wrap.classList.add('open');
        });
      } else {
        btn.addEventListener('click', () => {
          AudioSys.sfx('tick');
          b.onClick?.(st, ui);
          ui.render();
        });
      }
      actions.appendChild(wrap);
    }
  };

  // ---- svg interactions (pointerdown: elements re-render during motion) ----
  svg.addEventListener('pointerdown', (e) => {
    const target = (e.target as Element).closest('[data-act]');
    if (!target) return;
    const name = target.getAttribute('data-act') || '';
    const fn = cfg.acts?.[name];
    if (fn) {
      fn(st, target, ui);
      ui.render();
    }
  });
  svg.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = (e.target as Element).closest('[data-act]');
    if (!target) return;
    const name = target.getAttribute('data-act') || '';
    cfg.acts?.[name]?.(st, target, ui);
    ui.render();
  });

  // ---- controls row ---------------------------------------------------------
  const controls = el('div', 'controls');

  const wobWrap = el('div', 'ctl');
  wobWrap.appendChild(el('label', '', 'Hand-drawn wobble'));
  const wob = document.createElement('input');
  wob.id = 'wb';
  wob.type = 'range';
  wob.min = '0';
  wob.max = '7';
  wob.step = '0.1';
  wob.value = '0';
  wobWrap.appendChild(wob);
  controls.appendChild(wobWrap);

  const colWrap = el('div', 'ctl');
  colWrap.appendChild(el('label', '', 'Colour'));
  const pals = el('div', 'row');
  pals.id = 'pals';
  for (const key of Object.keys(PALETTES)) {
    const sw = el('button', 'sw');
    sw.type = 'button';
    sw.title = key;
    sw.setAttribute('aria-label', key);
    sw.style.background = PALETTES[key].l;
    sw.setAttribute('aria-pressed', String(st.pal === key));
    sw.addEventListener('click', () => {
      st.pal = key;
      pals.querySelectorAll('.sw').forEach((s) => s.setAttribute('aria-pressed', String(s === sw)));
      AudioSys.sfx('tick');
      ui.render();
    });
    pals.appendChild(sw);
  }
  colWrap.appendChild(pals);
  controls.appendChild(colWrap);

  const lblWrap = el('div', 'ctl');
  lblWrap.id = 'lblctl';
  lblWrap.hidden = true;
  lblWrap.appendChild(el('label', '', 'Labels'));
  const lbl = el('button', '', 'On');
  lbl.id = 'lbl';
  lbl.type = 'button';
  lbl.setAttribute('aria-pressed', 'true');
  lbl.addEventListener('click', () => {
    const on = document.documentElement.classList.toggle('nolabels');
    lbl.textContent = on ? 'Off' : 'On';
    lbl.setAttribute('aria-pressed', String(!on));
  });
  lblWrap.appendChild(lbl);
  controls.appendChild(lblWrap);

  const sndWrap = el('div', 'ctl');
  sndWrap.appendChild(el('label', '', 'Sound'));
  const sndRow = el('div', 'row');
  const musBtn = el('button', '', 'Lofi');
  musBtn.type = 'button';
  musBtn.setAttribute('aria-pressed', String(AudioSys.music));
  musBtn.addEventListener('click', () => {
    AudioSys.setMusic(!AudioSys.music);
    musBtn.setAttribute('aria-pressed', String(AudioSys.music));
  });
  const fxBtn = el('button', '', 'Effects');
  fxBtn.type = 'button';
  fxBtn.setAttribute('aria-pressed', String(AudioSys.effects));
  fxBtn.addEventListener('click', () => {
    AudioSys.setEffects(!AudioSys.effects);
    fxBtn.setAttribute('aria-pressed', String(AudioSys.effects));
  });
  sndRow.appendChild(musBtn);
  sndRow.appendChild(fxBtn);
  sndWrap.appendChild(sndRow);
  controls.appendChild(sndWrap);

  main.appendChild(controls);

  if (cfg.credit !== false) {
    const made = el('p', 'made-with');
    made.innerHTML = `<a href="https://github.com/kanishka-namdeo/build-a-drone" target="_blank" rel="noopener">build-a-drone ↗</a>`;
    main.appendChild(made);
  }

  // unlock audio on first gesture
  const unlock = (): void => AudioSys.unlock();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });

  // wobble slider live-patches the displacement scale
  wob.addEventListener('input', () => {
    const wobEl = document.getElementById('inkwob');
    if (wobEl) wobEl.setAttribute('scale', (parseFloat(wob.value) * INKK).toFixed(2));
  });

  // ---- url params + test hooks ---------------------------------------------
  const q = new URLSearchParams(location.search);
  const hashQuery = location.hash.split('?')[1];
  if (hashQuery) {
    for (const [k, v] of new URLSearchParams(hashQuery)) q.append(k, v);
  }
  const pal = q.get('pal');
  if (pal && PALETTES[pal]) st.pal = pal;
  if (q.get('labels') === '0') {
    document.documentElement.classList.add('nolabels');
    lbl.textContent = 'Off';
    lbl.setAttribute('aria-pressed', 'false');
  }
  cfg.params?.(st, q);

  const press = q.get('press');
  if (press) {
    for (const spec of press.split(',')) {
      const [label, ms] = spec.split('@');
      const t = window.setTimeout(() => {
        const btns = Array.from(actions.querySelectorAll('button.act')).filter(
          (b) => b.textContent && b.textContent.startsWith(label.split('>')[0])
        );
        if (!btns.length) {
          trackError(`press: no button ${label}`);
          return;
        }
        if (label.includes('>')) {
          (btns[0] as HTMLElement).click();
          const choice = label.split('>')[1];
          setTimeout(() => {
            const chip = Array.from(actions.querySelectorAll('button.chip')).find((c) =>
              c.textContent?.startsWith(choice)
            );
            if (chip) (chip as HTMLElement).click();
            else trackError(`press: no chip ${choice}`);
          }, 120);
        } else {
          (btns[0] as HTMLElement).click();
        }
      }, parseInt(ms || '300', 10));
      pressTimers.push(t);
    }
  }

  // expose state for tests
  (window as unknown as Record<string, unknown>).__st = st;

  rebuildButtons();
  ui.render();

  // reveal the labels control only when the art actually has tags
  if (art.querySelector('.dl-tag')) lblWrap.hidden = false;

  return ui;
}

/** Escape text for innerHTML insertion. */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Paper grain background CSS (injected once by styles import). */
export const PAPER_GRAIN_URI = paperGrainDataUri();
void INK;
