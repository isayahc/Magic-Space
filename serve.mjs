import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { root } from './paths.mjs';
const require = createRequire(`${root}/package.json`);
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const files = new Map([
  ['/comparison', ['viewer.html', 'text/html']],
  ['/comparison/qwen3-4b.json', ['qwen3-4b.scene.json', 'application/json']],
  ['/comparison/gpt-4.1.json', ['gpt-4.1.scene.json', 'application/json']],
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
        let body = await readFile(new URL(file[0], import.meta.url), 'utf8');
        if (file[1] === 'text/html') body = await server.transformIndexHtml(path, body);
        res.setHeader('Content-Type', file[1]); res.end(body);
      } catch (error) { next(error); }
    });
  },
}] });
await server.listen();
console.log(`Animated comparison: http://127.0.0.1:${port}/comparison`);
