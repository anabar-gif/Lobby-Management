import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = String(process.env.PORT || '4173');

const child = spawn('npx', ['vite', 'preview', '--host', '0.0.0.0', '--port', port], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
