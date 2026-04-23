import express from 'express';
import basicAuth from 'express-basic-auth';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

if (!existsSync(path.join(dist, 'index.html'))) {
    console.error('Error: dist/index.html not found. Run "npm run build" first.');
    process.exit(1);
}

/* Defaults match requested access; override on Heroku with e.g. heroku config:set BASIC_AUTH_USER=... */
const authUser = process.env.BASIC_AUTH_USER || 'admin';
const authPassword = process.env.BASIC_AUTH_PASSWORD || 'salesforce';

const app = express();
app.set('trust proxy', 1);
app.use(
    basicAuth({
        users: { [authUser]: authPassword },
        challenge: true,
    })
);
app.use(express.static(dist, { index: 'index.html', fallthrough: true }));
app.use((req, res) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
        res.sendFile(path.join(dist, 'index.html'));
    } else {
        res.status(404).end();
    }
});

const port = parseInt(process.env.PORT || '4173', 10);
app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on ${port} (HTTP Basic: user "${authUser}")`);
});
