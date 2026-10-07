// USAII Intuitive LMS: Comprehension and Mastery
//
// The two course-level learning metrics, exactly as recommended by Dr. Milton:
//
//   Comprehension: how well the learner understands the concepts, principles,
//   terminology, and appropriate choices covered in the micro-credential.
//     End-of-lesson knowledge checks ........ 45%
//     Scenario-based judgment questions ..... 25%
//     Final assessment, knowledge items ..... 30%
//
//   Mastery: how well the learner can apply those concepts in a realistic
//   workplace decision, task, or scenario.
//     Comprehension score ................... 30%
//     Applied learning-sprint activities .... 45%  (scored against a rubric)
//     Final scenario-based assessment ....... 25%
//
// Rules this module enforces:
// 1. Each metric is calculated per learning objective first (one lesson = one
//    objective), then rolled up as the plain mean of objectives, so an easy
//    topic with many questions cannot outweigh the others.
// 2. When an objective has no evidence of one kind yet (or the course was not
//    designed with it), that weight is shared by the evidence that does exist.
// 3. Only assessed evidence counts. Lessons opened, videos watched, time on a
//    page, logins, clicks, simply submitting an activity, and viewing the
//    Study Guide never raise either score.
// 4. Nothing is shown until the learner has completed at least two scored
//    checkpoints. Mastery also needs applied evidence (a rubric-scored
//    activity or final scenario items) and a measured Comprehension.
//
// Pure, deterministic functions: the server and the browser compute the same
// numbers from the same records.

import type {
  AttemptItem,
  CheckAttempt,
  CheckQuestion,
  Course,
  Enrollment,
  EvidenceKey,
  EvidencePart,
  LearningMetrics,
  Lesson,
  LessonActivity,
  LessonProgress,
  ObjectiveMetric,
  QuestionKind,
  RubricLevel,
  RubricResult,
} from './types';

/** Recommended weights (%). One place to change them if USAII revises the model. */
export const METRIC_WEIGHTS = {
  comprehension: { knowledgeChecks: 45, scenarioJudgment: 25, finalKnowledge: 30 },
  mastery: { comprehension: 30, appliedActivities: 45, finalScenario: 25 },
} as const;

/** Scored checkpoints needed before either percentage is shown. */
export const MIN_SCORED_CHECKPOINTS = 2;

/** The objective used for final assessment questions not tied to one lesson. */
export const COURSE_OBJECTIVE = '__course';

export const EVIDENCE_LABELS: Record<EvidenceKey, string> = {
  knowledgeChecks: 'End-of-lesson knowledge checks',
  scenarioJudgment: 'Scenario-based judgment questions',
  finalKnowledge: 'Final assessment, knowledge items',
  comprehension: 'Comprehension score',
  appliedActivities: 'Applied learning-sprint activities',
  finalScenario: 'Final scenario-based assessment',
};

/** The two-sentence explanations shown behind the information icon. */
export const METRIC_TEXT = {
  comprehension: {
    name: 'Comprehension',
    short: 'How well you understand the concepts.',
    info: 'Comprehension shows how well you understand the concepts, principles, terminology, and appropriate choices covered in this micro-credential. It comes from your end-of-lesson knowledge checks, scenario-based judgment questions, and the knowledge items on the final assessment.',
    pending: 'Not measured yet',
  },
  mastery: {
    name: 'Mastery',
    short: 'How well you can apply them in a practical work situation.',
    info: 'Mastery shows how well you can apply those concepts in a realistic workplace decision, task, or scenario. It comes from your applied activities, scored against clear criteria, and the scenario items on the final assessment, and it builds on your Comprehension.',
    pending: 'Building evidence',
  },
} as const;

export const RUBRIC_MAX: RubricLevel = 2;
export const RUBRIC_LEVELS: { level: RubricLevel; label: string }[] = [
  { level: 2, label: 'Met' },
  { level: 1, label: 'Partially met' },
  { level: 0, label: 'Not met' },
];
export const rubricLevelLabel = (l: RubricLevel) => RUBRIC_LEVELS.find((x) => x.level === l)?.label ?? '';

export const QUESTION_KIND_LABEL: Record<QuestionKind, string> = {
  knowledge: 'Knowledge',
  scenario: 'Scenario judgment',
};

export const questionKind = (q: Pick<CheckQuestion, 'kind'>): QuestionKind => (q.kind === 'scenario' ? 'scenario' : 'knowledge');

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const r = (n: number) => Math.round(n);

/** Weighted mean over the parts that have evidence; null when none do. */
function weighted(parts: [number | null | undefined, number][]): number | null {
  const have = parts.filter(([v, w]) => v !== null && v !== undefined && w > 0) as [number, number][];
  const wsum = have.reduce((a, [, w]) => a + w, 0);
  return wsum ? have.reduce((a, [v, w]) => a + v * w, 0) / wsum : null;
}

/** Percent correct per question kind, or null for a kind with no items. */
function byKind(items: AttemptItem[]): Record<QuestionKind, number | null> {
  const pctOf = (k: QuestionKind) => {
    const xs = items.filter((i) => i.kind === k);
    return xs.length ? (xs.filter((i) => i.correct).length / xs.length) * 100 : null;
  };
  return { knowledge: pctOf('knowledge'), scenario: pctOf('scenario') };
}

/** Per-question results for grading and for the metrics. */
export function buildItems(questions: CheckQuestion[], answers: number[], objectiveFor: (q: CheckQuestion) => string | undefined): AttemptItem[] {
  return questions.map((q, i) => ({ qid: q.id, kind: questionKind(q), objectiveId: objectiveFor(q), correct: answers[i] === q.correctIndex }));
}

/**
 * Per-question results of an attempt. Attempts recorded before 5.3 have no items;
 * they are rebuilt from the answers only when that reproduces the recorded score, otherwise null.
 */
function itemsOf(a: CheckAttempt, questions: CheckQuestion[], objectiveFor: (q: CheckQuestion) => string | undefined): AttemptItem[] | null {
  if (a.items?.length) return a.items;
  if (a.answers.length !== questions.length || !questions.length) return null;
  const items = buildItems(questions, a.answers, objectiveFor);
  // If the rebuilt result does not reproduce the recorded score, the questions changed since: do not guess.
  const rebuilt = Math.round((items.filter((i) => i.correct).length / items.length) * 100);
  return rebuilt === a.score ? items : null;
}

/** Graded lesson-check attempts only. Practice attempts after the last graded one ("review") never count. */
export const gradedAttempts = (p: LessonProgress) => p.attempts.filter((a) => a.kind === 'check');

/**
 * Knowledge-check evidence for one lesson. Lesson checks are open book with instant feedback,
 * so the first try (initial understanding) and the most recent try (current understanding)
 * count equally. A retake can raise the score, but memorizing the answer key cannot erase the first try.
 */
function lessonCheckEvidence(lesson: Lesson, p: LessonProgress): { knowledge: number | null; scenario: number | null } | null {
  const graded = gradedAttempts(p);
  if (!lesson.check.length || !graded.length) return null;
  const used = graded.length === 1 ? [graded[0]] : [graded[0], graded[graded.length - 1]];
  const k: number[] = [];
  const s: number[] = [];
  for (const a of used) {
    const items = itemsOf(a, lesson.check, () => lesson.id);
    if (!items) {
      k.push(a.score); // an older attempt whose questions changed: its overall score is knowledge evidence
      continue;
    }
    const b = byKind(items);
    if (b.knowledge !== null) k.push(b.knowledge);
    if (b.scenario !== null) s.push(b.scenario);
  }
  return { knowledge: mean(k), scenario: mean(s) };
}

/** True when an activity is rubric-scored: it has a rubric PDF (5.6+) or older typed criteria. */
export function hasRubric(act: LessonActivity | undefined): boolean {
  return !!act && (!!act.rubricPdf?.url || !!act.rubric?.length);
}

/** The rubric result that counts for an activity: the latest scored version. */
export function activityRubric(p: LessonProgress): RubricResult | undefined {
  return p.activity?.rubric ?? p.activity?.previous?.rubric;
}

export function computeLearningMetrics(course: Course, enrollment: Enrollment | undefined): LearningMetrics {
  const lessons = course.modules.flatMap((m) => m.lessons.map((l) => ({ lesson: l, moduleId: m.id })));
  const lessonIds = new Set(lessons.map((x) => x.lesson.id));
  const prog = (id: string): LessonProgress => enrollment?.lessons[id] ?? { status: 'not_started', activeSeconds: 0, attempts: [] };
  const finalObjective = (q: CheckQuestion) => (q.objectiveId && lessonIds.has(q.objectiveId) ? q.objectiveId : COURSE_OBJECTIVE);

  type Parts = Partial<Record<EvidenceKey, number | null>>;
  const parts = new Map<string, Parts>();
  const setPart = (obj: string, key: EvidenceKey, v: number | null) => {
    if (v === null) return;
    const cur = parts.get(obj) ?? {};
    cur[key] = v;
    parts.set(obj, cur);
  };

  let checkpoints = 0;
  let awaitingScore = 0;

  // Lessons: knowledge checks, scenario judgment, applied activities.
  for (const { lesson } of lessons) {
    const p = prog(lesson.id);
    const ev = lessonCheckEvidence(lesson, p);
    if (ev) {
      checkpoints += 1;
      setPart(lesson.id, 'knowledgeChecks', ev.knowledge);
      setPart(lesson.id, 'scenarioJudgment', ev.scenario);
    }
    if (lesson.activity && p.activity) {
      const rub = activityRubric(p);
      if (rub) {
        checkpoints += 1;
        setPart(lesson.id, 'appliedActivities', rub.percent);
      }
      if (hasRubric(lesson.activity) && !p.activity.rubric) awaitingScore += 1;
    }
  }

  // Final assessment: the most recent attempt, split by item type and learning objective.
  const fq = course.finalExam?.questions ?? [];
  const finals = enrollment?.finalExam?.attempts ?? [];
  if (fq.length && finals.length) {
    checkpoints += 1;
    const latest = finals[finals.length - 1];
    const items = itemsOf(latest, fq, finalObjective);
    if (items) {
      const groups = new Map<string, AttemptItem[]>();
      for (const it of items) {
        const obj = it.objectiveId && lessonIds.has(it.objectiveId) ? it.objectiveId : COURSE_OBJECTIVE;
        groups.set(obj, [...(groups.get(obj) ?? []), it]);
      }
      for (const [obj, its] of groups) {
        const b = byKind(its);
        setPart(obj, 'finalKnowledge', b.knowledge);
        setPart(obj, 'finalScenario', b.scenario);
      }
    } else {
      setPart(COURSE_OBJECTIVE, 'finalKnowledge', latest.score);
    }
  }

  const W = METRIC_WEIGHTS;
  const objectiveOrder = [...lessons.map((x) => x.lesson.id), COURSE_OBJECTIVE];
  const objectives: ObjectiveMetric[] = [];
  for (const id of objectiveOrder) {
    const pt = parts.get(id) ?? {};
    const comp = weighted([
      [pt.knowledgeChecks, W.comprehension.knowledgeChecks],
      [pt.scenarioJudgment, W.comprehension.scenarioJudgment],
      [pt.finalKnowledge, W.comprehension.finalKnowledge],
    ]);
    const applied = pt.appliedActivities !== undefined || pt.finalScenario !== undefined;
    const mast = applied
      ? weighted([
          [comp, W.mastery.comprehension],
          [pt.appliedActivities, W.mastery.appliedActivities],
          [pt.finalScenario, W.mastery.finalScenario],
        ])
      : null;
    const l = lessons.find((x) => x.lesson.id === id);
    if (id === COURSE_OBJECTIVE && comp === null && mast === null) continue; // only listed when the final has course-wide items
    objectives.push({
      objectiveId: id,
      title: l ? l.lesson.topic || l.lesson.title : 'Whole course (final assessment)',
      moduleId: l?.moduleId ?? null,
      comprehension: comp === null ? null : r(comp),
      mastery: mast === null ? null : r(mast),
      parts: Object.fromEntries(Object.entries({ ...pt, comprehension: comp }).map(([k, v]) => [k, v === null || v === undefined ? null : r(v)])),
    });
  }

  const enough = checkpoints >= MIN_SCORED_CHECKPOINTS;
  const compVals = objectives.map((o) => o.comprehension).filter((x): x is number => x !== null);
  const mastVals = objectives.map((o) => o.mastery).filter((x): x is number => x !== null);
  // The course value is the plain mean of the objective values instructors see, so every number can be traced.
  const comprehension = enough && compVals.length ? r(mean(compVals)!) : null;
  const mastery = enough && comprehension !== null && mastVals.length ? r(mean(mastVals)!) : null;

  const courseLevel = (key: EvidenceKey): EvidencePart => {
    const vals = objectives.map((o) => o.parts[key]).filter((x): x is number => x !== null && x !== undefined);
    const weight =
      key === 'comprehension' ? W.mastery.comprehension : (W.comprehension as Record<string, number>)[key] ?? (W.mastery as Record<string, number>)[key];
    return { key, label: EVIDENCE_LABELS[key], weight, score: vals.length ? r(mean(vals)!) : null, objectives: vals.length };
  };

  return {
    comprehension,
    mastery,
    scoredCheckpoints: checkpoints,
    checkpointsNeeded: MIN_SCORED_CHECKPOINTS,
    comprehensionParts: (['knowledgeChecks', 'scenarioJudgment', 'finalKnowledge'] as const).map(courseLevel),
    masteryParts: [{ ...courseLevel('comprehension'), score: comprehension }, courseLevel('appliedActivities'), courseLevel('finalScenario')],
    objectives,
    awaitingScore,
  };
}

/* ------------------------------------------------------------------ */
/* Assessment design: what the instructor entered, and what it means    */
/* ------------------------------------------------------------------ */

export interface DesignIssue {
  severity: 'warn' | 'info';
  text: string;
}

export interface AssessmentDesign {
  lessonKnowledge: number;
  lessonScenario: number;
  finalKnowledge: number;
  finalScenario: number;
  finalUnmapped: number;
  activities: number;
  activitiesWithRubric: number;
  lessonsWithoutCheck: number;
  issues: DesignIssue[];
}

/** Checks a course's assessment design against the Comprehension and Mastery model. */
export function assessmentDesign(course: Course): AssessmentDesign {
  const lessons = course.modules.flatMap((m) => m.lessons);
  const ids = new Set(lessons.map((l) => l.id));
  const lq = lessons.flatMap((l) => l.check);
  const fq = course.finalExam?.questions ?? [];
  const acts = lessons.filter((l) => l.activity);
  const d: AssessmentDesign = {
    lessonKnowledge: lq.filter((q) => questionKind(q) === 'knowledge').length,
    lessonScenario: lq.filter((q) => questionKind(q) === 'scenario').length,
    finalKnowledge: fq.filter((q) => questionKind(q) === 'knowledge').length,
    finalScenario: fq.filter((q) => questionKind(q) === 'scenario').length,
    finalUnmapped: fq.filter((q) => !q.objectiveId || !ids.has(q.objectiveId)).length,
    activities: acts.length,
    activitiesWithRubric: acts.filter((l) => hasRubric(l.activity)).length,
    lessonsWithoutCheck: lessons.filter((l) => !l.check.length).length,
    issues: [],
  };
  const add = (severity: DesignIssue['severity'], text: string) => d.issues.push({ severity, text });
  if (!lessons.length) return d;
  if (!lq.length) add('warn', 'No lesson has a knowledge check, so the knowledge-check evidence (45% of Comprehension) is missing.');
  else if (d.lessonsWithoutCheck) add('info', `${d.lessonsWithoutCheck} ${d.lessonsWithoutCheck === 1 ? 'lesson has' : 'lessons have'} no knowledge check. Three to five questions after each lesson are recommended.`);
  if (lq.length && !d.lessonScenario) add('warn', 'No lesson question is tagged Scenario judgment, so that 25% of Comprehension is shared by the other evidence.');
  if (!d.activities) add('warn', 'No lesson has an applied activity, so the activity evidence (45% of Mastery) is missing.');
  else if (d.activitiesWithRubric < d.activities)
    add('warn', `${d.activities - d.activitiesWithRubric} of ${d.activities} activities have no rubric PDF. Those activities count toward progress only, not Mastery.`);
  if (!fq.length) add('info', 'There is no final assessment, so the final knowledge and final scenario evidence are missing.');
  else {
    if (!d.finalScenario) add('warn', 'No final assessment question is tagged Scenario judgment, so the final scenario evidence (25% of Mastery) is missing.');
    if (!d.finalKnowledge) add('warn', 'No final assessment question is tagged Knowledge, so the final knowledge evidence (30% of Comprehension) is missing.');
    if (d.finalUnmapped) add('info', `${d.finalUnmapped} final ${d.finalUnmapped === 1 ? 'question is' : 'questions are'} not linked to a lesson objective. ${d.finalUnmapped === 1 ? 'It counts' : 'They count'} as one course-wide objective.`);
  }
  return d;
}
