import { readFile,writeFile,mkdir,rename,readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join,resolve,relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STARTERS,DEFAULT_LOADOUT } from './catalog.mjs';
import { makeWorkflow } from './workflows.mjs';
import { createMcpClient,connection } from './mcp.mjs';

export const assetsRoot=fileURLToPath(new URL('../assets/characters/',import.meta.url));
const active=new Set();
const busy=c=>c.job&&['submitting','running','uncertain'].includes(c.job.status);
export function validateDraft(input){
  const text=(v,max)=>{if(typeof v!=='string'||v.length>max)throw new Error('Invalid character field');return v.trim();};
  const name=text(input.name,60),role=text(input.role,60);
  if(!name||!role)throw new Error('Name and role are required');
  if(!STARTERS.some(s=>s.id===input.baseId))throw new Error('Unknown base character');
  const loadout={};for(const key of Object.keys(DEFAULT_LOADOUT))loadout[key]=text(input.loadout?.[key],300);
  return {name,role,baseId:input.baseId,loadout,notes:text(input.notes??'',1800),semantic:text(input.semantic??'',2500)};
}
export function decodeImage(value){
  if(typeof value!=='string'||value.length>17_000_000)throw new Error('Reference must be an image under 12 MB');
  const match=value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if(!match)throw new Error('Use a PNG, JPEG or WebP reference');
  const bytes=Buffer.from(match[2],'base64');
  const type=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':bytes[0]===255&&bytes[1]===216?'jpeg':bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'webp':null;
  if(type!==match[1]||bytes.length>12*1024*1024)throw new Error('Invalid or oversized reference image');
  return {bytes,ext:type==='jpeg'?'jpg':type};
}
export function validateRig(bytes){
  if(bytes.length<20||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(8)!==bytes.length)throw new Error('Output is not a complete GLB');
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
  if(!json.skins?.length||!json.animations?.some(a=>a.channels?.length))throw new Error('Generated model is missing its skeleton or animation');
}

export function createCharacterService({directory=assetsRoot,cloudFactory}={}){
  const submissions=new Map();
  let queue=Promise.resolve();
  const serial=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
  const local=join(directory,'local');
  const validId=id=>/^[a-z0-9-]{1,80}$/.test(id);
  const file=id=>{if(!validId(id))throw new Error('Invalid character ID');return join(local,id,'character.json');};
  async function bundled(){try{return JSON.parse(await readFile(join(directory,'catalog.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
  async function list(){
    await mkdir(local,{recursive:true});const custom=[];
    for(const entry of await readdir(local,{withFileTypes:true}))if(entry.isDirectory()&&validId(entry.name)){
      try{custom.push(JSON.parse(await readFile(file(entry.name),'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;}
    }
    return [...STARTERS,...await bundled(),...custom];
  }
  async function get(id){const c=(await list()).find(c=>c.id===id);if(!c)throw new Error('Character not found');return structuredClone(c);}
  async function save(c){await mkdir(join(local,c.id),{recursive:true});const dest=file(c.id);await writeFile(dest+'.tmp',JSON.stringify(c,null,2));await rename(dest+'.tmp',dest);return c;}
  function assetPath(url){
    const prefix='/characters/assets/';if(!url?.startsWith(prefix))throw new Error('Reference must belong to the character library');
    const path=resolve(directory,url.slice(prefix.length));const rel=relative(directory,path);
    if(rel.startsWith('..')||resolve(path)===resolve(directory))throw new Error('Invalid asset path');return path;
  }
  const assetURL=(c,name)=>`/characters/assets/local/${c.id}/${name}`;
  const connectionStatus=async()=>cloudFactory?{connected:true,message:'Test MCP provider connected'}:connection();
  const configured=async()=>(await connectionStatus()).connected;
  async function client(){
    if(cloudFactory)return cloudFactory();
    return createMcpClient();
  }
  function writable(c){if(c.starter||c.bundled)throw new Error('Duplicate this character before editing');if(busy(c))throw new Error('Resolve the current generation before changing this character');}
  async function create(input){return serial(async()=>{
    const source=await get(input.sourceId||'engineer');const draft=validateDraft({...source,name:input.name||`${source.name} II`});
    const c={...draft,id:randomUUID(),color:source.color,portrait:source.portrait,reference:source.portrait,walk:source.walk,idle:source.idle,jobs:[],deployed:false,createdAt:new Date().toISOString()};
    // A new recruit starts from the selected character's actual visual reference and rig.
    c.sourceCharacter=source.id;
    if(source.look){c.reference=source.look;c.look=source.look;c.modelReady=source.modelReady;}
    return save(c);
  });}
  async function update(id,input){return serial(async()=>{
    const c=await get(id);writable(c);const draft=validateDraft(input);
    const changed=JSON.stringify([c.loadout,c.notes,c.semantic])!==JSON.stringify([draft.loadout,draft.notes,draft.semantic]);
    if(draft.baseId!==c.baseId)throw new Error('Create a new character to change its base');
    Object.assign(c,draft);
    if(changed){delete c.look;delete c.modelReady;c.deployed=false;const base=STARTERS.find(s=>s.id===c.baseId);c.walk=base.walk;c.idle=base.idle;}
    return save(c);
  });}
  async function reference(id,image){return serial(async()=>{
    const c=await get(id);writable(c);const {bytes,ext}=decodeImage(image),name=`reference-${randomUUID()}.${ext}`;
    await writeFile(join(local,id,name),bytes);c.reference=assetURL(c,name);c.portrait=c.reference;c.semantic='';delete c.look;delete c.modelReady;c.deployed=false;
    const base=STARTERS.find(s=>s.id===c.baseId);c.walk=base.walk;c.idle=base.idle;return save(c);
  });}
  async function submit(id,stage,confirm){
    const c=await serial(async()=>{
      if(confirm!==true)throw new Error('Confirm Comfy credit spend before generating');
      const connection=await connectionStatus();if(!connection.connected)throw new Error(connection.message);
      const c=await get(id);writable(c);
      if(!['look','model','analyze'].includes(stage))throw new Error('Invalid generation stage');
      if(stage==='model'&&!c.look)throw new Error('Generate and review an outfit image first');
      const image=stage==='model'?c.look:(c.reference||c.portrait);
      await readFile(assetPath(image)); // Fail before submitting if the reference is missing.
      const job={id:randomUUID(),stage,status:'submitting',createdAt:new Date().toISOString(),source:image,seed:Math.floor(Math.random()*2147483647)};
      c.job=job;c.jobs.push(job);active.add(job.id);return save(c);
    });
    const work=(async()=>{
      let job;
      try{
        const api=await client(),graph=makeWorkflow(stage,c,'reference.png',c.job.seed);
        await writeFile(join(local,id,`${c.job.id}.workflow-api.json`),JSON.stringify(graph,null,2));
        const wf=api.workflows.fromJson(graph);wf.setInput('1','image',api.assets.fromFile(assetPath(c.job.source)));
        job=await api.submit(wf,{confirm:true});
        await serial(async()=>{const current=await get(id);current.job.promptId=job.id;current.job.status='running';current.jobs[current.jobs.length-1]=current.job;await save(current);});
      }catch(error){
        await serial(async()=>{const current=await get(id);
          if(job?.id)current.job.promptId=job.id;
          // A lost submit response may already have spent credits. Never resubmit automatically.
          current.job.status=error.httpStatus>=400&&error.httpStatus<500?'failed':'uncertain';
          current.job.error=current.job.status==='uncertain'?'Submission outcome uncertain. Check Comfy Cloud before retrying; this request will not be automatically resubmitted.':`Comfy rejected this request (${error.code||error.httpStatus}). Check credits, subscription and node availability.`;
          current.jobs[current.jobs.length-1]=current.job;await save(current);
        });
      }finally{active.delete(c.job.id);}
    })();
    submissions.set(id,work);
    void work.finally(()=>submissions.delete(id)).catch(error=>console.error('Character job persistence failed:',error.name));
    return c;
  }
  async function refresh(id){return serial(async()=>{
    const c=await get(id);if(!c.job)return c;
    if(c.job.status==='submitting'&&!active.has(c.job.id)){c.job.status='uncertain';c.job.error='Server restarted during submission. Check Comfy Cloud for this job before retrying.';return save(c);}
    if(!['running','uncertain'].includes(c.job.status)||!c.job.promptId)return c;
    const api=await client(),job=await api.jobs.get(c.job.promptId);
    if(['failed','cancelled','expired'].includes(job.status)){c.job.status='failed';c.job.error=`Comfy job ${job.status}. No character was deployed.`;}
    else if(job.status==='succeeded'){
      const download=async(node,name)=>{const output=job.getOutputs(node)[0];if(!output)throw new Error(`Missing output from node ${node}`);const bytes=Buffer.from(await output.toBytes());if(name.endsWith('.glb'))validateRig(bytes);await writeFile(join(local,id,name),bytes);return assetURL(c,name);};
      const tag=c.job.id;
      if(c.job.stage==='look'){c.look=await download('3',`${tag}-look.png`);delete c.modelReady;c.deployed=false;const base=STARTERS.find(s=>s.id===c.baseId);c.walk=base.walk;c.idle=base.idle;}
      if(c.job.stage==='analyze'){const url=await download('3',`${tag}-description.txt`);c.semantic=(await readFile(assetPath(url),'utf8')).slice(0,2500);}
      if(c.job.stage==='model'){
        const walk=await download('6',`${tag}-walk.glb`),idle=await download('7',`${tag}-idle.glb`);
        c.walk=walk;c.idle=idle;c.modelReady=true;
      }
      c.job.status='succeeded';c.job.completedAt=new Date().toISOString();
    }
    c.jobs[c.jobs.length-1]=c.job;return save(c);
  });}
  async function deploy(id){return serial(async()=>{const c=await get(id);if(c.starter)throw new Error('This crew member is already on duty');if(!c.modelReady)throw new Error('Finish the rigged 3D generation first');if(busy(c))throw new Error('Wait for the current job');
    // Bundled examples are copied into a local roster record when first deployed.
    if(c.bundled){const existing=(await list()).find(x=>x.sourceBundle===c.id);if(existing)return existing;c.sourceBundle=c.id;c.id=randomUUID();delete c.bundled;}
    c.deployed=true;return save(c);
  });}
  async function recover(id,promptId){return serial(async()=>{
    const c=await get(id);if(c.job?.status!=='uncertain')throw new Error('Only uncertain submissions need recovery');
    if(!/^[a-f0-9-]{36}$/i.test(promptId||''))throw new Error('Enter the matching Comfy job UUID');
    const api=await client();await api.jobs.get(promptId); // Confirm this account can read it before attaching.
    c.job.promptId=promptId;c.job.status='running';delete c.job.error;c.jobs[c.jobs.length-1]=c.job;return save(c);
  });}
  return {list,get,create,update,reference,submit,refresh,deploy,recover,configured,connectionStatus,assetPath,waitForSubmission:id=>submissions.get(id)};
}

export function characterMiddleware(service=createCharacterService()){
  const send=(res,status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(data));};
  async function body(req){let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>18_000_000)throw new Error('Request too large');parts.push(chunk);}return JSON.parse(Buffer.concat(parts).toString('utf8')||'{}');}
  return async(req,res,next)=>{
    const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/api/characters'))return next();
    try{
      if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return send(res,403,{error:'Same-origin requests only'});
      if(req.method==='GET'&&url.pathname==='/api/characters'){const connection=await service.connectionStatus();return send(res,200,{characters:await service.list(),configured:connection.connected,connection});}
      if(req.method==='POST'&&url.pathname==='/api/characters')return send(res,201,await service.create(await body(req)));
      const match=url.pathname.match(/^\/api\/characters\/([a-z0-9-]+)(?:\/(reference|generate|status|deploy|workflow|recover))?$/);
      if(!match)return send(res,404,{error:'Unknown character route'});
      const [,id,action]=match;
      if(req.method==='GET'&&action==='status')return send(res,200,await service.refresh(id));
      if(req.method==='GET'&&action==='workflow'){
        const c=await service.get(id),stage=url.searchParams.get('stage')||'look';return send(res,200,makeWorkflow(stage,c));
      }
      if(req.method==='PATCH'&&!action)return send(res,200,await service.update(id,await body(req)));
      if(req.method==='POST'&&action==='reference')return send(res,200,await service.reference(id,(await body(req)).image));
      if(req.method==='POST'&&action==='generate'){const b=await body(req);return send(res,202,await service.submit(id,b.stage,b.confirm));}
      if(req.method==='POST'&&action==='deploy')return send(res,200,await service.deploy(id));
      if(req.method==='POST'&&action==='recover')return send(res,200,await service.recover(id,(await body(req)).promptId));
      return send(res,405,{error:'Method not allowed'});
    }catch(error){return send(res,400,{error:error.message||'Character request failed'});}
  };
}
