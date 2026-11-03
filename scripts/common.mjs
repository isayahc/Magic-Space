import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

export const project = fileURLToPath(new URL('../', import.meta.url));
export const stateFile = join(project, '.magic-space', 'setup.json');
export function state() {
  try { return JSON.parse(readFileSync(stateFile, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}
export function modeNames(mode) {
  if (!['cloud', 'local', 'both'].includes(mode)) throw new Error('Mode must be cloud, local, or both.');
  return mode === 'both' ? ['comfy-cloud', 'comfy-mcp'] : [mode === 'cloud' ? 'comfy-cloud' : 'comfy-mcp'];
}
export function run(command, args, { capture = false, timeout = 120000 } = {}) {
  const env = { ...process.env };
  delete env.OPENCODE_SESSION_ID; // CLI writes must target this checkout, not the invoking agent's session.
  let executable = command;
  let argv = args;
  if (process.platform === 'win32' && /\.(cmd|bat|ps1)$/i.test(command)) {
    executable = 'powershell.exe';
    env.MAGIC_SPACE_COMMAND = command;
    env.MAGIC_SPACE_ARGS = JSON.stringify(args);
    argv = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
      '$ErrorActionPreference="Stop"; $a=ConvertFrom-Json $env:MAGIC_SPACE_ARGS; & $env:MAGIC_SPACE_COMMAND @a; if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }'];
  }
  const result = spawnSync(executable, argv, { cwd: project, env, encoding: 'utf8', timeout,
    maxBuffer: 4 * 1024 * 1024, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
  if (result.error) throw new Error(`Could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status ?? result.signal}${capture ? `: ${result.stderr.trim()}` : ''}`);
  return capture ? result.stdout.trim() : '';
}
export function opencodePath() {
  return process.env.MAGIC_SPACE_OPENCODE || state().opencode || (process.platform === 'win32' ? 'opencode.cmd' : 'opencode');
}
export function requireV2(command) {
  const version = run(command, ['--version'], { capture: true });
  if (!/\bv?2\./.test(version)) throw new Error(`OpenCode V2 required; found ${version}. Install V2 from https://opencode.ai/v2/docs/ and rerun setup.`);
  return version;
}
