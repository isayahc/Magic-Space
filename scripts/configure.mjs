import { mkdirSync, existsSync, copyFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { project, stateFile, modeNames, run, requireV2 } from './common.mjs';

try {
  const [mode = 'both', workspace] = process.argv.slice(2);
  modeNames(mode);
  if (workspace && (mode === 'cloud' || !existsSync(join(resolve(workspace), 'main.py')))) {
    throw new Error('Workspace must be an existing ComfyUI directory containing main.py, with local/both mode.');
  }
  const opencode = process.env.MAGIC_SPACE_OPENCODE;
  if (!opencode) throw new Error('Use setup.sh or setup.ps1 to run configuration.');
  console.log(requireV2(opencode));
  mkdirSync(join(project, '.magic-space'), { recursive: true });
  let comfy;
  let mcp;
  if (mode !== 'cloud') {
    const uv = process.env.MAGIC_SPACE_UV;
    if (!uv) throw new Error('uv was not found by the setup script.');
    const venv = join(project, '.magic-space', 'venv');
    const bin = join(venv, process.platform === 'win32' ? 'Scripts' : 'bin');
    const python = join(bin, process.platform === 'win32' ? 'python.exe' : 'python');
    if (!existsSync(python)) run(uv, ['venv', '--python', '3.12', venv], { timeout: 600000 });
    run(uv, ['pip', 'install', '--python', python, 'comfy-mcp==0.10.0', 'comfy-cli==1.24.0'], { timeout: 600000 });
    comfy = join(bin, process.platform === 'win32' ? 'comfy.exe' : 'comfy');
    mcp = join(bin, process.platform === 'win32' ? 'comfy-mcp.exe' : 'comfy-mcp');
    if (!existsSync(comfy) || !existsSync(mcp)) throw new Error('Installation did not create the expected comfy and comfy-mcp executables.');
    if (workspace) run(comfy, ['set-default', resolve(workspace)]);
  }
  // The CLI merges the entries; keep a local backup of any existing project config as well.
  for (const name of ['opencode.json', 'opencode.jsonc']) {
    const path = join(project, name);
    if (existsSync(path)) copyFileSync(path, join(project, '.magic-space', `${name}.${Date.now()}.bak`));
  }
  if (mode !== 'local') run(opencode, ['mcp', 'add', 'comfy-cloud', '--url', 'https://cloud.comfy.org/mcp']);
  if (mode !== 'cloud') run(opencode, ['mcp', 'add', 'comfy-mcp', '--env', `COMFY_BIN=${comfy}`, '--', mcp]);
  writeFileSync(stateFile, JSON.stringify({ mode, opencode, comfy, mcp }, null, 2) + '\n');
  console.log('\nSetup complete. MCP configuration is scoped to this Magic-Space checkout.');
  console.log('Run npm run agent to open OpenCode here. Use /connect to choose an agent model/provider.');
  if (mode !== 'local') console.log('Cloud: run /mcps, select comfy-cloud, and sign in. Then run npm run smoke.');
  if (mode !== 'cloud') console.log('Local MCP installed. ComfyUI and diffusion models are separate; start your existing ComfyUI when you want local execution.');
} catch (error) { console.error(`SETUP FAILED: ${error.message}`); process.exitCode = 1; }
