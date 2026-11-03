import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkServers, offlineSmoke } from './smoke.mjs';
import { run, modeNames } from './common.mjs';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('cloud authentication is not confused with a working connection', () => {
  for (const status of ['needs_auth', 'pending', 'failed', 'disabled']) {
    assert.equal(checkServers({ data: [{ name: 'comfy-cloud', status: { status } }] }, 'cloud')[0].ok, false);
  }
});
test('both requires two connections; unrelated failures do not fail the test', () => {
  const payload = { data: [
    { name: 'comfy-cloud', status: { status: 'connected' } },
    { name: 'other-service', status: { status: 'failed' } },
  ] };
  assert.equal(checkServers(payload, 'cloud')[0].ok, true);
  assert.equal(checkServers(payload, 'both')[1].status, 'missing');
  payload.data.push({ name: 'comfy-mcp', status: { status: 'connected' } });
  assert.ok(checkServers(payload, 'both').every(check => check.ok));
});
test('rejects unknown modes and malformed API responses', () => {
  assert.throws(() => modeNames('clodu'), /Mode must/);
  assert.throws(() => checkServers({}, 'both'), /Unexpected/);
});
test('subprocess failure is not reported as success', () => {
  assert.throws(() => run(process.execPath, ['-e', 'process.exit(7)'], { capture: true }), /exited with 7/);
});
test('subprocess preserves spaces and shell metacharacters in arguments', () => {
  const value = 'folder with spaces & $special; characters';
  assert.equal(run(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', value], { capture: true }), value);
});
test('bundled outputs and both generation workflows agree with the shared prompt', offlineSmoke);
test('Windows PowerShell shims receive separate arguments without interpolation', { skip: process.platform !== 'win32' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'magic-space-args-'));
  try {
    const shim = join(dir, 'fake command.ps1');
    writeFileSync(shim, 'ConvertTo-Json -InputObject $args -Compress\n');
    const args = ['mcp', 'add', 'name with spaces & $dollars', '--url', 'https://example.test/?a=1&b=2'];
    assert.deepEqual(JSON.parse(run(shim, args, { capture: true })), args);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
