import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { root } from './paths.mjs';
import { currentRuns, legacyRuns } from './models.mjs';
import { characterMiddleware,assetsRoot } from './characters/server.mjs';
import { resolve,relative } from 'node:path';
const require = createRequire(`${root}/package.json`);
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const stationAssets = await readdir(new URL('assets/station/', import.meta.url));
const mime = { glb: 'model/gltf-binary', png: 'image/png', jpg: 'image/jpeg', txt: 'text/plain', json: 'application/json', webm: 'video/webm', gif: 'image/gif' };
const files = new Map([
  ['/characters', ['characters/index.html', 'text/html']],
  ['/characters/', ['characters/index.html', 'text/html']],
  ...['main.mjs','preview.mjs','catalog.mjs'].map(name=>[`/characters/${name}`,[`characters/${name}`,'application/javascript']]),
  ['/characters/style.css',['characters/style.css','text/css']],
  ['/characters/viewport.css',['characters/viewport.css','text/css']],
  ['/station', ['station/index.html', 'text/html']],
  ['/station/', ['station/index.html', 'text/html']],
  ...['main.mjs', 'world.mjs', 'navigation.mjs'].map(name => [`/station/${name}`, [`station/${name}`, 'application/javascript']]),
  ['/station/style.css', ['station/style.css', 'text/css']],
  ...stationAssets.filter(name => mime[name.split('.').at(-1)]).map(name => [`/station/assets/${name}`, [`assets/station/${name}`, mime[name.split('.').at(-1)]]]),
  ['/comparison', ['viewer.html', 'text/html']],
  ...[...currentRuns, ...legacyRuns].map(run => [`/comparison/${run.slug}.json`, [`assets/${run.slug}.scene.json`, 'application/json']]),
  ...['astronaut', 'engineer', 'botanist'].map(name => [`/comparison/assets/${name}.glb`, [`assets/${name}.glb`, 'model/gltf-binary']]),
]);
const port = Number(process.env.PORT || 4194);
const server = await createServer({ root, server: { host: '127.0.0.1', port, strictPort: true }, plugins: [{
  name: 'comparison-viewer',
  configureServer(server) {
    server.middlewares.use(characterMiddleware());
    server.middlewares.use(async(req,res,next)=>{
      const url=req.url?.split('?')[0];
      if(!url?.startsWith('/characters/assets/'))return next();
      const name=url.slice('/characters/assets/'.length),path=resolve(assetsRoot,name),rel=relative(assetsRoot,path),ext=name.split('.').at(-1);
      if(rel.startsWith('..')||!mime[ext]||name.endsWith('character.json')){res.statusCode=404;return res.end();}
      try{res.setHeader('Content-Type',mime[ext]);res.setHeader('X-Content-Type-Options','nosniff');res.end(await readFile(path));}catch{res.statusCode=404;res.end();}
    });
    server.middlewares.use(async (req, res, next) => {
      const path = req.url?.split('?')[0];
      const file = files.get(path);
      if (!file) return next();
      try {
        let body = await readFile(new URL(file[0], import.meta.url), /^(model|image|video)\//.test(file[1]) ? undefined : 'utf8');
        if (file[1] === 'text/html') body = await server.transformIndexHtml(path, body);
        res.setHeader('Content-Type', file[1]); res.end(body);
      } catch (error) { next(error); }
    });
  },
}] });
await server.listen();
console.log(`Animated comparison: http://127.0.0.1:${port}/comparison`);
console.log(`Living space station: http://127.0.0.1:${port}/station`);
console.log(`Character atelier: http://127.0.0.1:${port}/characters`);
