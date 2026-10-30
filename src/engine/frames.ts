/**
 * Drone Lab — oriented 3D frames.
 *
 * A frame is `{ o, R }`: an origin plus a 3x3 rotation matrix (rows). Local +x
 * is the craft's nose, +z is up. Use these to draw a part at any position and
 * attitude without touching its modelling code.
 */

import { Vec3 } from './core';

export interface Frame {
  o: Vec3;
  R: number[][];
}

const ID: number[][] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1]
];

export const FR = {
  /** Identity frame at (x, y, z). */
  I(x = 0, y = 0, z = 0): Frame {
    return { o: [x, y, z], R: ID.map((r) => [...r]) };
  },
  /** Transform point to world. */
  pt(f: Frame, v: Vec3): Vec3 {
    return [
      f.o[0] + f.R[0][0] * v[0] + f.R[0][1] * v[1] + f.R[0][2] * v[2],
      f.o[1] + f.R[1][0] * v[0] + f.R[1][1] * v[1] + f.R[1][2] * v[2],
      f.o[2] + f.R[2][0] * v[0] + f.R[2][1] * v[1] + f.R[2][2] * v[2]
    ];
  },
  /** Transform direction to world (no translation). */
  dir(f: Frame, v: Vec3): Vec3 {
    return [
      f.R[0][0] * v[0] + f.R[0][1] * v[1] + f.R[0][2] * v[2],
      f.R[1][0] * v[0] + f.R[1][1] * v[1] + f.R[1][2] * v[2],
      f.R[2][0] * v[0] + f.R[2][1] * v[1] + f.R[2][2] * v[2]
    ];
  },
  /** Matrix product A - B. */
  mulR(A: number[][], B: number[][]): number[][] {
    const out: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        out[i][j] = A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j];
    return out;
  },
  /** Translate in local coords. */
  T(f: Frame, x: number, y: number, z: number): Frame {
    return { o: FR.pt(f, [x, y, z]), R: f.R };
  },
  /** Translate along world z. */
  up(f: Frame, dz: number): Frame {
    return { o: [f.o[0], f.o[1], f.o[2] + dz], R: f.R };
  },
  /** Rotate about local x (pitch). */
  Rx(f: Frame, a: number): Frame {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { o: f.o, R: FR.mulR(f.R, [[1, 0, 0], [0, c, -s], [0, s, c]]) };
  },
  /** Rotate about local y (roll toward +y). */
  Ry(f: Frame, a: number): Frame {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { o: f.o, R: FR.mulR(f.R, [[c, 0, s], [0, 1, 0], [-s, 0, c]]) };
  },
  /** Rotate about local z (yaw). */
  Rz(f: Frame, a: number): Frame {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return { o: f.o, R: FR.mulR(f.R, [[c, -s, 0], [s, c, 0], [0, 0, 1]]) };
  },
  /** Uniform scale (draw a part bigger without changing its code). */
  S(f: Frame, k: number): Frame {
    return { o: f.o, R: f.R.map((r) => r.map((v) => v * k)) };
  }
};

export const rad = (d: number): number => (d * Math.PI) / 180;
export const deg = (r: number): number => (r * 180) / Math.PI;
