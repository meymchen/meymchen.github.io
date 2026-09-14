export type FluidKind = "cavity" | "cylinder";
export interface FluidRequest {
  id: number;
  generation: number;
  action: "reset" | "step" | "probe";
  kind: FluidKind;
  speed: number;
  viscosity: number;
  count: number;
  probe: [number, number, number];
}
export interface FluidFrame {
  id: number;
  generation: number;
  kind: FluidKind;
  width: number;
  height: number;
  depth: number;
  steps: number;
  speed: number;
  viscosity: number;
  reynolds: number;
  tau: number;
  field: Float32Array;
  solid: Uint8Array;
  populations: number[];
  probe: [number, number, number];
  error?: string;
}
