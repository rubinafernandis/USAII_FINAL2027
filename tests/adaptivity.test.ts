/**
 * Adaptivity tests: five learner states run through the real analytics engine.
 * Checks differential response, determinism, limited-evidence handling, signal separation,
 * and that applied work is graded by rubric, never by submission alone.
 * Writes the walkthrough to tests/out/adaptivity.json for the review report.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const outDir = path.resolve('tests/out');
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'lms-adapt-')));

const { buildSnapshot, flattenLessons, emptyProgress } = await import('../shared/analytics');
const { buildItems } = await import('../shared/metrics');
const { buildUsaiiCourses } = await import('../server/content/usaiiCourses');
import type { ActivityEvent, Course, Enrollment, LearnerSnapshot } from '../shared/types';

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-07T12:00:00Z');
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

function course(): Course {
  const c = buildUsaiiCourses('u_i', iso(30))[0];
  c.status = 'published';
  // Every activity is rubric-scored out of 20, as an instructor would set up in 5.6.
  for (const m of c.modules) for (const l of m.lessons) if (l.activity) l.activity.rubricPdf = { url: '/uploads/rubric.pdf', name: 'rubric.pdf', maxPoints: 20 };
  return c;
}

/** One learner: which lessons are done, their check scores, rubric points, and study days. */
function learner(c: Course, spec: { done: number; check: (i: number) => number; rubric?: (i: number) => number | null; submitOnly?: boolean; studyDays: number[]; final?: number }) {
  const flat = flattenLessons(c);
  const lessons: Enrollment['lessons'] = {};
  flat.slice(0, spec.done).forEach((f, i) => {
    const p = emptyProgress();
    p.status = 'done';
    p.startedAt = iso(20 - i);
    p.completedAt = iso(19 - i);
    p.activeSeconds = 3000;
    const qs = f.lesson.check;
    if (qs.length) {
      const target = spec.check(i);
      const right = Math.round((target / 100) * qs.length);
      const answers = qs.map((q, k) => (k < right ? q.correctIndex : (q.correctIndex + 1) % q.options.length));
      p.attempts.push({ at: iso(19 - i), score: Math.round((right / qs.length) * 100), answers, kind: 'check', items: buildItems(qs, answers, () => f.lesson.id) });
    }
    if (f.lesson.activity) {
      const pts = spec.rubric?.(i) ?? null;
      p.activity = { fields: {}, submittedAt: iso(19 - i), review: 'approved' };
      if (pts !== null && !spec.submitOnly) p.activity.rubric = { scores: [], points: pts, maxPoints: 20, percent: Math.round((pts / 20) * 100), scoredBy: 'I', scoredAt: iso(18 - i) };
    }
    lessons[f.lesson.id] = p;
  });
  const enrollment: Enrollment = { id: 'e', userId: 'u', courseId: c.id, enrolledAt: iso(21), lessons };
  if (spec.final !== undefined) {
    const qs = c.finalExam!.questions;
    const right = Math.round((spec.final / 100) * qs.length);
    const answers = qs.map((q, k) => (k < right ? q.correctIndex : (q.correctIndex + 1) % q.options.length));
    enrollment.finalExam = { attempts: [{ at: iso(0.5), score: Math.round((right / qs.length) * 100), answers, kind: 'check', items: buildItems(qs, answers, (q) => q.objectiveId) }] };
  }
  const events: ActivityEvent[] = spec.studyDays.flatMap((d, i) => [
    { id: `l${i}`, userId: 'u', type: 'login' as const, at: iso(d) },
    { id: `s${i}`, userId: 'u', courseId: c.id, type: 'study' as const, at: iso(d), seconds: 1800 },
  ]);
  return { enrollment, events };
}

function snap(c: Course, l: ReturnType<typeof learner>): LearnerSnapshot {
  return buildSnapshot({ course: c, enrollment: l.enrollment, userId: 'u', goal: { statement: '', why: '', minutesPerDay: 30, daysPerWeek: 4 }, events: l.events, threads: [], now: NOW });
}

const c = course();
const personas = {
  'A. Strong comprehension, weak mastery': learner(c, { done: 6, check: () => 100, rubric: () => 6, studyDays: [0, 1, 2, 4, 5] }),
  'B. Behind pace but capable': learner(c, { done: 2, check: () => 100, rubric: () => 18, studyDays: [9, 12] }),
  'C. Weak on one objective': learner(c, { done: 6, check: (i) => (i === 2 ? 33 : 100), rubric: () => 17, studyDays: [0, 1, 3, 4] }),
  'D. Very little evidence (one quiz)': learner(c, { done: 1, check: () => 67, rubric: () => null, studyDays: [0] }),
  'E. High performer near the final': learner(c, { done: 10, check: () => 100, rubric: () => 19, studyDays: [0, 1, 2, 3, 4, 5] }),
};

const results = Object.fromEntries(Object.entries(personas).map(([k, l]) => [k, snap(c, l)]));

test('differential response: every persona gets a different next step or recommendation set', () => {
  const sigs = Object.values(results).map((s) => JSON.stringify([s.nextStep.title, s.recommendations.map((r) => r.id)]));
  assert.equal(new Set(sigs).size, sigs.length, 'two personas received identical guidance');
});

test('determinism: identical evidence always gives identical guidance', () => {
  for (const [k, l] of Object.entries(personas)) assert.deepEqual(snap(c, l), results[k], k);
});

test('applied work is graded by rubric score, not by submission alone (C19)', () => {
  const strong = snap(c, learner(c, { done: 6, check: () => 100, rubric: () => 20, studyDays: [0, 1, 2] }));
  const weak = snap(c, learner(c, { done: 6, check: () => 100, rubric: () => 4, studyDays: [0, 1, 2] }));
  const unscored = snap(c, learner(c, { done: 6, check: () => 100, rubric: () => 20, submitOnly: true, studyDays: [0, 1, 2] }));
  const part = (s: LearnerSnapshot) => s.prediction.breakdown.find((b) => b.label.startsWith('Applied'))!;
  assert.equal(part(strong).score, 100);
  assert.equal(part(weak).score, 20);
  assert.equal(part(unscored).score, null, 'submitted but unscored work must not count as 100%');
  assert.ok(strong.prediction.predictedGrade > weak.prediction.predictedGrade);
  assert.equal(unscored.metrics.mastery, null, 'mastery is never inferred from submission');
});

test('limited evidence: one quiz gives a wide, labelled early estimate (C4)', () => {
  const d = results['D. Very little evidence (one quiz)'].prediction;
  assert.equal(d.evidence, 'early');
  assert.ok(d.range.high - d.range.low >= 30, `range too narrow: ${d.range.low}-${d.range.high}`);
  assert.match(d.evidenceNote, /Early estimate/);
  const e = results['E. High performer near the final'].prediction;
  assert.ok(e.range.high - e.range.low < d.range.high - d.range.low, 'range must narrow with more evidence');
  assert.match(e.evidenceNote, /not a guarantee/);
});

test('signal separation: completion, comprehension, mastery and readiness differ (C12, C15)', () => {
  const a = results['A. Strong comprehension, weak mastery'];
  assert.ok(a.metrics.comprehension !== null && a.metrics.comprehension >= 90);
  assert.ok(a.metrics.mastery !== null && a.metrics.mastery < a.metrics.comprehension!, 'weak rubric scores must lower mastery');
  // Time spent and completion do not move mastery.
  const more = learner(c, { done: 6, check: () => 100, rubric: () => 6, studyDays: [0, 1, 2, 3, 4, 5, 6] });
  assert.equal(snap(c, more).metrics.mastery, a.metrics.mastery);
});

test('every recommendation states the issue, why it matters, and what to do (C7)', () => {
  for (const s of Object.values(results)) for (const r of s.recommendations) assert.ok(r.title && r.detail && r.why, r.id);
});

test('every risk signal carries a practical next step (C18)', () => {
  for (const s of Object.values(results)) for (const f of s.risk.factors) assert.ok(f.advice.length > 10, f.label);
});

test('edge cases: no enrollment, empty course, and zero scores do not crash or divide by zero', () => {
  const none = buildSnapshot({ course: c, enrollment: undefined, userId: 'x', events: [], threads: [], now: NOW });
  assert.equal(none.prediction.evidence, 'none');
  assert.ok(Number.isFinite(none.prediction.predictedGrade));
  const empty: Course = { ...c, modules: [], finalExam: undefined };
  assert.doesNotThrow(() => buildSnapshot({ course: empty, enrollment: undefined, userId: 'x', events: [], threads: [], now: NOW }));
  const zero = snap(c, learner(c, { done: 4, check: () => 0, rubric: () => 0, studyDays: [0] }));
  assert.ok(Number.isFinite(zero.prediction.predictedGrade) && zero.prediction.range.low >= 0);
  assert.equal(zero.metrics.mastery !== null ? zero.metrics.mastery < 30 : true, true);
});

test('write walkthrough for the report', () => {
  fs.mkdirSync(outDir, { recursive: true });
  const table = Object.fromEntries(
    Object.entries(results).map(([k, s]) => [
      k,
      {
        completion: s.completion.percent,
        comprehension: s.metrics.comprehension,
        mastery: s.metrics.mastery,
        predicted: s.prediction.predictedGrade,
        range: `${s.prediction.range.low}-${s.prediction.range.high}`,
        evidence: s.prediction.evidence,
        passConfidence: s.prediction.passConfidence,
        nextStep: s.nextStep.title,
        recommendations: s.recommendations.map((r) => r.title),
        risks: s.risk.factors.map((f) => `${f.label} -> ${f.advice}`),
      },
    ]),
  );
  fs.writeFileSync(path.join(outDir, 'adaptivity.json'), JSON.stringify(table, null, 2));
});
