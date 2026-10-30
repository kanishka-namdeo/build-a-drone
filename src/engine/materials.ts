/**
 * Drone Lab — shared materials: electronics, wires, resistor colour code.
 */

import { Tone, matOf } from './core';

export const BLK: Tone = { l: '#5d5954', m: '#423e3a', d: '#292623' };
export const GOLD: Tone = { l: '#f3d679', m: '#d6b04a', d: '#9c7a26' };
export const TIN: Tone = { l: '#f1f2ef', m: '#c9ced0', d: '#959c9f' };
export const SLEEVE: Tone = { l: '#4a72b8', m: '#33589a', d: '#1d3666' };
export const STRIPE: Tone = { l: '#e9eef6', m: '#c9d3e3', d: '#9aa8bf' };
export const CHIPC: Tone = { l: '#dcbd8a', m: '#c4a06a', d: '#8f7146' };
export const FUSE: Tone = { l: '#8fb24f', m: '#6f9139', d: '#435a1f' };
export const LEDBODY: Tone = { l: '#f6f2e6', m: '#ddd6c4', d: '#b3ab97' };
export const BOOT: Tone = { l: '#7d8286', m: '#62676b', d: '#3f4346' };
export const TERMG: Tone = { l: '#59b779', m: '#3f9a5d', d: '#22603a' };
export const TERMB: Tone = { l: '#5d93e0', m: '#3f74c4', d: '#22457d' };
export const POTB: Tone = { l: '#5f86d6', m: '#4669b8', d: '#273f78' };
export const RESB: Tone = { l: '#e8d3a6', m: '#d0b780', d: '#9c8453' };
export const WOODB: Tone = { l: '#e2b47a', m: '#c99555', d: '#93683a' };
export const YEL: Tone = { l: '#f6cf45', m: '#d9ad25', d: '#8f6f10' };
export const CARBON: Tone = { l: '#3a3a3c', m: '#2b2b2d', d: '#1c1c1e' };
export const PCB: Tone = { l: '#2e7d4f', m: '#22603a', d: '#154026' };

export const SILK = '#fbf8ee';
export const HOLE = '#2b2825';
export const PAPER_W = '#fbfaf4';

export const WIRE = {
  red: matOf('#e2483d'),
  blk: matOf('#3a3632'),
  yel: matOf('#f2c230'),
  grn: matOf('#43b05c'),
  blu: matOf('#3e86d9'),
  org: matOf('#f08a2b'),
  wht: matOf('#ece6d6'),
  pur: matOf('#8c4bd1')
} as Record<string, Tone>;

/** Resistor colour code (band -> hex). */
export const BAND: Record<string, string> = {
  blk: '#2a2622',
  brn: '#7a4a1f',
  red: '#d6392c',
  org: '#ef7d22',
  yel: '#f2c230',
  grn: '#3aa357',
  blu: '#2f6fd6',
  vio: '#8c4bd1',
  gry: '#8a8a8a',
  wht: '#f4f1e8',
  gld: '#d4af37'
};
