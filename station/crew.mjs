import { STARTERS } from '../characters/catalog.mjs';

// Authored extensions to the archived, unmodified three-person AI blueprint.
export const SCIENTIST_ROUTINES = {
  astrophysicist:[
    {room:'command',action:'Calibrating orbital star fixes',seconds:9},
    {room:'research',action:'Comparing storm spectra with the pigment atlas',seconds:12},
    {room:'engineering',action:'Checking telescope sensor drift',seconds:7},
    {room:'command',action:'Updating the planetary observation schedule',seconds:8},
    {room:'hydroponics',action:'Sampling light response in living pigments',seconds:10},
  ],
  'materials-scientist':[
    {room:'research',action:'Testing ceramic sample fatigue',seconds:12},
    {room:'cargo',action:'Cataloguing incoming alloy samples',seconds:8},
    {room:'engineering',action:'Inspecting pressure-seal wear',seconds:10},
    {room:'medical',action:'Checking biocompatible coating samples',seconds:7},
    {room:'research',action:'Recording material stress results',seconds:9},
  ],
};

export function stationCrew(blueprint,characters){
  const scientists=STARTERS.filter(c=>SCIENTIST_ROUTINES[c.id]).map(c=>({id:c.id,callsign:c.name,role:c.role,color:c.color,walk:c.walk,idle:c.idle,tasks:SCIENTIST_ROUTINES[c.id]}));
  const bases=[...blueprint.crew,...scientists],byId=new Map(bases.map(c=>[c.id,c]));
  const equipped=new Map(characters.filter(c=>c.deployed&&c.modelReady&&!c.starter).map(c=>[c.characterId||c.id,c]));
  const recruits=[...equipped.values()].map(c=>{
    const base=byId.get(c.baseId);
    if(!base)throw new Error(`No station routine for character base: ${c.baseId}`);
    return {id:c.id,callsign:c.name,role:c.role,color:c.color||base.color||'#d3ed91',walk:c.walk,idle:c.idle,tasks:base.tasks};
  });
  return [...bases.filter(c=>!equipped.has(c.id)),...recruits];
}
