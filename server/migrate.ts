/**
 * Upgrades a saved database to the current format without losing learners' work.
 *
 * 7 → 8 (LMS 5.6):
 *  - The four starter accounts move from the old published passwords to strong ones. Only an account
 *    whose password is STILL the old published one is changed; a password someone already changed is kept.
 *    Changing it also ends any sign-in made with the old password.
 *  - Worked-example videos in the five USAII courses get their transcript filled in from the lesson text.
 *  - The shared cache for transcript translations is created.
 */
import type { Database } from '../shared/types';
import { hashPassword, verifyPassword } from './auth';
import { fillWorkedExampleTranscripts, USAII_COURSE_IDS } from './content/usaiiCourses';
import { SEED_ACCOUNTS, seedPasswords } from './seed';

const OLD_PUBLISHED = { instructor: 'Instructor@2026', learner: 'Learner@2026' };

export function migrateDatabase(d: Database): boolean {
  if (d.version !== 7) return false;
  const pw = seedPasswords();
  const now = new Date().toISOString();
  let rotated = 0;
  for (const a of SEED_ACCOUNTS) {
    const u = d.users.find((x) => x.id === a.id && x.email.toLowerCase() === a.email);
    if (!u) continue;
    if (verifyPassword(OLD_PUBLISHED[a.role], u)) {
      Object.assign(u, hashPassword(pw[a.id]), { passwordChangedAt: now });
      rotated += 1;
    }
  }
  let filled = 0;
  for (const c of d.courses) if (USAII_COURSE_IDS.has(c.id)) filled += fillWorkedExampleTranscripts(c);
  d.transcriptTranslations ??= {};
  console.log(`[migrate] 7 → 8: ${rotated} starter password(s) replaced with strong ones; ${filled} video transcript(s) filled in.`);
  return true;
}
