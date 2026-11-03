import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, out } from './paths.mjs';
const { validateSceneRequest } = await import(pathToFileURL(join(root, 'server/mcp-scene-contract.mjs')).href);
const { makeManifest, readManifest, hydrateManifest, canonicalJSON } = await import(pathToFileURL(join(root, 'src/lib/workspace.ts')).href);
const require = createRequire(join(root, 'package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const { chromium, expect } = require('@playwright/test');
const { GifReader } = require('omggif');
const assets = JSON.parse(await readFile(join(root, 'public/examples/cleanroom/cleanroom-suite.json'), 'utf8')).bundledAssets;
const assetMap = { 'cleanroom-robot': assets[1], 'cleanroom-desk': assets[2] };
const runs = [
  { model: 'Qwen3 4B', kind: 'open-weight', slug: 'qwen3-4b', file: 'qwen3-4b.raw.txt', job: '8cd75a8f-dc80-4364-bfed-6e91bde0117a' },
  { model: 'GPT-4.1', kind: 'closed-source', slug: 'gpt-4.1', file: 'gpt-4.1.raw.txt', job: '617735fc-0df7-47cf-b430-cd152dc59291' },
];
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const results = [];
await mkdir(out, { recursive: true });
for (const run of runs) {
  const raw = await readFile(join(out, run.file), 'utf8');
  await writeFile(join(out, `${run.slug}.raw.txt`), raw);
  const scene = JSON.parse(raw); // No stripping fences, repair, or model-output rewriting.
  validateSceneRequest('astra.create_scene', { version: 1, request_id: 'f1640000-0000-4000-8000-000000000002', agent: 'benchmark', scene });
  const beds = scene.instances.filter(i => i.asset.id === 'cleanroom-desk');
  const robots = scene.instances.filter(i => i.asset.id === 'cleanroom-robot');
  const rover = robots[0];
  const keys = scene.animation.tracks[0]?.keys ?? [];
  const checks = {
    strict_json_and_schema: true,
    room_dimensions: scene.room.width === 12 && scene.room.depth === 10 && scene.room.height === 4,
    exactly_four_beds_and_one_robot: beds.length === 4 && robots.length === 1 && scene.instances.length === 5,
    bed_positions: equal(beds.map(i => JSON.stringify(i.position)).sort(), [[-3,0,-2],[-3,0,2],[3,0,-2],[3,0,2]].map(JSON.stringify).sort()),
    unique_ids_and_bed_names: new Set(scene.instances.map(i => i.id)).size === 5 && new Set(beds.map(i => i.name)).size === 4,
    visible_on_floor: scene.instances.every(i => i.visible && i.position[1] === 0),
    rover_identity_and_start: rover?.id === 'rover' && rover.name === 'Harvest Rover' && equal(rover.position, [0,0,-4]),
    only_rover_animated: scene.animation.tracks.length === 1 && scene.animation.tracks[0].instance_id === 'rover' && !scene.animation.tracks[0].part_id,
    twenty_second_loop: scene.animation.duration === 20 && scene.animation.loop === true,
    exact_key_times: equal(keys.map(k => k.time), [0,5,10,15,20]),
    route_and_aisle: keys.every(k => k.position[0] === 0 && k.position[1] === 0 && Math.abs(k.position[2]) <= 4) && keys.some(k => k.position[2] === 4),
    closed_pose_loop: equal(keys[0]?.position, rover.position) && equal(keys.at(-1)?.position, rover.position) && equal(keys[0]?.rotation, rover.rotation) && equal(keys.at(-1)?.rotation, rover.rotation),
  };
  // Deterministic adapter: resolves existing example geometry and maps snake_case fields.
  // It does not change the model's placements, names, timing, or rotations.
  const workspace = {
    room: [scene.room.width, scene.room.depth, scene.room.height],
    items: scene.instances.map(({ asset, ...i }) => ({ ...i, asset: assetMap[asset.id] })),
    animation: { ...scene.animation, tracks: scene.animation.tracks.map(t => ({
      id: `${t.instance_id}:instance`, instanceId: t.instance_id,
      keys: t.keys.map((k, i) => ({ ...k, id: `key-${i}` })),
    })) },
  };
  const manifest = makeManifest(workspace, true);
  const reopened = hydrateManifest(readManifest(manifest), []);
  checks.portable_roundtrip = canonicalJSON(makeManifest(reopened)) === canonicalJSON(makeManifest(workspace)) && reopened.items.every(i => !i.missing);
  await writeFile(join(out, `${run.slug}.scene.json`), JSON.stringify(manifest));
  const speeds = keys.slice(1).map((k, i) => Math.abs(k.position[2] - keys[i].position[2]) / (k.time - keys[i].time));
  results.push({ ...run, checks, passed: Object.values(checks).filter(Boolean).length, total: Object.keys(checks).length,
    compact_json: !raw.trim().includes('\n'), z_path: keys.map(k => k.position[2]), segment_speeds_m_s: speeds,
    note: 'Speed uniformity was not required by the prompt and is reported, not scored.' });
}
await writeFile(join(out, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));

const web = await createServer({ root, server: { host: '127.0.0.1', port: 4195, strictPort: true } });
let browser;
try {
  await web.listen();
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const run of runs) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:4195');
    await expect(page.getByRole('button', { name: /Drop files or browse/ })).toBeEnabled();
    await page.getByLabel('Import files').setInputFiles(join(out, `${run.slug}.scene.json`));
    const discard = page.getByRole('dialog', { name: 'Unsaved room changes' }).getByRole('button', { name: 'Discard and continue' });
    await expect.poll(async () => {
      if (await discard.isVisible()) await discard.click();
      return page.locator('.asset').count();
    }, { timeout: 20000 }).toBe(5);
    await expect(page.locator('.asset').filter({ hasText: 'MISSING' })).toHaveCount(0);
    await expect(page.getByLabel('Width', { exact: true })).toHaveValue('12');
    await page.screenshot({ path: join(out, `${run.slug}.png`) });
    const manifest = JSON.parse(await readFile(join(out, `${run.slug}.scene.json`), 'utf8'));
    const rendered = await page.evaluate(async manifest => {
      const { readManifest, hydrateManifest } = await import('/src/lib/workspace.ts');
      const { renderGif } = await import('/src/lib/gif.ts');
      const state = hydrateManifest(readManifest(manifest), []);
      const result = await renderGif(state.items.map(i => i.asset), state.room, {
        scope: 'room', assetIndex: 0, region: { x: 0, z: 0, width: 12, depth: 10 },
        motion: 'animation', size: 480, duration: 4, fps: 10, rangeStart: 8, rangeEnd: 12,
      }, new AbortController().signal, () => {}, state);
      return { bytes: Array.from(new Uint8Array(await result.blob.arrayBuffer())), metadata: result.metadata };
    }, manifest);
    const bytes = Buffer.from(rendered.bytes);
    const gif = new GifReader(bytes);
    if (gif.numFrames() !== 40 || gif.width !== 480) throw new Error('Unexpected GIF frame count or size');
    const first = Buffer.alloc(480 * 480 * 4), last = Buffer.alloc(first.length);
    gif.decodeAndBlitFrameRGBA(0, first); gif.decodeAndBlitFrameRGBA(39, last);
    if (first.equals(last)) throw new Error('GIF motion missing');
    await writeFile(join(out, `${run.slug}.gif`), bytes);
    await writeFile(join(out, `${run.slug}.gif-metadata.json`), JSON.stringify(rendered.metadata, null, 2));
    const row = results.find(r => r.slug === run.slug);
    row.browser = { imported_instances: 5, missing_geometry: 0, errors, gif_frames: 40, gif_range_seconds: [8,12], gif_motion_verified: true };
    await writeFile(join(out, 'results.json'), JSON.stringify(results, null, 2));
    console.log(`Verified import and authored-animation GIF: ${run.model}`);
    await page.close();
  }
} finally { await browser?.close(); await web.close(); }
