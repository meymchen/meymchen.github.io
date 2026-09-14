import { test, expect } from "@playwright/test";
import { LatticeBoltzmann, equilibrium, CX, CY } from "../src/scripts/lbm";
import { CylinderFlow3D, equilibrium3, C3 } from "../src/scripts/lbm3d";

for (const [speed, viscosity] of [
  [0.035, 0.03],
  [0.085, 0.03],
  [0.035, 0.09],
  [0.085, 0.09],
  [0.07, 0.05],
]) {
  test(`closed square cavity conserves mass and develops circulation at ${speed}, ${viscosity}`, () => {
    const sim = new LatticeBoltzmann();
    sim.speed = speed;
    sim.viscosity = viscosity;
    sim.reset();
    expect(sim.width).toBe(sim.height);
    expect(Math.max(...sim.ux)).toBe(0);
    const mass = () =>
        sim.rho.reduce((sum, r, i) => sum + (sim.solid[i] ? 0 : r), 0),
      initial = mass();
    for (let t = 0; t < 8000; t++) sim.step();
    expect(mass() / initial).toBeCloseTo(1, 10);
    expect(Math.min(...sim.rho)).toBeGreaterThan(0.8);
    expect(Math.max(...sim.rho)).toBeLessThan(1.2);
    expect(sim.ux[32 + 2 * 64]).toBeGreaterThan(0.01);
    expect(sim.ux[32 + 48 * 64]).toBeLessThan(-0.002);
    expect(Math.max(...sim.uy)).toBeGreaterThan(0.005);
    expect(Math.min(...sim.uy)).toBeLessThan(-0.005);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++)
        expect(sim.solid[x + y * 64]).toBe(
          x === 0 || y === 0 || x === 63 || y === 63 ? 1 : 0,
        );
  });
}

test("D3Q19 equilibrium and periodic dynamics conserve all three momentum components", () => {
  const rho = 1.03,
    u = 0.03,
    v = -0.02,
    w = 0.015,
    f = C3.map((_, q) => equilibrium3(q, rho, u, v, w));
  expect(f.reduce((a, b) => a + b, 0)).toBeCloseTo(rho, 12);
  for (let k = 0; k < 3; k++)
    expect(f.reduce((a, b, q) => a + b * C3[q][k], 0)).toBeCloseTo(
      rho * [u, v, w][k],
      12,
    );
  const sim = new CylinderFlow3D(12, 10, 8, true);
  for (let i = 0; i < sim.size; i++)
    for (let q = 0; q < 19; q++)
      sim.f[i * 19 + q] = equilibrium3(q, 1 + 0.0005 * Math.sin(i), u, v, w);
  sim.measure();
  const total = () =>
    Array.from(sim.f).reduce(
      (a, b, i) => {
        a[0] += b;
        for (let k = 0; k < 3; k++) a[k + 1] += b * C3[i % 19][k];
        return a;
      },
      [0, 0, 0, 0],
    );
  const before = total();
  for (let t = 0; t < 200; t++) sim.step();
  total().forEach((a, i) => expect(a).toBeCloseTo(before[i], 9));
});

test("D3Q19 shear decay agrees with viscosity along the depth axis", () => {
  const sim = new CylinderFlow3D(16, 16, 16, true),
    wave = (2 * Math.PI) / 16,
    amplitude = 0.005;
  sim.viscosity = 0.05;
  for (let z = 0; z < 16; z++)
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++)
        for (let q = 0; q < 19; q++)
          sim.f[sim.index(x, y, z) * 19 + q] = equilibrium3(
            q,
            1,
            amplitude * Math.sin(wave * z),
            0,
            0,
          );
  sim.measure();
  for (let t = 0; t < 150; t++) sim.step();
  let measured = 0;
  for (let z = 0; z < 16; z++)
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++)
        measured +=
          (sim.ux[sim.index(x, y, z)] * Math.sin(wave * z) * 2) / sim.size;
  expect(
    Math.abs(
      measured / (amplitude * Math.exp(-sim.viscosity * wave * wave * 150)) - 1,
    ),
  ).toBeLessThan(0.04);
});

for (const [speed, viscosity] of [
  [0.035, 0.03],
  [0.085, 0.03],
  [0.035, 0.09],
  [0.085, 0.09],
  [0.07, 0.05],
]) {
  test(`finite cylinder creates genuine 3D flow and remains stable at ${speed}, ${viscosity}`, () => {
    test.setTimeout(60000);
    const sim = new CylinderFlow3D();
    sim.speed = speed;
    sim.viscosity = viscosity;
    sim.reset();
    for (let t = 0; t < 1200; t++) sim.step();
    expect(sim.solid[sim.index(18, 16, 10)]).toBe(1);
    expect(sim.solid[sim.index(18, 16, 2)]).toBe(0);
    expect(Math.max(...sim.uz)).toBeGreaterThan(0.002);
    expect(Math.min(...sim.uz)).toBeLessThan(-0.002);
    expect(
      Math.abs(sim.ux[sim.index(27, 16, 2)] - sim.ux[sim.index(27, 16, 10)]),
    ).toBeGreaterThan(0.002);
    expect(Math.min(...sim.rho)).toBeGreaterThan(0.75);
    expect(Math.max(...sim.rho)).toBeLessThan(1.25);
    expect(Array.from(sim.f).every(Number.isFinite)).toBeTruthy();
  });
}

test("D2Q9 equilibrium recovers density and momentum", () => {
  const rho = 1.04,
    u = 0.07,
    v = -0.02;
  const f = Array.from({ length: 9 }, (_, q) => equilibrium(q, rho, u, v));
  expect(f.reduce((a, b) => a + b, 0)).toBeCloseTo(rho, 12);
  expect(f.reduce((a, b, q) => a + b * CX[q], 0)).toBeCloseTo(rho * u, 12);
  expect(f.reduce((a, b, q) => a + b * CY[q], 0)).toBeCloseTo(rho * v, 12);
});

test("periodic collision and streaming conserve total mass and momentum", () => {
  const sim = new LatticeBoltzmann(24, 24, true);
  for (let i = 0; i < sim.size; i++)
    for (let q = 0; q < 9; q++)
      sim.f[i * 9 + q] *= 1 + 0.002 * Math.sin(i * 13 + q * 7);
  sim.measure();
  const totals = () =>
    Array.from(sim.f).reduce(
      (a, f, k) => {
        a[0] += f;
        a[1] += f * CX[k % 9];
        a[2] += f * CY[k % 9];
        return a;
      },
      [0, 0, 0],
    );
  const before = totals();
  for (let t = 0; t < 250; t++) sim.step();
  totals().forEach((value, i) => expect(value).toBeCloseTo(before[i], 9));
});

test("shear-wave decay agrees with analytical viscosity", () => {
  for (const nu of [0.025, 0.07]) {
    const sim = new LatticeBoltzmann(32, 32, true);
    sim.viscosity = nu;
    const wave = (2 * Math.PI) / 32,
      amplitude = 0.008;
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++)
        for (let q = 0; q < 9; q++)
          sim.f[(x + y * 32) * 9 + q] = equilibrium(
            q,
            1,
            amplitude * Math.sin(wave * y),
            0,
          );
    sim.measure();
    for (let t = 0; t < 300; t++) sim.step();
    let measured = 0;
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++)
        measured += (sim.ux[x + y * 32] * Math.sin(wave * y) * 2) / sim.size;
    const expected = amplitude * Math.exp(-nu * wave * wave * 300);
    expect(Math.abs(measured / expected - 1)).toBeLessThan(0.025);
  }
});
