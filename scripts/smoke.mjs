import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { project, state, modeNames, opencodePath, requireV2, run } from './common.mjs';
import { currentRuns, legacyRuns } from '../models.mjs';

export function checkServers(payload, mode) {
  if (!Array.isArray(payload?.data)) throw new Error('Unexpected OpenCode /api/mcp response; expected a data array.');
  return modeNames(mode).map(name => {
    const status = payload.data.find(server => server.name === name)?.status?.status ?? 'missing';
    return { name, status, ok: status === 'connected' };
  });
}
export function offlineSmoke() {
  const prompt = readFileSync(join(project, 'prompt.txt'), 'utf8').trim();
  for (const { slug: name } of [...currentRuns, ...legacyRuns]) {
    const raw = JSON.parse(readFileSync(join(project, `${name}.raw.txt`), 'utf8'));
    const scene = JSON.parse(readFileSync(join(project, `${name}.scene.json`), 'utf8'));
    const workflow = JSON.parse(readFileSync(join(project, `${name}.workflow-api.json`), 'utf8'));
    assert.equal(raw.instances.length, 5, `${name}: five raw scene objects`);
    assert.equal(scene.instances.length, 5, `${name}: five portable scene objects`);
    assert.equal(raw.animation.duration, 20, `${name}: twenty-second timeline`);
    assert.equal(workflow['2'].inputs.prompt, prompt, `${name}: identical prompt`);
    assert.equal(workflow['3'].class_type, 'SaveText', `${name}: text output node`);
  }
  for (const name of ['astronaut', 'engineer', 'botanist']) {
    const glb = readFileSync(join(project, 'assets', `${name}.glb`));
    assert.equal(glb.toString('ascii', 0, 4), 'glTF', `${name}: binary glTF header`);
    assert.equal(glb.readUInt32LE(4), 2, `${name}: glTF version`);
    assert.equal(glb.readUInt32LE(8), glb.length, `${name}: complete download`);
    const json = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)).trim());
    assert.ok(json.meshes?.length > 0 && json.materials?.length > 0, `${name}: mesh and materials`);
    assert.ok(!json.buffers?.some(b => b.uri && !b.uri.startsWith('data:')), `${name}: self-contained geometry`);
    assert.ok(!json.images?.some(image => image.uri && !image.uri.startsWith('data:')), `${name}: self-contained textures`);
  }
}
async function main() {
  const { values } = parseArgs({ options: { mode: { type: 'string' }, offline: { type: 'boolean' },
    'require-comfyui': { type: 'boolean' }, 'comfyui-url': { type: 'string', default: 'http://127.0.0.1:8188' } } });
  if (values.offline && (values.mode || values['require-comfyui'])) throw new Error('--offline cannot be combined with --mode or --require-comfyui.');
  if (values.offline) { offlineSmoke(); console.log('PASS: saved outputs and paired workflow prompts. No network calls.'); return; }
  const mode = values.mode || state().mode || 'both';
  modeNames(mode);
  if (mode === 'cloud' && values['require-comfyui']) throw new Error('--require-comfyui needs local or both mode.');
  const command = opencodePath();
  console.log(`PASS: ${requireV2(command)}`);
  // The CLI initializes MCP for a fresh location; the status API alone only reads existing state.
  run(command, ['mcp', 'list'], { capture: true });
  const path = `/api/mcp?location%5Bdirectory%5D=${encodeURIComponent(project.replace(/[\\/]$/, ''))}`;
  let checks;
  // Discovery is asynchronous: fresh locations can be empty before entries become pending.
  const deadline = Date.now() + 60000;
  do {
    checks = checkServers(JSON.parse(run(command, ['api', 'get', path], { capture: true })), mode);
    if (!checks.some(check => ['missing', 'pending'].includes(check.status)) || Date.now() >= deadline) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  } while (true);
  for (const check of checks) {
    console.log(`${check.ok ? 'PASS' : 'FAIL'}: ${check.name} ${check.status}`);
    if (check.status === 'needs_auth') console.log('  Run npm run agent, then /mcps -> comfy-cloud -> sign in.');
    else if (!check.ok) console.log('  Run the setup script for this mode, then inspect /mcps in OpenCode.');
  }
  if (checks.some(check => !check.ok)) { process.exitCode = 1; return; }
  if (values['require-comfyui']) {
    const base = new URL(values['comfyui-url']);
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) || !['http:', 'https:'].includes(base.protocol)) {
      throw new Error('ComfyUI smoke check expects a loopback http(s) URL.');
    }
    const response = await fetch(new URL('/system_stats', base), { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`ComfyUI system_stats returned HTTP ${response.status}.`);
    const stats = await response.json();
    if (!stats.system || !Array.isArray(stats.devices)) throw new Error('Response is not a ComfyUI system_stats payload.');
    console.log('PASS: local ComfyUI responds to system_stats.');
  }
  console.log('PASS: requested MCP connections are ready. No model generation or credit spend.');
  if (mode !== 'cloud' && !values['require-comfyui']) console.log('ComfyUI execution was not checked; use --require-comfyui when the local backend is running.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(`FAIL: ${error.message}`); process.exitCode = 1; });
}
