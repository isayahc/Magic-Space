import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { project } from './common.mjs';
const people = [
  ['astronaut', 'An adult female astronaut with dark brown skin, white and orange pressure suit, open helmet showing a friendly face, compact backpack', '61fcab21-c34f-4cc4-9e2d-9a1c3fadeba4'],
  ['engineer', 'An adult male spacecraft engineer with medium brown skin, short dark hair, teal and charcoal utility coveralls, orange safety accents, utility belt', 'bcaa9979-448a-45c4-8caa-608c3f791dcc'],
  ['botanist', 'An adult female space botanist with light brown skin, short curly black hair, green and ivory research jumpsuit, small purple shoulder patch', '85f08a34-1ef3-4f1c-939d-bc56faa792f8'],
];
const items = people.map(([name, description], i) => ({
  tool: 'run_template', name: 'api_tripo_p2_text_to_model', description: `Magic-Space ${name}`,
  input_overrides: {
    '1': {
      'model.prompt': `Single full-body stylized sci-fi human game character. ${description}. Adult proportions, appealing clean low-poly game art, complete head hands and boots, standing upright in relaxed A-pose, arms separated from torso, feet apart flat on ground. One character only, no base, no scenery, no props held in hands. Clean textured mesh, readable color blocks, suitable for a miniature orbital greenhouse scene.`,
      'model.face_limit': 12000, 'model.texture': 'standard', 'model.pbr': true,
      'model.model_seed': 420+i, 'model.image_seed': 420+i, 'model.texture_seed': 420+i,
      'model.negative_prompt': 'base, pedestal, multiple people, scenery, weapons, missing limbs, extra limbs',
    },
    '14': { filename_prefix: `magic_space/${name}` },
  },
}));
writeFileSync(join(project, 'assets/crew-batch.json'), JSON.stringify({ items, client_os: 'windows' }, null, 2)+'\n');
writeFileSync(join(project, 'assets/provenance.json'), JSON.stringify(people.map(([name, description, job],i) => ({name, description, job, file: `${name}.glb`, provider: 'Tripo', model: 'P2', template: 'api_tripo_p2_text_to_model', requested_face_limit: 12000, seed: 420+i, viewer_height_m: 1.75, viewer_rotation_degrees: [0,-90,0], viewer_position: [[-2,0,3.8],[2,0,3.8],[4.5,0,3.8]][i]})), null, 2)+'\n');
console.log('Wrote crew generation recipe and provenance. No jobs submitted.');
