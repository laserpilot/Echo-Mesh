import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT } from '@echo/protocol';
import { createServer, lanAddresses } from './server.ts';

const port = Number(process.env.PORT ?? DEFAULT_PORT);
const dist = fileURLToPath(new URL('../../web/dist', import.meta.url));
const staticDir = existsSync(dist) && process.env.NODE_ENV !== 'development' ? dist : undefined;

await createServer({ port, staticDir });

const webPort = staticDir ? port : 5173;
console.log(`\n  Echo Mesh server on :${port}${staticDir ? ' (serving built web app)' : ''}`);
for (const ip of ['localhost', ...lanAddresses()]) {
  console.log(`    conduct  http://${ip}:${webPort}/conduct`);
  console.log(`    play     http://${ip}:${webPort}/`);
}
console.log();
