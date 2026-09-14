import { test, expect } from '@playwright/test';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const privateIdentifiers = /陈宇明|傅秀聪|张骏升|欧宝星|吴池力|赵汝恒|朱龙潜|贺伟|Jinshan Pang|Shizhong He|Huihe Qiu|Chili Wu|Lingbo Mao|Gayle Laakmann McDowell|多益|延利|霍英东|风力新能源科技|神码|18819808792/;
const documentExtension = /\.(?:pdf|docx?|xlsx?|pptx?|zip|typ|txt|md)(?:$|[?#])/i;

async function outputFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? outputFiles(file) : [file];
  }));
  return files.flat();
}

test('timeline follows reading and supports direct chapter navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./');
  await expect(page.locator('[data-chapter]')).toHaveCount(8);
  const rail = page.getByRole('navigation', { name: '时间线导航' });
  await rail.getByRole('link', { name: '2021 从算法到系统' }).click();
  await expect(page).toHaveURL(/#systems$/);
  await expect(page.locator('[data-chapter-link="systems"]')).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('#systems')).toContainText('SEED RL');
  await page.locator('#coding').evaluate(el => el.scrollIntoView({ block: 'start' }));
  await expect(page.locator('[data-chapter-link="coding"]')).toHaveAttribute('aria-current', 'step');
  await page.screenshot({ path: 'test-results/timeline-desktop.png' });
  const text = await page.locator('body').innerText();
  for (const privateName of ['陈宇明', '广州延利', '多益网络', '霍英东', '朱龙潜']) expect(text).not.toContain(privateName);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new URL(process.env.BASE_PATH ? `${process.env.BASE_PATH}/` : '/', 'https://ymchen.me').href);
});

test('mobile timeline fits without horizontal scrolling and deep links work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./#sharing');
  await expect(page.locator('[data-chapter-link="sharing"]')).toHaveAttribute('aria-current', 'step');
  await page.locator('[data-chapter-link="first-frame"]').click();
  await expect(page.locator('[data-chapter-link="first-frame"]')).toHaveAttribute('aria-current', 'step');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: 'test-results/timeline-mobile.png' });
});

test('engineering practice is readable and the retired PDF is unavailable', async ({ page }) => {
  await page.goto('./resume/');
  await expect(page.getByRole('heading', { name: 'Yuming Chen', exact: true })).toBeVisible();
  await expect(page.locator('.resume-document')).toContainText('独立完成首版全部组件并上线');
  await expect(page.locator('.resume-document')).toContainText('12 人');
  await expect(page.locator('.resume-document')).toContainText('25 档难度');
  await expect(page.locator('[download], #print-resume')).toHaveCount(0);
  const response = await page.request.get('./resume-comprehensive.pdf');
  expect(response.status()).toBe(404);
  expect((await response.body()).subarray(0, 5).toString()).not.toBe('%PDF-');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('timeline and resume remain readable without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseURL!);
  await page.locator('[data-chapter-link="simulation"]').click();
  await expect(page).toHaveURL(/#simulation$/);
  await expect(page.locator('#simulation')).toContainText('Fortran');
  await page.goto(`${baseURL}resume/`);
  await expect(page.getByRole('heading', { name: 'Yuming Chen', exact: true })).toBeVisible();
  await expect(page.locator('[download]')).toHaveCount(0);
  await page.getByRole('link', { name: '阅读工程笔记' }).click();
  await expect(page.locator('.blog-entry')).toHaveCount(3);
  await page.locator('.blog-entry').first().click();
  await expect(page.locator('.article-body')).toBeVisible();
  await context.close();
});

test('all published artifacts exclude private identifiers and document files', async () => {
  const files = await outputFiles('dist');
  expect(files.some(file => file.endsWith('index.html'))).toBeTruthy();
  for (const file of files) {
    expect(file, 'No document assets in the published output').not.toMatch(documentExtension);
    if (/\.(?:html|js|css|json|svg|map)$/i.test(file)) {
      expect(await readFile(file, 'utf8'), file).not.toMatch(privateIdentifiers);
    }
  }
});

test('every page has safe links and fits mobile screens', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const pages = (await outputFiles('dist')).filter(file => file.endsWith('.html'));
  const internalLinks = new Set<string>();
  for (const file of pages) {
    const relative = path.relative('dist', file).replaceAll(path.sep, '/').replace(/index\.html$/, '');
    const url = new URL(relative, baseURL).href;
    const response = await page.goto(url);
    // A direct request for the generated 404.html asset succeeds; missing URLs return 404.
    expect(response?.status(), url).toBe(200);
    expect(await page.content(), url).not.toMatch(privateIdentifiers);
    await expect(page.locator('[download]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), url).toBeTruthy();
    for (const href of await page.locator('a[href]').evaluateAll(links => links.map(link => (link as HTMLAnchorElement).href))) {
      expect(href, url).not.toMatch(documentExtension);
      expect(href, url).not.toMatch(/^(?:blob:|data:)/);
      if (href.startsWith(baseURL!)) internalLinks.add(href);
    }
    if (/^(?:resume\/|blog\/|research\/)$/.test(relative)) {
      await page.screenshot({ path: `test-results/content-${relative.replaceAll('/', '-') }mobile.png` });
    }
  }
  for (const href of internalLinks) {
    expect((await page.request.get(href)).ok(), href).toBeTruthy();
  }
});
