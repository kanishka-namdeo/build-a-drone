/**
 * Drone Lab — craft registry + roster.
 *
 * Crafts register themselves here; the roster lists all 13 planned figures.
 * A craft that is not yet implemented shows as "soon" in the nav.
 */

import type { CraftRecord } from '../types';
import { quad5 } from './quad5';

export const crafts: CraftRecord[] = [quad5];

export interface RosterEntry {
  key: string;
  fig: number;
  name: string;
  sub: string;
}

/** The full 13-figure roster (unimplemented crafts render disabled). */
export const roster: RosterEntry[] = [
  { key: 'quad5', fig: 1, name: '5-inch freestyle quad', sub: 'Betaflight + FPV' },
  { key: 'whoop65', fig: 2, name: 'Tiny Whoop 65 mm', sub: 'indoor, brushless' },
  { key: 'cine35', fig: 3, name: '3-inch cinewhoop', sub: 'ducted, smooth video' },
  { key: 'lr7', fig: 4, name: '7-inch long range', sub: 'GPS rescue' },
  { key: 'race5', fig: 5, name: 'Racing quad', sub: 'gates + rates' },
  { key: 'gpscam', fig: 6, name: 'GPS camera drone', sub: 'ArduPilot, gimbal' },
  { key: 'delivery', fig: 7, name: 'Delivery drone', sub: 'Pixhawk + companion' },
  { key: 'agrihexa', fig: 8, name: 'Agri hexacopter', sub: 'spray + RTK' },
  { key: 'wing9', fig: 9, name: 'FPV flying wing', sub: 'INAV, elevons' },
  { key: 'vtol', fig: 10, name: 'VTOL tiltrotor', sub: 'hover to cruise' },
  { key: 'swarm', fig: 11, name: 'Swarm micro', sub: 'Crazyflie, mocap' },
  { key: 'tricopter', fig: 12, name: 'Tricopter', sub: 'servo yaw' },
  { key: 'octo', fig: 13, name: 'Heavy-lift octocopter', sub: 'redundancy' }
];
