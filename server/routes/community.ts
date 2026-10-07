import { Router } from 'express';
import type { Course, Thread } from '../../shared/types';
import { flattenLessons } from '../../shared/analytics';
import { requireAuth, requireRole } from '../auth';
import { db, nowIso, save, uid } from '../db';
import { audit, fail, generateNudges, getCourse, getEnrollment, isStaff, notify, notifyCourseStaff, notifyStaff, recordEvent } from '../services';
import { me, wrap } from './util';
import { callLLM } from '../ai';

export const communityRouter = Router();
communityRouter.use(requireAuth);

/**
 * A learner's question is private: only that learner and the staff can read it.
 * Learners still see announcements that staff post to a whole class.
 */
const canSee = (t: Thread, userId: string, staff: boolean) => staff || t.authorId === userId || (t.audience === 'everyone' && t.authorRole !== 'learner');

/** Learners see courses they are enrolled in; instructors see courses they created. */
export function canAccessCourse(userId: string, staff: boolean, courseId: string) {
  const course = db().courses.find((c) => c.id === courseId);
  // A learner only reaches a course that is enrolled AND still published (a draft is hidden from them everywhere else too).
  if (!staff) return !!course && course.status === 'published' && !!getEnrollment(userId, courseId);
  return course?.createdBy === userId;
}

/* ---------------- Threads (Ask) ---------------- */

communityRouter.get(
  '/threads',
  wrap((req) => {
    const u = me(req);
    const staff = isStaff(u.role);
    const courseId = typeof req.query.courseId === 'string' ? req.query.courseId : '';
    const d = db();
    const threads = d.threads
      .filter((t) => (!courseId || t.courseId === courseId) && canAccessCourse(u.id, staff, t.courseId) && canSee(t, u.id, staff))
      .sort((a, b) => {
        const la = a.replies.length ? a.replies[a.replies.length - 1].createdAt : a.createdAt;
        const lb = b.replies.length ? b.replies[b.replies.length - 1].createdAt : b.createdAt;
        return lb.localeCompare(la);
      });
    return { threads };
  }),
);

communityRouter.post(
  '/threads',
  wrap((req) => {
    const u = me(req);
    const staff = isStaff(u.role);
    const { courseId, lessonId, title, body } = req.body ?? {};
    const course = getCourse(String(courseId));
    if (!canAccessCourse(u.id, staff, course.id)) fail(403, 'You are not enrolled in this course.');
    const cleanTitle = String(title ?? '').trim().slice(0, 200);
    const cleanBody = String(body ?? '').trim().slice(0, 5000);
    if (cleanTitle.length < 5) fail(400, 'Please write your question (at least 5 characters).');
    const lesson = lessonId ? flattenLessons(course).find((f) => f.lesson.id === lessonId)?.lesson : undefined;
    const t: Thread = {
      id: uid('th'),
      courseId: course.id,
      lessonId: lesson?.id,
      lessonTitle: lesson?.title,
      authorId: u.id,
      authorName: u.name,
      authorRole: u.role,
      // Learners always write to their own instructor. Only staff can address a whole class.
      // Learners write privately to their instructor; instructors post to the class.
      audience: staff ? 'everyone' : 'instructor',
      title: cleanTitle,
      body: cleanBody,
      createdAt: nowIso(),
      likes: [],
      replies: [],
      readBy: [u.id],
    };
    db().threads.unshift(t);
    recordEvent(u.id, 'post', course.id);
    if (!staff)
      notifyCourseStaff(course, {
        kind: 'message',
        title: `Question from ${u.name}`,
        body: cleanTitle,
        link: { view: 'inbox', threadId: t.id },
      });
    save();
    return { thread: t };
  }),
);

communityRouter.post(
  '/threads/:id/reply',
  wrap((req) => {
    const u = me(req);
    const staff = isStaff(u.role);
    const t = db().threads.find((x) => x.id === req.params.id) ?? fail(404, 'Thread not found.');
    if (!canAccessCourse(u.id, staff, t!.courseId) || !canSee(t!, u.id, staff)) fail(403, 'You cannot reply to this thread.');
    const text = String(req.body?.text ?? '').trim().slice(0, 5000);
    if (text.length < 2) fail(400, 'Write a reply first.');
    t!.replies.push({ id: uid('rp'), authorId: u.id, authorName: u.name, authorRole: u.role, text, createdAt: nowIso(), likes: [] });
    t!.readBy = [u.id];
    recordEvent(u.id, 'reply', t!.courseId);
    if (t!.authorId !== u.id) {
      notify(t!.authorId, {
        kind: 'reply',
        title: staff ? `${u.name} answered your question` : `${u.name} replied to your question`,
        body: t!.title,
        link: { view: 'ask', courseId: t!.courseId, threadId: t!.id },
      });
    }
    if (!staff && t!.authorId === u.id)
      notifyCourseStaff(getCourse(t!.courseId), { kind: 'message', title: `Follow-up from ${u.name}`, body: t!.title, link: { view: 'inbox', threadId: t!.id } });
    save();
    return { thread: t };
  }),
);

communityRouter.post(
  '/threads/:id/like',
  wrap((req) => {
    const u = me(req);
    const staff = isStaff(u.role);
    const t = db().threads.find((x) => x.id === req.params.id) ?? fail(404, 'Thread not found.');
    if (!canSee(t!, u.id, staff)) fail(403, 'Not allowed.');
    const target = req.body?.replyId ? t!.replies.find((r) => r.id === req.body.replyId) : t;
    if (!target) fail(404, 'Reply not found.');
    const i = target!.likes.indexOf(u.id);
    if (i >= 0) target!.likes.splice(i, 1);
    else target!.likes.push(u.id);
    save();
    return { thread: t };
  }),
);

communityRouter.post(
  '/threads/:id/read',
  wrap((req) => {
    const u = me(req);
    const t = db().threads.find((x) => x.id === req.params.id);
    if (t && !t.readBy.includes(u.id)) {
      t.readBy.push(u.id);
      save();
    }
    return { ok: true };
  }),
);

communityRouter.delete(
  '/threads/:id',
  wrap((req) => {
    const u = me(req);
    const d = db();
    const t = d.threads.find((x) => x.id === req.params.id) ?? fail(404, 'Thread not found.');
    if (!isStaff(u.role) && t!.authorId !== u.id) fail(403, 'Not allowed.');
    d.threads = d.threads.filter((x) => x.id !== t!.id);
    audit(u, 'DELETE_THREAD', `Removed thread "${t!.title}".`);
    save();
    return { ok: true };
  }),
);

/* ---------------- Notifications & messages ---------------- */

communityRouter.get(
  '/notifications',
  wrap((req) => {
    const u = me(req);
    generateNudges(u);
    const list = db().notifications.filter((n) => n.userId === u.id).slice(0, 50);
    return { notifications: list, unread: list.filter((n) => !n.read).length };
  }),
);

communityRouter.post(
  '/notifications/read',
  wrap((req) => {
    const u = me(req);
    const ids: string[] | undefined = Array.isArray(req.body?.ids) ? req.body.ids : undefined;
    for (const n of db().notifications) if (n.userId === u.id && (!ids || ids.includes(n.id))) n.read = true;
    save();
    return { ok: true };
  }),
);

/* ---------------- Feedback (would you recommend?) ---------------- */

/**
 * The quick check-in on My Learning. It used to remove every earlier answer from this learner,
 * including their star ratings; now it replaces only their earlier check-in for the same course.
 */
communityRouter.post(
  '/feedback',
  wrap((req) => {
    const u = me(req);
    if (typeof req.body?.recommend !== 'boolean') fail(400, 'Please answer Yes or No.');
    const ease = Math.round(Number(req.body?.ease));
    if (!(ease >= 1 && ease <= 5)) fail(400, 'Please choose how easy it is, from 1 to 5.');
    const raw = String(req.body?.courseId ?? '');
    const courseId = raw && getEnrollment(u.id, raw) ? raw : undefined;
    const d = db();
    d.feedback = d.feedback.filter((f) => !(f.userId === u.id && (f.kind ?? 'pulse') === 'pulse' && f.courseId === courseId));
    d.feedback.unshift({
      id: uid('fb'),
      userId: u.id,
      kind: 'pulse',
      courseId,
      recommend: req.body.recommend,
      ease,
      comment: String(req.body?.comment ?? '').slice(0, 2000),
      createdAt: nowIso(),
    });
    notifyStaff({ kind: 'feedback', title: `New check-in from ${u.name}`, body: `Would recommend the course: ${req.body.recommend ? 'Yes' : 'No'} · Next step ease: ${ease} of 5`, link: { view: 'feedback' } });
    save();
    return { ok: true };
  }),
);

/** The learner's own current answers, so Give Feedback shows what they chose before. */
communityRouter.get(
  '/feedback/mine',
  wrap((req) => {
    const u = me(req);
    const mine = db().feedback.filter((f) => f.userId === u.id);
    const latest = (k: string, courseId?: string) =>
      mine.filter((f) => f.kind === k && (courseId === undefined || f.courseId === courseId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const courses = [...new Set(mine.filter((f) => f.kind === 'course' && f.courseId).map((f) => f.courseId!))];
    return {
      recommend: latest('recommend')?.recommend ?? null,
      platform: latest('platform') ? { stars: latest('platform')!.stars ?? null, comment: latest('platform')!.comment, at: latest('platform')!.createdAt, recommendUsaii: latest('platform')!.recommendUsaii ?? null } : null,
      courses: Object.fromEntries(courses.map((c) => { const f = latest('course', c)!; return [c, { stars: f.stars ?? null, comment: f.comment, at: f.createdAt }]; })),
    };
  }),
);

/* ---------------- Star ratings (courses and the LMS itself) ---------------- */

communityRouter.post(
  '/feedback/rating',
  wrap((req) => {
    const u = me(req);
    const kind = req.body?.kind === 'platform' ? 'platform' : 'course';
    const stars = Math.round(Number(req.body?.stars));
    if (!(stars >= 1 && stars <= 5)) fail(400, 'Please choose a rating from 1 to 5 stars.');
    const courseId = kind === 'course' ? String(req.body?.courseId ?? '') : undefined;
    // "Would you recommend USAII® to others?" is asked on the LMS rating card and is required there.
    const recommendUsaii = req.body?.recommendUsaii;
    if (kind === 'platform' && typeof recommendUsaii !== 'boolean') fail(400, 'Please answer whether you would recommend USAII® to others.');
    if (kind === 'course') {
      if (!courseId) fail(400, 'Please choose the course you are rating.');
      if (!getEnrollment(u.id, String(courseId))) fail(403, 'You are not enrolled in this course.');
    }
    const d = db();
    // One rating per learner per target: rating again replaces the earlier one.
    d.feedback = d.feedback.filter((f) => !(f.userId === u.id && f.kind === kind && (kind === 'platform' || f.courseId === courseId)));
    d.feedback.unshift({
      id: uid('fb'),
      userId: u.id,
      kind,
      courseId,
      stars,
      // "Would you recommend?" is its own question now; for a star rating this only marks 4 or 5 stars.
      recommend: stars >= 4,
      ...(kind === 'platform' ? { recommendUsaii: recommendUsaii as boolean } : {}),
      ease: 0,
      comment: String(req.body?.comment ?? '').slice(0, 2000),
      createdAt: nowIso(),
    });
    notifyStaff({
      kind: 'feedback',
      title: kind === 'course' ? `New course rating from ${u.name}` : `New LMS rating from ${u.name}`,
      body: `${stars} of 5 stars${kind === 'platform' ? ` · Would recommend USAII®: ${recommendUsaii ? 'Yes' : 'No'}` : ''}`,
      link: { view: 'feedback' },
    });
    save();
    return { ok: true };
  }),
);

communityRouter.post(
  '/feedback/recommend',
  wrap((req) => {
    const u = me(req);
    if (typeof req.body?.recommend !== 'boolean') fail(400, 'Please choose Yes or No.');
    const recommend = req.body.recommend as boolean;
    const d = db();
    // One answer per learner: answering again replaces the previous one.
    d.feedback = d.feedback.filter((f) => !(f.userId === u.id && f.kind === 'recommend'));
    d.feedback.unshift({
      id: uid('fb'),
      userId: u.id,
      kind: 'recommend',
      recommend,
      ease: 0,
      comment: '',
      createdAt: nowIso(),
    });
    notifyStaff({ kind: 'feedback', title: `${u.name} answered "Would you recommend USAII® Courses to others?"`, body: recommend ? 'Yes' : 'No', link: { view: 'feedback' } });
    save();
    return { ok: true, recommend };
  }),
);

communityRouter.get(
  '/feedback/mine',
  wrap((req) => {
    const u = me(req);
    return { ratings: db().feedback.filter((f) => f.userId === u.id && f.kind) };
  }),
);

/* ---------------- AI study coach (course-grounded) ---------------- */

const STOP = new Set('a an the and or but if of to in on for with is are was were be been it this that what how why when where which who do does did can could should would i you my your me we our about from as at by not no yes so than then there their them they into just more most also very use using'.split(' '));
const tokens = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w));

function retrieve(course: Course, question: string, lessonId?: string) {
  const qt = new Set(tokens(question));
  const passages: { lesson: string; text: string; score: number }[] = [];
  for (const f of flattenLessons(course)) {
    const texts: string[] = [];
    for (const b of f.lesson.blocks) {
      if (b.text) texts.push(b.text);
      if (b.items) texts.push(b.items.join('; '));
      if (b.transcript) texts.push(b.transcript);
    }
    for (const q of f.lesson.check) if (q.rationale) texts.push(q.rationale);
    for (const text of texts) {
      const tt = tokens(text);
      if (!tt.length) continue;
      let hits = 0;
      for (const w of tt) if (qt.has(w)) hits += 1;
      if (!hits) continue;
      const score = (hits / Math.sqrt(tt.length)) * (f.lesson.id === lessonId ? 1.5 : 1);
      passages.push({ lesson: f.lesson.title, text, score });
    }
  }
  return passages.sort((a, b) => b.score - a.score).slice(0, 4);
}

communityRouter.post(
  '/ai/tutor',
  wrap(async (req) => {
    const u = me(req);
    const course = getCourse(String(req.body?.courseId ?? ''));
    if (!canAccessCourse(u.id, isStaff(u.role), course.id)) fail(403, 'You are not enrolled in this course.');
    const question = String(req.body?.question ?? '').trim().slice(0, 1000);
    if (question.length < 3) fail(400, 'Ask a question first.');
    const lessonId = typeof req.body?.lessonId === 'string' ? req.body.lessonId : undefined;
    const sources = retrieve(course, question, lessonId);

    const system =
      'You are a warm, encouraging study coach for a USAII course. Explain in plain language suitable for a 16-year-old or a busy executive. ' +
      'Use ONLY the course excerpts provided; if they do not cover the question, say so and suggest asking the instructor. ' +
      'Never reveal answers to quiz or exam questions directly; guide the learner to reason instead. Keep answers under 160 words and end with one short "Try this" suggestion.';
    const context = sources.map((s, i) => `[${i + 1}] (${s.lesson}) ${s.text}`).join('\n');
    const ai = sources.length ? (await callLLM(system, `Course: ${course.title}\nExcerpts:\n${context}\n\nLearner question: ${question}`))?.text ?? null : null;

    if (ai) return { mode: 'ai', answer: ai, sources: sources.map((s) => ({ lesson: s.lesson, text: s.text.slice(0, 220) })) };
    if (!sources.length)
      return {
        mode: 'course',
        answer: 'I could not find this in your course material yet. Try different words, or send the question to your instructor using "Just instructor".',
        sources: [],
      };
    const top = sources.slice(0, 2);
    return {
      mode: 'course',
      answer: `Here is what your course says:\n\n${top.map((s) => `• ${s.text.length > 420 ? s.text.slice(0, 420) + '…' : s.text}`).join('\n\n')}\n\nTry this: explain the idea back in your own words, then check it against "${top[0].lesson}".`,
      sources: sources.map((s) => ({ lesson: s.lesson, text: s.text.slice(0, 220) })),
    };
  }),
);

/* ---------------- Public credential verification ---------------- */

export const publicRouter = Router();
publicRouter.get(
  '/verify/:certId',
  wrap((req) => {
    const d = db();
    const enr = d.enrollments.find((e) => e.certificateId === req.params.certId);
    if (!enr) fail(404, 'No credential found with this ID.');
    const user = d.users.find((u) => u.id === enr!.userId);
    const course = d.courses.find((c) => c.id === enr!.courseId);
    return { valid: true, certificateId: enr!.certificateId, learnerName: user?.name, credentialName: course?.credentialName, courseTitle: course?.title, issuedAt: enr!.certificateIssuedAt };
  }),
);
