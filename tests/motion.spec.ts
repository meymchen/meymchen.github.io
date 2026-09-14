import { test, expect } from '@playwright/test';

test('completion particle follows the orthogonal connection route', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('./#coding');
  const visual = page.locator('.visual-5');
  await visual.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const errors = await visual.evaluate(el => {
    const particle = el.querySelector<SVGCircleElement>('.completion-packet')!;
    const animation = particle.getAnimations()[0];
    animation.pause();
    const errors: { time: number; x: number; y: number }[] = [];
    for (let time = 0; time <= 3600; time += 100) {
      animation.currentTime = time;
      const style = getComputedStyle(particle);
      if (Number(style.opacity) < .05) continue;
      const matrix = new DOMMatrix(style.transform);
      const x = matrix.e, y = matrix.f;
      const onRoute = (Math.abs(y - 89) < .1 && x >= 423 && x <= 536) ||
        (Math.abs(x - 536) < .1 && y >= 89 && y <= 194) ||
        (Math.abs(y - 194) < .1 && x >= 423 && x <= 536);
      if (!onRoute) errors.push({ time, x, y });
    }
    return errors;
  });
  expect(errors).toEqual([]);
});

test('all seven themed scenes loop, pause, and stop offscreen', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('./');
  const visuals = page.locator('[data-journey-visual]');
  await expect(visuals).toHaveCount(7);
  for (let i = 0; i < 7; i++) {
    const visual = visuals.nth(i);
    await visual.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect(visual).toHaveAttribute('data-running', 'true');
    const animationState = () => visual.evaluate(el => el.getAnimations({ subtree: true }).map(a => ({ time: Number(a.currentTime), state: a.playState, iterations: a.effect?.getTiming().iterations })));
    const before = await animationState();
    expect(before.length).toBeGreaterThan(0);
    expect(before.every(a => a.iterations === Infinity && a.state === 'running')).toBeTruthy();
    await expect.poll(async () => (await animationState())[0].time).toBeGreaterThan(before[0].time + 150);
    // Capture a representative instant without waiting through the entire cycle.
    await visual.evaluate(el => el.getAnimations({ subtree: true }).forEach(a => { a.currentTime = 4200; }));
    await visual.getByRole('button').click();
    await expect(visual).toHaveAttribute('data-running', 'false');
    expect((await animationState()).every(a => a.state === 'paused')).toBeTruthy();
    await visual.screenshot({ path: `test-results/motion-${i}.png` });
    await visual.getByRole('button').click();
    await expect(visual).toHaveAttribute('data-running', 'true');
  }
  await page.locator('#contact').evaluate(el => el.scrollIntoView({ behavior: 'instant' }));
  await expect(page.locator('[data-journey-visual][data-running="true"]')).toHaveCount(0);
});

test('reduced motion and narrow screens retain legible static scenes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#first-code');
  for (const visual of await page.locator('[data-journey-visual]').all()) {
    await expect(visual.getByRole('button')).toBeDisabled();
    expect(await visual.evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.locator('.visual-1').screenshot({ path: 'test-results/motion-mobile.png' });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.visual-1').evaluate(el => el.scrollIntoView({ behavior: 'instant', block: 'center' }));
  await expect(page.locator('.visual-1')).toHaveAttribute('data-running', 'true');
});
