import { Router } from 'express';
import {
  clearFailures,
  setPassword,
  verifyUnknownUser,
  initials,
  issueToken,
  loginLocked,
  recordFailure,
  requireAuth,
  toPublic,
  validatePassword,
  verifyPassword,
} from '../auth';
import { db, save } from '../db';
import { audit, fail, recordEvent } from '../services';
import { PASSWORD_RULE } from '../auth';
import { me, wrap } from './util';
import type { LearnMode } from '../../shared/types';

export const authRouter = Router();

const normEmail = (e: unknown) => (typeof e === 'string' ? e.trim().toLowerCase() : '');

authRouter.post(
  '/login',
  wrap((req) => {
    const email = normEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) fail(400, 'Enter your email and password.');
    if (password.length > 256) fail(400, 'That email and password combination did not match.');
    const ip = req.ip ?? '';
    const wait = loginLocked(email, ip);
    if (wait) fail(429, `Too many attempts. Please wait ${wait > 90 ? `${Math.ceil(wait / 60)} minutes` : `${wait} seconds`} and try again.`);
    const user = db().users.find((u) => u.email.toLowerCase() === email);
    if (!user) verifyUnknownUser(password);
    if (!user || !verifyPassword(password, user)) {
      recordFailure(email, ip);
      fail(401, 'That email and password combination did not match.');
    }
    if (!user!.active) fail(403, user!.suspension ? 'Your account is suspended. Please contact your instructor.' : 'This account has been deactivated. Contact your instructor.');
    // The sign-in page has a Learner tab and an Instructor tab. Only after the password is proven
    // do we say which one this account uses (so this never helps anyone guess accounts).
    const wanted = req.body?.role;
    if ((wanted === 'learner' || wanted === 'instructor') && wanted !== user!.role)
      fail(403, user!.role === 'instructor' ? 'This is an instructor account. Choose the Instructor tab to sign in.' : 'This is a learner account. Choose the Learner tab to sign in.');
    clearFailures(email);
    recordEvent(user!.id, 'login');
    return { token: issueToken(user!.id), user: toPublic(user!) };
  }),
);

// Self-registration is intentionally disabled: accounts are created by an instructor.

/** The password rule, so every screen shows the same wording the server enforces. */
authRouter.get('/password-rule', (_req, res) => res.json({ rule: PASSWORD_RULE }));

authRouter.get('/me', requireAuth, wrap((req) => ({ user: toPublic(me(req)) })));

authRouter.post(
  '/change-password',
  requireAuth,
  wrap((req) => {
    const u = me(req);
    const { current, next } = req.body ?? {};
    if (!u.mustChangePassword && !verifyPassword(String(current ?? ''), u)) fail(400, 'Your current password is incorrect.');
    const err = validatePassword(next);
    if (err) fail(400, err);
    if (verifyPassword(String(next), u)) fail(400, 'Choose a password that is different from your current one.');
    setPassword(u, next);
    u.mustChangePassword = false;
    audit(u, 'CHANGE_PASSWORD', 'Password changed.');
    save();
    // Every other sign-in with the old password has just ended; give this browser a fresh token.
    return { user: toPublic(u), token: issueToken(u.id) };
  }),
);

authRouter.patch(
  '/profile',
  requireAuth,
  wrap((req) => {
    const u = me(req);
    const b = req.body ?? {};
    if (typeof b.name === 'string' && b.name.trim().length >= 2) {
      u.name = b.name.trim().slice(0, 100);
      u.initials = initials(u.name);
    }
    if (typeof b.onboarded === 'boolean') u.onboarded = b.onboarded;
    if (['read', 'watch', 'listen', 'do'].includes(b.learnMode)) u.learnMode = b.learnMode as LearnMode;
    if (b.goal === null) delete u.goal;
    else if (b.goal && typeof b.goal === 'object') {
      u.goal = {
        statement: String(b.goal.statement ?? '').slice(0, 300),
        why: String(b.goal.why ?? '').slice(0, 500),
        minutesPerDay: Math.max(5, Math.min(240, Number(b.goal.minutesPerDay) || 20)),
        daysPerWeek: Math.max(1, Math.min(7, Number(b.goal.daysPerWeek) || 4)),
      };
    }
    save();
    return { user: toPublic(u) };
  }),
);
