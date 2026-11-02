import { readFile, writeFile, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const portArg = process.argv.find((a) => a.startsWith('--client-port='));
const port = portArg ? Number(portArg.split('=')[1]) : 3000;
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid client port');
for (const [folder, target] of [
  ['Server', '.env'],
  ['Client', '.env.local'],
]) {
  const destination = path.join(root, folder, target);
  let exists = false;
  try {
    await access(destination);
    exists = true;
  } catch {
    /* First setup. */
  }
  if (exists) {
    console.log(`${folder}/${target} already exists; preserved.`);
    continue;
  }
  let source = await readFile(path.join(root, folder, '.env.example'), 'utf8');
  if (folder === 'Server') {
    source = source
      .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${randomBytes(32).toString('hex')}`)
      .replace(/^JWT_REFRESH_SECRET=.*\r?\n/m, '')
      .replace(/^DEMO_PASSWORD=.*$/m, `DEMO_PASSWORD=${randomBytes(18).toString('base64url')}`)
      .replace(/^CLIENT_ORIGIN=.*$/m, `CLIENT_ORIGIN=http://localhost:${port}`);
  }
  await writeFile(destination, source, { flag: 'wx' });
  console.log(`Created ${folder}/${target}. Secrets remain in your local ignored file.`);
}
console.log(`Next: follow README.md. Client port: ${port}.`);
