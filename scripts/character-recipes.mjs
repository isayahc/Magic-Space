// Preserve the sample's original submission graphs. No provider calls.
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {out} from '../paths.mjs';
import {DEFAULT_LOADOUT,PRESETS} from '../characters/catalog.mjs';
import {makeWorkflow} from '../characters/workflows.mjs';
const sample={id:'nova-orbital',name:'Nova',role:'Orbital stylist',baseId:'engineer',color:'#d3ed91',bundled:true,loadout:DEFAULT_LOADOUT,notes:PRESETS.orbital.notes,semantic:'',portrait:'/characters/assets/engineer-base.png',reference:'/characters/assets/engineer-base.png',look:'/characters/assets/orbital-look.png',walk:'/characters/assets/orbital-walk.glb',idle:'/characters/assets/orbital-idle.glb',modelReady:true,deployed:false,jobs:[
  {stage:'look',status:'succeeded',promptId:'ee120d37-1309-4091-bd74-d63c1b8e615e',model:'bfl/flux-kontext-pro'},
  {stage:'model',status:'succeeded',promptId:'470cac6d-3372-4198-8e5f-049e4f8cc579',model:'Tripo P2 + rig + walk/idle'},
]};
const look=makeWorkflow('look',sample,'c900df7d26c8fb47729ed44cc172c78203c6358f7694a0ee37001c89759fd462.png',8451);
look['1']._meta.title='Load Image';look['2']._meta.title='Flux.1 Kontext [pro] Image';look['3']._meta.title='Save Image';
look['2'].inputs.prompt=look['2'].inputs.prompt.replace(/ +/g,' ');
look['3'].inputs.filename_prefix='comfy_partner_bfl-flux-kontext-pro_orbital-streetwear-from-default-engineer';
const model=makeWorkflow('model',sample,'fe303a239adc28e2a8d6cc99a85f2958b52e0960959e6338497b64fd280b76ac.png',8451);model['1']._meta.title='Read approved orbital streetwear';
for(const [name,data]of Object.entries({'catalog.json':[sample],'orbital-look.workflow-api.json':look,'orbital-model.workflow-api.json':model}))await writeFile(join(out,'characters',name),JSON.stringify(data,null,2)+'\n');
console.log('Saved bundled Nova catalog and original generation recipes.');
