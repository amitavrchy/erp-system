import { cp } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index = process.argv.indexOf('--port');
if (index >= 0) {
  const port = Number(process.argv[index + 1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid port');
  process.env.PORT = String(port);
}
await cp(path.join(root, '.next/static'), path.join(root, '.next/standalone/.next/static'), {
  recursive: true,
});
await cp(path.join(root, 'public'), path.join(root, '.next/standalone/public'), {
  recursive: true,
});
await import(pathToFileURL(path.join(root, '.next/standalone/server.js')).href);
