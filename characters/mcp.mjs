import { Service } from '@opencode/client/service';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const directory=fileURLToPath(new URL('../',import.meta.url));
export async function rpc(method,input={}){
  const endpoint=await Service.discover();
  if(!endpoint)throw new Error('Start OpenCode with your connected Comfy Cloud MCP, then refresh the studio.');
  const response=await fetch(`${endpoint.url}/api/rpc/magic-space-mcp/${method}?location%5Bdirectory%5D=${encodeURIComponent(directory)}`,{
    method:'POST',headers:{...Service.headers(endpoint),'Content-Type':'application/json'},body:JSON.stringify({input}),signal:AbortSignal.timeout(120000),
  });
  const data=await response.json();
  if(!response.ok)throw new Error(data.message||'OpenCode MCP bridge unavailable. Open this project in OpenCode and reload its configuration.');
  return data.output;
}
export function unpack(result){
  if(result.output)return typeof result.output==='string'?{text:result.output}:result.output;
  const text=typeof result.content==='string'?result.content:(result.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n');
  try{return JSON.parse(text);}catch{return {text};}
}
export async function connection(){
  try{const value=await rpc('status');const server=value.servers.data.find(s=>s.name==='comfy-cloud');
    return {connected:server?.status.status==='connected',message:server?.status.status==='connected'?'Comfy MCP connected · using your existing OpenCode sign-in.':'Connect Comfy Cloud MCP in OpenCode, then refresh the studio.'};
  }catch(error){return {connected:false,message:error.message};}
}
export function createMcpClient({call=async(tool,args)=>unpack(await rpc('call',{tool,args})),fetcher=fetch}={}){
  return {
    workflows:{fromJson:graph=>({graph:structuredClone(graph),setInput(node,input,path){this.source=path;this.node=node;this.input=input;}})},
    assets:{fromFile:path=>path},
    async submit(wf,{confirm}={}){
      if(confirm!==true)throw Object.assign(new Error('Confirm Comfy credit spend before generating'),{httpStatus:400});
      // Upload errors happen before any paid submission, so they can safely fail the draft.
      try{
        const upload=await call('upload_file',{file_path:wf.source,client_os:process.platform==='win32'?'windows':'linux'});
        let result=upload;
        if(!result.name){
          const text=upload.text||JSON.stringify(upload);
          const url=text.match(/https:\/\/cloud\.comfy\.org\/api\/uploads\/[A-Za-z0-9_-]+/)?.[0];
          if(!url)throw new Error('MCP did not return an upload filename or single-use upload URL');
          const bytes=await readFile(wf.source),type=wf.source.endsWith('.webp')?'image/webp':/\.jpe?g$/i.test(wf.source)?'image/jpeg':'image/png';
          const response=await fetcher(url,{method:'PUT',headers:{'Content-Type':type},body:bytes,signal:AbortSignal.timeout(120000)});
          if(!response.ok)throw new Error(`Reference upload failed (${response.status})`);
          result=await response.json();
        }
        if(!result.name)throw new Error('MCP upload returned no filename');
        wf.graph[wf.node].inputs[wf.input]=result.subfolder?`${result.subfolder}/${result.name}`:result.name;
      }catch(error){error.httpStatus=400;throw error;}
      const submitted=await call('submit_workflow',{workflow:wf.graph,confirm:true});
      const id=submitted.prompt_id||submitted.result?.prompt_id;
      if(!id){const rejected=['error','failed','rejected'].includes(submitted.result?.status||submitted.status);throw Object.assign(new Error('MCP submission returned no job ID. Check Comfy before retrying.'),rejected?{httpStatus:400}:{});}
      return {id};
    },
    jobs:{async get(id){
      const result=await call('get_job_status',{prompt_id:id});
      const raw=result.result?.job_status||result.result?.status||result.status;
      if(!raw)throw new Error('MCP returned no job status; the saved job ID is retained.');
      const status=['completed','succeeded'].includes(raw)?'succeeded':['error','failed','cancelled','expired'].includes(raw)?'failed':'running';
      let outputs=[];
      if(status==='succeeded'){
        const output=await call('get_output',{prompt_id:id,inline_urls:true,client_os:process.platform==='win32'?'windows':'linux'});
        outputs=output.results||[];
      }
      return {status,getOutputs:node=>outputs.filter(o=>String(o.source_node_id)===String(node)).map(o=>({async toBytes(){
        const url=new URL(o.url);if(url.protocol!=='https:')throw new Error('MCP returned an invalid output URL');
        const response=await fetcher(url,{signal:AbortSignal.timeout(120000)});if(!response.ok)throw new Error(`Output download failed (${response.status})`);return response.arrayBuffer();
      }}))};
    }},
  };
}
