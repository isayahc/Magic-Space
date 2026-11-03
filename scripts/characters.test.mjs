import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCharacterService,decodeImage,validateRig } from '../characters/server.mjs';
import { STARTERS,DEFAULT_LOADOUT,characterWardrobe,groupWardrobe } from '../characters/catalog.mjs';
import { makeWorkflow } from '../characters/workflows.mjs';
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/X8sAAAAASUVORK5CYII=','base64');
const rig=await readFile(new URL('../assets/station/engineer-walk.glb',import.meta.url));
async function fixture(t,options={}){
  const directory=await mkdtemp(join(tmpdir(),'magic-space-characters-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  await writeFile(join(directory,'engineer-base.png'),image);
  return {directory,service:createCharacterService({directory,...options})};
}
test('character drafts survive restart and reject invalid fields/path traversal',async t=>{
  const {directory,service}=await fixture(t),c=await service.create({name:'Nova',sourceId:'engineer'});
  const draft={...c,loadout:{...DEFAULT_LOADOUT,outerwear:'Silver jacket'}};
  await service.update(c.id,draft);
  assert.equal((await createCharacterService({directory}).get(c.id)).loadout.outerwear,'Silver jacket');
  await assert.rejects(service.update(c.id,{...draft,name:''}),/required/);
  assert.throws(()=>service.assetPath('/characters/assets/../../secret'),/Invalid/);
  await assert.rejects(service.update('engineer',draft),/Create an outfit/);
});
test('reference upload checks type and invalidates generated appearances',async t=>{
  const {service}=await fixture(t),c=await service.create({name:'Nova',sourceId:'engineer'});
  const updated=await service.reference(c.id,`data:image/png;base64,${image.toString('base64')}`);
  assert.match(updated.reference,/reference-.*\.png$/);assert.equal(updated.semantic,'');assert.equal(updated.deployed,false);
  assert.throws(()=>decodeImage('data:image/png;base64,PHNjcmlwdD4='),/Invalid/);
  assert.throws(()=>decodeImage('data:image/svg+xml;base64,AA=='),/PNG/);
});
test('workflow chain uses image editing and the approved image for rigged 3D',()=>{
  const c=STARTERS[0],look=makeWorkflow('look',c,'base.png'),model=makeWorkflow('model',c,'approved.png');
  assert.deepEqual(look['2'].inputs.input_image,['1',0]);assert.equal(look['2'].class_type,'FluxKontextProImageNode');
  assert.equal(model['1'].inputs.image,'approved.png');assert.deepEqual(model['2'].inputs['model.image'],['1',0]);
  assert.equal(model['2'].class_type,'TripoPSeriesImageToModelNode');
  assert.deepEqual(model['4'].inputs.original_model_task_id,['3',1]);assert.equal(model['4'].inputs.animate_in_place,true);
  assert.equal(model['7'].class_type,'Save3DAdvanced');
  assert.throws(()=>makeWorkflow('unknown',c),/Unknown/);
});
test('spend gate and approval ordering stop submissions before provider calls',async t=>{
  let calls=0;const {service}=await fixture(t,{cloudFactory:()=>{calls++;throw new Error('should not be called');}});
  const c=await service.create({name:'Nova',sourceId:'engineer'});
  await assert.rejects(service.submit(c.id,'look',false),/Confirm/);
  await assert.rejects(service.submit(c.id,'model',true),/review/);assert.equal(calls,0);
});
test('submitted jobs persist, prevent duplicates, collect once and deploy valid rigs',async t=>{
  let submits=0,status='running',stage='look';
  const api={workflows:{fromJson:graph=>({setInput(){},graph})},assets:{fromFile:path=>path},
    submit:async()=>({id:`job-${++submits}`}),jobs:{get:async()=>({status,getOutputs:()=>[{toBytes:async()=>stage==='model'?rig:image}]})}};
  const {directory,service}=await fixture(t,{cloudFactory:()=>api});
  const c=await service.create({name:'Nova',sourceId:'engineer'});
  await service.submit(c.id,'look',true);
  await assert.rejects(service.submit(c.id,'look',true),/current generation/);
  await service.waitForSubmission(c.id);
  assert.equal((await service.get(c.id)).job.promptId,'job-1');
  status='succeeded';const refreshed=await service.refresh(c.id);assert.ok(refreshed.look);assert.equal(submits,1);
  stage='model';status='running';await service.submit(c.id,'model',true);
  await service.waitForSubmission(c.id);
  status='succeeded';const done=await createCharacterService({directory,cloudFactory:()=>api}).refresh(c.id);
  assert.ok(done.modelReady);assert.ok(done.walk.endsWith('.glb'));assert.equal((await service.deploy(c.id)).deployed,true);
  const changed=await service.update(c.id,{...done,notes:'A different jacket'});assert.equal(changed.modelReady,undefined);assert.equal(changed.look,undefined);assert.equal(changed.deployed,false);
});
test('ambiguous submit failures block a second charge',async t=>{
  let calls=0;const api={workflows:{fromJson:()=>({setInput(){}})},assets:{fromFile:x=>x},submit:async()=>{calls++;throw new TypeError('fetch failed');},jobs:{get:async()=>({status:'running'})}};
  const {service}=await fixture(t,{cloudFactory:()=>api}),c=await service.create({name:'Nova',sourceId:'engineer'});
  await service.submit(c.id,'look',true);
  await service.waitForSubmission(c.id);
  assert.equal((await service.get(c.id)).job.status,'uncertain');await assert.rejects(service.submit(c.id,'look',true),/current generation/);assert.equal(calls,1);
  const recovered=await service.recover(c.id,'ee120d37-1309-4091-bd74-d63c1b8e615e');assert.equal(recovered.job.status,'running');assert.equal(calls,1);
});
test('rig validation rejects unanimated or incomplete model outputs',()=>{
  validateRig(rig);assert.throws(()=>validateRig(Buffer.from('not a glb')),/complete GLB/);
});
test('legacy automatic copies become outfits while intentionally named recruits stay distinct',()=>{
  const original=STARTERS[0],look={...original,id:'look',starter:false,name:'Latch II',sourceCharacter:'engineer',look:'/saved.png',jobs:[{promptId:'kept'}]};
  const nested={...look,id:'nested',name:'Latch II II',sourceCharacter:'look'};
  const nova={...look,id:'nova',name:'Nova'};
  const records=characterWardrobe([original,look,nested,nova]);
  assert.equal(groupWardrobe(records).length,2);assert.equal(records[1].characterId,'engineer');assert.equal(records[2].characterId,'engineer');
  assert.equal(records[1].name,'Latch');assert.equal(records[1].look,'/saved.png');assert.equal(records[1].jobs[0].promptId,'kept');assert.equal(records[3].name,'Nova');
});
test('new outfits share identity and equipping one replaces the previous outfit',async t=>{
  const {directory,service}=await fixture(t);
  const first=await service.create({sourceId:'engineer',kind:'outfit'}),second=await service.create({sourceId:first.id,kind:'outfit'});
  assert.equal(first.name,'Latch');assert.equal(second.characterId,'engineer');assert.notEqual(first.outfitName,second.outfitName);
  const renamed=await service.update(first.id,{...first,outfitName:'Night shift'});assert.equal(renamed.outfitName,'Night shift');
  for(const c of [first,second])await writeFile(join(directory,'local',c.id,'character.json'),JSON.stringify({...c,modelReady:true}));
  await service.deploy(first.id);await service.deploy(second.id);
  assert.equal((await service.get(first.id)).deployed,false);assert.equal((await service.get(second.id)).deployed,true);
  assert.equal(groupWardrobe(await service.list()).length,STARTERS.length);
  await service.deploy('engineer');assert.equal((await service.get(second.id)).deployed,false);
  assert.equal((await createCharacterService({directory}).get(second.id)).characterId,'engineer');
});
