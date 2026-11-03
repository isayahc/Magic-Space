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
  {id:'astronaut',name:'Kite',role:'Survey',color:'#bdddcf',description:'A station surveyor in a white and orange spacesuit with a compact life-support pack.'},
  {id:'botanist',name:'Pip',role:'Hydroponics',color:'#c8de82',description:'A station botanist wearing a green and ivory work suit with practical boots.'},
].map(c=>({...c,baseId:c.id,starter:true,loadout:{...DEFAULT_LOADOUT},notes:'',semantic:'',portrait:`/characters/assets/${c.id}-base.png`,walk:`/station/assets/${c.id}-walk.glb`,idle:`/station/assets/${c.id}-idle.glb`,jobs:[]}));
export const PRESETS = {
  orbital:{label:'Orbital streetwear',loadout:DEFAULT_LOADOUT,notes:'Premium technical streetwear, tactile fabric, clean graphic color blocking, original unbranded design.'},
  greenhouse:{label:'Greenhouse punk',loadout:{outerwear:'Oversized moss-green cropped work jacket',top:'Ivory ribbed thermal shirt',bottoms:'Charcoal utility trousers with green knee panels',footwear:'Chunky ivory work boots',accessory:'Orange garden-tool belt and stitched leaf patches',palette:'Moss / ivory / orange'},notes:'Botanical workwear meets retro space-station punk. No handheld tools.'},
  nightshift:{label:'Night-shift runner',loadout:{outerwear:'Black short techwear jacket with reflective piping',top:'Slate high-collar compression shirt',bottoms:'Tapered graphite cargo pants',footwear:'Black high-top magnetic sneakers',accessory:'Small silver belt pouches and cyan wrist terminal',palette:'Graphite / silver / electric cyan'},notes:'Sleek utilitarian silhouette, subtle cyan detailing, no cape or trailing cloth.'},
};
export function outfitPrompt(c){
  return `Edit this image of ONE adult space-station character. Preserve the same face, skin tone, hairstyle, body proportions, and recognizable identity. Change the clothing to this complete coordinated outfit: ${Object.entries(c.loadout).map(([k,v])=>`${k}: ${v}`).join('; ')}. ${c.notes||''} ${c.semantic?`Visible reference details to preserve: ${c.semantic}.`:''} Full body from head to toes, front view, symmetrical relaxed A-pose with arms clearly separated from the torso and legs apart. Both hands and all limbs visible. Stylized polished 3D game-character concept, clean detailed materials. Neutral light gray studio background, soft even lighting, no text, no logos, no floor props, no weapons, no extra people, no split panels. Keep silhouette simple enough for humanoid skeletal rigging. Clothing should be worn on the character, not floating beside them.`;
}
