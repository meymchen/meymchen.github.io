import { LatticeBoltzmann } from "./lbm";
import { CylinderFlow3D } from "./lbm3d";
import type { FluidRequest, FluidFrame } from "./fluid-types";
let sim: LatticeBoltzmann | CylinderFlow3D = new LatticeBoltzmann(),
  generation = -1;
self.onmessage = (event: MessageEvent<FluidRequest>) => {
  const request = event.data;
  try {
    if (request.action === "reset") {
      generation = request.generation;
      sim =
        request.kind === "cavity"
          ? new LatticeBoltzmann()
          : new CylinderFlow3D();
      sim.speed = request.speed;
      sim.viscosity = request.viscosity;
      sim.reset();
    }
    if (request.generation !== generation) return;
    for (let t = 0; t < request.count; t++) sim.step();
    const is3 = sim instanceof CylinderFlow3D,
      depth = sim instanceof CylinderFlow3D ? sim.depth : 1;
    const probe = request.probe.map((p, i) =>
      Math.round(
        Math.max(
          i === 2 && !is3 ? 0 : 1,
          Math.min([sim.width - 2, sim.height - 2, depth - 1][i], p),
        ),
      ),
    ) as [number, number, number];
    const index = probe[0] + sim.width * (probe[1] + sim.height * probe[2]);
    const field = new Float32Array(sim.size * 4),
      solid = sim.solid.slice();
    for (let i = 0; i < sim.size; i++) {
      field[i * 4] = sim.rho[i];
      field[i * 4 + 1] = sim.ux[i];
      field[i * 4 + 2] = sim.uy[i];
      field[i * 4 + 3] = sim instanceof CylinderFlow3D ? sim.uz[i] : 0;
    }
    const q = is3 ? 19 : 9;
    const frame: FluidFrame = {
      id: request.id,
      generation,
      kind: request.kind,
      width: sim.width,
      height: sim.height,
      depth,
      steps: sim.steps,
      speed: sim.speed,
      viscosity: sim.viscosity,
      reynolds: sim.reynolds,
      tau: sim.tau,
      field,
      solid,
      populations: Array.from(sim.f.slice(index * q, (index + 1) * q)),
      probe,
    };
    self.postMessage(frame, { transfer: [field.buffer, solid.buffer] });
  } catch (error) {
    self.postMessage({
      id: request.id,
      generation: request.generation,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
