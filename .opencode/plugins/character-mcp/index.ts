import { Plugin } from '@opencode/plugin';
import { Rpc } from '@opencode/plugin/rpc';

const allowed=['get_server_info','upload_file','submit_workflow','get_job_status','get_output'];
const bridge=Rpc.define({id:'magic-space-mcp',methods:{
  status:{input:{type:'object'},output:{type:'object'},errors:{}},
  call:{input:{type:'object',properties:{tool:{type:'string',enum:allowed},args:{type:'object'}},required:['tool','args'],additionalProperties:false},output:{type:'object'},errors:{}},
},events:{}});
export default Plugin.define({id:'magic-space-mcp',async setup(ctx){
  const find=async(name:string)=>(await ctx.tool.list()).find(t=>t.name===name&&t.options?.namespace==='comfy-cloud');
  await ctx.rpc.register(bridge,{
    status:async()=>({servers:{data:(await ctx.mcp.list()).data.filter(s=>s.name==='comfy-cloud')}}),
    call:async(raw,context)=>{
      const {tool:name,args}=raw as {tool:string,args:Record<string,unknown>};
      if(!allowed.includes(name))throw new Error('Unsupported character MCP operation');
      if(name==='submit_workflow'&&args.confirm!==true)throw new Error('Credit confirmation required');
      const tool=await find(name);if(!tool)throw new Error('Comfy Cloud MCP is not connected in this project');
      // An inert audit session supplies tool context; no model or agent is run.
      let sessionID=await ctx.storage.get('sessionID') as string|undefined;
      if(!sessionID){const session=await ctx.session.create({title:'Magic-Space character MCP operations'});sessionID=session.id;await ctx.storage.set('sessionID',sessionID);}
      const message=await ctx.session.synthetic({sessionID,text:`Character studio MCP: ${name}`});
      return await tool.execute(args,{sessionID,agent:'build',messageID:message.id,id:crypto.randomUUID(),signal:context.signal,progress:async()=>{}});
    },
  });
}});
