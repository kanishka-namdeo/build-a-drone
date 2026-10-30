/**
 * Drone Lab — lesson panels: the side roster nav, wiring diagram, and the
 * lesson grid (Design it / Meet the drone / Selected part / Parts in the box /
 * Fly it controls / firmware CLI / serial log / Check yourself / Practice).
 */

import type { CraftRecord, Design, CalcOut, FlightState } from '../types';
import type { ShellUi } from '../engine/shell';
import { esc } from '../engine/shell';
import { calcTiles, calcWarnings } from './calc';
import { Progress } from '../engine/storage';
import { AudioSys } from '../engine/audio';

export interface RosterEntry {
  key: string;
  fig: number;
  name: string;
  sub: string;
}

export interface LessonCtx {
  dr: CraftRecord;
  D: Record<string, unknown>;
  ui: ShellUi;
  calc(): CalcOut;
  design(): Design;
  selectPart(id: string | null): void;
  setDesign(patch: Partial<Design>): void;
  flying(): boolean;
  mode(): string;
  modes(): Record<string, { title: string; code?: string; hint?: string; alt?: boolean }>;
  isPlaced(id: string): boolean;
  partName(id: string): string;
  onQuiz(qi: number, ai: number): void;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function h(tag: string, cls?: string, html?: string): HTMLElement {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

/* ------------------------------------------------------------------ */
/* side roster nav                                                     */
/* ------------------------------------------------------------------ */

export function buildRoster(main: HTMLElement, roster: RosterEntry[], activeKey: string): void {
  const page = main.querySelector('.page') ?? main;
  // wrap the shell content in a column next to the nav
  const content = h('div', 'content');
  while (page.children.length) content.appendChild(page.children[0]);
  const nav = h('nav', 'side');
  nav.innerHTML = `<h1>Drone Lab</h1><p>Hand-inked drones you design, build and then fly.</p>`;
  for (const r of roster) {
    const a = h(
      'a',
      '',
      `<span>Fig. ${String(r.fig).padStart(2, '0')}</span><b>${esc(r.name)}</b><em>${esc(r.sub)}</em>`
    );
    a.setAttribute('href', `#${r.key}`);
    if (r.key === activeKey) a.setAttribute('aria-current', 'page');
    nav.appendChild(a);
  }
  nav.appendChild(h('small', '', 'Design it, wire it, build it, smoke-test it, then fly it in the simulator.'));
  page.appendChild(nav);
  page.appendChild(content);
}

/* ------------------------------------------------------------------ */
/* wiring diagram                                                      */
/* ------------------------------------------------------------------ */

const WIRE_STYLE: Record<string, { col: string; dash?: string; w: number }> = {
  power: { col: '#e2483d', w: 4 },
  data: { col: '#43b05c', dash: '10 7', w: 2.5 },
  video: { col: '#f2c230', w: 2.5 },
  motor: { col: '#f08a2b', w: 2.5 },
  rf: { col: '#8c4bd1', w: 2.5 },
  i2c: { col: '#3e86d9', w: 2.5 }
};

export function wiringSvg(dr: CraftRecord, d: Design, c: CalcOut, selected: string | null): string {
  const nodes = dr.wiring.nodes(d, c);
  let svg = '';
  // links first (under the boxes)
  for (const link of dr.wiring.links) {
    const A = nodes[link.from];
    const B = nodes[link.to];
    if (!A || !B) continue;
    const [ax, ay] = [A[0] + 75, A[1] + 28];
    const [bx, by] = [B[0] + 75, B[1] + 28];
    const st = WIRE_STYLE[link.kind] ?? WIRE_STYLE.data;
    const route = `M${ax} ${ay}L${bx} ${ay}L${bx} ${by}`;
    if (link.kind === 'power') {
      // red + black pair
      svg += `<path d="${route}" fill="none" stroke="#e2483d" stroke-width="4" transform="translate(-2.5 0)"/>`;
      svg += `<path d="${route}" fill="none" stroke="#3a3632" stroke-width="4" transform="translate(2.5 0)"/>`;
    } else {
      svg += `<path d="${route}" fill="none" stroke="${st.col}" stroke-width="${st.w}"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}/>`;
      if (link.kind === 'motor') {
        svg += `<path d="${route}" fill="none" stroke="${st.col}" stroke-width="${st.w}" transform="translate(0 -5)" opacity="0.55"/>`;
        svg += `<path d="${route}" fill="none" stroke="${st.col}" stroke-width="${st.w}" transform="translate(0 5)" opacity="0.55"/>`;
      }
    }
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    if (link.label) {
      svg += `<text x="${mx}" y="${my - 6}" font-family="ui-monospace,Menlo,monospace" font-size="10.5" font-weight="700" fill="#231e16" text-anchor="middle">${esc(link.label)}</text>`;
    }
    if (link.label2) {
      svg += `<text x="${mx}" y="${my + 14}" font-family="ui-monospace,Menlo,monospace" font-size="10.5" font-weight="700" fill="#231e16" text-anchor="middle">${esc(link.label2)}</text>`;
    }
  }
  // node boxes
  for (const [id, spec] of Object.entries(nodes)) {
    const [x, y, title, sub, col] = spec;
    const on = selected === id;
    const fill = on ? 'var(--accent)' : '#fbf8f0';
    svg +=
      `<g data-act="wire" data-id="${id}" role="button" tabindex="0">` +
      `<rect x="${x}" y="${y}" width="150" height="56" rx="10" fill="${fill}" stroke="#231e16" stroke-width="1.5"/>` +
      `<path d="M${x} ${y + 10}a10 10 0 0 1 10 -10v56h-10Z" fill="${col}"/>` +
      `<text x="${x + 18}" y="${y + 24}" font-family="ui-monospace,Menlo,monospace" font-size="12.5" font-weight="800" fill="#231e16">${esc(title)}</text>` +
      `<text x="${x + 18}" y="${y + 40}" font-family="ui-monospace,Menlo,monospace" font-size="10.5" fill="#857d6e">${esc(sub)}</text>` +
      `</g>`;
  }
  // legend
  const legend: Array<[string, string]> = [
    ['power', 'power'],
    ['data', 'data / signal'],
    ['video', 'video'],
    ['motor', 'motor phases'],
    ['rf', 'radio / RF']
  ];
  let lx = 20;
  for (const [kind, label] of legend) {
    const st = WIRE_STYLE[kind];
    svg += `<line x1="${lx}" y1="326" x2="${lx + 26}" y2="326" stroke="${st.col}" stroke-width="4"${st.dash ? ` stroke-dasharray="${st.dash}"` : ''}/>`;
    svg += `<text x="${lx + 32}" y="330" font-family="ui-monospace,Menlo,monospace" font-size="10.5" fill="#857d6e">${label}</text>`;
    lx += 32 + label.length * 6.6 + 18;
  }
  return `<svg viewBox="0 0 760 340" role="img" aria-label="wiring diagram" style="width:100%;height:auto">${svg}</svg>`;
}

/* ------------------------------------------------------------------ */
/* the lesson panels                                                   */
/* ------------------------------------------------------------------ */

export interface LessonDom {
  root: HTMLElement;
  sync(): void;
}

export function buildLesson(ctx: LessonCtx, main: HTMLElement): LessonDom {
  const dr = ctx.dr;
  const page = main.querySelector('.page .content') as HTMLElement;

  // ---- wiring section ----
  const wiringSec = h('section', 'wide wiring');
  wiringSec.innerHTML = `<h2>Wiring · click a block</h2>`;
  const wiringCard = h('div', 'card');
  wiringSec.appendChild(wiringCard);
  page.appendChild(wiringSec);

  wiringCard.addEventListener('click', (e) => {
    const g = (e.target as Element).closest('[data-act="wire"]');
    if (!g) return;
    const id = g.getAttribute('data-id') || null;
    ctx.selectPart(id === ctx.D.sel ? null : id);
  });

  // ---- lesson grid ----
  const lesson = h('section', 'lesson');
  const left = h('div', 'col');
  const right = h('div', 'col');
  lesson.appendChild(left);
  lesson.appendChild(right);
  page.appendChild(lesson);

  // left: design it
  const designSec = h('div', 'panel');
  designSec.innerHTML = `<h2>Design it</h2>`;
  const selRow = h('div', 'selrow');
  const mkSelect = (label: string, opts: Record<string, { name: string }>, key: string): HTMLSelectElement => {
    const wrap = h('label', 'selwrap', `<span>${label}</span>`);
    const s = document.createElement('select');
    for (const [k, v] of Object.entries(opts)) {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = v.name;
      s.appendChild(o);
    }
    s.value = key;
    s.addEventListener('change', () => {
      if (ctx.flying() && (ctx.D.flight as FlightState)?.armed) {
        ctx.ui.flash('Land and disarm before changing parts');
        s.value = key;
        return;
      }
      AudioSys.sfx('tick');
      ctx.setDesign({ [label.toLowerCase().includes('batt') ? 'batt' : label.toLowerCase().includes('motor') ? 'motor' : 'prop']: s.value } as Partial<Design>);
    });
    wrap.appendChild(s);
    selRow.appendChild(wrap); // keep the label + select together
    return s;
  };
  const d0 = ctx.design();
  mkSelect('Battery', dr.batts, d0.batt);
  mkSelect('Motors', dr.motors, d0.motor);
  mkSelect('Props', dr.props, d0.prop);
  designSec.appendChild(selRow);
  const tiles = h('div', 'tiles');
  designSec.appendChild(tiles);
  const warns = h('div', 'warns');
  designSec.appendChild(warns);
  const cost = h('table', 'cost');
  designSec.appendChild(cost);
  left.appendChild(designSec);

  // left: meet the drone
  const meetSec = h('div', 'panel');
  meetSec.innerHTML = `<h2>Meet the ${esc(dr.noun || 'drone')}</h2><div class="overview">${dr.overview}</div>`;
  left.appendChild(meetSec);

  // left: selected part
  const selSec = h('div', 'panel');
  selSec.innerHTML = `<h2>Selected part</h2>`;
  const selBody = h('div', 'selbody');
  selSec.appendChild(selBody);
  left.appendChild(selSec);

  // left: parts in the box
  const partsSec = h('div', 'panel');
  partsSec.innerHTML = `<h2>Parts in the box</h2>`;
  const chips = h('div', 'pchips');
  partsSec.appendChild(chips);
  left.appendChild(partsSec);

  chips.addEventListener('click', (e) => {
    const c = (e.target as Element).closest('button[data-id]');
    if (!c) return;
    const id = c.getAttribute('data-id') || null;
    ctx.selectPart(id === ctx.D.sel ? null : id);
  });

  // right: fly it controls
  const flySec = h('div', 'panel');
  const controls = dr.controls ?? [
    ['W S', 'throttle / climb + descend'],
    ['A D', 'yaw left / right'],
    ['arrows', 'pitch + roll'],
    ['Space', 'arm / disarm'],
    ['R', 'reset to the pad'],
    ['V', 'FPV view on / off']
  ];
  flySec.innerHTML =
    `<h2>Fly it · controls</h2><div class="keys">` +
    controls.map(([k, v]) => `<div><kbd>${esc(k)}</kbd><span>${esc(v)}</span></div>`).join('') +
    `</div><p class="mut">or drag the two sticks on the figure.</p>`;
  right.appendChild(flySec);

  // right: CLI
  const cliSec = h('div', 'panel');
  cliSec.innerHTML = `<h2 class="cliname">${esc(dr.cliName || 'Betaflight')} CLI · <em class="climode">build</em></h2>`;
  const cliPre = h('pre', 'code');
  cliSec.appendChild(cliPre);
  right.appendChild(cliSec);

  // right: log
  const logSec = h('div', 'panel');
  logSec.innerHTML = `<h2>${esc(dr.logName || 'Betaflight')} log</h2>`;
  const term = h('div', 'term');
  logSec.appendChild(term);
  right.appendChild(logSec);

  // right: quiz
  const quizSec = h('div', 'panel');
  quizSec.innerHTML = `<h2>Check yourself</h2>`;
  const quizBody = h('div', 'quiz');
  quizSec.appendChild(quizBody);
  right.appendChild(quizSec);

  quizBody.addEventListener('click', (e) => {
    const chip = (e.target as Element).closest('button[data-q]');
    if (!chip) return;
    const qi = parseInt(chip.getAttribute('data-q') || '0', 10);
    const ai = parseInt(chip.getAttribute('data-a') || '0', 10);
    ctx.onQuiz(qi, ai);
  });

  // right: practice
  if (dr.practice) {
    const prSec = h('div', 'panel');
    prSec.innerHTML = `<h2>Practice task</h2><p>${dr.practice}</p>`;
    right.appendChild(prSec);
  }

  /* ---- sync ---- */
  let sig = '';
  const sync = (): void => {
    const d = ctx.design();
    const c = ctx.calc();
    const sel = (ctx.D.sel as string) || '';
    const serial = (ctx.D.serial as string[]) ?? [];
    const quiz = (ctx.D.quiz as Record<number, number>) ?? {};
    const newSig = JSON.stringify([d, sel, serial.length, serial[serial.length - 1], ctx.flying(), ctx.mode(), quiz]);
    if (newSig === sig) return;
    sig = newSig;

    // design selects
    const sels = selRow.querySelectorAll('select');
    if (sels[0]) sels[0].value = d.batt;
    if (sels[1]) sels[1].value = d.motor;
    if (sels[2]) sels[2].value = d.prop;

    // tiles
    const rows = dr.calcRows ? dr.calcRows(c) : calcTiles(c).map((t) => ({ ...t, small: false }));
    tiles.innerHTML = rows
      .map((t) => `<div class="tile"><div class="tv">${esc(t.value)}</div><div class="tk">${esc(t.label)}</div></div>`)
      .join('');

    // warnings
    warns.innerHTML = calcWarnings(dr, d, c)
      .map((w) => `<div class="${w.warn ? 'warn' : 'ok'}">${esc(w.text)}</div>`)
      .join('');

    // cost
    cost.innerHTML =
      `<tr><th>Category</th><th>Parts</th><th>Cost</th></tr>` +
      `<tr><td>Electrical</td><td>${c.nElect}</td><td>$${Math.round(c.cost.Electrical)}</td></tr>` +
      `<tr><td>Mechanical</td><td>${c.nMech}</td><td>$${Math.round(c.cost.Mechanical)}</td></tr>` +
      `<tr><td colspan="2"><b>Total (approx.)</b></td><td><b>$${Math.round(c.cost.Total)}</b></td></tr>`;

    // wiring
    wiringCard.innerHTML = wiringSvg(dr, d, c, sel);

    // selected part
    const part = sel ? dr.parts.find((p) => p.id === sel) : null;
    if (part) {
      const placed = ctx.isPlaced(part.id);
      selBody.innerHTML =
        `<div class="selname"><b>${esc(part.short)}</b> · ${placed ? 'fitted' : 'in the box'}</div>` +
        `<div class="seltitle">${esc(part.name)}</div>` +
        `<p>${esc(part.what)}</p>`;
    } else {
      selBody.innerHTML = `<p class="mut">nothing selected — click any part, a wiring block, or a name below.</p>`;
    }

    // parts chips
    chips.innerHTML = dr.parts
      .map(
        (p) =>
          `<button data-id="${p.id}" class="pchip${ctx.isPlaced(p.id) ? ' on' : ''}${sel === p.id ? ' sel' : ''}" aria-pressed="${sel === p.id}">${esc(p.short)}</button>`
      )
      .join('');

    // cli
    const climode = cliSec.querySelector('.climode') as HTMLElement;
    if (ctx.flying()) {
      const m = ctx.modes()[ctx.mode()];
      climode.textContent = m?.title || ctx.mode();
      cliPre.textContent = m?.code || dr.buildCode;
    } else {
      climode.textContent = 'build';
      cliPre.textContent = dr.buildCode;
    }

    // log
    term.innerHTML = serial.slice(-10).map((l) => `<div>${esc(l)}</div>`).join('');

    // quiz
    quizBody.innerHTML = dr.quiz
      .map(
        (q, qi) =>
          `<div class="qq"><div class="q">${esc(q.q)}</div><div class="aa">` +
          q.a
            .map(
              (a, ai) =>
                `<button data-q="${qi}" data-a="${ai}" class="chip${quiz[qi] === ai ? (ai === q.ok ? ' ok' : ' no') : ''}">${esc(a)}</button>`
            )
            .join('') +
          `</div></div>`
      )
      .join('');
  };

  return { root: lesson, sync };
}

/** Persist a quiz answer + return whether it was correct. */
export function recordQuiz(craftKey: string, qi: number, ai: number, okIdx: number): boolean {
  const p = Progress.get(craftKey);
  const quiz = { ...(p.quiz ?? {}) };
  quiz[qi] = ai;
  Progress.set(craftKey, { quiz });
  return ai === okIdx;
}
