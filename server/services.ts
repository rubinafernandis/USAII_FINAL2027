import type {
  ActivityEventType,
  ContentBlock,
  Course,
  CourseModule,
  Enrollment,
  Lesson,
  Notification,
  QuestionKind,
  Role,
  RubricCriterion,
  RubricDocument,
  UserRecord,
} from '../shared/types';
import { INSTRUCTION_BLOCK_TYPES } from '../shared/types';
import {
  buildSnapshot,
  computePrediction,
  dateKey,
  flattenLessons,
  isEligibleForFinal,
  lessonTopicStatus,
  progressOf,
} from '../shared/analytics';
import { db, nowIso, save, uid } from './db';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};

export const isStaff = (role: Role) => role === 'instructor';

export function getCourse(id: string): Course {
  return db().courses.find((c) => c.id === id) ?? fail(404, 'Course not found.');
}

export function getEnrollment(userId: string, courseId: string): Enrollment | undefined {
  return db().enrollments.find((e) => e.userId === userId && e.courseId === courseId);
}

export function requireEnrollment(userId: string, courseId: string): Enrollment {
  return getEnrollment(userId, courseId) ?? fail(403, 'You are not enrolled in this course.');
}

export function findLesson(course: Course, lessonId: string): Lesson {
  return flattenLessons(course).find((f) => f.lesson.id === lessonId)?.lesson ?? fail(404, 'Lesson not found.');
}

/** Remove answer keys before sending course content to learners. */
export function sanitizeCourse(course: Course): Course {
  const strip = (qs: Lesson['check']) => qs.map((q) => ({ ...q, correctIndex: -1, rationale: '' }));
  return {
    ...course,
    modules: course.modules.map((m) => ({
      ...m,
      lessons: m.lessons.map((l) => ({ ...l, check: strip(l.check) })),
    })),
    finalExam: course.finalExam ? { ...course.finalExam, questions: strip(course.finalExam.questions) } : undefined,
  };
}

export function snapshotFor(user: UserRecord, course: Course, now = Date.now()) {
  const d = db();
  return buildSnapshot({
    course,
    enrollment: getEnrollment(user.id, course.id),
    userId: user.id,
    goal: user.goal,
    events: d.events,
    threads: d.threads,
    now,
  });
}

export function recordEvent(userId: string, type: ActivityEventType, courseId?: string, seconds?: number) {
  const d = db();
  const now = Date.now();
  if (type === 'study' && seconds) {
    // Merge consecutive heartbeats into one event (keeps the log compact).
    for (let i = d.events.length - 1; i >= Math.max(0, d.events.length - 60); i--) {
      const e = d.events[i];
      if (e.userId === userId && e.type === 'study' && e.courseId === courseId) {
        if (now - Date.parse(e.at) < 120_000 && (e.seconds ?? 0) < 900 && dateKey(e.at) === dateKey(now)) {
          e.seconds = (e.seconds ?? 0) + seconds;
          e.at = new Date(now).toISOString();
          save();
          return;
        }
        break;
      }
    }
  }
  d.events.push({ id: uid('ev'), userId, courseId, type, at: new Date(now).toISOString(), seconds });
  save();
}

export function notify(userId: string, n: Omit<Notification, 'id' | 'userId' | 'createdAt' | 'read'>) {
  const d = db();
  if (n.key && d.notifications.some((x) => x.userId === userId && x.key === n.key)) return;
  d.notifications.unshift({ id: uid('nt'), userId, createdAt: nowIso(), read: false, ...n });
  if (d.notifications.length > 2000) d.notifications.length = 2000;
  save();
}

export function notifyStaff(n: Omit<Notification, 'id' | 'userId' | 'createdAt' | 'read'>) {
  for (const u of db().users.filter((x) => isStaff(x.role) && x.active)) notify(u.id, { ...n, key: n.key ? `${n.key}-${u.id}` : undefined });
}

/** Notify the instructor who owns this course (or every instructor if that account is inactive). */
export function notifyCourseStaff(course: Course, n: Omit<Notification, 'id' | 'userId' | 'createdAt' | 'read'>) {
  const owner = db().users.find((u) => u.active && u.id === course.createdBy);
  const targets = owner ? [owner] : db().users.filter((u) => u.active && u.role === 'instructor');
  const list = targets.length ? targets : db().users.filter((u) => u.active && isStaff(u.role));
  for (const u of list) notify(u.id, { ...n, key: n.key ? `${n.key}-${u.id}` : undefined });
}

export function audit(actor: UserRecord, action: string, details: string) {
  const d = db();
  d.audit.unshift({ id: uid('au'), at: nowIso(), actorId: actor.id, actorName: actor.name, role: actor.role, action, details });
  if (d.audit.length > 1000) d.audit.length = 1000;
  save();
}

/** Issue a credential once every requirement is met. Returns true if newly issued. */
export function maybeIssueCredential(user: UserRecord, course: Course): boolean {
  const enr = getEnrollment(user.id, course.id);
  if (!enr || enr.certificateIssuedAt) return false;
  if (!isEligibleForFinal(course, enr)) return false;
  const hasFinal = !!course.finalExam && course.finalExam.questions.length > 0;
  if (hasFinal && !(enr.finalExam?.attempts ?? []).some((a) => a.score >= course.passMark)) return false;
  const now = Date.now();
  const topics = flattenLessons(course).map((f) => lessonTopicStatus(f, progressOf(enr, f.lesson.id), now));
  const pred = computePrediction(course, enr, topics, 100);
  if ((pred.currentGrade ?? 0) < course.passMark) return false;
  enr.certificateIssuedAt = nowIso();
  enr.certificateId = `USAII-${course.id.replace('course-', '').toUpperCase().slice(0, 8)}-${uid('c').slice(2, 10).toUpperCase()}`;
  notify(user.id, {
    kind: 'credential',
    title: 'You earned your credential! 🎉',
    body: `${course.credentialName} is ready to download and share.`,
    link: { view: 'credential', courseId: course.id },
  });
  audit(user, 'CREDENTIAL_ISSUED', `${course.credentialName} issued (${enr.certificateId}).`);
  save();
  return true;
}

/** Timely, personalized learning nudges (generated at most once per day per topic). */
/** Instructors hear about learners who start to fall behind, at most once a week each. */
function generateStaffAlerts(staff: UserRecord) {
  const d = db();
  const now = Date.now();
  const week = Math.floor(now / (7 * 86_400_000));
  const courses = d.courses.filter((c) => c.status === 'published' && c.createdBy === staff.id);
  let created = 0;
  for (const course of courses) {
    for (const enr of d.enrollments.filter((e) => e.courseId === course.id && !e.certificateIssuedAt)) {
      if (created >= 3) return;
      const learner = d.users.find((u) => u.id === enr.userId && u.role === 'learner' && u.active);
      if (!learner) continue;
      const snap = snapshotFor(learner, course, now);
      if (!snap.risk.needsSupport) continue;
      const before = d.notifications.length;
      notify(staff.id, {
        kind: 'nudge',
        key: `risk-${learner.id}-${course.id}-${week}`,
        title: `${learner.name} may need support`,
        body: `${course.title}: ${snap.risk.factors.slice(0, 2).map((f) => f.label).join(', ')}.`,
        link: { view: 'cohort', courseId: course.id },
      });
      if (d.notifications.length > before) created += 1;
    }
  }
}

export function generateNudges(user: UserRecord) {
  if (user.role !== 'learner') return generateStaffAlerts(user);
  const d = db();
  const now = Date.now();
  const today = dateKey(now);
  let created = 0;
  const push = (n: Omit<Notification, 'id' | 'userId' | 'createdAt' | 'read'>) => {
    if (created >= 3) return;
    const before = d.notifications.length;
    notify(user.id, n);
    if (d.notifications.length > before) created += 1;
  };

  for (const enr of d.enrollments.filter((e) => e.userId === user.id)) {
    const course = d.courses.find((c) => c.id === enr.courseId);
    if (!course || course.status !== 'published' || enr.certificateIssuedAt) continue;
    const snap = snapshotFor(user, course, now);
    const lastStudy = d.events
      .filter((e) => e.userId === user.id && e.type === 'study' && e.courseId === course.id)
      .reduce((m, e) => Math.max(m, Date.parse(e.at)), 0);
    if (lastStudy && now - lastStudy > 2 * 86_400_000) {
      push({
        key: `idle-${course.id}-${today}`,
        kind: 'nudge',
        title: `Pick up where you left off in ${course.title}`,
        body: `${snap.nextStep.title} · about ${snap.nextStep.minutes} min.`,
        link: { view: 'dashboard', courseId: course.id },
      });
    }
    const due = snap.topics.find((m) => m.reviewDue);
    if (due)
      push({
        key: `review-${due.lessonId}-${today}`,
        kind: 'nudge',
        title: `Memory boost due: ${due.topic}`,
        body: 'A 3-minute review now helps this stick for the long term.',
        link: { view: 'study', courseId: course.id, lessonId: due.lessonId },
      });
    if (enr.targetDate && snap.completion.estimatedDate && snap.completion.estimatedDate > enr.targetDate)
      push({
        key: `pace-${course.id}-${today}`,
        kind: 'nudge',
        title: 'You are a little behind your target date',
        body: `At your current pace you will finish on ${snap.completion.estimatedDate}. Open the what-if planner to see what closes the gap.`,
        link: { view: 'progress', courseId: course.id },
      });
    if (snap.eligibleForFinal && course.finalExam && !snap.credentialEarned)
      push({
        key: `final-${course.id}`,
        kind: 'nudge',
        title: 'Your final assessment is unlocked',
        body: `All lessons are complete in ${course.title}.`,
        link: { view: 'dashboard', courseId: course.id },
      });
  }
}

/* ------------------------------------------------------------------ */
/* Course validation (course builder)                                  */
/* ------------------------------------------------------------------ */

const BLOCK_TYPES = new Set(['heading', 'paragraph', 'text', 'video', 'audio', 'image', 'quote', 'list', 'link']);
const str = (v: unknown, max = 20000) => (typeof v === 'string' ? v.slice(0, max) : '');
const num = (v: unknown, lo: number, hi: number, dflt: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : dflt;
};
const safeUrl = (v: unknown) => {
  const s = str(v, 2000).trim();
  if (!s) return '';
  if (s.startsWith('/uploads/')) return s;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
};

const cleanKind = (v: unknown): QuestionKind => (v === 'scenario' ? 'scenario' : 'knowledge');

/** Rubric criteria: a label is required; ids stay stable so earlier scores keep their meaning. */
function cleanRubric(v: unknown): RubricCriterion[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const seen = new Set<string>();
  const out = v
    .map((c: any) => {
      let id = str(c?.id, 60) || uid('rc');
      if (seen.has(id)) id = uid('rc');
      seen.add(id);
      return { id, label: str(c?.label, 300).trim(), description: str(c?.description, 1000).trim() || undefined };
    })
    .filter((c) => c.label)
    .slice(0, 10);
  return out.length ? out : undefined;
}

/** Activity instructions: written content and images only (no video or audio players inside instructions). */
const INSTRUCTION_TYPES = new Set<string>(INSTRUCTION_BLOCK_TYPES);
function cleanInstructionBlocks(v: unknown): ContentBlock[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .slice(0, 60)
    .filter((b: any) => b && INSTRUCTION_TYPES.has(b.type))
    .map(cleanBlock)
    .filter((b): b is ContentBlock => !!b)
    .filter((b) => (b.type === 'image' || b.type === 'link' ? !!b.url : b.type === 'list' ? !!b.items?.length : !!b.text?.trim()));
  return out.length ? out : undefined;
}

/** The rubric PDF: an uploaded .pdf (or an https link) and the total points it awards. */
function cleanRubricPdf(v: any): RubricDocument | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const url = safeUrl(v.url);
  if (!url) return undefined;
  if (url.startsWith('/uploads/') && !/\.pdf$/i.test(url)) fail(400, 'The rubric must be a PDF file.');
  const maxPoints = Number(v.maxPoints);
  if (!Number.isFinite(maxPoints) || maxPoints < 1 || maxPoints > 1000) fail(400, 'Enter the rubric total points (1 to 1000).');
  return { url, name: str(v.name, 200).trim() || 'Rubric.pdf', maxPoints: Math.round(maxPoints * 2) / 2 };
}

function cleanBlock(b: any): ContentBlock | null {
  if (!b || !BLOCK_TYPES.has(b.type)) return null;
  const out: ContentBlock = { id: str(b.id, 60) || uid('b'), type: b.type };
  if (b.text !== undefined) out.text = str(b.text);
  if (b.type === 'heading') out.level = b.level === 3 ? 3 : 2;
  if (b.type === 'text') out.tone = b.tone === 'tip' ? 'tip' : 'info'; // no alarming warning boxes inside lessons
  if (['video', 'audio', 'image', 'link'].includes(b.type)) out.url = safeUrl(b.url);
  if (b.label !== undefined) out.label = str(b.label, 300);
  if (b.attribution !== undefined) out.attribution = str(b.attribution, 300);
  if (b.transcript !== undefined) out.transcript = str(b.transcript);
  if (b.type === 'list') {
    out.items = Array.isArray(b.items) ? b.items.map((i: unknown) => str(i, 1000)).filter(Boolean).slice(0, 100) : [];
    out.ordered = !!b.ordered;
  }
  return out;
}

export function validateCourse(input: any, existing: Course | undefined, actor: UserRecord): Course {
  const title = str(input?.title, 200).trim();
  if (!title) fail(400, 'Course title is required.');
  const modulesIn: any[] = Array.isArray(input.modules) ? input.modules.slice(0, 50) : [];
  const seen = new Set<string>();
  const modules: CourseModule[] = modulesIn.map((m, mi) => ({
    id: str(m?.id, 60) || uid('m'),
    title: str(m?.title, 200).trim() || `Module ${mi + 1}`,
    summary: str(m?.summary, 1000),
    lessons: (Array.isArray(m?.lessons) ? m.lessons.slice(0, 100) : []).map((l: any, li: number): Lesson => {
      let id = str(l?.id, 60) || uid('l');
      if (seen.has(id)) id = uid('l');
      seen.add(id);
      const check = (Array.isArray(l?.check) ? l.check.slice(0, 50) : [])
        .map((q: any) => {
          const options = (Array.isArray(q?.options) ? q.options : []).map((o: unknown) => str(o, 500).trim()).filter(Boolean).slice(0, 6);
          return {
            id: str(q?.id, 60) || uid('q'),
            question: str(q?.question, 1000).trim(),
            options,
            correctIndex: num(q?.correctIndex, 0, Math.max(0, options.length - 1), 0),
            rationale: str(q?.rationale, 2000),
            kind: cleanKind(q?.kind),
            // A lesson question always measures its own lesson's objective, so none is stored.
          };
        })
        .filter((q: any) => q.question && q.options.length >= 2);
      const act = l?.activity;
      return {
        id,
        title: str(l?.title, 200).trim() || `Lesson ${li + 1}`,
        topic: str(l?.topic, 200).trim() || str(l?.title, 200).trim() || `Topic ${li + 1}`,
        estimatedMinutes: num(l?.estimatedMinutes, 1, 600, 15),
        summary: str(l?.summary, 1000),
        blocks: (Array.isArray(l?.blocks) ? l.blocks.slice(0, 300) : []).map(cleanBlock).filter(Boolean) as ContentBlock[],
        check,
        checkSettings: {
          mode: l?.checkSettings?.mode === 'quiz' ? 'quiz' : 'practice',
          timeLimitMin: num(l?.checkSettings?.timeLimitMin, 0, 240, 0),
          attemptsAllowed: num(l?.checkSettings?.attemptsAllowed, 0, 10, 0),
        },
        activity:
          act && str(act.title, 200).trim()
            ? {
                title: str(act.title, 200).trim(),
                instructions: (Array.isArray(act.instructions) ? act.instructions : []).map((s: unknown) => str(s, 1000).trim()).filter(Boolean).slice(0, 30),
                instructionBlocks: cleanInstructionBlocks(act.instructionBlocks),
                fields: (Array.isArray(act.fields) ? act.fields : [])
                  .map((f: any) => ({ id: str(f?.id, 60) || uid('f'), label: str(f?.label, 300).trim(), hint: str(f?.hint, 300), multiline: !!f?.multiline, placeholder: str(f?.placeholder, 500) }))
                  .filter((f: any) => f.label)
                  .slice(0, 40),
                allowFile: !!act.allowFile,
                rubric: cleanRubric(act.rubric),
                rubricPdf: cleanRubricPdf(act.rubricPdf),
              }
            : undefined,
      };
    }),
  }));

  const g = input.grading ?? {};
  let grading = { checks: num(g.checks, 0, 100, 30), activities: num(g.activities, 0, 100, 10), finalExam: num(g.finalExam, 0, 100, 60) };
  const total = grading.checks + grading.activities + grading.finalExam;
  if (total !== 100) {
    if (total === 0) grading = { checks: 30, activities: 10, finalExam: 60 };
    else fail(400, `Grading weights must add up to 100% (currently ${total}%).`);
  }

  const lessonIds = new Set(modules.flatMap((m) => m.lessons.map((l) => l.id)));
  const fe = input.finalExam;
  const feQuestions = fe && Array.isArray(fe.questions) ? fe.questions : [];
  const finalExam = feQuestions.length
    ? {
        questions: feQuestions
          .slice(0, 200)
          .map((q: any) => {
            const options = (Array.isArray(q?.options) ? q.options : []).map((o: unknown) => str(o, 500).trim()).filter(Boolean).slice(0, 6);
            const objectiveId = str(q?.objectiveId, 60);
            return {
              id: str(q?.id, 60) || uid('q'),
              question: str(q?.question, 1000).trim(),
              options,
              correctIndex: num(q?.correctIndex, 0, Math.max(0, options.length - 1), 0),
              rationale: str(q?.rationale, 2000),
              kind: cleanKind(q?.kind),
              // Only a lesson that exists in this course can be the objective; anything else is course-wide.
              ...(objectiveId && lessonIds.has(objectiveId) ? { objectiveId } : {}),
            };
          })
          .filter((q: any) => q.question && q.options.length >= 2),
        timeLimitMin: num(fe.timeLimitMin, 0, 480, 30),
        attemptsAllowed: num(fe.attemptsAllowed, 0, 10, 2),
      }
    : undefined;

  const now = nowIso();
  // The instructor sets the price in Course details. A micro-credential costs less than $50.
  let price = existing?.price ?? 0;
  let priceSet = existing?.priceSet ?? false;
  if (input.priceSet !== false && input.price !== undefined && input.price !== null && input.price !== '') {
    const p = Number(input.price);
    if (!Number.isFinite(p) || p < 0) fail(400, 'Enter a course price of 0 or more.');
    if (p >= 50) fail(400, 'A micro-credential must cost less than $50.');
    price = p;
    priceSet = true;
  }
  return {
    id: existing?.id ?? uid('course'),
    title,
    subtitle: str(input.subtitle, 300),
    description: str(input.description, 5000),
    credentialName: str(input.credentialName, 200).trim() || `${title} Credential`,
    durationLabel: str(input.durationLabel, 100),
    level: str(input.level, 100) || 'Everyone',
    price: Math.round(price * 100) / 100,
    priceSet,
    access: input.access === 'invite' ? 'invite' : 'open',
    status: existing?.status ?? 'draft',
    accent: ['blue', 'purple', 'pink', 'green'].includes(input.accent) ? input.accent : 'blue',
    coverImage: safeUrl(input.coverImage) || undefined,
    // The study plan PDF learners download from Resources.
    studyPlan: input.studyPlan && safeUrl(input.studyPlan.url) ? { url: safeUrl(input.studyPlan.url), name: str(input.studyPlan.name, 200) || 'Study plan.pdf' } : undefined,
    passMark: num(input.passMark, 1, 100, 70),
    grading,
    modules,
    finalExam,
    createdBy: existing?.createdBy ?? actor.id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}
