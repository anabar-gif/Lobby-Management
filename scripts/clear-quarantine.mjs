/**
 * macOS Gatekeeper often blocks native .node binaries and esbuild after npm install
 * (com.apple.quarantine). Clearing quarantine on node_modules fixes
 * "Apple could not verify … is free of malware" for local dev dependencies.
 *
 * Run manually anytime: npm run fix-gatekeeper
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { platform } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const nm = path.join(root, 'node_modules');

if (platform() !== 'darwin') {
    process.exit(0);
}

if (!existsSync(nm)) {
    process.exit(0);
}

const r = spawnSync('xattr', ['-dr', 'com.apple.quarantine', nm], {
    cwd: root,
    stdio: 'inherit'
});

if (r.status !== 0) {
    console.warn(
        '[clear-quarantine] xattr exited with',
        r.status,
        '- try: System Settings → Privacy & Security → allow the blocked app, or run Terminal outside restricted folders.'
    );
    process.exit(0);
}

console.log('[clear-quarantine] Removed com.apple.quarantine from node_modules (macOS).');
