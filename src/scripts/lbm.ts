// D2Q9 BGK, dx = dt = 1. Directions use canvas coordinates.
export const CX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
export const CY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
export const W = [
  4 / 9,
  1 / 9,
  1 / 9,
  1 / 9,
  1 / 9,
  1 / 36,
  1 / 36,
  1 / 36,
  1 / 36,
];
const OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];
export function equilibrium(q: number, rho: number, ux: number, uy: number) {
  const cu = CX[q] * ux + CY[q] * uy;
  return W[q] * rho * (1 + 3 * cu + 4.5 * cu * cu - 1.5 * (ux * ux + uy * uy));
}
export class LatticeBoltzmann {
  readonly size: number;
  f: Float64Array;
  private next: Float64Array;
  readonly rho: Float64Array;
  readonly ux: Float64Array;
  readonly uy: Float64Array;
  readonly solid: Uint8Array;
  steps = 0;
  speed = 0.07;
  viscosity = 0.05;
  constructor(
    readonly width = 64,
    readonly height = 64,
    readonly periodic = false,
  ) {
    this.size = width * height;
    this.f = new Float64Array(this.size * 9);
    this.next = new Float64Array(this.f.length);
    this.rho = new Float64Array(this.size);
    this.ux = new Float64Array(this.size);
    this.uy = new Float64Array(this.size);
    this.solid = new Uint8Array(this.size);
    this.reset();
  }
  get tau() {
    return 0.5 + 3 * this.viscosity;
  }
  get reynolds() {
    return (this.speed * (this.width - 2)) / this.viscosity;
  }
  reset() {
    this.steps = 0;
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        const i = x + y * this.width;
        this.solid[i] =
          !this.periodic &&
          (y === 0 || y === this.height - 1 || x === 0 || x === this.width - 1)
            ? 1
            : 0;
        for (let q = 0; q < 9; q++)
          this.f[i * 9 + q] = equilibrium(
            q,
            1,
            this.periodic ? this.speed : 0,
            0,
          );
      }
    this.measure();
  }
  measure() {
    for (let i = 0; i < this.size; i++) {
      let rho = 0,
        mx = 0,
        my = 0;
      for (let q = 0; q < 9; q++) {
        const f = this.f[i * 9 + q];
        rho += f;
        mx += f * CX[q];
        my += f * CY[q];
      }
      if (!Number.isFinite(rho) || rho < 0.1 || rho > 3)
        throw new Error("LBM density outside stable range");
      this.rho[i] = rho;
      this.ux[i] = this.solid[i] ? 0 : mx / rho;
      this.uy[i] = this.solid[i] ? 0 : my / rho;
    }
  }
  step() {
    const { width: w, height: h } = this;
    this.next.fill(0);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = x + y * w;
        if (this.solid[i]) continue;
        const rho = this.rho[i],
          u = this.ux[i],
          v = this.uy[i];
        for (let q = 0; q < 9; q++) {
          const post =
            this.f[i * 9 + q] +
            (equilibrium(q, rho, u, v) - this.f[i * 9 + q]) / this.tau;
          let nx = x + CX[q],
            ny = y + CY[q];
          if (this.periodic) {
            nx = (nx + w) % w;
            ny = (ny + h) % h;
          }
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const j = nx + ny * w;
          // Half-way bounce-back: reflect the outgoing population at a solid link.
          if (this.solid[j]) {
            // Moving top lid; the lid takes precedence on diagonal corner links.
            const correction =
              ny === 0 ? 6 * W[q] * rho * CX[q] * this.speed : 0;
            this.next[i * 9 + OPP[q]] = post - correction;
          } else this.next[j * 9 + q] = post;
        }
      }
    if (!this.periodic) {
      for (let i = 0; i < this.size; i++)
        if (this.solid[i])
          for (let q = 0; q < 9; q++) this.next[i * 9 + q] = W[q];
    }
    [this.f, this.next] = [this.next, this.f];
    this.steps++;
    this.measure();
  }
  sample(x: number, y: number): [number, number] {
    const ix = Math.max(0, Math.min(this.width - 2, Math.floor(x))),
      iy = Math.max(0, Math.min(this.height - 2, Math.floor(y)));
    const a = Math.max(0, Math.min(1, x - ix)),
      b = Math.max(0, Math.min(1, y - iy)),
      i = ix + iy * this.width;
    const mix = (f: Float64Array) =>
      f[i] * (1 - a) * (1 - b) +
      f[i + 1] * a * (1 - b) +
      f[i + this.width] * (1 - a) * b +
      f[i + this.width + 1] * a * b;
    return [mix(this.ux), mix(this.uy)];
  }
}
