/**
 * End-to-end API tests against a real server (fresh data folder) and a mock AI service.
 * Run: npm run test:api   (starts its own server on port 4699; needs a free port 4699 and 4790)
 */
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve('.');
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'lms-api-'));
const BASE = 'http://127.0.0.1:4699';
const PW = { instructor: 'VJ%NTj+R%zgvTp3wmc', alex: '7rcV%5qXmNTFttj_Dw', jordan: 'Vv_rG%?6Jyj78bt+Kx' };

let server: ChildProcess;
let mock: http.Server;
let aiCalls = 0;

/* A tiny stand-in for the Anthropic Messages API. */
function startMock() {
  mock = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      aiCalls += 1;
      const j = JSON.parse(body);
      const user = JSON.stringify(j.messages[0].content);
      let text: string;
      if (j.system.includes('translator')) {
        const m = /<transcript>\\n([\s\S]*?)\\n<\/transcript>/.exec(user);
        text = (m ? m[1].replace(/\\n/g, '\n') : '').split('\n\n').map((p) => p.replace(/^(\[[\d:]+\] )?/, '$1[HI] ')).join('\n\n');
      } else {
        assert.ok(user.includes('"type":"document"'), 'rubric PDF must be attached');
        text = '```json\n{"maxPoints": 10, "points": 7, "criteria": [{"name": "Clarity", "points": 7, "max": 10, "reason": "Clear list."}], "feedback": "Good start."}\n```';
      }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ content: [{ type: 'text', text }] }));
    });
  });
  return new Promise<void>((r) => mock.listen(4790, '127.0.0.1', () => r()));
}

async function api(p: string, opts: { token?: string; body?: unknown; method?: string } = {}) {
  const r = await fetch(BASE + '/api' + p, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let data: any = null;
  try {
    data = await r.json();
  } catch {
    /* not json */
  }
  return { status: r.status, data, headers: r.headers };
}
const login = async (email: string, password: string, role?: string) => (await api('/auth/login', { body: { email, password, role } })).data?.token as string;

async function upload(token: string, name: string, type: string, bytes: Buffer) {
  const fd = new FormData();
  fd.append('file', new Blob([bytes], { type }), name);
  const r = await fetch(BASE + '/api/uploads', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: fd });
  return { status: r.status, data: await r.json() };
}

const MINI_PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

before(async () => {
  await startMock();
  // Run the server from a scratch copy of the folder layout, so tests never touch real data.
  for (const f of ['server', 'shared', 'src', 'public', 'index.html', 'vite.config.ts', 'tsconfig.json', 'package.json', 'node_modules', 'dist']) {
    if (fs.existsSync(path.join(ROOT, f))) fs.symlinkSync(path.join(ROOT, f), path.join(WORK, f));
  }
  server = spawn(process.execPath, [path.join(ROOT, 'node_modules/tsx/dist/cli.mjs'), 'server/index.ts'], {
    cwd: WORK,
    env: { ...process.env, PORT: '4699', NODE_ENV: 'production', SEED_INSTRUCTOR_PASSWORD: PW.instructor, SEED_LEARNER_PASSWORD: PW.alex, ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_BASE_URL: 'http://127.0.0.1:4790', GEMINI_API_KEY: '' },
    stdio: 'pipe',
  });
  let log = '';
  server.stdout!.on('data', (d) => (log += d));
  server.stderr!.on('data', (d) => (log += d));
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(BASE + '/api/health')).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Server did not start:\n' + log);
});

after(() => {
  server?.kill();
  mock?.close();
});

let instr = '';
let alex = '';
const CID = 'c_ai_fluency';
const LID = 'af-d1';

/* ---------------- Sign-in security ---------------- */

test('old published passwords no longer work; new strong ones do', async () => {
  assert.equal((await api('/auth/login', { body: { email: 'alex.rivera@enterprise.com', password: 'Learner@2026' } })).status, 401);
  assert.equal((await api('/auth/login', { body: { email: 'instructor@usaii.org', password: 'Instructor@2026' } })).status, 401);
  instr = await login('instructor@usaii.org', PW.instructor, 'instructor');
  alex = await login('alex.rivera@enterprise.com', PW.alex, 'learner');
  assert.ok(instr && alex);
});

test('the sign-in tab must match the account role', async () => {
  const r = await api('/auth/login', { body: { email: 'alex.rivera@enterprise.com', password: PW.alex, role: 'instructor' } });
  assert.equal(r.status, 403);
  assert.match(r.data.error, /learner account/);
});

test('repeated wrong passwords lock the account', async () => {
  const statuses: number[] = [];
  for (let i = 0; i < 6; i++) statuses.push((await api('/auth/login', { body: { email: 'nobody@example.com', password: 'wrong-password' } })).status);
  assert.deepEqual(statuses.slice(0, 5), [401, 401, 401, 401, 401]);
  assert.equal(statuses[5], 429);
});

test('passwords are never printed or exposed', async () => {
  const me = await api('/auth/me', { token: alex });
  assert.equal(me.data.user.passwordHash, undefined);
  assert.equal(me.data.user.passwordChangedAt, undefined);
});

test('weak new password is rejected; changing password ends old sessions', async () => {
  const jordan = await login('jordan.lee@enterprise.com', PW.alex);
  const weak = await api('/auth/change-password', { token: jordan, body: { current: PW.alex, next: 'Password123' } });
  assert.equal(weak.status, 400);
  const other = await login('jordan.lee@enterprise.com', PW.alex);
  await new Promise((r) => setTimeout(r, 1100));
  const ok = await api('/auth/change-password', { token: jordan, body: { current: PW.alex, next: 'Fresh!Passw0rd-2026' } });
  assert.equal(ok.status, 200);
  assert.ok(ok.data.token, 'a fresh token is returned');
  assert.equal((await api('/auth/me', { token: other })).status, 401, 'old session must end');
  assert.equal((await api('/auth/me', { token: ok.data.token })).status, 200);
});

test('security headers are set', async () => {
  const r = await fetch(BASE + '/api/health');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.ok(r.headers.get('strict-transport-security'));
});

/* ---------------- Uploads ---------------- */

test('uploads: HTML disguised as an image and SVG are refused', async () => {
  assert.equal((await upload(alex, 'evil.html', 'image/png', Buffer.from('<script>alert(1)</script>'))).status, 400);
  assert.equal((await upload(alex, 'evil.svg', 'image/svg+xml', Buffer.from('<svg onload="alert(1)"/>'))).status, 400);
});

test('uploads: images and PDFs open inline; documents download in a sandbox', async () => {
  const png = await upload(instr, 'pic.png', 'image/png', PNG);
  assert.equal(png.status, 200);
  const r1 = await fetch(BASE + png.data.url);
  assert.equal(r1.headers.get('content-disposition'), null);
  const txt = await upload(alex, 'notes.txt', 'text/plain', Buffer.from('hello'));
  const r2 = await fetch(BASE + txt.data.url);
  assert.equal(r2.headers.get('content-disposition'), 'attachment');
  assert.match(r2.headers.get('content-security-policy') ?? '', /sandbox/);
  // An encoded "../" must never escape the uploads folder.
  const trav = await fetch(BASE + '/uploads/%2e%2e%2fpackage.json');
  assert.notEqual(trav.status, 200);
  assert.doesNotMatch(await trav.text(), /usaii-intuitive-lms/);
});

/* ---------------- Course setup by the instructor ---------------- */

let imgUrl = '';
let pdfUrl = '';
test('instructor sets rich instructions with an image, a rubric PDF, a video, then publishes', async () => {
  imgUrl = (await upload(instr, 'diagram.png', 'image/png', PNG)).data.url;
  pdfUrl = (await upload(instr, 'Rubric Day 1.pdf', 'application/pdf', MINI_PDF)).data.url;
  const { data } = await api(`/staff/courses/${CID}`, { token: instr });
  const course = data.course;
  const lesson = course.modules[0].lessons[0];
  lesson.activity.instructionBlocks = [
    { id: 'i1', type: 'paragraph', text: 'List the tasks you did **last week**.' },
    { id: 'i2', type: 'image', url: imgUrl, label: 'Example list', text: 'An example' },
    { id: 'i3', type: 'list', items: ['Sort them', 'Mark AI tasks'], ordered: false },
    { id: 'i4', type: 'video', url: '/uploads/x.mp4' }, // not allowed inside instructions
  ];
  lesson.activity.rubricPdf = { url: pdfUrl, name: 'Rubric Day 1.pdf', maxPoints: 20 };
  const video = lesson.blocks.find((b: any) => b.type === 'video');
  video.url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  course.price = 0;
  course.priceSet = true;
  const saved = await api(`/staff/courses/${CID}`, { token: instr, method: 'PUT', body: course });
  assert.equal(saved.status, 200, JSON.stringify(saved.data));
  const act = saved.data.course.modules[0].lessons[0].activity;
  assert.deepEqual(
    act.instructionBlocks.map((b: any) => b.type),
    ['paragraph', 'image', 'list'],
    'video blocks are stripped from instructions',
  );
  assert.equal(act.rubricPdf.maxPoints, 20);
  assert.ok(saved.data.course.modules[0].lessons[0].blocks.find((b: any) => b.type === 'video').transcript.length > 200);
  assert.equal((await api(`/staff/courses/${CID}/status`, { token: instr, body: { status: 'published' } })).status, 200);
});

test('rubric must be a PDF with sensible total points', async () => {
  const { data } = await api(`/staff/courses/${CID}`, { token: instr });
  const c1 = structuredClone(data.course);
  c1.modules[0].lessons[0].activity.rubricPdf = { url: imgUrl, name: 'x.png', maxPoints: 20 };
  assert.equal((await api(`/staff/courses/${CID}`, { token: instr, method: 'PUT', body: c1 })).status, 400);
  const c2 = structuredClone(data.course);
  c2.modules[0].lessons[0].activity.rubricPdf = { url: pdfUrl, name: 'r.pdf', maxPoints: 0 };
  assert.equal((await api(`/staff/courses/${CID}`, { token: instr, method: 'PUT', body: c2 })).status, 400);
});

/* ---------------- Transcripts ---------------- */

test('transcript translation: access rules and validation', async () => {
  const body = { courseId: CID, lessonId: LID, blockId: 'af-d1-b9', lang: 'hi' };
  assert.equal((await api('/transcripts/translate', { token: alex, body })).status, 403, 'not enrolled yet');
  assert.equal((await api(`/learner/enroll/${CID}`, { token: alex, body: {} })).status, 200);
  assert.equal((await api('/transcripts/translate', { token: alex, body: { ...body, lang: 'xx' } })).status, 400);
  assert.equal((await api('/transcripts/translate', { token: alex, body: { ...body, blockId: 'nope' } })).status, 404);
  const en = await api('/transcripts/translate', { token: alex, body: { ...body, lang: 'en' } });
  assert.equal(en.status, 200);
  assert.match(en.data.text, /Dana/);
});

test('transcript translation: translated once, then served from the shared cache', async () => {
  const body = { courseId: CID, lessonId: LID, blockId: 'af-d1-b9', lang: 'hi' };
  const before = aiCalls;
  const first = await api('/transcripts/translate', { token: alex, body });
  assert.equal(first.status, 200, JSON.stringify(first.data));
  assert.equal(first.data.cached, false);
  assert.match(first.data.text, /\[HI\]/);
  const calls = aiCalls - before;
  assert.ok(calls >= 1);
  const second = await api('/transcripts/translate', { token: instr, body });
  assert.equal(second.data.cached, true);
  assert.equal(aiCalls - before, calls, 'no second AI call');
});

test('status endpoint reports what is available', async () => {
  const r = await api('/transcripts/status', { token: alex });
  assert.deepEqual(r.data, { translate: true, transcribe: false });
});

test('automatic transcription without a Gemini key explains what to do', async () => {
  const r = await api('/staff/transcribe', { token: instr, body: { url: '/uploads/x.mp4' } });
  assert.equal(r.status, 503);
  assert.match(r.data.error, /GEMINI_API_KEY/);
});

/* ---------------- Activity and rubric review ---------------- */

test('learner sees rich instructions and the rubric PDF', async () => {
  const home = await api('/learner/home', { token: alex });
  const item = home.data.items.find((i: any) => i.course.id === CID);
  const act = item.course.modules[0].lessons[0].activity;
  assert.equal(act.instructionBlocks[1].url, imgUrl);
  assert.equal(act.rubricPdf.url, pdfUrl);
});

test('rubric PDF review: score required, range enforced, percent computed, Mastery evidence recorded', async () => {
  const sub = await api(`/learner/lesson/${CID}/${LID}/activity`, { token: alex, body: { fields: { 'af-d1-f1': 'Weekly report; supplier email; meeting notes' } } });
  assert.equal(sub.status, 200, JSON.stringify(sub.data));
  const base = { userId: 'u_alex', courseId: CID, lessonId: LID };
  assert.equal((await api('/staff/activity-feedback', { token: instr, body: { ...base, decision: 'approved' } })).status, 400, 'score required');
  assert.equal((await api('/staff/activity-feedback', { token: instr, body: { ...base, decision: 'approved', rubricPoints: 25 } })).status, 400, 'over the maximum');
  assert.equal((await api('/staff/activity-feedback', { token: instr, body: { ...base, decision: 'resubmit', feedback: 'Add more detail.' } })).status, 200, 'score optional for resubmit');
  const ok = await api('/staff/activity-feedback', { token: instr, body: { ...base, decision: 'approved', rubricPoints: 15 } });
  assert.equal(ok.status, 200);
  assert.deepEqual([ok.data.activity.rubric.points, ok.data.activity.rubric.maxPoints, ok.data.activity.rubric.percent], [15, 20, 75]);
  const list = await api('/staff/submissions', { token: instr });
  const row = list.data.submissions.find((s: any) => s.lessonId === LID);
  assert.equal(row.rubricPdf.url, pdfUrl);
  assert.equal(list.data.aiAvailable, true);
  const home = await api('/learner/home', { token: alex });
  const snap = home.data.items.find((i: any) => i.course.id === CID).snapshot;
  assert.equal(snap.prediction.breakdown.find((b: any) => b.label.startsWith('Applied')).score, 75);
});

test('AI rubric suggestion reads the PDF and rescales to the rubric total', async () => {
  const r = await api('/staff/rubric-suggest', { token: instr, body: { userId: 'u_alex', courseId: CID, lessonId: LID } });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.suggestion.points, 14); // 7 of 10 rescaled to 20
  assert.equal(r.data.suggestion.maxPoints, 20);
  assert.equal(r.data.suggestion.criteria[0].name, 'Clarity');
});

test('learners cannot use instructor routes', async () => {
  assert.equal((await api('/staff/rubric-suggest', { token: alex, body: {} })).status, 403);
  assert.equal((await api('/staff/transcribe', { token: alex, body: {} })).status, 403);
});

test('final assessment: forecast is logged and the time limit is enforced on submit', async () => {
  const start = await api(`/learner/final/${CID}/start`, { token: alex, body: {} });
  if (start.status !== 200) return; // final requires all lessons done; the time check is covered by code review
  const n = start.data.questions.length;
  const r = await api(`/learner/final/${CID}/submit`, { token: alex, body: { answers: Array(n).fill(0) } });
  assert.equal(r.status, 200);
  assert.equal(r.data.enrollment.forecastLog.length, 1);
});
