// Bring externally generated/MCP outputs into the local character roster; no model calls.
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {join,extname} from 'node:path';
import {createCharacterService,assetsRoot,validateRig,decodeImage} from '../characters/server.mjs';
const args=process.argv.slice(2),options={};
const allowed=['name','base','image','walk','idle','image-job','model-job'];
for(let i=0;i<args.length;i+=2){const key=args[i].replace(/^--/,'');if(!allowed.includes(key)||!args[i+1])throw new Error(`Unknown or incomplete argument: ${args[i]}`);options[key]=args[i+1];}
for(const key of ['name','image','walk','idle'])if(!options[key])throw new Error(`Usage: node scripts/import-character.mjs --name Nova --base engineer --image outfit.png --walk walk.glb --idle idle.glb (missing --${key})`);
for(const key of ['image-job','model-job'])if(options[key]&&!/^[a-f0-9-]{36}$/i.test(options[key]))throw new Error(`Invalid --${key} UUID`);
const image=await readFile(options.image),mime=extname(options.image).toLowerCase()==='.jpg'||extname(options.image).toLowerCase()==='.jpeg'?'jpeg':extname(options.image).toLowerCase()==='.webp'?'webp':'png';
const {ext}=decodeImage(`data:image/${mime};base64,${image.toString('base64')}`);
validateRig(await readFile(options.walk));validateRig(await readFile(options.idle));
const service=createCharacterService(),c=await service.create({name:options.name,sourceId:options.base||'engineer'});
const dir=join(assetsRoot,'local',c.id),url=`/characters/assets/local/${c.id}`;
await copyFile(options.image,join(dir,`imported-look.${ext}`));await copyFile(options.walk,join(dir,'imported-walk.glb'));await copyFile(options.idle,join(dir,'imported-idle.glb'));
c.look=`${url}/imported-look.${ext}`;c.walk=`${url}/imported-walk.glb`;c.idle=`${url}/imported-idle.glb`;c.modelReady=true;
c.notes='Imported generated outfit. Edit these wardrobe notes before requesting a new look.';
c.jobs=[{stage:'look',status:'imported',promptId:options['image-job']||null},{stage:'model',status:'imported',promptId:options['model-job']||null}];
await writeFile(join(dir,'character.json.tmp'),JSON.stringify(c,null,2));
const {rename}=await import('node:fs/promises');await rename(join(dir,'character.json.tmp'),join(dir,'character.json'));
console.log(`Imported ${c.name} (${c.id}). Reload /characters to preview and add them to the station.`);
