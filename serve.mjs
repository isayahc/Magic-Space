import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { root } from './paths.mjs';
import { currentRuns, legacyRuns } from './models.mjs';
const require = createRequire(`${root}/package.json`);
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const files = new Map([
  ['/comparison', ['viewer.html', 'text/html']],
  ...[...currentRuns, ...legacyRuns].map(run => [`/comparison/${run.slug}.json`, [`${run.slug}.scene.json`, 'application/json']]),
  ...['astronaut', 'engineer', 'botanist'].map(name => [`/comparison/assets/${name}.glb`, [`assets/${name}.glb`, 'model/gltf-binary']]),
]);
const port = Number(process.env.PORT || 4194);
const server = await createServer({ root, server: { host: '127.0.0.1', port, strictPort: true }, plugins: [{
  name: 'comparison-viewer',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const path = req.url?.split('?')[0];
      const file = files.get(path);
      if (!file) return next();
      try {
        let body = await readFile(new URL(file[0], import.meta.url), file[1] === 'model/gltf-binary' ? undefined : 'utf8');
        if (file[1] === 'text/html') body = await server.transformIndexHtml(path, body);
        res.setHeader('Content-Type', file[1]); res.end(body);
      } catch (error) { next(error); }
    });
  },
}] });
await server.listen();
console.log(`Animated comparison: http://127.0.0.1:${port}/comparison`);
