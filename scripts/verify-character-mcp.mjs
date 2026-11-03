// Read-only live integration check: no submission and no credit spend.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { connection,createMcpClient } from '../characters/mcp.mjs';
const connected=await connection();assert.equal(connected.connected,true,connected.message);
const promptId='ee120d37-1309-4091-bd74-d63c1b8e615e';
const job=await createMcpClient().jobs.get(promptId);assert.equal(job.status,'succeeded');
const outputs=job.getOutputs('3');assert.equal(outputs.length,1);
const bytes=Buffer.from(await outputs[0].toBytes());assert.ok(bytes.length>1000);
assert.equal(bytes.subarray(1,4).toString(),'PNG');
await writeFile(new URL('../assets/characters/mcp-verification.json',import.meta.url),JSON.stringify({transport:'OpenCode plugin → authenticated Comfy Cloud MCP',connected:true,promptId,status:job.status,outputBytes:bytes.length,checks:['existing MCP sign-in','completed job status','output node mapping','existing PNG download'],paidSubmissions:0},null,2)+'\n');
console.log('PASS: existing authenticated MCP connection, completed job and PNG output; zero paid submissions.');
