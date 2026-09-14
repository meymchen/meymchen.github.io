// Run after npm run dev. Verifies the development module graph in a real browser.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: process.env.TEST_BROWSER || 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:4321/');
  await page.locator('#scene[data-rendered=true]').waitFor();
  await page.waitForFunction(() => Number(document.getElementById('scene')?.dataset.steps) > 1000);
  await page.screenshot({ path: 'test-results/dev-desktop.png' });
  await page.getByRole('button', { name: '三维 · 圆柱绕流' }).click();
  await page.waitForFunction(() => document.getElementById('scene')?.dataset.kind === 'cylinder' && Number(document.getElementById('scene')?.dataset.steps) > 160);
  await page.screenshot({ path: 'test-results/dev-cylinder.png' });
  const result = { url: page.url(), title: await page.title(), testedModes: ['D2Q9 cavity', 'D3Q19 cylinder'], rendered: await page.locator('#scene').getAttribute('data-rendered'), errors };
  await writeFile('test-results/dev-results.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (errors.length) process.exitCode = 1;
} finally { await browser.close(); }
