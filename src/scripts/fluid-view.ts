import type { FluidFrame } from "./fluid-types";
type Vec = [number, number, number];
type Particle = { p: Vec; history: Vec[] };
export class FluidView {
  readonly canvas = document.createElement("canvas");
  readonly probeHandle = document.createElement("button");
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fieldCanvas = document.createElement("canvas");
  private readonly fc: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private generation = -1;
  private steps = 0;
  private seed = 32;
  yaw = -0.55;
  pitch = 0.45;
  private projectionScale = 1;
  private projectionCenter = [0, 0];
  mode: "speed" | "curl" = "speed";
  constructor() {
    const ctx = this.canvas.getContext("2d"),
      fc = this.fieldCanvas.getContext("2d");
    if (!ctx || !fc) throw new Error("Canvas unavailable");
    this.ctx = ctx;
    this.fc = fc;
    this.probeHandle.id = "probe-handle";
    this.probeHandle.type = "button";
    this.probeHandle.hidden = true;
    this.probeHandle.setAttribute("aria-label", "移动三维探针");
    this.probeHandle.title = "拖动探针；方向键移动 x／y，PageUp／PageDown 移动 z";
  }
  private random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  private spawn(frame: FluidFrame, entry = false): Vec {
    for (let tries = 0; tries < 100; tries++) {
      const p: Vec = [
        entry ? 1 + this.random() * 2 : 1 + this.random() * (frame.width - 3),
        1 + this.random() * (frame.height - 3),
        frame.depth > 1 ? 1 + this.random() * (frame.depth - 3) : 0,
      ];
      if (!this.isSolid(frame, p)) return p;
    }
    return [2, 2, frame.depth > 1 ? 2 : 0];
  }
  private isSolid(f: FluidFrame, p: Vec) {
    const [x, y, z] = p.map(Math.round);
    return (
      x < 1 ||
      x >= f.width - 1 ||
      y < 1 ||
      y >= f.height - 1 ||
      z < 0 ||
      z >= f.depth ||
      Boolean(f.solid[x + f.width * (y + f.height * z)])
    );
  }
  sample(f: FluidFrame, p: Vec): Vec {
    const [x, y, z] = p.map((v, i) =>
      Math.max(
        0,
        Math.min(
          [f.width - 2, f.height - 2, Math.max(0, f.depth - 2)][i],
          Math.floor(v),
        ),
      ),
    );
    const a = p[0] - x,
      b = p[1] - y,
      c = f.depth > 1 ? p[2] - z : 0,
      v: Vec = [0, 0, 0];
    for (let dz = 0; dz < (f.depth > 1 ? 2 : 1); dz++)
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++) {
          const weight =
              (dx ? a : 1 - a) *
              (dy ? b : 1 - b) *
              (f.depth > 1 ? (dz ? c : 1 - c) : 1),
            i = (x + dx + f.width * (y + dy + f.height * (z + dz))) * 4;
          for (let k = 0; k < 3; k++) v[k] += f.field[i + k + 1] * weight;
        }
    return v;
  }
  update(frame: FluidFrame) {
    if (frame.generation !== this.generation) {
      this.generation = frame.generation;
      this.steps = frame.steps;
      this.particles = Array.from(
        { length: frame.kind === "cavity" ? 550 : 700 },
        () => ({ p: this.spawn(frame), history: [] }),
      );
    }
    const delta = Math.max(0, Math.min(24, frame.steps - this.steps));
    this.steps = frame.steps;
    if (delta) {
      for (const particle of this.particles) {
        particle.history.push([...particle.p]);
        if (particle.history.length > 10) particle.history.shift();
        for (let t = 0; t < delta; t++) {
          const u = this.sample(frame, particle.p),
            next = particle.p.map((v, k) => v + u[k]) as Vec;
          if (this.isSolid(frame, next)) {
            particle.p = this.spawn(frame, frame.kind === "cylinder");
            particle.history = [];
            break;
          }
          particle.p = next;
        }
      }
    }
    this.draw(frame);
  }
  resize(width: number, height: number) {
    const dpr = Math.min(devicePixelRatio, 1.5);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
  }
  private color(f: FluidFrame, p: Vec) {
    if (this.mode === "speed") {
      const u = this.sample(f, p),
        a = Math.min(1, Math.hypot(...u) / 0.13);
      return `rgb(${100 + 145 * a},${155 + 95 * a},${175 - 70 * a})`;
    }
    const i =
      Math.round(p[0]) +
      f.width * (Math.round(p[1]) + f.height * Math.round(p[2]));
    const curl =
      -(
        f.field[(i + 1) * 4 + 2] -
        f.field[(i - 1) * 4 + 2] -
        f.field[(i + f.width) * 4 + 1] +
        f.field[(i - f.width) * 4 + 1]
      ) * 0.5;
    return curl > 0 ? "#71d5f0" : "#ffc28a";
  }
  draw(f: FluidFrame) {
    this.probeHandle.hidden = f.kind !== "cylinder";
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#0b151a";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (f.kind === "cavity") this.cavity(f);
    else this.volume(f);
  }
  private cavity(f: FluidFrame) {
    const { ctx } = this,
      w = f.width,
      h = f.height;
    this.fieldCanvas.width = w;
    this.fieldCanvas.height = h;
    const image = this.fc.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = x + y * w,
          u = f.field[i * 4 + 1],
          v = f.field[i * 4 + 2];
        const curl =
          x > 0 && x < w - 1 && y > 0 && y < h - 1
            ? -(
                f.field[(i + 1) * 4 + 2] -
                f.field[(i - 1) * 4 + 2] -
                f.field[(i + w) * 4 + 1] +
                f.field[(i - w) * 4 + 1]
              ) * 0.5
            : 0;
        const a = Math.min(
            1,
            this.mode === "speed"
              ? Math.hypot(u, v) / 0.1
              : Math.abs(curl) / 0.01,
          ),
          c =
            this.mode === "speed"
              ? [88, 175, 76]
              : curl > 0
                ? [57, 156, 190]
                : [214, 112, 66];
        for (let k = 0; k < 3; k++)
          image.data[i * 4 + k] = f.solid[i]
            ? [32, 46, 48][k]
            : [9, 18, 23][k] + a * c[k] * 0.55;
        image.data[i * 4 + 3] = 255;
      }
    this.fc.putImageData(image, 0, 0);
    ctx.setTransform(this.canvas.width / w, 0, 0, this.canvas.height / h, 0, 0);
    ctx.drawImage(this.fieldCanvas, 0, 0);
    for (const p of this.particles) {
      ctx.strokeStyle = "#d9ffc390";
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      p.history.forEach((v, i) =>
        i ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1]),
      );
      ctx.lineTo(p.p[0], p.p[1]);
      ctx.stroke();
      ctx.fillStyle = "#d9ffc3";
      ctx.fillRect(p.p[0], p.p[1], 0.24, 0.24);
    }
    ctx.strokeStyle = "#b7f77a";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(2, 1);
    ctx.lineTo(62, 1);
    ctx.stroke();
    for (let x = 10; x < 60; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, 1);
      ctx.lineTo(x - 1.3, 0.3);
      ctx.moveTo(x, 1);
      ctx.lineTo(x - 1.3, 1.7);
      ctx.stroke();
    }
    ctx.fillStyle = "#b7f77a";
    ctx.font = "2px monospace";
    ctx.fillText("LID →", 3, 5);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 0.2;
    ctx.strokeRect(f.probe[0] - 1, f.probe[1] - 1, 2, 2);
  }
  private projectRaw(p: Vec): Vec {
    const x = p[0] - 31.5,
      y = -(p[1] - 15.5),
      z = p[2] - 9.5,
      cy = Math.cos(this.yaw),
      sy = Math.sin(this.yaw),
      cp = Math.cos(this.pitch),
      sp = Math.sin(this.pitch);
    const xx = x * cy + z * sy,
      zz = -x * sy + z * cy,
      yy = y * cp - zz * sp,
      depth = y * sp + zz * cp;
    const perspective = 110 / (110 - depth);
    return [xx * perspective, -yy * perspective, depth];
  }
  private project(p: Vec): Vec {
    const raw = this.projectRaw(p);
    return [
      this.canvas.width / 2 +
        (raw[0] - this.projectionCenter[0]) * this.projectionScale,
      this.canvas.height / 2 +
        (raw[1] - this.projectionCenter[1]) * this.projectionScale,
      raw[2],
    ];
  }
  // Invert the camera transform on the plane through the initial probe,
  // parallel to the screen. Pointer coordinates are normalized to the canvas.
  probeAt(f: FluidFrame, u: number, v: number, anchor: Vec): Vec | null {
    const depth = this.projectRaw(anchor)[2];
    const perspective = 110 / (110 - depth);
    const xx = ((u - .5) * this.canvas.width / this.projectionScale + this.projectionCenter[0]) / perspective;
    const yy = -((v - .5) * this.canvas.height / this.projectionScale + this.projectionCenter[1]) / perspective;
    const y = yy * Math.cos(this.pitch) + depth * Math.sin(this.pitch);
    const zz = -yy * Math.sin(this.pitch) + depth * Math.cos(this.pitch);
    const x = xx * Math.cos(this.yaw) - zz * Math.sin(this.yaw);
    const z = xx * Math.sin(this.yaw) + zz * Math.cos(this.yaw);
    return this.validProbe(f, [x + 31.5, 15.5 - y, z + 9.5]);
  }
  validProbe(f: FluidFrame, point: Vec): Vec | null {
    const p = point.map((n, i) => Math.max(1, Math.min([f.width, f.height, f.depth][i] - 2, Math.round(n)))) as Vec;
    return this.isSolid(f, p) ? null : p;
  }
  private volume(f: FluidFrame) {
    const { ctx } = this;
    const line = (a: Vec, b: Vec, color: string, width = 1) => {
      const p = this.project(a),
        q = this.project(b);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
      ctx.stroke();
    };
    const vertices: Vec[] = [];
    for (const z of [0, 19])
      for (const y of [0, 31])
        for (const x of [0, 63]) vertices.push([x, y, z]);
    const corners = vertices.map((p) => this.projectRaw(p));
    const xmin = Math.min(...corners.map((p) => p[0])),
      xmax = Math.max(...corners.map((p) => p[0]));
    const ymin = Math.min(...corners.map((p) => p[1])),
      ymax = Math.max(...corners.map((p) => p[1]));
    this.projectionScale = Math.min(
      (this.canvas.width * 0.9) / (xmax - xmin),
      (this.canvas.height * 0.88) / (ymax - ymin),
    );
    this.projectionCenter = [(xmin + xmax) / 2, (ymin + ymax) / 2];
    for (let i = 0; i < 8; i++)
      for (let bit = 1; bit <= 4; bit *= 2)
        if (!(i & bit)) line(vertices[i], vertices[i | bit], "#516b6855");
    for (let x = 0; x < 64; x += 8) line([x, 31, 0], [x, 31, 19], "#39504b44");
    // Depth-sort finite cylinder faces and particle trails in the same camera space.
    const primitives: { depth: number; draw: () => void }[] = [];
    const ring = (z: number) =>
      Array.from(
        { length: 24 },
        (_, j) =>
          [
            18 + 4.2 * Math.cos((j * Math.PI) / 12),
            16 + 4.2 * Math.sin((j * Math.PI) / 12),
            z,
          ] as Vec,
      );
    const r0 = ring(3.5),
      r1 = ring(15.5);
    const face = (points: Vec[], shade: string) => {
      const ps = points.map((p) => this.project(p));
      primitives.push({
        depth: ps.reduce((a, p) => a + p[2], 0) / ps.length,
        draw: () => {
          ctx.fillStyle = shade;
          ctx.strokeStyle = "#b7f77a70";
          ctx.lineWidth = 0.65;
          ctx.beginPath();
          ps.forEach((p, i) =>
            i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]),
          );
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        },
      });
    };
    for (let j = 0; j < 24; j++) {
      const v = Math.round(35 + 22 * Math.cos((j * Math.PI) / 12));
      face(
        [r0[j], r0[(j + 1) % 24], r1[(j + 1) % 24], r1[j]],
        `rgb(${v},${v + 20},${v + 10})`,
      );
    }
    face(r0, "#273f35");
    face(r1, "#39533a");
    for (const particle of this.particles) {
      const p = this.project(particle.p);
      primitives.push({
        depth: p[2],
        draw: () => {
          const positions = [...particle.history, particle.p].map((v) =>
            this.project(v),
          );
          ctx.strokeStyle = this.color(f, particle.p);
          ctx.globalAlpha = 0.6;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          positions.forEach((v, i) =>
            i ? ctx.lineTo(v[0], v[1]) : ctx.moveTo(v[0], v[1]),
          );
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = this.color(f, particle.p);
          ctx.fillRect(p[0], p[1], 1.7, 1.7);
        },
      });
    }
    primitives.sort((a, b) => a.depth - b.depth).forEach((p) => p.draw());
    line([3, 28, 2], [12, 28, 2], "#b7f77a", 1.5);
    line([3, 28, 2], [3, 20, 2], "#7fd4ef", 1.5);
    line([3, 28, 2], [3, 28, 9], "#f5bf82", 1.5);
    ctx.font = `${Math.max(10, this.canvas.width / 58)}px monospace`;
    for (const [label, p, color] of [
      ["x / FLOW", [13, 28, 2], "#b7f77a"],
      ["y", [3, 19, 2], "#7fd4ef"],
      ["z", [3, 28, 10], "#f5bf82"],
    ] as [string, Vec, string][]) {
      const v = this.project(p);
      ctx.fillStyle = color;
      ctx.fillText(label, v[0], v[1]);
    }
    const probe = this.project(f.probe);
    this.probeHandle.style.left = `${probe[0] / this.canvas.width * 100}%`;
    this.probeHandle.style.top = `${probe[1] / this.canvas.height * 100}%`;
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(probe[0] - 3, probe[1] - 3, 6, 6);
  }
}
