import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { out } from '../paths.mjs';
import { validateBlueprint,makeNavigation,ROOM_CENTERS,onFloor } from '../station/navigation.mjs';
import { stationCrew,SCIENTIST_ROUTINES } from '../station/crew.mjs';
import { STARTERS } from '../characters/catalog.mjs';
const data=JSON.parse(readFileSync(join(out,'station/blueprint.raw.txt'),'utf8'));
test('untouched GPT-6 blueprint satisfies the station contract',()=>{validateBlueprint(data);});
test('every crew task has a continuous safe route around equipment',()=>{
  const nav=makeNavigation(data);
  for(const [i,person] of stationCrew(data,[]).entries())for(let j=0;j<person.tasks.length;j++){
    const a=ROOM_CENTERS[person.tasks[j].room],b=ROOM_CENTERS[person.tasks[(j+1)%person.tasks.length].room];
    const path=nav.path([a[0]+i-1,a[1]],[b[0]+i-1,b[1]]);
    assert.ok(path.length);
    for(const [k,p] of path.entries()){
      assert.ok(onFloor(...p));
      assert.ok(!nav.obstacles.some(o=>Math.abs(o.x-p[0])<1.05&&Math.abs(o.z-p[1])<1.05));
      if(k)assert.ok(Math.abs(p[0]-path[k-1][0])+Math.abs(p[1]-path[k-1][1])<=.501);
    }
  }
});
test('every starter has real skins and animation channels in both clips',()=>{
  for(const {id:name} of STARTERS)for(const mode of ['walk','idle']){
    const b=readFileSync(join(out,`station/${name}-${mode}.glb`));
    assert.equal(b.toString('ascii',0,4),'glTF');assert.equal(b.readUInt32LE(8),b.length);
    const gltf=JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)));
    assert.ok(gltf.skins?.some(s=>s.joints.length>=20));
    assert.ok(gltf.animations?.some(a=>a.channels.length>20));
    assert.ok(gltf.meshes?.length);
  }
});
test('scientist outfits replace their base and inherit their research routines',()=>{
  const original=JSON.stringify(data);
  for(const id of Object.keys(SCIENTIST_ROUTINES)){
    const outfit={id:`${id}-outfit`,characterId:id,baseId:id,name:'Saved scientist',role:'Research',deployed:true,modelReady:true,walk:'/walk.glb',idle:'/idle.glb'};
    const crew=stationCrew(data,[outfit]);
    assert.equal(crew.length,STARTERS.length);
    assert.ok(!crew.some(c=>c.id===id));
    assert.deepEqual(crew.find(c=>c.id===outfit.id).tasks,SCIENTIST_ROUTINES[id]);
    assert.ok(new Set(SCIENTIST_ROUTINES[id].map(t=>t.room)).size>=3);
    const recruit=stationCrew(data,[{...outfit,characterId:'separate-recruit'}]);
    assert.equal(recruit.length,STARTERS.length+1);
    assert.ok(recruit.some(c=>c.id===id));
  }
  assert.equal(JSON.stringify(data),original);
});
