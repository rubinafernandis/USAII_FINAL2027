import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, Clock, Eye, FileText, Flag, Rocket, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { useMemo, useState, type ComponentType } from 'react';
import { flattenLessons, progressOf } from '../../shared/analytics';
import type { ActivityReview, ActivitySubmission, LessonActivity } from '../../shared/types';
import { Button, Card, cx, Empty, Modal, navigate, PageHeader, Select } from '../components/ui';
import { fmtDate, fmtMinutes } from '../lib/format';
import { downloadMyWorkPdf } from '../lib/pdf';
import { rubricLevelLabel } from '../../shared/metrics';
import type { Course, Enrollment } from '../../shared/types';
import DocPanel from './DocPanel';

const REVIEW_LABEL = { approved: 'Approved', resubmit: 'Resubmission requested', not_approved: 'Not approved' } as const;

/** Everything the learner wrote in this course's activities, in course order: the same content as the PDF. */
function MyWork({ course, enrollment, learnerName }: { course: Course; enrollment: Enrollment; learnerName: string }) {
  const pieces = flattenLessons(course)
    .map((f, i) => ({ f, i, act: f.lesson.activity, sub: enrollment.lessons[f.lesson.id]?.activity }))
    .filter((x) => x.act && x.sub);
  return (
    <article className="mx-auto max-w-[720px] px-5 py-8 sm:px-8">
      <h1 className="font-display text-[28px] font-extrabold leading-tight">My work: {course.title}</h1>
      <p className="mt-1 text-sm text-ink-soft">{learnerName}</p>
      <div className="my-6 h-[3px] w-24 rounded-full bg-gradient-to-r from-nblue via-npurple to-npink" />
      {pieces.length === 0 && <p className="text-ink-soft">No activities submitted yet.</p>}
      <div className="space-y-8">
        {pieces.map(({ f, i, act, sub }) => (
          <section key={f.lesson.id}>
            <h2 className="text-lg font-bold text-nblue">
              {i + 1}. {act!.title}
            </h2>
            <p className="text-[13px] italic text-ink-faint">{f.lesson.title}</p>
            {sub!.review && (
              <p className="mt-1 text-[13px] font-semibold text-ink-soft">
                {REVIEW_LABEL[sub!.review]}
                {sub!.rubric ? (sub!.rubric.maxPoints !== undefined ? ` · Rubric score ${sub!.rubric.points} / ${sub!.rubric.maxPoints} (${sub!.rubric.percent}%)` : ` · ${sub!.rubric.scores.map((c) => `${c.label}: ${rubricLevelLabel(c.level)}`).join(' · ')}`) : ''}
              </p>
            )}
            <dl className="mt-3 space-y-3">
              {act!.fields
                .filter((fl) => sub!.fields[fl.id]?.trim())
                .map((fl) => (
                  <div key={fl.id}>
                    <dt className="text-sm font-bold">{fl.label}</dt>
                    <dd className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-soft">{sub!.fields[fl.id]}</dd>
                  </div>
                ))}
            </dl>
            {sub!.fileUrl && (
              <a href={sub!.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-nblue hover:underline">
                <FileText className="h-4 w-4" /> View attached file: {sub!.fileName ?? 'Attachment'}
              </a>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
import { useLearner, type CourseItem } from './context';
import { track } from './track';

/**
 * Your Journey.
 * A simple, dated record of what the learner has done in one course: lessons
 * completed, activities submitted, the instructor's decision on each activity,
 * the final assessment, and the certificate. Everything comes from what the
 * instructor entered in Course Builder and what the learner did, so it works
 * for any course without extra setup.
 */

type Kind = 'started' | 'lesson' | 'activity' | 'review' | 'final' | 'certificate';
type Filter = 'all' | 'lesson' | 'activity' | 'review';

interface Work {
  title: string;
  lessonTitle: string;
  activity: LessonActivity;
  sub: ActivitySubmission;
}

interface Moment {
  id: string;
  kind: Kind;
  at: string;
  title: string;
  detail?: string;
  note?: string;
  review?: ActivityReview;
  work?: Work;
  action?: { label: string; path: string };
}

const LOOK: Record<Kind, { icon: ComponentType<{ className?: string }>; color: string }> = {
  started: { icon: Rocket, color: '#1F6BFF' },
  lesson: { icon: CheckCircle2, color: '#00C77F' },
  activity: { icon: FileText, color: '#8B3DFF' },
  review: { icon: BadgeCheck, color: '#00C77F' },
  final: { icon: Flag, color: '#1F6BFF' },
  certificate: { icon: Trophy, color: '#F5A300' },
};

const REVIEW: Record<ActivityReview, { icon: ComponentType<{ className?: string }>; color: string; label: string; pill: string }> = {
  approved: { icon: BadgeCheck, color: '#00C77F', label: 'Approved', pill: 'bg-ngreen-soft text-ngreen-ink' },
  resubmit: { icon: RotateCcw, color: '#F5A300', label: 'Resubmission requested', pill: 'bg-[#fff4d9] text-[#9a5b00]' },
  not_approved: { icon: XCircle, color: '#FF2E93', label: 'Not approved', pill: 'bg-npink-soft text-npink' },
};

function buildJourney(item: CourseItem) {
  const { course, enrollment } = item;
  const moments: Moment[] = [{ id: 'started', kind: 'started', at: enrollment.enrolledAt, title: `Started ${course.title}` }];
  let seconds = 0;
  let submitted = 0;

  flattenLessons(course).forEach((f) => {
    const p = progressOf(enrollment, f.lesson.id);
    seconds += p.activeSeconds || 0;

    if (p.status === 'done' && p.completedAt)
      moments.push({
        id: `l-${f.lesson.id}`,
        kind: 'lesson',
        at: p.completedAt,
        title: `Completed ${f.lesson.title}`,
        detail: p.activeSeconds ? `${fmtMinutes(Math.max(1, Math.round(p.activeSeconds / 60)))} spent` : undefined,
      });

    const act = f.lesson.activity;
    const sub = p.activity;
    if (!act || !sub) return;
    submitted += 1;
    const work: Work = { title: act.title, lessonTitle: f.lesson.title, activity: act, sub };

    // When the learner resubmitted, the earlier version and its review stay in the record.
    if (sub.previous) {
      moments.push({ id: `a0-${f.lesson.id}`, kind: 'activity', at: sub.previous.submittedAt, title: `Submitted ${act.title}`, detail: 'Earlier version' });
      if (sub.previous.review && sub.previous.at)
        moments.push({ id: `r0-${f.lesson.id}`, kind: 'review', at: sub.previous.at, title: act.title, review: sub.previous.review, detail: sub.previous.by, note: sub.previous.feedback });
    }
    moments.push({ id: `a-${f.lesson.id}`, kind: 'activity', at: sub.submittedAt, title: `Submitted ${act.title}`, detail: sub.previous ? 'Resubmitted' : undefined, work });
    if (sub.review && sub.reviewedAt)
      moments.push({
        id: `r-${f.lesson.id}`,
        kind: 'review',
        at: sub.reviewedAt,
        title: act.title,
        review: sub.review,
        detail: sub.reviewedBy,
        note: sub.feedback,
        action: sub.review === 'approved' ? undefined : { label: 'Revise and resubmit', path: `study/${course.id}/${f.lesson.id}?step=apply` },
      });
  });

  const passed = (enrollment.finalExam?.attempts ?? []).find((a) => a.score >= course.passMark);
  if (passed) moments.push({ id: 'final', kind: 'final', at: passed.at, title: 'Passed the final assessment', detail: `Score ${passed.score}%` });
  if (enrollment.certificateIssuedAt)
    moments.push({ id: 'cert', kind: 'certificate', at: enrollment.certificateIssuedAt, title: `Earned ${course.credentialName || 'your certificate'}`, action: { label: 'Open Milestone Vault', path: 'vault' } });

  moments.sort((a, b) => b.at.localeCompare(a.at)); // newest first
  const days = Math.max(1, Math.floor((Date.now() - Date.parse(enrollment.enrolledAt)) / 86_400_000) + 1);
  return { moments, minutes: Math.round(seconds / 60), days, submitted };
}

function WorkModal({ work, onClose }: { work: Work | null; onClose: () => void }) {
  return (
    <Modal
      open={!!work}
      onClose={onClose}
      wide
      title={work?.title ?? ''}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {work && (
        <div className="space-y-4">
          <p className="text-[13px] text-ink-soft">
            {work.lessonTitle} · submitted {fmtDate(work.sub.submittedAt)}
          </p>
          {work.activity.fields.map((f) =>
            work.sub.fields[f.id]?.trim() ? (
              <div key={f.id}>
                <div className="text-[13px] font-bold text-ink">{f.label}</div>
                <div className="mt-1 whitespace-pre-line rounded-2xl bg-mist px-4 py-3 text-[14.5px] leading-relaxed text-body">{work.sub.fields[f.id]}</div>
              </div>
            ) : null,
          )}
          {work.sub.fileName && <p className="text-[13px] text-ink-soft">Attached file: {work.sub.fileName}</p>}
        </div>
      )}
    </Modal>
  );
}

export default function JourneyPage() {
  const { home, active, activeId, setActiveId, learner, readOnly } = useLearner();
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<Work | null>(null);
  const [workOpen, setWorkOpen] = useState(false);
  const journey = useMemo(() => (active ? buildJourney(active) : null), [active]);

  if (!active || !journey) return <Empty title="No journey yet" text="Your journey starts when you join a course." action={<Button onClick={() => navigate('explore')}>Explore Courses</Button>} />;
  const { course } = active;

  const count = (k: Filter) => (k === 'all' ? journey.moments.length : journey.moments.filter((m) => m.kind === k).length);
  const shown = filter === 'all' ? journey.moments : journey.moments.filter((m) => m.kind === filter);
  const filters: [Filter, string][] = [
    ['all', 'All'],
    ['lesson', 'Lessons'],
    ['activity', 'Activities'],
    ['review', 'Feedback on activities'],
  ];
  const stats = [
    { icon: CalendarDays, heading: 'Days in this course', value: `Day ${journey.days}`, color: '#1F6BFF' },
    { icon: Clock, heading: 'Time invested', value: fmtMinutes(journey.minutes), color: '#8B3DFF' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Your Journey" subtitle="Everything you have done in a course, newest first." />

      {/* Filter bar: choose the course, see its two key numbers */}
      <Card className="!p-4 sm:!p-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="min-w-[240px] flex-1">
            <label htmlFor="journey-course" className="mb-1.5 block text-[12px] font-bold uppercase tracking-[0.12em] text-ink-faint">
              Course
            </label>
            <Select
              id="journey-course"
              value={activeId}
              onChange={(e) => {
                setActiveId(e.target.value);
                setFilter('all');
              }}
              className="!rounded-full !py-2.5 font-semibold"
            >
              {home.items.map((i) => (
                <option key={i.course.id} value={i.course.id}>
                  {i.course.title}
                </option>
              ))}
            </Select>
          </div>
          {stats.map((s) => (
            <div key={s.heading} className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${s.color}18`, color: s.color }}>
                <s.icon className="h-5 w-5" />
              </span>
              <div>
                <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-faint">{s.heading}</div>
                <div className="font-display text-2xl font-extrabold leading-tight">{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Filters, and the learner's work: view first, download inside */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
          {filters.map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              aria-pressed={filter === v}
              className={cx('rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition', filter === v ? 'bg-ink text-white' : 'bg-mist text-ink-soft hover:text-ink')}
            >
              {l} <span className="opacity-70">({count(v)})</span>
            </button>
          ))}
        </div>
        <Button
          size="sm"
          variant="secondary"
          disabled={!journey.submitted}
          title={journey.submitted ? 'Everything you wrote in this course, in one place. Download it as a PDF from the viewer.' : 'Available after your first activity'}
          icon={<Eye className="h-4 w-4" />}
          onClick={() => {
            setWorkOpen(true);
            if (!readOnly) track(course.id, 'work_view');
          }}
        >
          View my work
        </Button>
        <DocPanel
          open={workOpen}
          onClose={() => setWorkOpen(false)}
          title="My work"
          subtitle={course.title}
          icon={<FileText className="h-5 w-5" />}
          onDownload={() => {
            downloadMyWorkPdf(course, active.enrollment, learner.name);
            if (!readOnly) track(course.id, 'work_download');
          }}
        >
          <MyWork course={course} enrollment={active.enrollment} learnerName={learner.name} />
        </DocPanel>
      </div>

      {/* The record */}
      {shown.length === 0 ? (
        <Card className="text-center text-sm text-ink-soft">Nothing here yet.</Card>
      ) : (
        <ol className="relative space-y-3">
          <span className="absolute bottom-3 left-[19px] top-3 w-[2px] bg-line" aria-hidden />
          <AnimatePresence initial={false} mode="popLayout">
            {shown.map((m) => {
              const look = m.review ? REVIEW[m.review] : LOOK[m.kind];
              return (
                <motion.li key={`${course.id}-${m.id}`} layout initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative pl-14">
                  <span className="absolute left-0 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md" style={{ background: look.color }}>
                    <look.icon className="h-[18px] w-[18px]" />
                  </span>
                  <Card className="!p-4">
                    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold leading-snug text-ink">
                          {m.review ? `Feedback on activity: ${m.title}` : m.title}
                          {m.review && <span className={cx('ml-2 inline-block rounded-full px-2.5 py-0.5 align-middle text-[12px] font-bold', REVIEW[m.review].pill)}>{REVIEW[m.review].label}</span>}
                        </div>
                        {m.detail && <div className="mt-0.5 text-[13px] text-ink-soft">{m.review ? `By ${m.detail}` : m.detail}</div>}
                      </div>
                      <time className="shrink-0 text-[12.5px] font-semibold text-ink-faint" dateTime={m.at}>
                        {fmtDate(m.at)}
                      </time>
                    </div>
                    {m.note && <p className="mt-2.5 border-l-4 border-line pl-3 text-[14px] italic text-ink-soft">“{m.note}”</p>}
                    {(m.work || (m.action && !readOnly)) && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {m.work && (
                          <Button size="sm" variant="secondary" icon={<FileText className="h-4 w-4" />} onClick={() => setOpen(m.work!)}>
                            Read
                          </Button>
                        )}
                        {m.action && !readOnly && (
                          <Button size="sm" onClick={() => navigate(m.action!.path)}>
                            {m.action.label} <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
                  </Card>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ol>
      )}

      <WorkModal work={open} onClose={() => setOpen(null)} />
    </div>
  );
}
