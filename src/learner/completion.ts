import { flattenLessons, lessonRequirements, progressOf } from '../../shared/analytics';
import type { CourseItem } from './context';

/**
 * One definition of "what it takes to finish this course", shared by the
 * sidebar's Steps to Completion list and the Steps to Completion page, so the
 * two can never disagree. Every requirement mirrors the rules the server uses
 * to mark a lesson complete and to open the final assessment.
 */

export type StepStatus = 'done' | 'current' | 'started' | 'upcoming' | 'locked';

export interface Requirement {
  label: string;
  done: boolean;
  detail?: string;
  go?: string;
}

export interface Step {
  id: string;
  kind: 'lesson' | 'final';
  n: number;
  /** "Lesson 4", or "Final" */
  label: string;
  title: string;
  stageIndex: number;
  minutes: number;
  status: StepStatus;
  completedAt?: string;
  builds?: string | null;
  requirements: Requirement[];
  go: string | null;
}

export interface Stage {
  index: number;
  name: string;
  title: string;
  summary?: string;
  done: number;
  total: number;
}

export interface Completion {
  steps: Step[];
  stages: Stage[];
  total: number;
  done: number;
  current: Step | null;
  minutesLeft: number;
  finishDate: string | null;
  next: { label: string; go: string } | null;
  certificate: { name: string; earned: boolean; at?: string };
}

export function buildCompletion(item: CourseItem): Completion {
  const { course, enrollment, snapshot } = item;
  const flat = flattenLessons(course);
  const base = (id: string) => `study/${course.id}/${id}`;
  const nextLesson = snapshot.nextStep.action.kind === 'lesson' ? snapshot.nextStep.action.lessonId : undefined;

  const steps: Step[] = flat.map((f, i) => {
    const p = progressOf(enrollment, f.lesson.id);
    const req = lessonRequirements(f.lesson, p);
    const best = p.attempts.filter((a) => a.kind === 'check').reduce<number | null>((m, a) => (m === null || a.score > m ? a.score : m), null);
    const isQuiz = f.lesson.checkSettings.mode === 'quiz';
    const requirements: Requirement[] = [
      { label: 'Work through the lesson', done: p.status !== 'not_started', go: `${base(f.lesson.id)}?step=learn` },
      ...(req.needsCheck
        ? [{ label: isQuiz ? 'Take the quiz' : 'Take the knowledge check', done: req.checkDone, detail: best !== null ? `Best score ${best}%` : undefined, go: `${base(f.lesson.id)}?step=check` }]
        : []),
      ...(req.needsActivity ? [{ label: `Submit your activity: ${f.lesson.activity!.title}`, done: req.activityDone, go: `${base(f.lesson.id)}?step=apply` }] : []),
      { label: 'Mark the lesson complete', done: p.status === 'done', go: `${base(f.lesson.id)}?step=reflect` },
    ];
    return {
      id: f.lesson.id,
      kind: 'lesson',
      n: i + 1,
      label: `Lesson ${i + 1}`,
      title: f.lesson.title,
      stageIndex: course.modules.findIndex((m) => m.id === f.module.id),
      minutes: f.lesson.estimatedMinutes,
      status: p.status === 'done' ? 'done' : p.status === 'in_progress' ? 'started' : 'upcoming',
      completedAt: p.completedAt,
      builds: f.lesson.activity?.title ?? null,
      requirements,
      go: base(f.lesson.id),
    };
  });

  const hasFinal = !!course.finalExam?.questions.length;
  if (hasFinal) {
    const attempts = enrollment.finalExam?.attempts ?? [];
    const best = attempts.reduce<number | null>((m, a) => (m === null || a.score > m ? a.score : m), null);
    const passed = best !== null && best >= course.passMark;
    const left = steps.filter((s) => s.status !== 'done').length;
    const fe = course.finalExam!;
    steps.push({
      id: 'final',
      kind: 'final',
      n: flat.length + 1,
      label: 'Final',
      title: 'Final assessment',
      stageIndex: course.modules.length,
      minutes: fe.timeLimitMin || 30,
      status: passed ? 'done' : snapshot.eligibleForFinal ? 'upcoming' : 'locked',
      completedAt: passed ? attempts.find((a) => a.score >= course.passMark)?.at : undefined,
      requirements: [
        { label: `Complete lessons 1–${flat.length}`, done: snapshot.eligibleForFinal, detail: left ? `${left} to go` : undefined },
        {
          label: `Score ${course.passMark}% or higher`,
          done: passed,
          detail: [fe.timeLimitMin ? `${fe.timeLimitMin} minutes` : 'Untimed', fe.attemptsAllowed ? `${fe.attemptsAllowed} attempt${fe.attemptsAllowed === 1 ? '' : 's'}` : 'Unlimited attempts', best !== null ? `best so far ${best}%` : ''].filter(Boolean).join(' · '),
          go: snapshot.eligibleForFinal ? `final/${course.id}` : undefined,
        },
      ],
      go: snapshot.eligibleForFinal || passed ? `final/${course.id}` : null,
    });
  }

  // "You are here": the lesson the next-step engine points to, else the first unfinished step.
  let current = steps.find((s) => s.kind === 'lesson' && s.id === nextLesson && s.status !== 'done') ?? steps.find((s) => s.status !== 'done' && s.status !== 'locked') ?? null;
  if (current) current.status = 'current';

  const stages: Stage[] = course.modules.map((m, i) => {
    const own = steps.filter((s) => s.stageIndex === i);
    return { index: i, name: `Module ${i + 1}`, title: m.title, summary: m.summary, done: own.filter((s) => s.status === 'done').length, total: own.length };
  });
  if (hasFinal) {
    const fin = steps[steps.length - 1];
    stages.push({ index: course.modules.length, name: 'Finish', title: 'Earn your certificate', done: fin.status === 'done' ? 1 : 0, total: 1 });
  }

  const nextReq = current?.requirements.find((r) => !r.done && r.go);
  const minutesLeft = steps.filter((s) => s.status !== 'done').reduce((a, s) => a + s.minutes, 0);

  return {
    steps,
    stages,
    total: steps.length,
    done: steps.filter((s) => s.status === 'done').length,
    current,
    minutesLeft,
    finishDate: snapshot.completion.estimatedDate,
    next: current && nextReq?.go ? { label: `${current.label}: ${nextReq.label}`, go: nextReq.go } : null,
    certificate: { name: course.credentialName || 'USAII® Certificate of Completion', earned: snapshot.credentialEarned, at: enrollment.certificateIssuedAt },
  };
}
