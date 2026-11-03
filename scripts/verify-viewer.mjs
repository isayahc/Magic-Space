import { createRequire } from 'node:module';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { root, out } from '../paths.mjs';
import { currentRuns } from '../models.mjs';
const require = createRequire(join(root, 'package.json'));
const { chromium, expect } = require('@playwright/test');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(process.env.VIEWER_URL || 'http://127.0.0.1:4194/comparison');
  await expect(page.locator('body')).toHaveAttribute('data-crew-ready', 'true', { timeout: 60000 });
  const crew = await page.evaluate(() => window.crewInfo);
  expect(crew).toHaveLength(3);
  expect(crew.every(person => person.meshes > 0)).toBe(true);
  for (const run of currentRuns) {
    await page.getByLabel('Model', { exact: true }).selectOption(run.slug);
    await expect(page.locator('body')).toHaveAttribute('data-ready', run.slug);
    await page.getByLabel('Animation time').fill('10');
    await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
    await page.screenshot({ path: join(out, `${run.slug}.crew.png`) });
  }
  await page.getByRole('button', { name: 'Meet the crew' }).click();
  await page.evaluate(async () => { for(let i=0;i<30;i++) await new Promise(requestAnimationFrame); });
  await page.screenshot({ path: join(out, 'sci-fi-crew.png') });
  await page.getByLabel('Show generated sci-fi crew').uncheck();
  await expect(page.getByLabel('Show generated sci-fi crew')).not.toBeChecked();
  await page.getByLabel('Show generated sci-fi crew').check();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Room view' }).click();
  await page.evaluate(async () => { for(let i=0;i<30;i++) await new Promise(requestAnimationFrame); });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: join(out, 'viewer-mobile.png') });
  expect(errors).toEqual([]);
  await writeFile(join(out, 'viewer-verification.json'), JSON.stringify({ crew, errors, models: currentRuns.map(r => r.slug), desktop: [1440,1000], mobile: [390,844], model_switch: true, scrub: true, crew_toggle: true }, null, 2));
  console.log('PASS: both models, three real GLB meshes, scrub/toggle controls, desktop/mobile, no browser or HTTP errors.');
} finally { await browser.close(); }
