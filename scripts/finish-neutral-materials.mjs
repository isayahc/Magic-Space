// The provider exports one shared material per character. Give these practical
// base outfits a soft matte finish rather than the export's glossy plastic look.
// Only the GLB JSON material factors change; mesh, skin, textures and clips remain.
import {readFile,writeFile} from 'node:fs/promises';
import {validateRig} from '../characters/server.mjs';
for(const id of (process.argv.slice(2).length?process.argv.slice(2):['astronaut','botanist']))for(const clip of ['walk','idle']){
  const file=new URL(`../assets/station/${id}-${clip}.glb`,import.meta.url),bytes=await readFile(file);
  validateRig(bytes);
  const oldLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.toString('utf8',20,20+oldLength));
  for(const material of json.materials){
    const pbr=material.pbrMetallicRoughness;
    delete pbr.metallicRoughnessTexture;pbr.metallicFactor=0;pbr.roughnessFactor=.85;
  }
  const text=Buffer.from(JSON.stringify(json)),length=Math.ceil(text.length/4)*4;
  const padded=Buffer.alloc(length,32);text.copy(padded);
  const header=Buffer.from(bytes.subarray(0,20)),tail=bytes.subarray(20+oldLength);
  header.writeUInt32LE(20+length+tail.length,8);header.writeUInt32LE(length,12);
  const output=Buffer.concat([header,padded,tail]);validateRig(output);await writeFile(file,output);
  console.log(`Applied matte finish: ${id}-${clip}.glb`);
}
