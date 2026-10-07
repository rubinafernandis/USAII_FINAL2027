import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import type { PublicUser, Role, UserRecord } from '../shared/types';
import { DATA_DIR, db } from './db';

const SECRET_FILE = path.join(DATA_DIR, 'secret.key');
const SECRET =
  process.env.AUTH_SECRET ||
  process.env.SESSION_SECRET ||
  (() => {
    if (fs.existsSync(SECRET_FILE)) return fs.readFileSync(SECRET_FILE, 'utf8').trim();
    const s = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SECRET_FILE, s);
    return s;
  })();

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const passwordHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { passwordHash, salt };
}

export function verifyPassword(password: string, user: UserRecord): boolean {
  const { passwordHash } = hashPassword(password, user.salt);
  const a = Buffer.from(passwordHash, 'hex');
  const b = Buffer.from(user.passwordHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Shown next to every password box, so the rule is the same everywhere. */
export const PASSWORD_RULE = 'At least 12 characters, with an uppercase letter, a lowercase letter, a number, and a symbol.';

const COMMON = new Set(['password1234', 'password@123', 'welcome@1234', 'qwerty123456', 'admin@123456', 'letmein12345', 'learner@2026', 'instructor@2026', 'usaii@123456', 'changeme1234']);

export function validatePassword(pw: unknown): string | null {
  if (typeof pw !== 'string' || pw.length < 12) return 'Password must be at least 12 characters.';
  if (pw.length > 128) return 'Password must be 128 characters or fewer.';
  if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw) || !/[^A-Za-z0-9]/.test(pw))
    return 'Password must include an uppercase letter, a lowercase letter, a number, and a symbol.';
  if (COMMON.has(pw.toLowerCase())) return 'This password is too common. Choose another one.';
  if (/(.)\1{3,}/.test(pw)) return 'Avoid repeating the same character four or more times.';
  return null;
}

/** A strong random password that meets the rule (used for generated test accounts). */
export function tempPassword(): string {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#%^&*-_=+?'];
  const all = sets.join('');
  const chars = sets.map((set) => set[crypto.randomInt(set.length)]);
  while (chars.length < 18) chars.push(all[crypto.randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sign = (s: string) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');

export function issueToken(userId: string): string {
  const now = Date.now();
  const payload = b64(JSON.stringify({ uid: userId, iat: now, exp: now + TOKEN_TTL_MS }));
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string): { uid: string; iat: number } | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const { uid, exp, iat } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof uid !== 'string' || typeof exp !== 'number' || Date.now() > exp) return null;
    return { uid, iat: typeof iat === 'number' ? iat : 0 };
  } catch {
    return null;
  }
}

export function toPublic(u: UserRecord): PublicUser {
  const { passwordHash: _h, salt: _s, passwordChangedAt: _p, ...rest } = u;
  return rest;
}

/** Set a new password and end every sign-in made with the old one. */
export function setPassword(u: UserRecord, password: string) {
  Object.assign(u, hashPassword(password), { passwordChangedAt: new Date().toISOString() });
}

/** Spend the same time on an unknown email as on a known one, so response time does not reveal which emails exist. */
const DUMMY = hashPassword('timing-equaliser-not-a-real-password');
export function verifyUnknownUser(password: string) {
  verifyPassword(password, { ...DUMMY } as UserRecord);
}

export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter((w) => /^[A-Za-z]/.test(w) && !/^(dr|mr|mrs|ms)\.?$/i.test(w))
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || name.slice(0, 2).toUpperCase()
  );
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRecord;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const tok = token ? readToken(token) : null;
  let user = tok ? db().users.find((u) => u.id === tok.uid) : undefined;
  // A token issued before the last password change is no longer valid (allow 1 s of clock rounding).
  if (user && user.passwordChangedAt && tok!.iat < Date.parse(user.passwordChangedAt) - 1000) user = undefined;
  if (user && !user.active) return res.status(401).json({ error: user.suspension ? 'Your account is suspended. Please contact your instructor.' : 'This account has been deactivated. Contact your instructor.' });
  if (!user) return res.status(401).json({ error: 'Your session has ended. Please sign in again.' });
  req.user = user;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role))
      return res.status(403).json({ error: 'You do not have access to this area.' });
    next();
  };
}

// Brute-force protection for sign-in, by account and by network address.
// Per account: after 5 failures the account waits 1 minute, then 5, then 15 (it resets after a success
// or 30 quiet minutes). Per address: at most 30 failures in 15 minutes across all accounts.
const failures = new Map<string, { count: number; strikes: number; until: number; last: number }>();
const ipFailures = new Map<string, number[]>();
const LOCK_STEPS = [60_000, 5 * 60_000, 15 * 60_000];
const IP_WINDOW = 15 * 60_000;
const IP_MAX = 30;

export function loginLocked(email: string, ip = ''): number {
  const now = Date.now();
  const f = failures.get(email);
  if (f && f.until > now) return Math.ceil((f.until - now) / 1000);
  const list = (ipFailures.get(ip) ?? []).filter((t) => now - t < IP_WINDOW);
  ipFailures.set(ip, list);
  if (list.length >= IP_MAX) return Math.ceil((list[0] + IP_WINDOW - now) / 1000);
  return 0;
}
export function recordFailure(email: string, ip = '') {
  const now = Date.now();
  const f = failures.get(email) ?? { count: 0, strikes: 0, until: 0, last: 0 };
  if (now - f.last > 30 * 60_000) Object.assign(f, { count: 0, strikes: 0 });
  f.last = now;
  f.count += 1;
  if (f.count >= 5) {
    f.until = now + LOCK_STEPS[Math.min(f.strikes, LOCK_STEPS.length - 1)];
    f.strikes += 1;
    f.count = 0;
  }
  failures.set(email, f);
  const list = ipFailures.get(ip) ?? [];
  list.push(now);
  ipFailures.set(ip, list);
  // Keep memory bounded.
  if (failures.size > 10_000) failures.clear();
  if (ipFailures.size > 10_000) ipFailures.clear();
}
export function clearFailures(email: string) {
  failures.delete(email);
}
