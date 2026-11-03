import { STARTERS,PRESETS } from './catalog.mjs';
import { createPreview } from './preview.mjs';
const $=s=>document.querySelector(s),preview=createPreview($('#model-preview'));
let characters=[],current,configured=false,connectionMessage='',view='model',tab='loadout',pendingStage,dirty=false,loading=0,pollTimer,toastTimer,submitting=false;
const busy=()=>current?.job&&['submitting','running','uncertain'].includes(current.job.status);
const immutable=()=>current?.starter||current?.bundled;
async function api(path='',options={}){
  const r=await fetch(`/api/characters${path}`,{...options,headers:{'Content-Type':'application/json',...options.headers}});
  const value=await r.json();if(!r.ok)throw new Error(value.error||`HTTP ${r.status}`);return value;
}
function notify(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,6500);}
function run(fn){return async(...args)=>{try{await fn(...args);}catch(error){notify(error.message);}};}
const slotLabels={outerwear:['◈','OUTERWEAR'],top:['▱','BASE LAYER'],bottoms:['▥','BOTTOMS'],footwear:['⌁','FOOTWEAR'],accessory:['⊕','ACCESSORIES'],palette:['◒','COLOR STORY']};
for(const [key,[icon,label]] of Object.entries(slotLabels)){
  const row=document.createElement('label');row.textContent=label;row.dataset.icon=icon;
  const input=document.createElement('input');input.id=`slot-${key}`;input.maxLength=300;row.append(input);$('#slots').append(row);
}
for(const [key,preset] of Object.entries(PRESETS)){
  const button=document.createElement('button');button.type='button';button.textContent=preset.label;button.dataset.preset=key;
  button.onclick=()=>{for(const [slot,value]of Object.entries(preset.loadout))$(`#slot-${slot}`).value=value;$('#notes').value=preset.notes;dirty=true;updateButtons();document.querySelectorAll('#presets button').forEach(b=>b.classList.toggle('active',b===button));};$('#presets').append(button);
}
function renderRoster(){
  $('#crew-count').textContent=String(characters.length).padStart(2,'0');
  $('#roster-list').replaceChildren(...characters.map(c=>{
    const button=document.createElement('button');button.className=`roster-card${c.id===current?.id?' selected':''}`;button.setAttribute('aria-label',`Select ${c.name}`);
    const img=document.createElement('img');img.src=c.look||c.portrait;img.alt='';
    const info=document.createElement('span'),name=document.createElement('b'),role=document.createElement('small');name.textContent=c.name;role.textContent=c.role;info.append(name,role);
    const marker=document.createElement('span');marker.className='indicator';marker.textContent=c.deployed||c.starter?'•':'↗';button.append(img,info,marker);
    button.onclick=run(async()=>{if(dirty&&!immutable())await save();await select(c.id);});return button;
  }));
}
function formValue(){return {name:$('#name').value,role:$('#role').value,baseId:current.baseId,loadout:Object.fromEntries(Object.keys(slotLabels).map(k=>[k,$(`#slot-${k}`).value])),notes:$('#notes').value,semantic:$('#semantic').value};}
function fill(){
  $('#name').value=current.name;$('#role').value=current.role;$('#notes').value=current.notes||'';$('#semantic').value=current.semantic||'';
  for(const k of Object.keys(slotLabels))$(`#slot-${k}`).value=current.loadout[k]||'';
  document.querySelectorAll('#presets button').forEach(b=>b.classList.remove('active'));
  dirty=false;
}
function replace(c){characters=characters.map(x=>x.id===c.id?c:x);current=c;renderRoster();update();}
async function select(id){
  clearTimeout(pollTimer);current=characters.find(c=>c.id===id)||characters[0];fill();renderRoster();update();
  view=current.look&&!current.modelReady?'look':'model';await showView(view);schedulePoll();
}
function updateButtons(){
  const locked=busy();$('#save').disabled=immutable()||locked||!dirty;
  $('#generate-look').disabled=locked;$('#generate-model').disabled=locked||!current.look||dirty;
  $('#analyze').disabled=locked;$('#reference-upload').disabled=locked||immutable();
  $('#deploy').hidden=!current.modelReady||current.starter;$('#deploy').disabled=locked||dirty||current.deployed;
  $('#deploy').textContent=current.deployed?'✓ On the station roster':'＋ Add to station crew';
  $('#save').textContent=immutable()?'Duplicate to save edits':dirty?'Save changes':'Saved';
  $('#view-look').disabled=!current.look;$('#view-model').disabled=!current.modelReady&&!current.starter;
  $('#export-workflow').textContent= current.look&&!dirty?'Download 3D workflow ↗':'Download outfit workflow ↗';
  document.querySelectorAll('#character-form input:not([type=file]), #character-form textarea, #presets button').forEach(el=>el.disabled=locked);
  $('#new-character').disabled=locked&&current.job.status!=='uncertain';$('#duplicate').disabled=locked&&current.job.status!=='uncertain';
}
function update(){
  $('#character-name').textContent=current.name;$('#character-role').textContent=current.role.toUpperCase();$('#subject-id').textContent=String(characters.indexOf(current)+1).padStart(2,'0');
  $('#base-thumb').src=current.reference||current.portrait;$('#look-thumb').hidden=!current.look;if(current.look)$('#look-thumb').src=current.look;
  $('#look-caption').textContent=current.look?'CONCEPT GENERATED':'IMAGE → IMAGE';$('#model-caption').textContent=current.modelReady?'WALK + IDLE READY':'IMAGE → RIGGED 3D';
  $('#connection-note').textContent=configured?'Comfy MCP connected · existing sign-in · each run asks before spending credits.':connectionMessage;
  const j=current.job;$('#job-status').textContent=j?`${{look:'Outfit',model:'3D + rig',analyze:'Visual reading'}[j.stage]} · ${j.status}${j.promptId?` · ${j.promptId}`:''}${j.error?` — ${j.error}`:''}`:'';
  $('#recovery').hidden=j?.status!=='uncertain';
  updateButtons();
}
async function showView(next){
  view=next;const mine=++loading;const customReference=next==='base'&&current.reference&&current.reference!==STARTERS.find(s=>s.id===current.baseId).portrait;const image=next==='look'||customReference;
  $('#look-preview').hidden=!image;$('#model-preview').hidden=image;$('.pose-controls').hidden=image;
  document.querySelectorAll('.pipeline-step').forEach(b=>b.classList.remove('selected'));
  $(`#view-${next==='look'?'look':next==='base'?'base':current.modelReady?'model':'base'}`).classList.add('selected');
  if(image){$('#look-preview').src=customReference?current.reference:current.look;$('#stage-loading').hidden=true;$('#preview-label').textContent=customReference?'01 / IDENTITY REFERENCE':'02 / OUTFIT CONCEPT';$('#preview-hint').textContent=customReference?'THIS IMAGE IS THE SOURCE OF YOUR NEXT OUTFIT EDIT':'REVIEW THIS IMAGE BEFORE BUILDING THE 3D MODEL';$('#asset-state').textContent=customReference?'UPLOADED REFERENCE':'FLUX IMAGE EDIT';return;}
  $('#stage-loading').hidden=false;
  try{const c=next==='base'?STARTERS.find(s=>s.id===current.baseId):current;await preview.load(c);if(mine!==loading)return;$('#preview-label').textContent=next!=='base'&&current.modelReady?'03 / CUSTOM RIG':'01 / ORIGINAL RIG';$('#asset-state').textContent=next!=='base'&&current.modelReady?'CUSTOM OUTFIT · 3D':'BASE CHARACTER';$('#preview-hint').textContent='DRAG TO ROTATE · SCROLL TO ZOOM';}
  finally{if(mine===loading)$('#stage-loading').hidden=true;}
}
async function ensureDraft(){
  if(!immutable())return;
  const input=formValue(),c=await api('',{method:'POST',body:JSON.stringify({sourceId:current.id,name:input.name+' II'})});
  characters.push(c);current=c;replace(await api(`/${c.id}`,{method:'PATCH',body:JSON.stringify({...input,name:c.name})}));fill();
}
async function save(){await ensureDraft();const c=await api(`/${current.id}`,{method:'PATCH',body:JSON.stringify(formValue())});replace(c);fill();updateButtons();await showView(c.look&&!c.modelReady?'look':'model');}
$('#character-form').onsubmit=run(async e=>{e.preventDefault();await save();notify('Character saved.');});
$('#character-form').addEventListener('input',()=>{dirty=true;updateButtons();});
$('#duplicate').onclick=run(async()=>{const c=await api('',{method:'POST',body:JSON.stringify({sourceId:current.id})});characters.push(c);await select(c.id);notify('Character duplicated. Make it yours.');});
function setTab(next){tab=next;$('#identity-fields').hidden=next!=='character';$('#loadout-fields').hidden=next!=='loadout';$('#tab-character').setAttribute('aria-selected',String(next==='character'));$('#tab-loadout').setAttribute('aria-selected',String(next==='loadout'));$('#editor-title').textContent=next==='character'?'A life in orbit.':'Build the drip.';$('#editor-subtitle').textContent=next==='character'?'An identity worth keeping.':'Same character. Whole new energy.';}
$('#tab-character').onclick=()=>setTab('character');$('#tab-loadout').onclick=()=>setTab('loadout');
$('#view-base').onclick=run(()=>showView('base'));$('#view-look').onclick=run(()=>showView('look'));$('#view-model').onclick=run(()=>showView('model'));
for(const mode of ['walk','idle'])$(`#pose-${mode}`).onclick=()=>{preview.pose(mode);for(const m of ['walk','idle'])$(`#pose-${m}`).classList.toggle('selected',m===mode);};
$('#reset-camera').onclick=()=>preview.reset();
$('#new-character').onclick=()=>{
  $('#new-base').replaceChildren(...characters.map(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=`${c.name} / ${c.role}`;return o;}));$('#new-base').value=current.id;$('#new-name').value='';$('#new-dialog').showModal();
};
$('#new-close').onclick=()=>$('#new-dialog').close();
$('#new-form').onsubmit=run(async e=>{e.preventDefault();const c=await api('',{method:'POST',body:JSON.stringify({sourceId:$('#new-base').value,name:$('#new-name').value})});characters.push(c);$('#new-dialog').close();await select(c.id);setTab('loadout');notify('New character created. Choose their look.');});
$('#reference-upload').onchange=run(async e=>{
  const file=e.target.files[0];if(!file)return;if(file.size>12*1024*1024)throw new Error('Choose an image under 12 MB');
  const image=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
  if(dirty)await save();replace(await api(`/${current.id}/reference`,{method:'POST',body:JSON.stringify({image})}));fill();notify('Reference saved. Your next outfit edit will use this image.');
});
function ask(stage){
  pendingStage=stage;$('#spend-title').textContent={look:'Give them a new look?',model:'Make this look real?',analyze:'Read this character?'}[stage];
  $('#spend-description').textContent={look:'FLUX Kontext Pro will edit the reference image using your loadout. You can review the result before paying for 3D.',model:'Tripo P2 will build a textured 3D model from the displayed outfit image, rig a biped skeleton, and export walk + idle clips. This stage makes multiple paid provider calls.',analyze:'GPT-6 Astra will read visible design details from your reference image and save editable identity notes.'}[stage];$('#spend-dialog').showModal();
}
$('#generate-look').onclick=()=>ask('look');$('#generate-model').onclick=run(async()=>{await showView('look');ask('model');});$('#analyze').onclick=()=>ask('analyze');$('#spend-cancel').onclick=()=>$('#spend-dialog').close();
$('#spend-confirm').onclick=run(async()=>{
  if(submitting)return;submitting=true;
  try{$('#spend-dialog').close();await ensureDraft();if(dirty)await save();
    replace(await api(`/${current.id}/generate`,{method:'POST',body:JSON.stringify({stage:pendingStage,confirm:true})}));schedulePoll();
  }finally{submitting=false;}
});
function schedulePoll(){
  clearTimeout(pollTimer);if(!busy()||current.job.status==='uncertain')return;const id=current.id;
  pollTimer=setTimeout(async()=>{
    try{const c=await api(`/${id}/status`);if(current.id!==id)return;const done=c.job.status==='succeeded';replace(c);if(done){fill();await showView(c.job.stage==='look'?'look':'model');notify(`${c.job.stage==='model'?'Rigged character':c.job.stage==='look'?'Outfit concept':'Visual description'} ready.`);}schedulePoll();}
    catch(e){if(current.id===id){$('#job-status').textContent=`Status check interrupted: ${e.message}. Your submitted job is retained.`;schedulePoll();}}
  },4000);
}
$('#deploy').onclick=run(async()=>{current=await api(`/${current.id}/deploy`,{method:'POST',body:'{}'});notify('Crew member added. Open or reload the station to meet them.');await refresh();});
$('#recover-job').onclick=run(async()=>{replace(await api(`/${current.id}/recover`,{method:'POST',body:JSON.stringify({promptId:$('#recover-id').value.trim()})}));schedulePoll();notify('Job attached. Collecting its existing result.');});
$('#export-workflow').onclick=run(async()=>{
  await ensureDraft();if(dirty)await save();const stage=current.look?'model':'look',graph=await api(`/${current.id}/workflow?stage=${stage}`);
  const url=URL.createObjectURL(new Blob([JSON.stringify(graph,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${current.name.replace(/[^a-z0-9-]/gi,'-')}-${stage}.workflow-api.json`;a.click();URL.revokeObjectURL(url);notify('Upload the reference in Comfy and replace node 1’s image filename before running.');
});
async function refresh(){const state=await api();characters=state.characters;configured=state.configured;connectionMessage=state.connection?.message||'Connect Comfy Cloud MCP in OpenCode and refresh.';await select(current?.id);}
try{await refresh();document.body.dataset.ready='true';window.characterStudio={preview,select,characters:()=>characters,current:()=>current};}
catch(e){$('#stage-loading').textContent=e.message;document.body.dataset.ready='failed';}
