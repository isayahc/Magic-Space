import { spawn } from 'node:child_process';
import { project, opencodePath } from './common.mjs';
// Interactive shell only for the user-facing agent; setup and smoke checks never start OAuth.
const command = opencodePath();
const env = { ...process.env };
delete env.OPENCODE_SESSION_ID;
let child;
if (process.platform === 'win32' && /\.(cmd|bat|ps1)$/i.test(command)) {
  child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '& $env:MAGIC_SPACE_COMMAND'],
    { cwd: project, stdio: 'inherit', env: { ...env, MAGIC_SPACE_COMMAND: command } });
} else child = spawn(command, [], { cwd: project, stdio: 'inherit', env });
child.on('error', error => { console.error(`Cannot start OpenCode: ${error.message}. Run the setup script first.`); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
