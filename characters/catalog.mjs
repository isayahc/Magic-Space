export const DEFAULT_LOADOUT = {
  outerwear:'Cropped cream utility jacket with black paneling',
  top:'Black technical undersuit',
  bottoms:'Relaxed black cargo trousers',
  footwear:'Cream high-top magnetic boots',
  accessory:'Orange cross-body utility strap and compact belt pouches',
  palette:'Bone white / charcoal / signal orange',
};
export const STARTERS = [
  {id:'engineer',name:'Latch',role:'Engineering',color:'#f3ae65',description:'A station engineer in a teal utility suit, with orange gloves and sturdy work boots.'},
  {id:'astronaut',name:'Kite',role:'Survey',color:'#bdddcf',description:'A station surveyor in a roomy orange pressure suit with a flat ivory chest plate and sturdy work boots.',loadout:{outerwear:'Roomy orange pressure suit with a flat ivory equipment plate',top:'Fully enclosed high-neck protective layer',bottoms:'Loose orange utility trousers with reinforced ivory knee pads',footwear:'Wide ivory flat-soled magnetic work boots',accessory:'Survey helmet, protective gloves, horizontal utility belt and compact life-support pack',palette:'Warm orange / ivory / slate gray'},notes:'Practical unisex protective clothing, straight relaxed silhouette, neutral proportions, matte woven fabric and scuffed fittings.'},
  {id:'botanist',name:'Pip',role:'Hydroponics',color:'#c8de82',description:'A station botanist in a straight-cut green utility jacket, relaxed cargo trousers and flat gardening boots.',loadout:{outerwear:'Straight-cut moss-green canvas utility jacket with ivory shoulder panels and rectangular pockets',top:'Olive crew-neck work shirt',bottoms:'Relaxed olive cargo trousers with reinforced knees',footwear:'Wide dark green flat-soled gardening boots',accessory:'Green work gloves and compact belt pouches',palette:'Moss green / olive / ivory'},notes:'Practical unisex gardening workwear, straight jacket hem, relaxed fit, neutral proportions, matte canvas and cotton.'},
  {id:'astrophysicist',name:'Aster',role:'Astrophysics',color:'#89cfe5',description:'An astrophysicist with silver curls in a long navy and ivory work jacket and relaxed utility trousers.',loadout:{outerwear:'Boxy hip-covering navy utility jacket with ivory shoulders and cyan piping',top:'Opaque ivory high-neck work shirt',bottoms:'Relaxed navy cargo trousers with ivory knee patches',footwear:'Flat ivory magnetic work boots',accessory:'Navy protective gloves and cyan wrist terminal',palette:'Navy / ivory / cyan'},notes:'Fully covered practical workwear, loose straight silhouette, thick matte fabric, flat chest panel, ordinary neutral proportions.'},
  {id:'materials-scientist',name:'Flint',role:'Materials science',color:'#dc9871',description:'A bearded materials scientist in a rust field-lab jacket, slate cargo trousers and sturdy protective boots.',loadout:{outerwear:'Straight-cut rust laboratory field jacket with slate shoulders and square pockets',top:'Opaque charcoal high-neck work shirt',bottoms:'Relaxed slate cargo trousers with rust reinforced knees',footwear:'Chunky flat charcoal safety boots',accessory:'Dark protective gloves and compact sample pouches',palette:'Rust / slate / charcoal'},notes:'Fully covered practical workwear, relaxed fit, thick matte canvas, straight waist, sturdy ordinary proportions.'},
].map(c=>({...c,baseId:c.id,starter:true,loadout:{...(c.loadout||DEFAULT_LOADOUT)},notes:c.notes||'',semantic:'',portrait:`/characters/assets/${c.id}-base.png`,walk:`/station/assets/${c.id}-walk.glb`,idle:`/station/assets/${c.id}-idle.glb`,jobs:[]}));
export const PRESETS = {
  orbital:{label:'Orbital streetwear',loadout:DEFAULT_LOADOUT,notes:'Premium technical streetwear, tactile fabric, clean graphic color blocking, original unbranded design.'},
  greenhouse:{label:'Greenhouse punk',loadout:{outerwear:'Oversized moss-green cropped work jacket',top:'Ivory ribbed thermal shirt',bottoms:'Charcoal utility trousers with green knee panels',footwear:'Chunky ivory work boots',accessory:'Orange garden-tool belt and stitched leaf patches',palette:'Moss / ivory / orange'},notes:'Botanical workwear meets retro space-station punk. No handheld tools.'},
  nightshift:{label:'Night-shift runner',loadout:{outerwear:'Black short techwear jacket with reflective piping',top:'Slate high-collar compression shirt',bottoms:'Tapered graphite cargo pants',footwear:'Black high-top magnetic sneakers',accessory:'Small silver belt pouches and cyan wrist terminal',palette:'Graphite / silver / electric cyan'},notes:'Sleek utilitarian silhouette, subtle cyan detailing, no cape or trailing cloth.'},
};
export function outfitPrompt(c){
  return `Edit this image of ONE adult space-station character. Preserve the same face, skin tone, hairstyle, body proportions, and recognizable identity. Change the clothing to this complete coordinated outfit: ${Object.entries(c.loadout).map(([k,v])=>`${k}: ${v}`).join('; ')}. ${c.notes||''} ${c.semantic?`Visible reference details to preserve: ${c.semantic}.`:''} Full body from head to toes, front view, symmetrical relaxed A-pose with arms clearly separated from the torso and legs apart. Both hands and all limbs visible. Stylized polished 3D game-character concept, clean detailed materials. Neutral light gray studio background, soft even lighting, no text, no logos, no floor props, no weapons, no extra people, no split panels. Keep silhouette simple enough for humanoid skeletal rigging. Clothing should be worn on the character, not floating beside them.`;
}

// Older builds stored automatic outfit drafts as “Name II”. Resolve those records
// into a wardrobe without changing IDs, media paths, or their generation history.
export function characterWardrobe(records){
  const byId=new Map(records.map(c=>[c.id,c]));
  function owner(c,seen=new Set()){
    if(seen.has(c.id))return c.id;seen.add(c.id);
    if(c.characterId)return c.characterId;
    const source=byId.get(c.sourceBundle||c.sourceCharacter);
    if(source&&(c.sourceBundle||c.name===`${source.name} II`))return owner(source,seen);
    return c.id;
  }
  const counts=new Map();
  return records.map(c=>{
    const characterId=owner(c),identity=byId.get(characterId)||c;
    const index=counts.get(characterId)||0;counts.set(characterId,index+1);
    return {...c,characterId,name:identity.name,role:identity.role,
      outfitName:c.outfitName||(c.id===characterId?'Original':`Look ${String(index).padStart(2,'0')}`)};
  });
}

export function groupWardrobe(records){
  const groups=new Map();
  for(const c of characterWardrobe(records)){
    if(!groups.has(c.characterId))groups.set(c.characterId,{id:c.characterId,name:c.name,role:c.role,outfits:[]});
    groups.get(c.characterId).outfits.push(c);
  }
  return [...groups.values()];
}
