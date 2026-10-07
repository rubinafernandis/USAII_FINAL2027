import { motion } from 'motion/react';
import { Award, BookOpen, CheckCircle2, ChevronDown, Circle, Clock, Eye, FileCheck2, FileText, Film, Headphones, Link2, Lock, PlayCircle } from 'lucide-react';
import { useState } from 'react';
import { flattenLessons, progressOf } from '../../shared/analytics';
import type { Course } from '../../shared/types';
import { fmtMinutes } from '../lib/format';
import { Button, Card, cx, Empty, navigate, PageHeader, Pill } from '../components/ui';
import { CourseSwitcher } from './Dashboard';
import { useLearner, type CourseItem } from './context';
import LearningMetrics from './LearningMetrics';
import DocPanel from './DocPanel';
import StudyGuideViewer from './StudyGuideViewer';
import { track } from './track';

function Overview({ item }: { item: CourseItem }) {
  const { readOnly } = useLearner();
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState(false);
  const c = item.course;
  const g = c.grading;
  const totalMin = flattenLessons(c).reduce((a, f) => a + f.lesson.estimatedMinutes, 0);
  return (
    <Card>
      <button className="flex w-full items-center justify-between gap-3 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div>
          <h2 className="text-xl font-bold">{c.title}</h2>
          <p className="text-sm text-ink-soft">{c.subtitle}</p>
        </div>
        <ChevronDown className={cx('h-5 w-5 shrink-0 text-ink-faint transition', open && 'rotate-180')} />
      </button>
      <div className="mt-4 flex flex-wrap gap-2">
        <Pill color="blue">
          <Clock className="h-3 w-3" /> {c.durationLabel || fmtMinutes(totalMin)}
        </Pill>
        <Pill color="purple">
          <BookOpen className="h-3 w-3" /> {c.modules.length} modules, {flattenLessons(c).length} lessons
        </Pill>
        <Pill color="green">
          <Award className="h-3 w-3" /> {c.credentialName}
        </Pill>
        <Pill color="gray">Pass mark {c.passMark}%</Pill>
      </div>
      <LearningMetrics metrics={item.snapshot.metrics} compact className="mt-4" />
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5 grid gap-5 border-t border-line pt-5 md:grid-cols-2">
          <div>
            <h3 className="mb-1 text-sm font-bold">About this course</h3>
            <p className="whitespace-pre-line text-sm text-ink-soft">{c.description}</p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold">How your grade works</h3>
            {[
              ['Check Your Understanding and quizzes', g.checks, '#1F6BFF'],
              ['Applied activities', g.activities, '#00C77F'],
              ['Final assessment', c.finalExam?.questions.length ? g.finalExam : 0, '#8B3DFF'],
            ]
              .filter(([, w]) => (w as number) > 0)
              .map(([l, w, col]) => (
                <div key={l as string} className="mb-2">
                  <div className="flex justify-between text-sm">
                    <span>{l}</span>
                    <span className="font-semibold">{w}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-mist">
                    <div className="h-2 rounded-full" style={{ width: `${w}%`, background: col as string }} />
                  </div>
                </div>
              ))}
            <p className="mt-3 text-xs text-ink-faint">Checks and quizzes are open book. Timed quizzes show the answer key after you submit.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" icon={<Eye className="h-4 w-4" />} onClick={() => setGuide(true)}>
                View Study Guide
              </Button>
              <span className="self-center text-xs text-ink-faint">You can download it as a PDF from the viewer.</span>
            </div>
          </div>
        </motion.div>
      )}
      <StudyGuideViewer item={item} open={guide} onClose={() => setGuide(false)} readOnly={readOnly} />
    </Card>
  );
}

function Resources({ item }: { item: CourseItem }) {
  const { readOnly } = useLearner();
  const course = item.course;
  const [guide, setGuide] = useState(false);
  const [plan, setPlan] = useState(false);
  const planUrl = course.studyPlan?.url;
  const items = flattenLessons(course).flatMap((f) =>
    f.lesson.blocks
      .filter((b) => b.url && (b.type === 'link' || b.type === 'video' || b.type === 'audio'))
      .map((b) => ({ id: b.id, type: b.type, label: b.label || b.url!, url: b.url!, lesson: f.lesson.title, lessonId: f.lesson.id })),
  );
  const icon = { link: Link2, video: Film, audio: Headphones } as const;
  return (
    <Card>
      <h3 className="text-lg font-bold">Resources</h3>
      <p className="text-sm text-ink-soft">Everything you may want to keep for later.</p>
      <div className="mt-4 space-y-2">
        {planUrl && (
          <button
            type="button"
            onClick={() => {
              setPlan(true);
              if (!readOnly) track(course.id, 'plan_view');
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-line p-3 text-left transition hover:border-npurple/40 hover:bg-npurple-soft/40"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-npurple-soft text-npurple">
              <Eye className="h-4 w-4" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">View Study Plan</span>
              <span className="block text-xs text-ink-faint">From your instructor: how this course is paced, week by week. Download it as a PDF from the viewer.</span>
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setGuide(true)}
          className="flex w-full items-center gap-3 rounded-2xl border border-line p-3 text-left transition hover:border-nblue/40 hover:bg-nblue-soft/40"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-nblue-soft text-nblue">
            <Eye className="h-4 w-4" />
          </span>
          <span className="flex-1">
            <span className="block font-semibold">View Study Guide</span>
            <span className="block text-xs text-ink-faint">The whole course, right here. Download it as a PDF from the viewer to keep, print, or read offline.</span>
          </span>
        </button>
        {items.map((r) => {
          const Icon = icon[r.type as keyof typeof icon];
          const external = r.type === 'link';
          return (
            <a
              key={r.id}
              href={external ? r.url : `#/study/${course.id}/${r.lessonId}`}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              className="flex items-center gap-3 rounded-2xl border border-line p-3 transition hover:border-npurple/40 hover:bg-npurple-soft/30"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-npurple-soft text-npurple">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.label}</span>
                <span className="block truncate text-xs text-ink-faint">From: {r.lesson}</span>
              </span>
            </a>
          );
        })}
      </div>
      <StudyGuideViewer item={item} open={guide} onClose={() => setGuide(false)} readOnly={readOnly} />
      {planUrl && (
        <DocPanel open={plan} onClose={() => setPlan(false)} title="Study Plan" subtitle={course.title} icon={<FileText className="h-5 w-5" />} downloadHref={planUrl} downloadName={`${course.title.replace(/\W+/g, '-')}-study-plan.pdf`} openHref={planUrl}>
          <iframe src={planUrl} title={`Study Plan: ${course.title}`} className="h-full min-h-[70vh] w-full border-0" />
        </DocPanel>
      )}
    </Card>
  );
}

export default function Learning() {
  const { home, active, readOnly } = useLearner();
  if (!active)
    return <Empty icon={<BookOpen className="h-6 w-6" />} title="No courses yet" text="Find a course to begin." action={<Button onClick={() => navigate('explore')}>Explore courses</Button>} />;
  const { course, enrollment, snapshot } = active;
  const nextLessonId = snapshot.nextStep.action.lessonId;
  const hasFinal = !!course.finalExam?.questions.length;
  const finalAttempts = enrollment.finalExam?.attempts ?? [];
  const passedFinal = finalAttempts.some((a) => a.score >= course.passMark);
  return (
    <div>
      <PageHeader
        title="My Learning"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex max-w-[280px] items-center gap-1.5 rounded-full border border-npurple/30 bg-npurple-soft/60 px-3.5 py-1.5 text-[13px] font-bold text-npurple">
              <BookOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{course.title}</span>
            </span>
            {home.items.length > 1 && <CourseSwitcher />}
          </div>
        }
      />
      <div className="space-y-5">
        <Overview item={active} />
        {course.modules.map((m, mi) => {
          const done = m.lessons.filter((l) => progressOf(enrollment, l.id).status === 'done').length;
          return (
            <Card key={m.id} className="!p-0 overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-mist/50 px-5 py-4">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-npurple">Module {mi + 1}</div>
                  <h3 className="text-lg font-bold">{m.title}</h3>
                  {m.summary && <p className="text-sm text-ink-soft">{m.summary}</p>}
                </div>
                <div className="text-right text-sm">
                  <div className="font-display font-bold">
                    {done}/{m.lessons.length}
                  </div>
                  <div className="text-xs text-ink-faint">lessons done</div>
                </div>
              </div>
              <ol>
                {m.lessons.map((l, li) => {
                  const p = progressOf(enrollment, l.id);
                  const isNext = l.id === nextLessonId;
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        disabled={readOnly}
                        onClick={() => navigate(`study/${course.id}/${l.id}`)}
                        className={cx('group flex w-full items-center gap-4 border-b border-line/70 px-5 py-4 text-left transition last:border-0 enabled:hover:bg-nblue-soft/30', isNext && 'bg-gradient-to-r from-nblue-soft/70 to-transparent')}
                      >
                        <span className="shrink-0">
                          {p.status === 'done' ? (
                            <CheckCircle2 className="h-6 w-6 text-ngreen" />
                          ) : p.status === 'in_progress' ? (
                            <PlayCircle className="h-6 w-6 text-nblue" />
                          ) : (
                            <Circle className="h-6 w-6 text-line" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-ink-faint">
                              {mi + 1}.{li + 1}
                            </span>
                            <span className="font-semibold">{l.title}</span>
                            {isNext && <Pill color="blue">Up next</Pill>}
                          </span>
                          <span className="mt-0.5 block truncate text-[13px] text-ink-soft">{l.summary}</span>
                        </span>
                        {/* Lessons show progress only. Comprehension and Mastery are course-level metrics shown above. */}
                        <span className="hidden shrink-0 text-right sm:block">
                          {p.status === 'done' ? (
                            <span className="block text-sm font-semibold text-ngreen-ink">Completed</span>
                          ) : (
                            <span className="block text-sm text-ink-faint">{l.estimatedMinutes} min</span>
                          )}
                          <span className="block text-[11px] text-ink-faint">{p.status === 'done' ? `${l.estimatedMinutes} min` : p.status === 'in_progress' ? 'In progress' : 'Not started'}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </Card>
          );
        })}
        {hasFinal && (
          <Card className={cx('flex flex-wrap items-center justify-between gap-4', snapshot.eligibleForFinal && !passedFinal && 'border-npurple/40')}>
            <div className="flex items-center gap-4">
              <span className={cx('flex h-12 w-12 items-center justify-center rounded-2xl', snapshot.eligibleForFinal ? 'bg-npurple-soft text-npurple' : 'bg-mist text-ink-faint')}>
                {snapshot.eligibleForFinal ? <FileCheck2 className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
              </span>
              <div>
                <h3 className="font-bold">Final assessment</h3>
                <p className="text-sm text-ink-soft">
                  {course.finalExam!.questions.length} questions, {course.finalExam!.timeLimitMin ? `${course.finalExam!.timeLimitMin} minutes` : 'untimed'}.{' '}
                  {passedFinal ? 'Passed.' : snapshot.eligibleForFinal ? 'Unlocked and ready.' : 'Unlocks when every lesson is complete.'}
                </p>
              </div>
            </div>
            <Button disabled={readOnly || !snapshot.eligibleForFinal} variant={passedFinal ? 'secondary' : 'primary'} onClick={() => navigate(`final/${course.id}`)}>
              {passedFinal ? 'View result' : 'Open final assessment'}
            </Button>
          </Card>
        )}
        <Resources item={active} />
      </div>
    </div>
  );
}
