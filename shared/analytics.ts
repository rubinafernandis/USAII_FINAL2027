// USAII Intuitive LMS — Learning Analytics Engine
// Pure, deterministic functions. Every metric shown to learners and instructors
// is derived here from real activity records, so the numbers are explainable.

import type {
  ActivityEvent,
  CompletionEstimate,
  Course,
  CourseModule,
  EngagementMetrics,
  Enrollment,
  GradePrediction,
  LearnerSnapshot,
  LearningGoal,
  Lesson,
  LessonProgress,
  TopicState,
  NextStep,
  Recommendation,
  RiskFactor,
  Thread,
  TopicStatus,
} from './types';
import { activityRubric, computeLearningMetrics, hasRubric } from './metrics';

const DAY_MS = 86_400_000;

/** Research-informed benchmark pace used for engagement scoring and what-if modeling. */
export const BENCHMARK = { daysPerWeek: 5, minutesPerDay: 30 };

export const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
export const round = (n: number) => Math.round(n);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function dateKey(d: Date | string | number): string {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function letterFor(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

export interface FlatLesson {
  lesson: Lesson;
  module: CourseModule;
  moduleIndex: number; // 1-based
  lessonIndex: number; // 1-based within module
  globalIndex: number; // 1-based across course
}

export function flattenLessons(course: Course): FlatLesson[] {
  const out: FlatLesson[] = [];
  let g = 0;
  course.modules.forEach((m, mi) =>
    m.lessons.forEach((l, li) => {
      g += 1;
      out.push({ lesson: l, module: m, moduleIndex: mi + 1, lessonIndex: li + 1, globalIndex: g });
    }),
  );
  return out;
}

export function whereLabel(course: Course, lessonId: string): string {
  const f = flattenLessons(course).find((x) => x.lesson.id === lessonId);
  if (!f) return '';
  return `Module ${f.moduleIndex}, lesson ${f.lessonIndex} of ${f.module.lessons.length}`;
}

export function emptyProgress(): LessonProgress {
  return { status: 'not_started', activeSeconds: 0, attempts: [] };
}

export function progressOf(enr: Enrollment | undefined, lessonId: string): LessonProgress {
  return enr?.lessons[lessonId] ?? emptyProgress();
}

export function attemptsLeft(lesson: Lesson, p: LessonProgress): number {
  const allowed = lesson.checkSettings.attemptsAllowed;
  if (!allowed) return Infinity;
  return Math.max(0, allowed - p.attempts.filter((a) => a.kind === 'check').length);
}

/** Requirements for a lesson to count as complete. */
export function lessonRequirements(lesson: Lesson, p: LessonProgress) {
  const needsCheck = lesson.check.length > 0;
  const needsActivity = !!lesson.activity;
  const checkDone = !needsCheck || p.attempts.some((a) => a.kind === 'check');
  const activityDone = !needsActivity || !!p.activity;
  return { needsCheck, needsActivity, checkDone, activityDone, complete: checkDone && activityDone };
}

/* ------------------------------------------------------------------ */
/* Topic status (per lesson: drives next steps and spaced reviews)      */
/* Not the Comprehension or Mastery metric: see shared/metrics.ts.      */
/* ------------------------------------------------------------------ */

export function topicState(score: number, started: boolean, attempted: boolean): TopicState {
  if (!started && !attempted) return 'Not started';
  if (!attempted) return 'Seen';
  if (score < 60) return 'Practicing';
  if (score < 80) return 'Developing';
  if (score < 90) return 'Solid';
  return 'Strong';
}

/**
 * @param objectiveComprehension the lesson's objective-level Comprehension, when measured.
 * It replaces the check blend so that the number a learner sees for a topic is always the
 * same number used in the Comprehension metric. Submitting an activity never raises it.
 */
export function lessonTopicStatus(f: FlatLesson, p: LessonProgress, now: number, objectiveComprehension?: number | null): TopicStatus {
  const { lesson, module } = f;
  const checks = p.attempts;
  const started = p.status !== 'not_started';
  let score = 0;
  let best: number | null = null;
  let first: number | null = null;

  if (lesson.check.length > 0) {
    if (checks.length) {
      best = Math.max(...checks.map((a) => a.score));
      first = checks[0].score;
      const latest = checks[checks.length - 1].score;
      // Blend best performance with most recent recall (retention).
      score = 0.6 * best + 0.4 * latest;
      if (objectiveComprehension !== undefined && objectiveComprehension !== null) score = objectiveComprehension;
    } else if (started) {
      score = 10;
    }
  } else if (p.status === 'done') {
    score = lesson.activity ? (p.activity ? 100 : 70) : 100;
  } else if (started) {
    score = lesson.activity && p.activity ? 60 : 15;
  }
  score = round(clamp(score));

  const attempted = lesson.check.length > 0 ? checks.length > 0 : p.status === 'done';
  const lastTouch = Math.max(
    p.completedAt ? Date.parse(p.completedAt) : 0,
    p.lastReviewedAt ? Date.parse(p.lastReviewedAt) : 0,
    checks.length ? Date.parse(checks[checks.length - 1].at) : 0,
  );
  const reviewDue =
    p.status === 'done' && lesson.check.length > 0 && score < 90 && lastTouch > 0 && now - lastTouch >= 3 * DAY_MS;

  let calibration: TopicStatus['calibration'];
  if (p.selfConfidence && first !== null) {
    const diff = p.selfConfidence * 20 - first;
    calibration = diff > 20 ? 'over' : diff < -20 ? 'under' : 'accurate';
  }

  return {
    lessonId: lesson.id,
    moduleId: module.id,
    lessonTitle: lesson.title,
    topic: lesson.topic,
    score,
    state: topicState(score, started, attempted),
    bestCheck: best,
    firstCheck: first,
    selfConfidence: p.selfConfidence,
    calibration,
    reviewDue,
  };
}

/* ------------------------------------------------------------------ */
/* Engagement                                                          */
/* ------------------------------------------------------------------ */

export function computeEngagement(args: {
  userId: string;
  courseId?: string;
  events: ActivityEvent[];
  enrollment?: Enrollment;
  now: number;
}): EngagementMetrics {
  const { userId, courseId, events, enrollment, now } = args;
  const mine = events.filter((e) => e.userId === userId);
  const inCourse = (e: ActivityEvent) => !courseId || !e.courseId || e.courseId === courseId;
  const study = mine.filter((e) => e.type === 'study' && inCourse(e));
  const logins = mine.filter((e) => e.type === 'login');

  const since7 = now - 7 * DAY_MS;
  const today = new Date(now);
  const daily: EngagementMetrics['daily'] = [];
  const minutesByDay = new Map<string, number>();
  for (const e of study) {
    const k = dateKey(e.at);
    minutesByDay.set(k, (minutesByDay.get(k) ?? 0) + (e.seconds ?? 0) / 60);
  }
  const loginDays = new Set(logins.map((e) => dateKey(e.at)));
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const k = dateKey(d);
    daily.push({ date: k, minutes: round(minutesByDay.get(k) ?? 0), login: loginDays.has(k) });
  }
  const last7 = daily.slice(7);
  const activeDaysLast7 = last7.filter((d) => d.minutes >= 1).length;
  const activeMinutesLast7 = round(last7.reduce((a, d) => a + d.minutes, 0));
  const loginsLast7 = logins.filter((e) => Date.parse(e.at) >= since7).length;
  const loginDaysLast7 = last7.filter((d) => d.login).length;

  // Sessions: study heartbeats separated by < 10 minutes belong to the same session.
  const sorted = [...study].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  let sessions = 0;
  let prev = 0;
  let totalSec = 0;
  for (const e of sorted) {
    const t = Date.parse(e.at);
    if (!prev || t - prev > 10 * 60_000) sessions += 1;
    prev = t;
    totalSec += e.seconds ?? 0;
  }
  const totalActiveMinutes = round(totalSec / 60);
  const avgSessionMinutes = sessions ? round(totalSec / 60 / sessions) : 0;

  const lessons = enrollment ? Object.values(enrollment.lessons) : [];
  const checksTaken = lessons.reduce((a, p) => a + p.attempts.length, 0);
  const activitiesSubmitted = lessons.filter((p) => !!p.activity).length;
  const lessonsTouched = lessons.filter((p) => p.status !== 'not_started').length;
  const posts = mine.filter((e) => (e.type === 'post' || e.type === 'reply') && inCourse(e)).length;

  const consistency = Math.min(1, activeDaysLast7 / BENCHMARK.daysPerWeek);
  const time = Math.min(1, activeMinutesLast7 / (BENCHMARK.daysPerWeek * BENCHMARK.minutesPerDay));
  const participation = lessonsTouched
    ? Math.min(1, (checksTaken + activitiesSubmitted + posts) / (lessonsTouched * 2))
    : 0;
  const parts: [number, number][] = [
    [consistency, 35],
    [time, 30],
    [participation, 25],
  ];
  const wsum = parts.reduce((a, [, w]) => a + w, 0);
  const engagementScore = round((parts.reduce((a, [v, w]) => a + v * w, 0) / wsum) * 100);

  let streak = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    const d = daily[i];
    const active = d.minutes >= 1;
    if (active) streak += 1;
    else if (i === daily.length - 1) continue; // today not yet active is fine
    else break;
  }

  return {
    loginsLast7,
    loginDaysLast7,
    activeDaysLast7,
    activeMinutesLast7,
    avgSessionMinutes,
    totalActiveMinutes,
    daily,
    checksTaken,
    activitiesSubmitted,
    posts,
    engagementScore,
    streak,
  };
}

/** Engagement score for a hypothetical weekly plan (used by the what-if simulator). */
export function hypotheticalEngagement(base: EngagementMetrics, minutesPerDay: number, daysPerWeek: number): number {
  const consistency = Math.min(1, daysPerWeek / BENCHMARK.daysPerWeek);
  const time = Math.min(1, (minutesPerDay * daysPerWeek) / (BENCHMARK.daysPerWeek * BENCHMARK.minutesPerDay));
  // More study time also creates more participation opportunities.
  const participationNow = base.engagementScore / 100;
  const participation = Math.min(1, Math.max(participationNow, 0.35 + 0.65 * time));
  const parts: [number, number][] = [
    [consistency, 35],
    [time, 30],
    [participation, 25],
  ];
  const wsum = parts.reduce((a, [, w]) => a + w, 0);
  return round((parts.reduce((a, [v, w]) => a + v * w, 0) / wsum) * 100);
}

/* ------------------------------------------------------------------ */
/* Grade prediction                                                    */
/* ------------------------------------------------------------------ */

export function computePrediction(
  course: Course,
  enrollment: Enrollment | undefined,
  topics: TopicStatus[],
  engagementScore: number,
): GradePrediction {
  const flat = flattenLessons(course);
  const withCheck = flat.filter((f) => f.lesson.check.length > 0);
  const withActivity = flat.filter((f) => !!f.lesson.activity);

  const bests: number[] = [];
  const firsts: number[] = [];
  const quizFirsts: number[] = [];
  for (const f of withCheck) {
    const p = progressOf(enrollment, f.lesson.id);
    const checks = p.attempts.filter((a) => a.kind === 'check');
    if (checks.length) {
      bests.push(Math.max(...checks.map((a) => a.score)));
      firsts.push(checks[0].score);
      if (f.lesson.checkSettings.mode === 'quiz') quizFirsts.push(checks[0].score);
    }
  }
  const avgCheck = mean(bests);
  const firstAttemptAvg = mean(firsts);

  const submitted = withActivity.filter((f) => !!progressOf(enrollment, f.lesson.id).activity).length;
  // Applied work is graded by its rubric score, never by submission alone. Activities without a rubric
  // only count by submission when the course has no rubric-scored activity at all.
  const rubricActs = withActivity.filter((f) => hasRubric(f.lesson.activity));
  const rubricScores = rubricActs
    .map((f) => {
      const p = progressOf(enrollment, f.lesson.id);
      return p.activity ? activityRubric(p)?.percent ?? null : null;
    })
    .filter((x): x is number => x !== null);
  const rubricAvg = mean(rubricScores);
  const useRubric = rubricActs.length > 0;
  const doneWithActivity = withActivity.filter((f) => {
    const p = progressOf(enrollment, f.lesson.id);
    return p.status !== 'not_started';
  }).length;

  const finalAttempts = enrollment?.finalExam?.attempts ?? [];
  const finalScore = finalAttempts.length ? Math.max(...finalAttempts.map((a) => a.score)) : null;

  const hasFinal = !!course.finalExam && course.finalExam.questions.length > 0;
  const w = { ...course.grading };
  if (!hasFinal) {
    w.checks += w.finalExam;
    w.finalExam = 0;
  }
  if (!withActivity.length) {
    w.checks += w.activities;
    w.activities = 0;
  }
  if (!withCheck.length) {
    w.finalExam += w.checks;
    w.checks = 0;
  }

  // ---- Current grade (earned so far, normalized over graded components with data)
  const comps: [number | null, number][] = [
    [avgCheck, w.checks],
    [useRubric ? rubricAvg : doneWithActivity ? (submitted / doneWithActivity) * 100 : null, w.activities],
    [finalScore, w.finalExam],
  ];
  const avail = comps.filter(([s, wt]) => s !== null && wt > 0) as [number, number][];
  const currentGrade = avail.length
    ? round(avail.reduce((a, [s, wt]) => a + s * wt, 0) / avail.reduce((a, [, wt]) => a + wt, 0))
    : null;

  // ---- Predicted final grade
  const prior = avgCheck ?? 72;
  const futureCheck = clamp(0.8 * prior + 0.2 * engagementScore);
  const predictedChecks = withCheck.length
    ? (bests.reduce((a, b) => a + b, 0) + (withCheck.length - bests.length) * futureCheck) / withCheck.length
    : 0;

  const submissionRate = doneWithActivity ? submitted / doneWithActivity : 0.8;
  const likelihood = clamp(0.6 * submissionRate + 0.4 * (engagementScore / 100), 0, 1);
  const predictedActivities = useRubric
    ? (rubricScores.reduce((a, b) => a + b, 0) + (rubricActs.length - rubricScores.length) * (rubricAvg ?? futureCheck) * (rubricScores.length ? 1 : likelihood)) / rubricActs.length
    : withActivity.length
      ? ((submitted + (withActivity.length - submitted) * likelihood) / withActivity.length) * 100
      : 0;

  const attemptedTopics = mean(topics.filter((m) => m.bestCheck !== null).map((m) => m.score));
  const finalBase = attemptedTopics ?? prior;
  const predictedFinal = finalScore ?? clamp(0.8 * finalBase + 0.2 * engagementScore);

  const wTotal = w.checks + w.activities + w.finalExam || 1;
  const predictedGrade = round(
    (predictedChecks * w.checks + predictedActivities * w.activities + predictedFinal * w.finalExam) / wTotal,
  );

  // ---- Pass confidence: logistic on margin above pass mark, tempered by evidence volume.
  const margin = predictedGrade - course.passMark;
  const logistic = 100 / (1 + Math.exp(-0.16 * margin));
  // Evidence = share of graded work that has a result, across the parts that carry weight.
  const coverage: [number, number][] = [];
  if (withCheck.length && w.checks) coverage.push([bests.length / withCheck.length, w.checks]);
  if (useRubric && w.activities) coverage.push([rubricScores.length / rubricActs.length, w.activities]);
  if (hasFinal && w.finalExam) coverage.push([finalScore !== null ? 1 : 0, w.finalExam]);
  const evidence = finalScore !== null ? 1 : coverage.length ? coverage.reduce((a, [c, wt]) => a + c * wt, 0) / coverage.reduce((a, [, wt]) => a + wt, 0) : 0;
  // The range narrows as evidence grows: about ±20 points with almost nothing graded, ±3 once the final is in.
  const half = finalScore !== null ? 3 : Math.round(4 + 16 * (1 - evidence));
  const range = { low: round(clamp(predictedGrade - half)), high: round(clamp(predictedGrade + half)) };
  const evidenceLevel: GradePrediction['evidence'] = evidence === 0 ? 'none' : evidence < 0.34 ? 'early' : 'solid';
  const evidenceNote =
    evidenceLevel === 'none'
      ? 'Not enough evidence yet. An estimate appears after your first graded check or activity.'
      : evidenceLevel === 'early'
        ? `Early estimate from ${Math.round(evidence * 100)}% of your graded work. It will change as you complete more; treat it as a rough guide, not a result.`
        : finalScore !== null
          ? 'Based on your final assessment and your graded work.'
          : `Estimate based on ${Math.round(evidence * 100)}% of your graded work. It is a forecast, not a guarantee.`;
  let passConfidence = logistic * (0.55 + 0.45 * evidence) + 50 * 0.45 * (1 - evidence);
  passConfidence = passConfidence * 0.85 + engagementScore * 0.15;
  if (enrollment?.certificateIssuedAt) passConfidence = 100;
  else if (
    hasFinal &&
    finalScore !== null &&
    finalScore < course.passMark &&
    course.finalExam!.attemptsAllowed > 0 &&
    finalAttempts.length >= course.finalExam!.attemptsAllowed
  )
    passConfidence = Math.min(passConfidence, 10);

  return {
    currentGrade,
    predictedGrade,
    predictedLetter: letterFor(predictedGrade),
    passConfidence: round(clamp(passConfidence, 1, 100)),
    avgCheckScore: avgCheck === null ? null : round(avgCheck),
    avgQuizFirstAttempt: quizFirsts.length ? round(mean(quizFirsts)!) : null,
    firstAttemptAvg: firstAttemptAvg === null ? null : round(firstAttemptAvg),
    finalExamScore: finalScore,
    evidence: evidenceLevel,
    range,
    evidenceNote,
    breakdown: [
      { label: 'Check Your Understanding', weight: w.checks, score: avgCheck === null ? null : round(avgCheck) },
      useRubric
        ? { label: 'Applied activities (rubric scores)', weight: w.activities, score: rubricAvg === null ? null : round(rubricAvg) }
        : { label: 'Applied activities (submitted)', weight: w.activities, score: doneWithActivity ? round((submitted / doneWithActivity) * 100) : null },
      { label: 'Final assessment', weight: w.finalExam, score: finalScore },
    ].filter((b) => b.weight > 0),
  };
}

/* ------------------------------------------------------------------ */
/* Completion estimate                                                 */
/* ------------------------------------------------------------------ */

export function computeCompletion(
  course: Course,
  enrollment: Enrollment | undefined,
  engagement: EngagementMetrics,
  goal: LearningGoal | undefined,
  now: number,
  override?: { minutesPerDay: number; daysPerWeek: number },
): CompletionEstimate {
  const flat = flattenLessons(course);
  let minutesRemaining = 0;
  let done = 0;
  for (const f of flat) {
    const p = progressOf(enrollment, f.lesson.id);
    if (p.status === 'done') done += 1;
    else if (p.status === 'in_progress')
      minutesRemaining += Math.max(5, f.lesson.estimatedMinutes - Math.round(p.activeSeconds / 60));
    else minutesRemaining += f.lesson.estimatedMinutes;
  }
  const hasFinal = !!course.finalExam && course.finalExam.questions.length > 0;
  const finalExamDone = !hasFinal || !!enrollment?.certificateIssuedAt || (enrollment?.finalExam?.attempts ?? []).some((a) => a.score >= course.passMark);
  if (hasFinal && !finalExamDone) minutesRemaining += course.finalExam!.timeLimitMin || 30;

  let minutesPerWeek: number;
  let paceSource: CompletionEstimate['paceSource'];
  const observed = engagement.daily.reduce((a, d) => a + d.minutes, 0) / 2; // per week over 14 days
  if (override) {
    minutesPerWeek = override.minutesPerDay * override.daysPerWeek;
    paceSource = 'goal';
  } else if (observed >= 15) {
    minutesPerWeek = observed;
    paceSource = 'observed';
  } else if (goal) {
    minutesPerWeek = goal.minutesPerDay * goal.daysPerWeek;
    paceSource = 'goal';
  } else {
    minutesPerWeek = 90;
    paceSource = 'default';
  }
  minutesPerWeek = Math.max(1, round(minutesPerWeek));
  const weeksRemaining = minutesRemaining / minutesPerWeek;
  const complete = minutesRemaining === 0;
  const estimatedDate = complete ? null : dateKey(now + Math.ceil(weeksRemaining * 7) * DAY_MS);

  return {
    lessonsDone: done,
    lessonsTotal: flat.length,
    percent: flat.length ? round((done / flat.length) * 100) : 0,
    minutesRemaining,
    minutesPerWeek,
    paceSource,
    weeksRemaining: Math.round(weeksRemaining * 10) / 10,
    estimatedDate,
    finalExamDone,
  };
}

/* ------------------------------------------------------------------ */
/* What-if simulator                                                   */
/* ------------------------------------------------------------------ */

export interface WhatIfResult {
  estimatedDate: string | null;
  weeksRemaining: number;
  predictedGrade: number;
  predictedLetter: string;
  passConfidence: number;
  engagementScore: number;
}

export function simulateWhatIf(
  course: Course,
  enrollment: Enrollment | undefined,
  base: EngagementMetrics,
  mastery: TopicStatus[],
  minutesPerDay: number,
  daysPerWeek: number,
  now: number,
): WhatIfResult {
  const eng = hypotheticalEngagement(base, minutesPerDay, daysPerWeek);
  const pred = computePrediction(course, enrollment, mastery, eng);
  const comp = computeCompletion(course, enrollment, base, undefined, now, { minutesPerDay, daysPerWeek });
  return {
    estimatedDate: comp.estimatedDate,
    weeksRemaining: comp.weeksRemaining,
    predictedGrade: pred.predictedGrade,
    predictedLetter: pred.predictedLetter,
    passConfidence: pred.passConfidence,
    engagementScore: eng,
  };
}

/* ------------------------------------------------------------------ */
/* Next step, recommendations, risk                                   */
/* ------------------------------------------------------------------ */

export function unreadStaffReply(threads: Thread[], userId: string, courseId: string): Thread | undefined {
  return threads.find(
    (t) =>
      t.courseId === courseId &&
      t.authorId === userId &&
      t.replies.some((r) => r.authorRole !== 'learner') &&
      !t.readBy.includes(userId),
  );
}

export function computeNextStep(args: {
  course: Course;
  enrollment?: Enrollment;
  mastery: TopicStatus[];
  threads: Thread[];
  userId: string;
  now: number;
}): NextStep {
  const { course, enrollment, mastery, threads, userId, now } = args;
  const flat = flattenLessons(course);
  const cid = course.id;

  if (!flat.length) {
    return {
      title: 'This course is being prepared',
      reason: 'Your instructor has not added lessons yet. You will be notified as soon as they are ready.',
      minutes: 0,
      label: 'Explore courses',
      action: { kind: 'browse' },
      where: course.title,
    };
  }

  const reply = unreadStaffReply(threads, userId, cid);
  if (reply) {
    return {
      title: `Read your instructor's reply`,
      reason: `Your question "${reply.title.slice(0, 60)}" has a new answer. Reading it now keeps you moving.`,
      minutes: 2,
      label: 'Read reply',
      action: { kind: 'thread', courseId: cid, threadId: reply.id },
      where: reply.lessonTitle ?? 'Ask',
    };
  }

  // Timed quiz already started and still open.
  for (const f of flat) {
    const p = progressOf(enrollment, f.lesson.id);
    if (p.quizStartedAt && f.lesson.checkSettings.mode === 'quiz') {
      const started = Date.parse(p.quizStartedAt);
      const answeredAfter = p.attempts.some((a) => Date.parse(a.at) >= started);
      const limit = f.lesson.checkSettings.timeLimitMin * 60_000;
      if (!answeredAfter && (!limit || now - started < limit)) {
        return {
          title: `Finish your quiz: ${f.lesson.title}`,
          reason: 'Your timed quiz is still open. Finish it before the timer runs out.',
          minutes: Math.max(1, Math.ceil((limit - (now - started)) / 60_000)),
          label: 'Resume quiz',
          action: { kind: 'check', courseId: cid, lessonId: f.lesson.id },
          where: whereLabel(course, f.lesson.id),
        };
      }
    }
  }

  const inProgress = flat.find((f) => progressOf(enrollment, f.lesson.id).status === 'in_progress');
  if (inProgress) {
    const p = progressOf(enrollment, inProgress.lesson.id);
    const req = lessonRequirements(inProgress.lesson, p);
    const left = Math.max(5, inProgress.lesson.estimatedMinutes - Math.round(p.activeSeconds / 60));
    const remainingBits = [
      !req.checkDone ? 'the understanding check' : '',
      !req.activityDone ? 'your applied activity' : '',
    ].filter(Boolean);
    return {
      title: `Continue: ${inProgress.lesson.title}`,
      reason: remainingBits.length
        ? `You started this lesson. Still to do: ${remainingBits.join(' and ')}.`
        : 'You are almost done with this lesson. Mark it complete to unlock your next step.',
      minutes: left,
      label: 'Continue lesson',
      action: { kind: 'lesson', courseId: cid, lessonId: inProgress.lesson.id },
      where: whereLabel(course, inProgress.lesson.id),
    };
  }

  const weak = mastery
    .filter((m) => m.bestCheck !== null && m.score < 60)
    .filter((m) => {
      const f = flat.find((x) => x.lesson.id === m.lessonId)!;
      return attemptsLeft(f.lesson, progressOf(enrollment, m.lessonId)) > 0;
    })
    .sort((a, b) => a.score - b.score)[0];
  if (weak) {
    return {
      title: `Strengthen: ${weak.topic}`,
      reason: `Your understanding of this topic is at ${weak.score}%. A short review and a retake is the fastest way to strengthen it.`,
      minutes: 8,
      label: 'Review & retake',
      action: { kind: 'review', courseId: cid, lessonId: weak.lessonId },
      where: whereLabel(course, weak.lessonId),
    };
  }

  const nextNew = flat.find((f) => progressOf(enrollment, f.lesson.id).status === 'not_started');
  if (nextNew) {
    const isFirst = nextNew.globalIndex === 1;
    return {
      title: `${isFirst ? 'Start here' : 'Next up'}: ${nextNew.lesson.title}`,
      reason: isFirst
        ? `This is lesson 1 of ${flat.length}. It takes about ${nextNew.lesson.estimatedMinutes} minutes, and you can pause any time.`
        : `Lesson ${nextNew.globalIndex} of ${flat.length}. It builds directly on what you just finished.`,
      minutes: nextNew.lesson.estimatedMinutes,
      label: isFirst ? 'Start lesson 1' : 'Start lesson',
      action: { kind: 'lesson', courseId: cid, lessonId: nextNew.lesson.id },
      where: whereLabel(course, nextNew.lesson.id),
    };
  }

  const due = mastery.find((m) => m.reviewDue);
  const hasFinal = !!course.finalExam && course.finalExam.questions.length > 0;
  const finalAttempts = enrollment?.finalExam?.attempts ?? [];
  const passedFinal = finalAttempts.some((a) => a.score >= course.passMark);

  if (hasFinal && !passedFinal) {
    const allowed = course.finalExam!.attemptsAllowed;
    const left = allowed ? allowed - finalAttempts.length : Infinity;
    const softSpot = mastery.filter((m) => m.score < course.passMark).sort((a, b) => a.score - b.score)[0];
    if (softSpot && left > 0) {
      return {
        title: `Before your final: review ${softSpot.topic}`,
        reason: `This topic sits at ${softSpot.score}%, below the ${course.passMark}% pass mark. A quick review now protects your final result.`,
        minutes: 8,
        label: 'Quick review',
        action: { kind: 'review', courseId: cid, lessonId: softSpot.lessonId },
        where: whereLabel(course, softSpot.lessonId),
      };
    }
    if (left > 0) {
      return {
        title: 'Take your final assessment',
        reason: `All lessons are complete. You need ${course.passMark}% to earn your ${course.credentialName}.`,
        minutes: course.finalExam!.timeLimitMin || 30,
        label: 'Start final assessment',
        action: { kind: 'final', courseId: cid },
        where: 'Final assessment',
      };
    }
    return {
      title: 'Talk with your instructor',
      reason: 'You have used all final assessment attempts. Your instructor can review options with you.',
      minutes: 15,
      label: 'Ask your instructor',
      action: { kind: 'thread', courseId: cid },
      where: 'Support',
    };
  }

  if (due) {
    return {
      title: `3-minute memory boost: ${due.topic}`,
      reason: 'Reviewing a few days after learning locks knowledge in long-term memory.',
      minutes: 3,
      label: 'Quick review',
      action: { kind: 'review', courseId: cid, lessonId: due.lessonId },
      where: whereLabel(course, due.lessonId),
    };
  }

  return {
    title: enrollment?.certificateIssuedAt ? 'You earned your credential' : 'Claim your credential',
    reason: enrollment?.certificateIssuedAt
      ? 'Share it, download it, or explore another course whenever you are ready.'
      : 'Every requirement is met. Your credential is ready.',
    minutes: 1,
    label: 'View credential',
    action: { kind: 'credential', courseId: cid },
    where: 'Credential',
  };
}

export function computeRecommendations(args: {
  course: Course;
  enrollment?: Enrollment;
  mastery: TopicStatus[];
  engagement: EngagementMetrics;
  prediction: GradePrediction;
  now: number;
}): Recommendation[] {
  const { course, enrollment, mastery, engagement, prediction, now } = args;
  const recs: Recommendation[] = [];
  const flat = flattenLessons(course);
  const cid = course.id;

  const weak = mastery.filter((m) => m.bestCheck !== null && m.score < 70).sort((a, b) => a.score - b.score);
  for (const m of weak.slice(0, 3)) {
    const f = flat.find((x) => x.lesson.id === m.lessonId)!;
    const canRetake = attemptsLeft(f.lesson, progressOf(enrollment, m.lessonId)) > 0;
    let detail = `Re-read the key ideas in "${m.lessonTitle}" (about 5 minutes), then ${canRetake ? 'retake the check' : 'read the answer explanations'}.`;
    if (m.calibration === 'over')
      detail = `You felt confident here but scored ${m.firstCheck}%. Read the explanation for each question you missed, then ${canRetake ? 'retake the check' : 'try the practice questions again'}.`;
    recs.push({
      id: `weak-${m.lessonId}`,
      priority: m.score < 60 ? 'now' : 'soon',
      title: `Strengthen "${m.topic}" (${m.score}%)`,
      detail,
      why: `This topic is below 70% on your knowledge checks, and ${m.topic} builds the base for later lessons and the final assessment.`,
      minutes: 8,
      action: { kind: 'review', courseId: cid, lessonId: m.lessonId },
    });
  }

  for (const f of flat) {
    const p = progressOf(enrollment, f.lesson.id);
    if (f.lesson.activity && !p.activity && p.status !== 'not_started') {
      recs.push({
        id: `act-${f.lesson.id}`,
        priority: 'soon',
        title: `Submit: ${f.lesson.activity.title}`,
        detail: 'Open the activity, follow the instructions, and submit your work for review.',
        why: f.lesson.activity.rubricPdf?.url || f.lesson.activity.rubric?.length
          ? 'Your instructor scores it against the rubric. That score is your Mastery evidence and part of your grade.'
          : 'Applying the idea to your own work is what turns knowledge into skill, and the lesson cannot be completed without it.',
        minutes: 15,
        action: { kind: 'activity', courseId: cid, lessonId: f.lesson.id },
      });
    }
  }

  // Applied work that scored low on its rubric: the Mastery gap, even when quiz scores are strong.
  const lowRubric = flat
    .map((f) => ({ f, p: progressOf(enrollment, f.lesson.id) }))
    .map(({ f, p }) => ({ f, p, rub: p.activity ? activityRubric(p) : undefined }))
    .filter((x) => x.f.lesson.activity && x.rub && x.rub.percent < 60)
    .sort((a, b) => a.rub!.percent - b.rub!.percent)
    .slice(0, 2); // the two weakest only, so guidance stays focused
  for (const { f, p, rub: r } of lowRubric) {
    const rub = r!;
    const resubmitAsked = p.activity!.review === 'resubmit' || p.activity!.review === 'not_approved';
    recs.push({
      id: `rubric-${f.lesson.id}`,
      priority: rub.percent < 40 ? 'now' : 'soon',
      title: `Improve "${f.lesson.activity!.title}" (rubric ${rub.percent}%)`,
      detail: resubmitAsked
        ? 'Read your instructor’s feedback, compare your work with the rubric, then revise and resubmit.'
        : 'Open the rubric, find the criteria where you lost points, and apply them in your next activity.',
      why: 'Applied work scored against the rubric is your Mastery evidence. Knowing the idea is not yet the same as using it well.',
      minutes: 20,
      action: { kind: 'activity', courseId: cid, lessonId: f.lesson.id },
    });
  }

  const weakIds = new Set(weak.slice(0, 3).map((m) => m.lessonId));
  for (const m of mastery.filter((x) => x.reviewDue && !weakIds.has(x.lessonId)).slice(0, 2)) {
    recs.push({
      id: `due-${m.lessonId}`,
      priority: 'later',
      title: `Memory boost: ${m.topic}`,
      detail: 'Do a 3-minute review of this lesson\'s key ideas.',
      why: 'You have not reviewed it for a while, and a short spaced review keeps it from fading before the final.',
      minutes: 3,
      action: { kind: 'review', courseId: cid, lessonId: m.lessonId },
    });
  }

  const nextNew = flat.find((f) => progressOf(enrollment, f.lesson.id).status === 'not_started');
  if (engagement.activeDaysLast7 < 3 && nextNew) {
    recs.push({
      id: 'rhythm',
      priority: 'soon',
      title: 'Build your rhythm: 2 more short sessions this week',
      detail: `Start "${nextNew.lesson.title}" today, and plan one more short session this week.`,
      why: `${engagement.activeDaysLast7 === 0 ? 'You have not studied in the last 7 days' : `You studied on ${engagement.activeDaysLast7} ${engagement.activeDaysLast7 === 1 ? 'day' : 'days'} in the last 7`}, and a steady rhythm of 3 or more days a week keeps you on pace to finish.`,
      minutes: 15,
      action: { kind: 'lesson', courseId: cid, lessonId: nextNew.lesson.id },
    });
  }

  const order = { now: 0, soon: 1, later: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 6);
}

export function computeRisk(args: {
  course: Course;
  enrollment?: Enrollment;
  engagement: EngagementMetrics;
  prediction: GradePrediction;
  completion: CompletionEstimate;
  mastery: TopicStatus[];
  events: ActivityEvent[];
  userId: string;
  now: number;
}): { needsSupport: boolean; factors: RiskFactor[] } {
  const { course, enrollment, engagement, prediction, completion, mastery, events, userId, now } = args;
  const factors: RiskFactor[] = [];
  if (enrollment?.certificateIssuedAt) return { needsSupport: false, factors };

  const last = events
    .filter((e) => e.userId === userId && e.type !== 'login')
    .reduce((m, e) => Math.max(m, Date.parse(e.at)), 0);
  const idleDays = last ? Math.floor((now - last) / DAY_MS) : null;
  if (idleDays === null) factors.push({ label: 'Has not started studying yet', severity: 'medium', advice: 'Send a welcome message with the first lesson and a 20-minute starting goal.' });
  else if (idleDays >= 5) factors.push({ label: `No study for ${idleDays} days`, severity: 'high', advice: 'Reach out personally and point to one short next step to restart momentum.' });
  else if (idleDays >= 3) factors.push({ label: `No study for ${idleDays} days`, severity: 'medium', advice: 'Send a short nudge with the next lesson and its time estimate.' });

  if (engagement.loginDaysLast7 <= 1)
    factors.push({ label: engagement.loginDaysLast7 === 0 ? 'Not signed in this week' : `Signed in only ${engagement.loginDaysLast7} ${engagement.loginDaysLast7 === 1 ? 'day' : 'days'} this week`, severity: engagement.loginDaysLast7 === 0 ? 'high' : 'medium', advice: 'Suggest a fixed weekly study time that matches their goal.' });

  if (engagement.avgSessionMinutes > 0 && engagement.avgSessionMinutes < 10)
    factors.push({ label: `Short study sessions (${engagement.avgSessionMinutes} min)`, severity: 'medium', advice: 'Recommend one uninterrupted 20 to 30 minute block so a whole lesson step fits in one session.' });

  if (prediction.evidence !== 'solid') {
    /* too little graded work: a pass-chance judgment would look more certain than it is */
  } else if (prediction.passConfidence < 60) factors.push({ label: `Low chance of passing (${prediction.passConfidence}%)`, severity: 'high', advice: 'Review their weakest topics with them and write Guidance on what to retake first.' });
  else if (prediction.passConfidence < 70) factors.push({ label: `Low chance of passing (${prediction.passConfidence}%)`, severity: 'medium', advice: 'Point them to the lowest-scoring topic and its check retake.' });

  for (const f of flattenLessons(course)) {
    const p = progressOf(enrollment, f.lesson.id);
    if (p.status === 'in_progress' && p.startedAt && now - Date.parse(p.startedAt) > 5 * DAY_MS) {
      factors.push({
        label: `Stalled on "${f.lesson.title}" for ${Math.floor((now - Date.parse(p.startedAt)) / DAY_MS)} days`,
        severity: 'medium',
        advice: 'Ask what is blocking them on this lesson; offer help in Questions.',
      });
      break;
    }
  }

  const weak = mastery.filter((m) => m.bestCheck !== null && m.score < 60);
  if (weak.length >= 2) factors.push({ label: `${weak.length} topics below 60% on knowledge checks`, severity: 'medium', advice: 'Suggest re-reading those lessons and retaking their checks before moving on.' });
  else if (weak.length === 1) factors.push({ label: `Weak topic: ${weak[0].topic} (${weak[0].score}%)`, severity: 'low', advice: `Suggest a review of "${weak[0].topic}" and a check retake.` });

  const lowApplied = flattenLessons(course).filter((f) => {
    const p = progressOf(enrollment, f.lesson.id);
    const r = p.activity ? activityRubric(p) : undefined;
    return !!r && r.percent < 60;
  }).length;
  if (lowApplied >= 2)
    factors.push({ label: `${lowApplied} applied activities below 60% on the rubric`, severity: 'medium', advice: 'Go through the rubric with them on their lowest activity and request a resubmission.' });

  if (enrollment?.targetDate && completion.estimatedDate && completion.estimatedDate > enrollment.targetDate)
    factors.push({ label: 'May miss their target date', severity: 'medium', advice: 'Agree a realistic new date or more study days per week.' });

  const high = factors.filter((f) => f.severity === 'high').length;
  const med = factors.filter((f) => f.severity === 'medium').length;
  return { needsSupport: high > 0 || med >= 2, factors };
}

/* ------------------------------------------------------------------ */
/* Snapshot                                                            */
/* ------------------------------------------------------------------ */

export function isEligibleForFinal(course: Course, enrollment?: Enrollment): boolean {
  return flattenLessons(course).every((f) => progressOf(enrollment, f.lesson.id).status === 'done');
}

export function buildSnapshot(args: {
  course: Course;
  enrollment?: Enrollment;
  userId: string;
  goal?: LearningGoal;
  events: ActivityEvent[];
  threads: Thread[];
  now: number;
}): LearnerSnapshot {
  const { course, enrollment, userId, goal, events, threads, now } = args;
  const flat = flattenLessons(course);
  const metrics = computeLearningMetrics(course, enrollment);
  // Topic scores reuse the objective-level Comprehension once the metric is shown, so the numbers always agree.
  const objComp = new Map(metrics.objectives.map((o) => [o.objectiveId, metrics.comprehension === null ? null : o.comprehension]));
  const mastery = flat.map((f) => lessonTopicStatus(f, progressOf(enrollment, f.lesson.id), now, objComp.get(f.lesson.id)));
  const engagement = computeEngagement({ userId, courseId: course.id, events, enrollment, now });
  const prediction = computePrediction(course, enrollment, mastery, engagement.engagementScore);
  const completion = computeCompletion(course, enrollment, engagement, goal, now);
  const nextStep = computeNextStep({ course, enrollment, mastery, threads, userId, now });
  const recommendations = computeRecommendations({ course, enrollment, mastery, engagement, prediction, now });
  const risk = computeRisk({ course, enrollment, engagement, prediction, completion, mastery, events, userId, now });
  const weakAreas = mastery.filter((m) => m.bestCheck !== null && m.score < 70).sort((a, b) => a.score - b.score);
  return {
    courseId: course.id,
    engagement,
    prediction,
    completion,
    topics: mastery,
    weakAreas,
    metrics,
    recommendations,
    nextStep,
    risk,
    eligibleForFinal: isEligibleForFinal(course, enrollment),
    credentialEarned: !!enrollment?.certificateIssuedAt,
  };
}
