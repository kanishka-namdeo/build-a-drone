/**
 * Drone Lab — shared types: craft records, designs, calculators, flight.
 */

import type { Vec3, Tone } from './engine/core';
import type { Frame } from './engine/frames';
import type { ShellButton, StatItem } from './engine/shell';

/* ------------------------------------------------------------------ */
/* design + calculator                                                 */
/* ------------------------------------------------------------------ */

export interface Design {
  batt: string;
  motor: string;
  prop: string;
}

export interface BattOption {
  name: string;
  cells: number;
  mah: number;
  g: number;
  price: number;
  /** Battery case colour. */
  col?: string;
  /** Case label drawn on the pack. */
  lab?: string;
  liion?: boolean;
}

export interface MotorOption {
  name: string;
  kv: number;
  g: number;
  price: number;
  forCells?: number;
  /** Thrust size factor (small motors on big frames). */
  sz?: number;
}

export interface PropOption {
  name: string;
  /** Thrust power factor (1 = baseline). */
  pf: number;
  /** Hover efficiency factor. */
  eff: number;
  g: number;
  price: number;
}

export interface FixedPart {
  id: string;
  name: string;
  g: number;
  price: number;
  cat: 'Electrical' | 'Mechanical';
}

export interface CalcOut {
  V: number;
  krpm: number;
  thrust: number;
  auw: number;
  tw: number;
  hoverW: number;
  hoverA: number;
  hoverMin: number;
  flyMin: number;
  maxA: number;
  over: boolean;
  weak: boolean;
  hoverThr: number;
  cost: { Electrical: number; Mechanical: number; Total: number };
  nElect: number;
  nMech: number;
  [k: string]: unknown;
}

/* ------------------------------------------------------------------ */
/* bench parts                                                         */
/* ------------------------------------------------------------------ */

export interface CraftPart {
  /** Canonical id (FRAME, MOTORS, ESC, WIRES, FC, XT60, CAM, RX, VTX, TOP, BATT, PROPS...). */
  id: string;
  name: string;
  short: string;
  /** Exploded-view layer. */
  z: number;
  /** Prerequisite part ids. */
  after?: string[];
  /** Orientation options: [normal, flipped] labels — flipped is the mistake. */
  polar?: [string, string];
  what: string;
}

export type MotorPos = [number, number, string, 'CW' | 'CCW'];

/* ------------------------------------------------------------------ */
/* drawing contract                                                    */
/* ------------------------------------------------------------------ */

export interface DrawOpt {
  has(id: string): boolean;
  /** Part frame lifted for drop / explode animation. */
  U(id: string): Frame;
  /** 0 = normal, 1 = flipped (polar parts). */
  orient(id: string): number;
  m: Tone;
  /** Motor spin phase (bench tests). */
  spin: number[];
  /** Motor rpm level 0..1 (flight). */
  rpm: number[];
  power: boolean;
  broken: boolean;
  k: number;
  design: Design;
  plugged: boolean;
  fault: boolean;
  all: boolean;
  fl?: FlightState;
}

export interface DrawAdd {
  (at: Vec3, svg: string, id?: string): void;
}

/* ------------------------------------------------------------------ */
/* wiring                                                              */
/* ------------------------------------------------------------------ */

export interface WiringNodeSpec {
  [id: string]: [number, number, string, string, string]; // x, y, title, sub, colour
}

export type WireKind = 'power' | 'data' | 'video' | 'motor' | 'rf' | 'i2c';

export interface WiringLink {
  from: string;
  to: string;
  kind: WireKind;
  label?: string;
  /** Extra label for the second conductor (power pairs). */
  label2?: string;
}

/* ------------------------------------------------------------------ */
/* quiz                                                                */
/* ------------------------------------------------------------------ */

export interface QuizQ {
  q: string;
  a: string[];
  ok: number;
}

/* ------------------------------------------------------------------ */
/* flight                                                              */
/* ------------------------------------------------------------------ */

export type LogKind = 'betaflight' | 'ardupilot' | 'inav' | 'crazyflie' | 'mavsdk';

export interface FlightMode {
  title: string;
  code?: string;
  hint?: string;
  /** Altitude-hold style throttle. */
  alt?: boolean;
}

export type WorldPrim =
  | { t: 'box'; x: number; y: number; z?: number; w: number; d: number; h: number; yaw?: number; col?: string; solid?: boolean; label?: string }
  | { t: 'cyl'; x: number; y: number; z?: number; r: number; h: number; r1?: number; n?: number; rot?: number; col?: string; solid?: boolean }
  | { t: 'tree'; x: number; y: number; h: number }
  | { t: 'pole'; x: number; y: number; h: number; col?: string; r?: number }
  | { t: 'gate'; x: number; y: number; heading: number; w?: number; h?: number; col?: string }
  | { t: 'house'; x: number; y: number; w: number; d: number; h: number; yaw?: number; col?: string; roof?: number; roofCol?: string }
  | { t: 'flat'; x: number; y: number; w: number; d: number; yaw?: number; col?: string; label?: string; ink?: boolean }
  | { t: 'disc'; x: number; y: number; r: number; col?: string; label?: string };

export interface Goal {
  x: number;
  y: number;
  z: number;
  r: number;
  /** Ring heading (degrees): must cross flying that way. null = touch sphere. */
  heading?: number | null;
  label?: string;
}

export interface RangeSpec {
  title: string;
  brief: string;
  field?: number;
  pad?: [number, number];
  ground?: string;
  alt?: boolean;
  keepGates?: boolean;
  prims?: WorldPrim[];
  goals?: Goal[];
  camTilt?: number;
  code?: string;
  /** Indoor range: warm walls/ceiling instead of sky, clouds and hills. */
  indoor?: boolean;
}

export interface FlightState {
  pos: Vec3;
  vel: Vec3;
  roll: number;
  pitch: number;
  yaw: number;
  tumble: number;
  thr: number;
  thrEff: number;
  armed: boolean;
  crashed: boolean;
  t: number;
  volt: number;
  used: number;
  heat: number;
  spin: number[];
  cam: Vec3;
  gate: number;
  goal: number;
  lapStart: number;
  runStart: number;
  msg: string;
  msgT: number;
  crashWhy?: string;
  flipWhy?: string;
  desync: boolean;
  lowWarned: boolean;
  outWarned: boolean;
  prevD: number;
  c: CalcOut;
  step: number;
  [k: string]: unknown;
}

/* ------------------------------------------------------------------ */
/* physics context (given to craft physics overrides)                  */
/* ------------------------------------------------------------------ */

export interface PhysCtx {
  /** Run the stock multirotor step (optionally with autopilot sticks set first). */
  stock(fl: FlightState, dt: number): void;
  batteryStep(fl: FlightState, dt: number): void;
  crash(fl: FlightState, why: string): void;
  worldCollide(fl: FlightState): void;
  goalCheck(fl: FlightState): void;
  gateCheck(fl: FlightState): void;
  say(msg: string, t?: number): void;
  stick: { thr: number; thrAbs: number; yaw: number; pitch: number; roll: number };
}

/* ------------------------------------------------------------------ */
/* the craft record                                                    */
/* ------------------------------------------------------------------ */

export interface CraftRecord {
  key: string;
  fig: number;
  name: string;
  sub: string;
  hint?: string;
  noun?: string;
  palette: string;
  log: LogKind;
  mat?: number;
  benchH?: number;
  benchUnit?: string;
  flyScale?: number;
  flyVB?: number;
  ceiling?: number;
  drag?: number;
  hitR?: number;
  camZ?: number;
  fpvProps?: boolean;
  kThrust: number;
  gPerW: number;
  minTW?: number;
  maxKvCells?: number;
  noSmoke?: boolean;
  calLabel?: string;
  design: Design;
  batts: Record<string, BattOption>;
  motors: Record<string, MotorOption>;
  props: Record<string, PropOption>;
  fixed: FixedPart[];
  parts: CraftPart[];
  mpos: MotorPos[];
  /** 1-based motor number that starts spinning the wrong way (until checked). */
  wrongMotor?: number;
  draw(f: Frame, add: DrawAdd, opt: DrawOpt): void;
  hull(f: Frame): Vec3[];
  tags?: Array<[string, Vec3, number, number]>;
  wiring: {
    nodes(d: Design, c: CalcOut): WiringNodeSpec;
    links: WiringLink[];
  };
  overview: string;
  buildCode: string;
  cliName?: string;
  logName?: string;
  controls?: Array<[string, string]>;
  modes?: Record<string, FlightMode>;
  mode?: string;
  range?: RangeSpec;
  quiz: QuizQ[];
  practice?: string;
  extraButtons?: Array<{ label: string; onClick(fl: FlightState | null): void; inFlight?: boolean }>;
  calc?(d: Design): CalcOut;
  warnings?(d: Design, c: CalcOut): string[];
  physics?(fl: FlightState, dt: number, ctx: PhysCtx): void;
  flyStats?(fl: FlightState): StatItem[];
  /** Custom calculator tile rows. */
  calcRows?(c: CalcOut): StatItem[];
}
