// Full D3Q19 volume. z is the finite cylinder axis, y points down on screen.
export const C3 = [
  [0, 0, 0],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
  [1, 1, 0],
  [-1, -1, 0],
  [1, -1, 0],
  [-1, 1, 0],
  [1, 0, 1],
  [-1, 0, -1],
  [1, 0, -1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, -1],
  [0, 1, -1],
  [0, -1, 1],
];
export const W3 = C3.map((c, i) =>
  i === 0
    ? 1 / 3
    : c.reduce((a, v) => a + Math.abs(v), 0) === 1
      ? 1 / 18
      : 1 / 36,
);
const OPP3 = C3.map((c) => C3.findIndex((d) => d.every((v, i) => v === -c[i])));
export function equilibrium3(
  q: number,
  rho: number,
  u: number,
  v: number,
  w: number,
) {
  const c = C3[q],
    cu = c[0] * u + c[1] * v + c[2] * w;
  return (
    W3[q] * rho * (1 + 3 * cu + 4.5 * cu * cu - 1.5 * (u * u + v * v + w * w))
  );
}
export class CylinderFlow3D {
  readonly size: number;
  f: Float64Array;
  private next: Float64Array;
  readonly rho: Float64Array;
  readonly ux: Float64Array;
  readonly uy: Float64Array;
  readonly uz: Float64Array;
  readonly solid: Uint8Array;
  speed = 0.07;
  viscosity = 0.05;
  steps = 0;
  readonly cylinder = { x: 18, y: 16, radius: 4, zMin: 4, zMax: 15 };
  constructor(
    readonly width = 64,
    readonly height = 32,
    readonly depth = 20,
    readonly periodic = false,
  ) {
    this.size = width * height * depth;
    this.f = new Float64Array(this.size * 19);
    this.next = new Float64Array(this.f.length);
    this.rho = new Float64Array(this.size);
    this.ux = new Float64Array(this.size);
    this.uy = new Float64Array(this.size);
    this.uz = new Float64Array(this.size);
    this.solid = new Uint8Array(this.size);
    this.reset();
  }
  get tau() {
    return 0.5 + 3 * this.viscosity;
  }
  get reynolds() {
    return (this.speed * this.cylinder.radius * 2) / this.viscosity;
  }
  index(x: number, y: number, z: number) {
    return x + this.width * (y + this.height * z);
  }
  reset() {
    this.steps = 0;
    for (let z = 0; z < this.depth; z++)
      for (let y = 0; y < this.height; y++)
        for (let x = 0; x < this.width; x++) {
          const i = this.index(x, y, z),
            c = this.cylinder;
          this.solid[i] =
            !this.periodic &&
            (y === 0 ||
              y === this.height - 1 ||
              z === 0 ||
              z === this.depth - 1 ||
              (z >= c.zMin &&
                z <= c.zMax &&
                Math.hypot(x - c.x, y - c.y) <= c.radius))
              ? 1
              : 0;
          for (let q = 0; q < 19; q++)
            this.f[i * 19 + q] = equilibrium3(
              q,
              1,
              this.solid[i] ? 0 : this.speed,
              0,
              0,
            );
        }
    this.measure();
  }
  measure() {
    for (let i = 0; i < this.size; i++) {
      let r = 0,
        u = 0,
        v = 0,
        w = 0;
      for (let q = 0; q < 19; q++) {
        const f = this.f[i * 19 + q],
          c = C3[q];
        r += f;
        u += f * c[0];
        v += f * c[1];
        w += f * c[2];
      }
      if (!Number.isFinite(r) || r < 0.1 || r > 3)
        throw new Error("D3Q19 density outside stable range");
      this.rho[i] = r;
      this.ux[i] = this.solid[i] ? 0 : u / r;
      this.uy[i] = this.solid[i] ? 0 : v / r;
      this.uz[i] = this.solid[i] ? 0 : w / r;
    }
  }
  step() {
    const w = this.width,
      h = this.height,
      d = this.depth,
      omega = 1 / this.tau;
    this.next.fill(0);
    for (let z = 0; z < d; z++)
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = this.index(x, y, z);
          if (this.solid[i]) continue;
          const rho = this.rho[i],
            u = this.ux[i],
            v = this.uy[i],
            uz = this.uz[i];
          for (let q = 0; q < 19; q++) {
            const c = C3[q],
              post =
                this.f[i * 19 + q] +
                omega * (equilibrium3(q, rho, u, v, uz) - this.f[i * 19 + q]);
            let nx = x + c[0],
              ny = y + c[1],
              nz = z + c[2];
            if (this.periodic) {
              nx = (nx + w) % w;
              ny = (ny + h) % h;
              nz = (nz + d) % d;
            }
            if (nx < 0 || nx >= w || ny < 0 || ny >= h || nz < 0 || nz >= d)
              continue;
            const j = this.index(nx, ny, nz);
            if (this.solid[j]) this.next[i * 19 + OPP3[q]] = post;
            else this.next[j * 19 + q] = post;
          }
        }
    if (!this.periodic) {
      for (let z = 1; z < d - 1; z++)
        for (let y = 1; y < h - 1; y++) {
          const left = this.index(0, y, z) * 19,
            right = this.index(w - 1, y, z) * 19;
          for (let q = 0; q < 19; q++) {
            this.next[left + q] = equilibrium3(q, 1, this.speed, 0, 0);
            this.next[right + q] = this.next[right - 19 + q];
          }
        }
      for (let i = 0; i < this.size; i++)
        if (this.solid[i])
          for (let q = 0; q < 19; q++) this.next[i * 19 + q] = W3[q];
    }
    [this.f, this.next] = [this.next, this.f];
    this.steps++;
    this.measure();
  }
}
