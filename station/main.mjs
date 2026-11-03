import * as THREE from '/node_modules/three/build/three.module.js';
import { OrbitControls } from '/node_modules/three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from '/node_modules/three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '/node_modules/three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '/node_modules/three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '/node_modules/three/examples/jsm/postprocessing/OutputPass.js';
import { createStation } from './world.mjs';
import { validateBlueprint,makeNavigation,ROOM_CENTERS } from './navigation.mjs';

const $=selector=>document.querySelector(selector);
const status=$('#load-status');
// Keep icon-only mobile controls named for screen readers and keyboard users.
document.querySelectorAll('.toolbar button').forEach(button=>button.setAttribute('aria-label',button.querySelector('span').textContent));
try {
  const response=await fetch('/station/assets/blueprint.raw.txt');
  if(!response.ok)throw new Error(`Blueprint HTTP ${response.status}`);
  const data=validateBlueprint(await response.json());
  const libraryResponse=await fetch('/api/characters');
  if(!libraryResponse.ok)throw new Error('Could not load the local crew library');
  const library=await libraryResponse.json();
  const recruits=library.characters.filter(c=>c.deployed&&c.modelReady&&!c.starter).map(c=>({id:c.id,callsign:c.name,role:c.role,color:c.color||'#d3ed91',walk:c.walk,idle:c.idle,tasks:data.crew.find(base=>base.id===c.baseId).tasks}));
  const definitions=[...data.crew,...recruits];
  const nav=makeNavigation(data),world=createStation(data);
  $('#station-name').textContent=data.name;$('#tagline').textContent=data.tagline;
  document.title=`${data.name} / Magic-Space`;
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;$('#viewport').append(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,250);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.maxPolarAngle=Math.PI*.47;controls.minDistance=7;controls.maxDistance=150;
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(world.scene,camera));
  const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.28,.5,1.15);composer.addPass(bloom);composer.addPass(new OutputPass());
  let selected=null,playing=true,speed=1,time=0,previous=performance.now(),uiTime=0;
  const crew=[],colors={astronaut:'#ffbb78',engineer:'#7bdedb',botanist:'#c3ec7e'};
  function overview(){selected=null;const scale=innerWidth<700?1.9:1;camera.position.set(31*scale,39*scale,40*scale);controls.target.set(0,0,0);controls.update();$('.crew-panel').classList.remove('following');}
  overview();
  function log(text){const item=document.createElement('div');item.className='feed-item';const stamp=document.createElement('time');stamp.textContent=`T+ ${Math.floor(time/60).toString().padStart(2,'0')}:${Math.floor(time%60).toString().padStart(2,'0')}`;item.append(stamp,document.createTextNode(text));$('#feed').prepend(item);while($('#feed').children.length>5)$('#feed').lastChild.remove();}
  log('Shift handover complete. Department routines loaded from GPT-6’s world blueprint.');
  const loader=new GLTFLoader();
  status.textContent='Loading rigged crew and animation clips…';
  const loaded=await Promise.all(definitions.map(async (definition,index)=>{
    const [walk,idle]=await Promise.all(['walk','idle'].map(clip=>loader.loadAsync(definition[clip]||`/station/assets/${definition.id}-${clip}.glb`)));
    if(!walk.animations.length||!idle.animations.length)throw new Error(`${definition.id}: missing animation clips`);
    let skinCount=0;walk.scene.traverse(o=>{if(o.isSkinnedMesh)skinCount++;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    if(!skinCount)throw new Error(`${definition.id}: no skinned mesh`);
    const body=walk.scene,root=new THREE.Group();body.rotation.y=-Math.PI/2;root.name=definition.id;root.add(body);world.scene.add(root);
    const bounds=new THREE.Box3().setFromObject(body),height=bounds.getSize(new THREE.Vector3()).y;
    if(!Number.isFinite(height)||height<=0)throw new Error('Invalid character bounds');
    body.scale.multiplyScalar(1.8/height);
    const scaled=new THREE.Box3().setFromObject(body),center=scaled.getCenter(new THREE.Vector3());
    body.position.add(new THREE.Vector3(-center.x,-scaled.min.y,-center.z));
    const mixer=new THREE.AnimationMixer(body);
    // Animation exports share the same rig. Only the idle clip is reused; its duplicate mesh is disposed.
    const actions={walk:mixer.clipAction(walk.animations[0]),idle:mixer.clipAction(idle.animations[0])};
    idle.scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}}});
    actions.idle.play();
    const first=ROOM_CENTERS[definition.tasks[0].room];root.position.set(first[0]+index%3-1,0,first[1]);
    const color=definition.color||colors[definition.id];
    const halo=new THREE.Mesh(new THREE.RingGeometry(.42,.47,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7,side:THREE.DoubleSide,depthWrite:false}));halo.rotation.x=-Math.PI/2;halo.position.y=.025;root.add(halo);
    const card=document.createElement('button');card.className='crew-card';card.style.setProperty('--crew-color',color);card.setAttribute('aria-label',`Follow ${definition.callsign}`);
    const avatar=document.createElement('span');avatar.className='crew-avatar';avatar.textContent=String(index+1).padStart(2,'0');
    const name=document.createElement('div');name.className='crew-name';name.textContent=definition.callsign;
    const role=document.createElement('div');role.className='crew-role';role.textContent=definition.role;
    const taskLabel=document.createElement('div');taskLabel.className='crew-task';taskLabel.textContent=definition.tasks[0].action;
    card.append(avatar,name,role,taskLabel);
    const person={definition,index,root,position:root.position,mixer,actions,mode:'idle',taskIndex:0,wait:definition.tasks[0].seconds,path:[],waypoint:0,distance:0,completed:0,taskLabel,card,skinCount,bone:body.getObjectByName('L_Thigh')||body.getObjectByName('Hip')};
    card.onclick=()=>follow(person);
    return person;
  }));
  crew.push(...loaded);
  crew.forEach(c=>$('#crew-list').append(c.card));
  function follow(person){selected=person;camera.position.copy(person.position).add(new THREE.Vector3(9,11,13));controls.target.copy(person.position).add(new THREE.Vector3(0,.6,0));controls.update();crew.forEach(c=>c.card.classList.toggle('selected',c===person));}
  function setMode(c,mode){if(c.mode===mode)return;c.actions[c.mode].fadeOut(.25);c.actions[mode].reset().fadeIn(.25).play();c.mode=mode;}
  function beginTask(c){
    c.taskIndex=(c.taskIndex+1)%c.definition.tasks.length;
    const task=c.definition.tasks[c.taskIndex],center=ROOM_CENTERS[task.room];
    c.path=nav.path([c.position.x,c.position.z],[center[0]+c.index%3-1,center[1]]);c.waypoint=0;
    setMode(c,'walk');
  }
  const emitted=new Set();
  function tick(dt){
    time+=dt;
    for(const c of crew){
      if(c.mode==='idle') {c.wait-=dt;if(c.wait<=0){c.completed++;beginTask(c);}}
      else {
        let budget=1.25*dt;
        while(budget>0&&c.waypoint<c.path.length){
          const [x,z]=c.path[c.waypoint],dx=x-c.position.x,dz=z-c.position.z,dist=Math.hypot(dx,dz);
          if(dist<.001){c.waypoint++;continue;}
          const step=Math.min(budget,dist);c.position.x+=dx/dist*step;c.position.z+=dz/dist*step;c.distance+=step;budget-=step;
          const target=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(target-c.root.rotation.y),Math.cos(target-c.root.rotation.y));c.root.rotation.y+=delta*Math.min(1,dt*10);
          if(step===dist)c.waypoint++;
        }
        if(c.waypoint>=c.path.length){setMode(c,'idle');c.wait=c.definition.tasks[c.taskIndex].seconds;log(`${c.definition.callsign}: ${c.definition.tasks[c.taskIndex].action}`);}
      }
      c.mixer.update(dt);
    }
    for(const event of data.events)if(time>=event.at&&!emitted.has(event.at)){emitted.add(event.at);log(`${event.title} — ${event.detail}`);}
    world.update(time,crew);
  }
  function updateUI(){
    crew.forEach(c=>{const task=c.definition.tasks[c.taskIndex];c.taskLabel.textContent=c.mode==='walk'?`En route · ${data.rooms.find(r=>r.id===task.room).name}`:task.action;});
    $('#clock').textContent=`${Math.floor(time/60).toString().padStart(2,'0')}:${Math.floor(time%60).toString().padStart(2,'0')}`;
  }
  $('#toggle-play').onclick=()=>{playing=!playing;$('#toggle-play').innerHTML=playing?'Ⅱ <span>Pause</span>':'▶ <span>Resume</span>';$('#toggle-play').setAttribute('aria-label',playing?'Pause':'Resume');};
  $('#speed').onchange=()=>{speed=Number($('#speed').value);};
  $('#view-all').onclick=()=>{overview();crew.forEach(c=>c.card.classList.remove('selected'));};
  $('#view-close').onclick=()=>follow(crew[0]);
  $('#toggle-cutaway').onclick=()=>{const visible=!world.walls[0].visible;world.walls.forEach(w=>w.visible=visible);$('#toggle-cutaway').classList.toggle('active',!visible);};
  $('#concept-open').onclick=()=>$('#concept-dialog').showModal();$('#concept-close').onclick=()=>$('#concept-dialog').close();
  $('#close-department').onclick=()=>{$('#department').hidden=true;};
  const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();let pointerStart;
  renderer.domElement.addEventListener('pointerdown',e=>{pointerStart=[e.clientX,e.clientY];});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(!pointerStart||Math.hypot(e.clientX-pointerStart[0],e.clientY-pointerStart[1])>5)return;
    mouse.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);raycaster.setFromCamera(mouse,camera);
    const hit=raycaster.intersectObjects(world.pickables)[0];if(!hit)return;
    const room=hit.object.userData.room;$('#department').hidden=false;$('#department h2').textContent=room.name;$('#department p').textContent=room.description;$('#department ul').replaceChildren(...room.props.map(p=>{const li=document.createElement('li');li.textContent=p.label;return li;}));
  });
  function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setSize(innerWidth,innerHeight);}
  addEventListener('resize',resize);resize();
  renderer.setAnimationLoop(now=>{
    const dt=Math.min((now-previous)/1000,.1);previous=now;
    if(playing)tick(dt*speed);
    if(selected){const target=selected.position.clone().add(new THREE.Vector3(0,.6,0)),offset=target.clone().sub(controls.target);camera.position.add(offset);controls.target.copy(target);}
    controls.update();composer.render();
    uiTime+=dt;if(uiTime>.25){updateUI();uiTime=0;}
  });
  // Read-only snapshots plus bounded deterministic advancement for browser verification.
  window.station={snapshot:()=>({time,playing,departments:data.rooms.length,props:data.rooms.reduce((n,r)=>n+r.props.length,0),drawCalls:renderer.info.render.calls,crew:crew.map(c=>({id:c.definition.id,position:c.position.toArray(),mode:c.mode,distance:c.distance,completed:c.completed,skins:c.skinCount,bone:c.bone?.quaternion.toArray(),task:c.definition.tasks[c.taskIndex]})),doors:world.doors.map(d=>d.open)}),advance:seconds=>{if(!Number.isFinite(seconds)||seconds<0||seconds>180)throw new Error('Advance between 0 and 180 seconds');for(let t=0;t<seconds;t+=.05)tick(Math.min(.05,seconds-t));updateUI();},inspectRoom:id=>{const room=data.rooms.find(r=>r.id===id);if(!room)return;const [x,z]=ROOM_CENTERS[id];selected=null;camera.position.set(x+10,13,z+15);controls.target.set(x,0,z);controls.update();}};
  document.body.dataset.ready='true';status.textContent=`6 departments · ${crew.length} animated crew · 36 equipment stations`;
  $('.crew-panel .panel-heading .muted').textContent=`${String(crew.length).padStart(2,'0')} CREW`;
}catch(error){console.error(error);status.textContent=`Station failed to load: ${error.message}`;document.body.dataset.ready='failed';}
