import { defineConfig } from '@playwright/test';
import process from 'node:process';
const baseURL = `http://127.0.0.1:4337${process.env.BASE_PATH || ''}/`;
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: { channel: process.env.TEST_BROWSER || 'msedge', baseURL, headless: true },
  webServer: { command: 'node ./node_modules/astro/bin/astro.mjs preview --ignore-lock --port 4337 --host 127.0.0.1', env: { ASTRO_PREVIEW_BACKGROUND: '1' }, url: baseURL, reuseExistingServer: process.env.TEST_REUSE_SERVER === '1', stdout: 'pipe', stderr: 'pipe' },
});
