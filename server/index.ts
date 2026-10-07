import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { exec } from 'node:child_process';
import { loadDb, ROOT, UPLOAD_DIR } from './db';
import { seedDatabase } from './seed';
import { migrateDatabase } from './migrate';
import { authRouter } from './routes/auth';
import { learnerRouter } from './routes/learner';
import { communityRouter, publicRouter } from './routes/community';
import { staffRouter } from './routes/staff';
import { uploadRouter } from './routes/uploads';
import { navVideoRouter } from './routes/navVideo';
import { transcriptRouter } from './routes/transcripts';

// 4600 keeps this app away from port 3000, where older prototypes usually run.
const BASE_PORT = Number(process.env.PORT) || 4600;
const APP_ID = 'usaii-intuitive-lms';
// `npm start` passes --prod, so a host runs the built app no matter how its dashboard is set up.
if (process.argv.includes('--prod')) process.env.NODE_ENV = 'production';
const isProd = process.env.NODE_ENV === 'production';

async function main() {
  loadDb(seedDatabase, migrateDatabase);
  const app = express();
  app.disable('x-powered-by');
  // Behind a host's proxy (Render, nginx), req.ip must be the visitor's address for sign-in rate limits.
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
  app.use(express.json({ limit: '5mb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (isProd) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ app: APP_ID, status: 'ok', version: '5.6.0', time: new Date().toISOString() }));
  app.use('/api/auth', authRouter);
  app.use('/api/learner', learnerRouter);
  app.use('/api/public', publicRouter);
  app.use('/api/staff', staffRouter);
  app.use('/api/uploads', uploadRouter);
  app.use('/api/nav-video', navVideoRouter);
  app.use('/api/transcripts', transcriptRouter);
  app.use('/api', communityRouter);
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

  // Uploaded files. Media, images and PDFs open inline; anything else (Office files, text, zip)
  // downloads and is sandboxed, so an uploaded file can never run as a page on the LMS's origin.
  const INLINE_UPLOAD = /\.(mp4|m4v|mov|webm|ogv|mp3|m4a|wav|ogg|aac|flac|png|jpe?g|gif|webp|avif|pdf)$/i;
  app.use(
    '/uploads',
    express.static(UPLOAD_DIR, {
      maxAge: '7d',
      fallthrough: false,
      dotfiles: 'deny',
      setHeaders: (res, filePath) => {
        if (!INLINE_UPLOAD.test(filePath)) {
          res.setHeader('Content-Disposition', 'attachment');
          res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
        }
      },
    }),
  );

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[error]', err);
    if (!res.headersSent) res.status(500).json({ error: 'Something went wrong on our side. Please try again.' });
  });

  const server = http.createServer(app);
  // Large videos (course media and the navigation video, up to 1 GB) can take longer than
  // Node's default 5-minute request limit on a slow connection; allow up to one hour.
  server.requestTimeout = 60 * 60 * 1000;

  if (!isProd) {
    const { createServer } = await import('vite');
    // Live-reload runs over this same server/port, so it never collides with another app.
    const vite = await createServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.join(ROOT, 'dist');
    if (!fs.existsSync(dist)) {
      console.error('Build not found. Run "npm run build" first (on Render: Build Command "npm install && npm run build").');
      process.exit(1);
    }
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // On a hosting platform the port is assigned and must be used exactly as given;
  // only on a local machine do we hunt for the next free port.
  const fixedPort = !!process.env.PORT;
  const port = fixedPort ? await listenOnPort(server, BASE_PORT) : await listenOnFreePort(server, BASE_PORT);
  const url = `http://localhost:${port}`;
  console.log('');
  console.log('  ==============================================');
  console.log('   USAII Intuitive LMS 5.6 is running');
  console.log(`   Open ${url}`);
  console.log('  ==============================================');
  if (port !== BASE_PORT) console.log(`   (Port ${BASE_PORT} was busy, so ${port} is used instead.)`);
  console.log('');
  // Passwords are never printed: anyone who can read a console or a host's log could sign in.
  console.log(isProd ? '   Starter accounts use SEED_INSTRUCTOR_PASSWORD / SEED_LEARNER_PASSWORD (see DEPLOY.md).' : '   Test accounts are listed in TEST-CREDENTIALS.md (see README).');
  console.log('');
  console.log('   Keep this window open while you use the LMS. Close it to stop.');
  console.log('');
  if (process.env.OPEN_BROWSER === '1') openBrowser(url);
}

function listenOnPort(server: http.Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => resolve(port));
  });
}

function listenOnFreePort(server: http.Server, start: number): Promise<number> {
  return new Promise((resolve, reject) => {
    let port = start;
    const tryPort = () => {
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && port < start + 20) {
          port += 1;
          tryPort();
        } else reject(err);
      });
      server.listen(port, () => resolve(port));
    };
    tryPort();
  });
}

function openBrowser(url: string) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd, () => undefined);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
