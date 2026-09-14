import { test, expect } from "@playwright/test";
import process from "node:process";

test("2D cavity: square boundaries, probe, controls and navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.url().startsWith("http://127.0.0.1") && r.status() >= 400)
      errors.push(`${r.status()} ${r.url()}`);
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("./#simulation");
  await page.locator("#scene").scrollIntoViewIfNeeded();
  const scene = page.locator("#scene");
  await expect(scene).toHaveAttribute("data-rendered", "true");
  await expect(scene).toHaveAttribute("data-kind", "cavity");
  await expect(page.locator("#fluid-title")).toHaveText("顶盖驱动方腔流");
  await expect(page.locator("#boundary-note")).toContainText("三壁无滑移");
  await page.getByRole("button", { name: "暂停模拟", exact: true }).click();
  await expect(page.locator("#step")).toBeEnabled();
  const steps = Number(await scene.getAttribute("data-steps"));
  await page.getByRole("button", { name: "单步" }).click();
  await expect(scene).toHaveAttribute("data-steps", String(steps + 1));
  const box = (await scene.boundingBox())!;
  expect(Math.abs(box.width - box.height)).toBeLessThan(1);
  await scene.click({ position: { x: box.width * 0.6, y: box.height * 0.7 } });
  await page.getByText("流动是怎样算出来的？").click();
  await expect(page.locator("#probe-location")).toHaveText("格点（38，45）");
  await expect(page.locator("#populations>div")).toHaveCount(9);
  await expect(page.locator(".lbm-equations .katex-display")).toHaveCount(5);
  await expect(page.locator(".lbm-equations math")).toHaveCount(5);
  await expect(page.locator(".katex-error")).toHaveCount(0);
  await page.getByRole("button", { name: "涡量", exact: true }).click();
  await expect(page.locator("#field-legend")).toContainText("ωz");
  await page
    .locator(".lbm-lab")
    .screenshot({ path: "test-results/cavity.png" });
  await page.locator("#flow-speed").focus();
  await page.keyboard.press("End");
  await expect(page.locator("#step")).toBeEnabled();
  await expect(page.locator("#speed-value")).toHaveText("0.085");
  await expect(scene).toHaveAttribute("data-steps", "0");
  await page.locator("#viscosity").focus();
  await page.keyboard.press("Home");
  await expect(page.locator("#step")).toBeEnabled();
  await expect(page.locator("#tau-value")).toHaveText("0.590");
  await page.locator("#reset").click();
  await expect(page.locator("#step")).toBeEnabled();
  await expect(page.locator("#flow-speed")).toHaveValue("0.07");
  await page.getByRole("button", { name: "继续模拟", exact: true }).click();
  await scene.scrollIntoViewIfNeeded();
  await expect
    .poll(async () => Number(await scene.getAttribute("data-steps")))
    .toBeGreaterThan(16);
  const links = await page
    .locator("a")
    .evaluateAll((as) =>
      as
        .map((a) => (a as HTMLAnchorElement).href)
        .filter((h) => h.startsWith(location.origin)),
    );
  for (const link of new Set(links))
    expect((await page.request.get(link)).ok()).toBeTruthy();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "笔记", exact: true })
    .click();
  await expect(page.locator(".blog-entry")).toHaveCount(3);
  await expect.poll(() => page.workers().length).toBe(0);
  expect(errors).toEqual([]);
});

test("3D cylinder: volume, orbit, single step and rapid mode switching", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("./#simulation");
  await page.locator("#scene").scrollIntoViewIfNeeded();
  await expect(page.locator("#scene")).toHaveAttribute("data-rendered", "true");
  await page.evaluate(() => {
    const diagram = document.querySelector<HTMLElement>("#fallback-diagram")!;
    const scene = document.querySelector<HTMLElement>("#scene")!;
    new MutationObserver(() => {
      if (diagram.getBoundingClientRect().width > 0 && !scene.dataset.diagramReappeared)
        scene.dataset.diagramReappeared = "true";
    }).observe(scene, { attributes: true, subtree: true });
  });
  await page.getByRole("button", { name: "三维 · 圆柱绕流" }).click();
  const scene = page.locator("#scene");
  await expect(scene).toHaveAttribute("data-rendered", "true", {
    timeout: 15000,
  });
  await expect(scene).toHaveAttribute("data-kind", "cylinder");
  await expect(page.locator("#model-label")).toHaveText("D3Q19 / LIVE");
  await expect(page.locator("#grid-size")).toHaveText("64 × 32 × 20");
  await expect
    .poll(async () => Number(await scene.getAttribute("data-steps")), {
      timeout: 15000,
    })
    .toBeGreaterThan(180);
  await page.getByRole("button", { name: "暂停模拟", exact: true }).click();
  await expect(page.locator("#step")).toBeEnabled();
  const steps = Number(await scene.getAttribute("data-steps"));
  await page.getByRole("button", { name: "单步" }).click();
  await expect(scene).toHaveAttribute("data-steps", String(steps + 1));
  await page.getByText("流动是怎样算出来的？").click();
  await expect(page.locator("#populations>div")).toHaveCount(19);
  await expect(page.locator("#model-note")).toContainText("整个体网格");
  const before = await page.locator("#scene canvas").screenshot();
  await scene.focus();
  await page.keyboard.press("ArrowRight");
  expect(
    (await page.locator("#scene canvas").screenshot()).equals(before),
  ).toBe(false);
  await expect(scene).toHaveAttribute("data-steps", String(steps + 1));
  await scene.scrollIntoViewIfNeeded();
  const box = (await scene.boundingBox())!;
  const beforeDrag = await page.locator("#scene canvas").screenshot();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.55, {
    steps: 5,
  });
  await page.mouse.up();
  expect(
    (await page.locator("#scene canvas").screenshot()).equals(beforeDrag),
  ).toBe(false);
  await page.getByRole("button", { name: "视角复位" }).click();
  await page
    .locator(".lbm-lab")
    .screenshot({ path: "test-results/cylinder-3d.png" });
  await page.getByRole("button", { name: "二维 · 方腔流" }).click();
  await page.getByRole("button", { name: "三维 · 圆柱绕流" }).click();
  await page.getByRole("button", { name: "二维 · 方腔流" }).click();
  await expect(scene).toHaveAttribute("data-rendered", "true");
  await expect(scene).toHaveAttribute("data-kind", "cavity");
  await expect(page.locator("#populations>div")).toHaveCount(9);
  await expect(page.locator("#grid-size")).toHaveText("64 × 64");
  await expect(scene).not.toHaveAttribute("data-diagram-reappeared", "true");
  await expect(page.locator("#fallback-diagram")).toBeHidden();
  expect(errors).toEqual([]);
});

test("mobile reduced motion in both examples", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./#simulation");
  await page.locator("#scene").scrollIntoViewIfNeeded();
  await page.locator("#scene").scrollIntoViewIfNeeded();
  await expect(page.locator("#scene")).toHaveAttribute("data-rendered", "true");
  await expect(page.locator("#scene")).toHaveAttribute("data-steps", "0");
  await expect(page.locator("#pause")).toHaveText("继续模拟");
  await page.getByRole("button", { name: "单步" }).click();
  await expect(page.locator("#scene")).toHaveAttribute("data-steps", "1");
  await page.getByRole("button", { name: "三维 · 圆柱绕流" }).click();
  await expect(page.locator("#scene")).toHaveAttribute("data-rendered", "true");
  await expect(page.locator("#scene")).toHaveAttribute("data-steps", "0");
  await page.getByText("流动是怎样算出来的？").click();
  await expect(page.locator("#populations>div")).toHaveCount(19);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "test-results/mobile-3d.png", fullPage: true });
});

test("no JavaScript keeps cavity boundaries and explanation", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4337${process.env.BASE_PATH || ""}/`);
  await page.locator("#lbm-fallback").scrollIntoViewIfNeeded();
  await expect(page.locator("#lbm-fallback")).toBeVisible();
  await expect(page.locator("#pause")).toBeDisabled();
  await page.getByText("流动是怎样算出来的？").click();
  await expect(page.locator(".lbm-equations")).toBeVisible();
  await expect(page.locator(".lbm-equations .katex-display")).toHaveCount(5);
  await context.close();
});

test("worker loading failure exposes a fallback", async ({ page }) => {
  await page.route("**/_astro/fluid.worker*.js", (r) => r.abort());
  await page.goto("./#simulation");
  await page.locator("#scene").scrollIntoViewIfNeeded();
  await page.locator("#scene").scrollIntoViewIfNeeded();
  await expect(page.locator("#scene-status")).toContainText("后台模拟无法加载");
  await page.locator("#lbm-fallback").scrollIntoViewIfNeeded();
  await expect(page.locator("#lbm-fallback")).toBeVisible();
  await expect(page.locator("#step")).toBeDisabled();
});
