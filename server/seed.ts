import fs from 'node:fs';
import path from 'node:path';
import type { Course, Database, UserRecord } from '../shared/types';
import { hashPassword, initials, tempPassword, validatePassword } from './auth';
import { DATA_DIR, DB_VERSION } from './db';
import { buildUsaiiCourses } from './content/usaiiCourses';

/**
 * Test-account passwords.
 *
 * Each account has its own strong password (18 random characters). They are listed only in
 * TEST-CREDENTIALS.md, never on the sign-in page and never in the console.
 *
 * Override them with SEED_INSTRUCTOR_PASSWORD and SEED_LEARNER_PASSWORD in .env. In production
 * (NODE_ENV=production) without those settings, random passwords are generated on first start and
 * written once to data/initial-credentials.txt, readable only by the server's own user.
 */
const DEV_PASSWORDS = {
  u_instructor: 'VJ%NTj+R%zgvTp3wmc',
  u_alex: '7rcV%5qXmNTFttj_Dw',
  u_jordan: 'Vv_rG%?6Jyj78bt+Kx',
  u_morgan: '&8gr-?MB?eA!7t2ztK',
} as const;
type SeedId = keyof typeof DEV_PASSWORDS;

function fromEnv(name: string): string | undefined {
  const v = process.env[name];
  if (!v) return undefined;
  const err = validatePassword(v);
  if (err) throw new Error(`${name} is too weak: ${err}`);
  return v;
}

let resolved: Record<SeedId, string> | null = null;
export function seedPasswords(): Record<SeedId, string> {
  if (resolved) return resolved;
  const instructor = fromEnv('SEED_INSTRUCTOR_PASSWORD');
  const learner = fromEnv('SEED_LEARNER_PASSWORD');
  const prod = process.env.NODE_ENV === 'production';
  const pick = (id: SeedId, env?: string) => env ?? (prod ? tempPassword() : DEV_PASSWORDS[id]);
  resolved = {
    u_instructor: pick('u_instructor', instructor),
    u_alex: pick('u_alex', learner),
    u_jordan: pick('u_jordan', learner),
    u_morgan: pick('u_morgan', learner),
  };
  if (prod && !(instructor && learner)) {
    // Never lock the owner out, and never fall back to the test passwords (they may be in a public repo).
    // Generated passwords are saved to a file and shown ONCE in the host's private log.
    const lines = SEED_ACCOUNTS.filter((a) => (a.role === 'instructor' ? !instructor : !learner)).map((a) => `   ${a.role.padEnd(10)} ${a.email.padEnd(30)} ${resolved![a.id]}`);
    const file = path.join(DATA_DIR, 'initial-credentials.txt');
    try {
      fs.writeFileSync(file, ['USAII LMS starter accounts (generated on first start). Change each password, then delete this file.', '', ...lines, ''].join('\n'), { mode: 0o600 });
    } catch {
      /* read-only disk: the log below is enough */
    }
    console.log('');
    console.log('  ======================================================================');
    console.log('   FIRST START: random passwords were generated for the starter accounts');
    console.log('   (shown only this once; also saved to data/initial-credentials.txt)');
    console.log(lines.join('\n'));
    console.log('   To choose your own and keep them stable across restarts, set');
    console.log('   SEED_INSTRUCTOR_PASSWORD and SEED_LEARNER_PASSWORD in the host settings.');
    console.log('  ======================================================================');
    console.log('');
  }
  return resolved;
}

export const SEED_ACCOUNTS: { id: SeedId; email: string; role: 'instructor' | 'learner' }[] = [
  { id: 'u_instructor', email: 'instructor@usaii.org', role: 'instructor' },
  { id: 'u_alex', email: 'alex.rivera@enterprise.com', role: 'learner' },
  { id: 'u_jordan', email: 'jordan.lee@enterprise.com', role: 'learner' },
  { id: 'u_morgan', email: 'morgan.chen@enterprise.com', role: 'learner' },
];

const DAY = 86_400_000;

export function seedDatabase(): Database {
  const now = Date.now();
  const at = (daysAgo: number, hour = 9, minute = 0) => {
    const d = new Date(now - daysAgo * DAY);
    d.setHours(hour, minute, 0, 0);
    // never create timestamps in the future
    return new Date(Math.min(d.getTime(), now - 60_000)).toISOString();
  };

  const pw = seedPasswords();
  const mkUser = (id: string, name: string, email: string, role: UserRecord['role'], password: string, extra: Partial<UserRecord> = {}): UserRecord => ({
    id,
    name,
    email,
    role,
    initials: initials(name),
    active: true,
    createdAt: at(21),
    onboarded: role !== 'learner',
    mustChangePassword: false,
    ...hashPassword(password),
    ...extra,
  });

  const users: UserRecord[] = [
    mkUser('u_instructor', 'Dr. Patricia Okonkwo', 'instructor@usaii.org', 'instructor', pw.u_instructor),
    mkUser('u_alex', 'Alex Rivera', 'alex.rivera@enterprise.com', 'learner', pw.u_alex, {
      goal: { statement: 'Use AI to cut my weekly reporting time in half', why: 'I spend every Monday morning on status reports.', minutesPerDay: 30, daysPerWeek: 5 },
      learnMode: 'read',
      onboarded: true,
    }),
    mkUser('u_jordan', 'Jordan Lee', 'jordan.lee@enterprise.com', 'learner', pw.u_jordan),
    mkUser('u_morgan', 'Morgan Chen', 'morgan.chen@enterprise.com', 'learner', pw.u_morgan, {
      goal: { statement: 'Plan projects faster with AI without missing risks', why: 'I lead carrier onboarding and planning takes days.', minutesPerDay: 30, daysPerWeek: 4 },
      learnMode: 'do',
      onboarded: true,
    }),
  ];

  // The five USAII courses start as drafts in the instructor's My Courses, with no price set.
  const courses: Course[] = buildUsaiiCourses('u_instructor', at(30));

  return {
    version: DB_VERSION,
    users,
    courses,
    enrollments: [],
    events: [],
    threads: [],
    notifications: [],
    messages: [],
    feedback: [],
    audit: [],
    transcriptTranslations: {},
  };
}
