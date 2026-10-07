import { Router } from 'express';
import type { CheckAttempt, CheckQuestion, LessonProgress } from '../../shared/types';
import { attemptsLeft, emptyProgress, lessonRequirements } from '../../shared/analytics';
import { buildItems } from '../../shared/metrics';
import { requireAuth, requireRole } from '../auth';
import { db, nowIso, save, uid } from '../db';
import {
  audit,
  fail,
  findLesson,
  getCourse,
  getEnrollment,
  notifyCourseStaff,
  maybeIssueCredential,
  notify,
  notifyStaff,
  recordEvent,
  requireEnrollment,
  sanitizeCourse,
  snapshotFor,
} from '../services';
import { me, wrap } from './util';

export const learnerRouter = Router();
learnerRouter.use(requireAuth, requireRole('learner'));

const lessonProgress = (enr: ReturnType<typeof requireEnrollment>, lessonId: string): LessonProgress => {
  if (!enr.lessons[lessonId]) enr.lessons[lessonId] = emptyProgress();
  return enr.lessons[lessonId];
};

/**
 * Grade answers against the answer key. `objectiveFor` records which learning objective each
 * question measured, so Comprehension and Mastery stay correct even if the course is edited later.
 */
function grade(questions: CheckQuestion[], answers: unknown, objectiveFor: (q: CheckQuestion) => string | undefined) {
  const arr = Array.isArray(answers) ? answers : [];
  const results = questions.map((q, i) => {
    const chosen = Number.isInteger(arr[i]) ? (arr[i] as number) : -1;
    return { questionId: q.id, chosen, correct: chosen === q.correctIndex, correctIndex: q.correctIndex, rationale: q.rationale };
  });
  const score = questions.length ? Math.round((results.filter((r) => r.correct).length / questions.length) * 100) : 0;
  const chosen = results.map((r) => r.chosen);
  return { score, results, answers: chosen, items: buildItems(questions, chosen, objectiveFor) };
}

/** Everything the learner home needs: enrolled courses with live analytics. */
learnerRouter.get(
  '/home',
  wrap((req) => {
    const u = me(req);
    const d = db();
    const items = d.enrollments
      .filter((e) => e.userId === u.id)
      .map((e) => d.courses.find((c) => c.id === e.courseId))
      .filter((c): c is NonNullable<typeof c> => !!c && c.status === 'published')
      .map((c) => ({ course: sanitizeCourse(c), enrollment: getEnrollment(u.id, c.id)!, snapshot: snapshotFor(u, c) }));
    const messages = d.messages.filter((m) => m.toId === u.id).slice(0, 20);
    const askedFeedback = d.feedback.some((f) => f.userId === u.id && (f.kind ?? 'pulse') === 'pulse' && Date.now() - Date.parse(f.createdAt) < 30 * 86_400_000);
    const lessonsDone = items.reduce((a, i) => a + i.snapshot.completion.lessonsDone, 0);
    return { items, messages, feedbackDue: !askedFeedback && lessonsDone >= 2 };
  }),
);

learnerRouter.get(
  '/catalog',
  wrap((req) => {
    const u = me(req);
    const d = db();
    return {
      courses: d.courses
        .filter((c) => c.status === 'published')
        .map((c) => ({
          id: c.id,
          title: c.title,
          subtitle: c.subtitle,
          description: c.description,
          credentialName: c.credentialName,
          durationLabel: c.durationLabel,
          level: c.level,
          price: c.price,
          access: c.access,
          accent: c.accent,
          coverImage: c.coverImage,
          modules: c.modules.map((m) => ({ title: m.title, lessons: m.lessons.length })),
          lessons: c.modules.reduce((a, m) => a + m.lessons.length, 0),
          minutes: c.modules.reduce((a, m) => a + m.lessons.reduce((b, l) => b + l.estimatedMinutes, 0), 0),
          hasFinal: !!c.finalExam?.questions.length,
          enrolled: d.enrollments.some((e) => e.userId === u.id && e.courseId === c.id),
          learners: d.enrollments.filter((e) => e.courseId === c.id).length,
          requested: d.notifications.some((n) => !!n.key && n.key.startsWith(`req-${u.id}-${c.id}-`)),
        })),
    };
  }),
);

learnerRouter.post(
  '/enroll/:courseId',
  wrap((req) => {
    const u = me(req);
    const c = getCourse(req.params.courseId);
    if (c.status !== 'published') fail(404, 'Course not available.');
    if (c.access !== 'open') fail(403, 'This course is by invitation. Use "Request access" and an instructor will respond.');
    if (!getEnrollment(u.id, c.id)) {
      db().enrollments.push({ id: uid('enr'), userId: u.id, courseId: c.id, enrolledAt: nowIso(), lessons: {} });
      audit(u, 'ENROLL', `Enrolled in ${c.title}${c.price ? ` ($${c.price})` : ' (free)'}.`);
      save();
    }
    return { ok: true };
  }),
);

learnerRouter.post(
  '/request-access/:courseId',
  wrap((req) => {
    const u = me(req);
    const c = getCourse(req.params.courseId);
    notifyStaff({
      key: `req-${u.id}-${c.id}`,
      kind: 'access',
      title: `Access request: ${u.name}`,
      body: `${u.name} (${u.email}) asked to join ${c.title}.`,
      link: { view: 'learners' },
    });
    return { ok: true };
  }),
);

learnerRouter.get(
  '/course/:courseId',
  wrap((req) => {
    const u = me(req);
    const c = getCourse(req.params.courseId);
    const enr = requireEnrollment(u.id, c.id);
    return { course: sanitizeCourse(c), enrollment: enr, snapshot: snapshotFor(u, c) };
  }),
);

learnerRouter.post(
  '/course/:courseId/target-date',
  wrap((req) => {
    const u = me(req);
    const enr = requireEnrollment(u.id, req.params.courseId);
    const date = String(req.body?.date ?? '');
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(400, 'Invalid date.');
    enr.targetDate = date || undefined;
    save();
    return { enrollment: enr };
  }),
);

learnerRouter.post(
  '/lesson/:courseId/:lessonId/open',
  wrap((req) => {
    const u = me(req);
    const c = getCourse(req.params.courseId);
    const enr = requireEnrollment(u.id, c.id);
    findLesson(c, req.params.lessonId);
    const p = lessonProgress(enr, req.params.lessonId);
    if (p.status === 'not_started') {
      p.status = 'in_progress';
      p.startedAt = nowIso();
    }
    save();
    return { progress: p };
  }),
);

/** Light usage signals from the learner portal, so instructors can see which resources get used. */
const TRACKABLE = new Set(['guide_view', 'guide_download', 'work_view', 'work_download', 'plan_view']);
learnerRouter.post(
  '/track',
  wrap((req) => {
    const u = me(req);
    const type = String(req.body?.type ?? '');
    const courseId = String(req.body?.courseId ?? '');
    if (!TRACKABLE.has(type)) fail(400, 'Unknown event.');
    if (!getEnrollment(u.id, courseId)) fail(403, 'You do not have access to this course.');
    // One view per half hour is enough: reopening the viewer should not inflate the count.
    const recent = db().events.some((e) => e.userId === u.id && e.courseId === courseId && e.type === type && Date.now() - Date.parse(e.at) < 30 * 60_000);
    if (!(type === 'guide_view' && recent)) recordEvent(u.id, type as 'guide_view', courseId);
    return { ok: true };
  }),
);

learnerRouter.post(
  '/heartbeat',
  wrap((req) => {
    const u = me(req);
    const { courseId, lessonId } = req.body ?? {};
    const seconds = Math.max(0, Math.min(60, Math.round(Number(req.body?.seconds) || 0)));
    if (!seconds || typeof courseId !== 'string') return { ok: true };
    const enr = getEnrollment(u.id, courseId);
    if (!enr) return { ok: true };
    if (typeof lessonId === 'string' && enr.lessons[lessonId]) enr.lessons[lessonId].activeSeconds += seconds;
    recordEvent(u.id, 'study', courseId, seconds);
    return { ok: true };
  }),
);

learnerRouter.post(
  '/lesson/:courseId/:lessonId/quiz-start',
  wrap((req) => {
    const u = me(req);
    const c = getCourse(req.params.courseId);
    const enr = requireEnrollment(u.id, c.id);
    const lesson = findLesson(c, req.params.lessonId);
    const p = lessonProgress(enr, lesson.id);
    if (attemptsLeft(lesson, p) <= 0) fail(400, 'You have used all attempts for this quiz.');
    if (p.status === 'not_started') {
      p.status = 'in_progress';
      p.startedAt = nowIso();
    }
    const open =
      p.quizStartedAt &&
      !p.attempts.some((a) => Date.parse(a.at) >= Date.parse(p.quizStartedAt!)) &&
      (!lesson.checkSettings.timeLimitMin || Date.now() - Date.parse(p.quizStartedAt) < lesson.checkSettings.timeLimitMin * 60_000);
    if (!open) p.quizStartedAt = nowIso();
    save();
    return { quizStartedAt: p.quizStartedAt, serverNow: nowIso() };
  }),
);

learnerRouter.post(
  '/lesson/:courseId/:lessonId/check',
  wrap((req) => {
    const u = me(req);
    const c = getCourse(req.params.courseId);
    const enr = requireEnrollment(u.id, c.id);
    const lesson = findLesson(c, req.params.lessonId);
    if (!lesson.check.length) fail(400, 'This lesson has no check.');
    const p = lessonProgress(enr, lesson.id);
    const graded = attemptsLeft(lesson, p) > 0;
    // Timed quizzes must be started first. Submissions after the timer are accepted as auto-submissions
    // (the client submits whatever was answered when time runs out).
    if (lesson.checkSettings.mode === 'quiz' && graded && !p.quizStartedAt) fail(400, 'Start the quiz first.');
    const g = grade(lesson.check, req.body?.answers, () => lesson.id);
    const wasDone = p.status === 'done';
    const attempt: CheckAttempt = { at: nowIso(), score: g.score, answers: g.answers, kind: graded ? 'check' : 'review', items: g.items };
    p.attempts.push(attempt);
    p.quizStartedAt = undefined;
    if (p.status === 'not_started') {
      p.status = 'in_progress';
      p.startedAt = nowIso();
    }
    if (wasDone) p.lastReviewedAt = nowIso();
    recordEvent(u.id, 'check', c.id);
    const issued = maybeIssueCredential(u, c);
    save();
    return { attempt, results: g.results, graded, credentialIssued: issued, snapshot: snapshotFor(u, c), enrollment: enr };
  }),
);

learnerRouter.get(
  '/lesson/:courseId/:lessonId/answer-key',
  wrap((req) => {
    const u = me(req);
    const c = getCourse(req.params.courseId);
    const enr = requireEnrollment(u.id, c.id);
    const lesson = findLesson(c, req.params.lessonId);
    const p = enr.lessons[lesson.id];
    if (!p?.attempts.length) fail(403, 'The answer key unlocks after your first attempt.');
    if (lesson.checkSettings.mode === 'quiz' && attemptsLeft(lesson, p!) > 0 && p!.quizStartedAt) fail(403, 'Finish your quiz first.');
    return { questions: lesson.check, lastAnswers: p!.attempts[p!.attempts.length - 1].answers };
  }),
);

learnerRouter.post(
  '/lesson/:courseId/:lessonId/activity',
  wrap((req) => {
    const u = me(req);
    const c = getCourse(req.params.courseId);
    const enr = requireEnrollment(u.id, c.id);
    const lesson = findLesson(c, req.params.lessonId);
    if (!lesson.activity) fail(400, 'This lesson has no activity.');
    const fieldsIn = req.body?.fields ?? {};
    const fields: Record<string, string> = {};
    for (const f of lesson.activity!.fields) fields[f.id] = String(fieldsIn[f.id] ?? '').slice(0, 10000);
    const fileUrl = typeof req.body?.fileUrl === 'string' && req.body.fileUrl.startsWith('/uploads/') ? req.body.fileUrl : undefined;
    const hasText = Object.values(fields).some((v) => v.trim().length >= 3);
    if (!hasText && !fileUrl) fail(400, 'Write a response or attach a file before submitting.');
    const p = lessonProgress(enr, lesson.id);
    if (p.status === 'not_started') {
      p.status = 'in_progress';
      p.startedAt = nowIso();
    }
    const before = p.activity;
    p.activity = {
      fields,
      fileUrl,
      fileName: fileUrl ? String(req.body?.fileName ?? 'Attachment').slice(0, 200) : undefined,
      submittedAt: nowIso(),
      // A resubmission starts a fresh review, but keeps what the instructor said last time.
      // The latest rubric score is kept too: it stays the Mastery evidence until the new version is scored.
      // Editing an unreviewed version again keeps the earlier review as it was.
      ...(before && (before.review || before.feedback || before.rubric)
        ? {
            previous: {
              review: before.review,
              feedback: before.feedback,
              by: before.reviewedBy ?? before.feedbackBy,
              at: before.reviewedAt ?? before.feedbackAt,
              submittedAt: before.submittedAt,
              rubric: before.rubric ?? before.previous?.rubric,
            },
          }
        : before?.previous
          ? { previous: before.previous }
          : {}),
    };
    // Let the instructor know a revised version is ready.
    if (before?.review === 'resubmit' || before?.review === 'not_approved')
      notifyCourseStaff(c, { kind: 'message', title: `${u.name} resubmitted an activity`, body: `"${lesson.activity!.title}" is ready for review again.`, link: { view: 'assessments' } });
    recordEvent(u.id, 'activity', c.id);
    const issued = maybeIssueCredential(u, c);
    save();
    return { progress: p, credentialIssued: issued, snapshot: snapshotFor(u, c) };
  }),
);

learnerRouter.post(
  '/lesson/:courseId/:lessonId/reflect',
  wrap((req) => {
    const u = me(req);
    const c = getCourse(req.params.courseId);
    const enr = requireEnrollment(u.id, c.id);
    const lesson = findLesson(c, req.params.lessonId);
    const p = lessonProgress(enr, lesson.id);
    const conf = Number(req.body?.selfConfidence);
    if (conf >= 1 && conf <= 5) p.selfConfidence = Math.round(conf);
    if (typeof req.body?.reflection === 'string') p.reflection = req.body.reflection.slice(0, 5000);
    save();
    return { progress: p };
  }),
);

learnerRouter.post(
  '/lesson/:courseId/:lessonId/complete',
  wrap((req) => {
    const u = me(req);
    const c = getCourse(req.params.courseId);
    const enr = requireEnrollment(u.id, c.id);
    const lesson = findLesson(c, req.params.lessonId);
    const p = lessonProgress(enr, lesson.id);
    const r = lessonRequirements(lesson, p);
    if (!r.checkDone) fail(400, 'Take the Check Your Understanding before completing this lesson.');
    if (!r.activityDone) fail(400, 'Submit the applied activity before completing this lesson.');
    if (p.status !== 'done') {
      p.status = 'done';
      p.completedAt = nowIso();
      if (!p.startedAt) p.startedAt = p.completedAt;
    }
    const issued = maybeIssueCredential(u, c);
    save();
    return { progress: p, credentialIssued: issued, snapshot: snapshotFor(u, c), enrollment: enr };
  }),
);

/* ---------------- Final assessment ---------------- */

learnerRouter.post(
  '/final/:courseId/start',
  wrap((req) => {
    const u = me(req);
    const c = getCourse(req.params.courseId);
    const enr = requireEnrollment(u.id, c.id);
    const fe = c.finalExam;
    if (!fe?.questions.length) fail(400, 'This course has no final assessment.');
    const snap = snapshotFor(u, c);
    if (!snap.eligibleForFinal) fail(400, 'Complete every lesson to unlock the final assessment.');
    enr.finalExam ??= { attempts: [] };
    if (enr.finalExam.attempts.some((a) => a.score >= c.passMark)) fail(400, 'You have already passed the final assessment.');
    if (fe!.attemptsAllowed && enr.finalExam.attempts.length >= fe!.attemptsAllowed) fail(400, 'No attempts remaining.');
    const st = enr.finalExam.startedAt;
    const stillOpen = st && !enr.finalExam.attempts.some((a) => Date.parse(a.at) >= Date.parse(st)) && (!fe!.timeLimitMin || Date.now() - Date.parse(st) < fe!.timeLimitMin * 60_000);
    if (!stillOpen) enr.finalExam.startedAt = nowIso();
    save();
    return { startedAt: enr.finalExam.startedAt, serverNow: nowIso(), questions: sanitizeCourse(c).finalExam!.questions, timeLimitMin: fe!.timeLimitMin };
  }),
);

learnerRouter.post(
  '/final/:courseId/submit',
  wrap((req) => {
    const u = me(req);
    const c = getCourse(req.params.courseId);
    const enr = requireEnrollment(u.id, c.id);
    const fe = c.finalExam;
    if (!fe?.questions.length || !enr.finalExam?.startedAt) fail(400, 'Start the final assessment first.');
    const st = Date.parse(enr.finalExam!.startedAt!);
    if (enr.finalExam!.attempts.some((a) => Date.parse(a.at) >= st)) fail(400, 'This attempt was already submitted.');
    // The time limit is enforced here too (with 60 s of grace for slow connections), not only on the timer.
    if (fe!.timeLimitMin && Date.now() - st > fe!.timeLimitMin * 60_000 + 60_000) fail(400, 'The time for this attempt has ended. Start a new attempt if you have one left.');
    // Record the forecast exactly as it stood before this result, so forecast accuracy can be measured later.
    const before = snapshotFor(u, c);
    const lessonIds = new Set(c.modules.flatMap((m) => m.lessons.map((l) => l.id)));
    const g = grade(fe!.questions, req.body?.answers, (q) => (q.objectiveId && lessonIds.has(q.objectiveId) ? q.objectiveId : undefined));
    const attempt: CheckAttempt = { at: nowIso(), score: g.score, answers: g.answers, kind: 'check', items: g.items };
    enr.finalExam!.attempts.push(attempt);
    (enr.forecastLog ??= []).push({
      at: attempt.at,
      predictedGrade: before.prediction.predictedGrade,
      low: before.prediction.range.low,
      high: before.prediction.range.high,
      passConfidence: before.prediction.passConfidence,
      evidence: before.prediction.evidence,
      comprehension: before.metrics.comprehension,
      mastery: before.metrics.mastery,
      finalScore: g.score,
    });
    recordEvent(u.id, 'final', c.id);
    const passed = g.score >= c.passMark;
    const issued = maybeIssueCredential(u, c);
    if (!passed) {
      notify(u.id, {
        kind: 'nudge',
        title: 'Your final result is in',
        body: `You scored ${g.score}%. Review your weakest topics before your next attempt.`,
        link: { view: 'progress', courseId: c.id },
      });
    }
    save();
    return { attempt, passed, passMark: c.passMark, results: g.results, credentialIssued: issued, snapshot: snapshotFor(u, c), enrollment: enr };
  }),
);

/* ---------------- Credential ---------------- */

learnerRouter.get(
  '/credential/:courseId',
  wrap((req) => {
    const u = me(req);
    const c = getCourse(req.params.courseId);
    const enr = requireEnrollment(u.id, c.id);
    const snap = snapshotFor(u, c);
    return {
      earned: !!enr.certificateIssuedAt,
      certificateId: enr.certificateId,
      issuedAt: enr.certificateIssuedAt,
      learnerName: u.name,
      courseTitle: c.title,
      credentialName: c.credentialName,
      grade: snap.prediction.currentGrade,
      requirements: [
        { label: `Complete all ${snap.completion.lessonsTotal} lessons`, met: snap.completion.lessonsDone === snap.completion.lessonsTotal },
        ...(c.finalExam?.questions.length ? [{ label: `Pass the final assessment (${c.passMark}%+)`, met: (enr.finalExam?.attempts ?? []).some((a) => a.score >= c.passMark) }] : []),
        { label: `Overall grade of ${c.passMark}% or higher`, met: (snap.prediction.currentGrade ?? 0) >= c.passMark && snap.completion.lessonsDone === snap.completion.lessonsTotal },
      ],
    };
  }),
);
