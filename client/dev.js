import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Change CWD to client/ so all configs resolve correctly
process.chdir(__dirname);

const { createServer } = await import('vite');

const server = await createServer({
  root: __dirname,
  configFile: path.join(__dirname, 'vite.config.ts'),
  server: { port: 3000, host: '127.0.0.1' },
});

await server.listen();
server.printUrls();
