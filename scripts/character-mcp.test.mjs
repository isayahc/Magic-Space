import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createMcpClient,unpack } from '../characters/mcp.mjs';

test('MCP upload filename feeds the paid graph exactly once after confirmation',async()=>{
  const calls=[];const api=createMcpClient({call:async(tool,args)=>{calls.push({tool,args});return tool==='upload_file'?{name:'reference.png',subfolder:'uploads'}:{result:{prompt_id:'owned-job'}};}});
  const wf=api.workflows.fromJson({'1':{inputs:{image:'placeholder'}}});wf.setInput('1','image','local.png');
  await assert.rejects(api.submit(wf),/Confirm/);assert.equal(calls.length,0);
  assert.equal((await api.submit(wf,{confirm:true})).id,'owned-job');
  assert.equal(calls[1].args.workflow['1'].inputs.image,'uploads/reference.png');assert.equal(calls[1].args.confirm,true);assert.equal(calls.length,2);
});
test('MCP hosted upload uses single-use URL without credentials and maps outputs by node',async()=>{
  const requests=[];const calls=[];
  const api=createMcpClient({call:async(tool,args)=>{calls.push(tool);return {
    upload_file:{text:'curl -- "https://cloud.comfy.org/api/uploads/one-use"'},
    submit_workflow:{result:{prompt_id:'owned-job'}},
    get_job_status:{result:{job_status:'completed'}},
    get_output:{results:[{source_node_id:'7',url:'https://cloud.comfy.org/api/s/idle?raw=1'},{source_node_id:'6',url:'https://cloud.comfy.org/api/s/walk?raw=1'}]},
  }[tool];},fetcher:async(url,options)=>{requests.push({url:String(url),options});return String(url).includes('uploads')?{ok:true,json:async()=>({name:'uploaded.png'})}:{ok:true,arrayBuffer:async()=>new Uint8Array([1,2]).buffer};}});
  const wf=api.workflows.fromJson({'1':{inputs:{}}});wf.setInput('1','image',fileURLToPath(new URL('../assets/characters/engineer-base.png',import.meta.url)));
  await api.submit(wf,{confirm:true});assert.equal(requests[0].options.method,'PUT');assert.equal(requests[0].options.headers.Authorization,undefined);
  const job=await api.jobs.get('owned-job');assert.equal(job.status,'succeeded');assert.equal((await job.getOutputs('6')[0].toBytes()).byteLength,2);
  assert.match(requests[1].url,/walk/);assert.equal(calls.filter(x=>x==='submit_workflow').length,1);
});
test('MCP failure before submission is safe; ambiguous paid response is never retried',async()=>{
  let calls=0;const wf={source:'unused',graph:{},node:'1',input:'image'};
  const api=createMcpClient({call:async tool=>{calls++;if(tool==='upload_file')return {name:'input.png'};throw new TypeError('connection lost');}});
  wf.graph={'1':{inputs:{}}};await assert.rejects(api.submit(wf,{confirm:true}),/connection lost/);assert.equal(calls,2);
  const broken=createMcpClient({call:async()=>{throw new Error('upload unavailable');}});
  await assert.rejects(broken.submit(wf,{confirm:true}),e=>e.httpStatus===400);
  assert.deepEqual(unpack({output:'upload instructions'}),{text:'upload instructions'});
});
