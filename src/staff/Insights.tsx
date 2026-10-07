import { motion } from 'motion/react';
import { ChevronDown, Clock, FileCheck2, Paperclip, Search, Users } from 'lucide-react';
import { useState } from 'react';
import type { ActivitySubmission, EngagementMetrics } from '../../shared/types';
import { api } from '../lib/api';
import { fmtDateTime, pct, scoreColor } from '../lib/format';
import { Avatar, Bar, Button, Card, cx, Empty, ErrorBox, Input, Loading, navigate, PageHeader, Pill, Tabs, Textarea, useLoad, useToast } from '../components/ui';
import { CourseSelect } from './Cohort';
import { statusOf, SubmissionsPanel, type SubmissionsData } from './Submissions';

interface AssessData {
  course: { id: string; title: string; passMark: number };
  courses: { id: string; title: string }[];
  lessons: {
    lessonId: string;
    title: string;
    moduleTitle: string;
    mode: string;
    questionCount: number;
    learnersAttempted: number;
    attempts: number;
    avgFirst: number | null;
    avgBest: number | null;
    questions: { id: string; question: string; answered: number; percentCorrect: number | null }[];
  }[];
  submissions: { userId: string; learnerName: string; learnerEmail?: string; lessonId: string; lessonTitle: string; activityTitle: string; fieldLabels: Record<string, string>; submission: ActivitySubmission }[];
  finals: { learnerName: string; attempts: { at: string; score: number }[]; passed: boolean }[];
}

export function Assessments() {
  const [courseId, setCourseId] = useState('');
  const [tab, setTab] = useState<'checks' | 'activities' | 'finals'>('activities');
  const [open, setOpen] = useState<string | null>(null);
  const { data, error, loading, reload } = useLoad(() => api<AssessData>(`/staff/assessments${courseId ? `?courseId=${courseId}` : ''}`), [courseId]);
  const subs = useLoad(() => api<SubmissionsData>('/staff/submissions'), []);
  if ((loading && !data) || (subs.loading && !subs.data)) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Could not load'} onRetry={() => void reload()} />;
  const pending = (subs.data?.submissions ?? []).filter((s) => statusOf(s.submission) === 'pending').length;
  return (
    <div className="space-y-5">
      <PageHeader
        title="Assessments"
        subtitle="Review learners’ activities, see which questions confuse learners, and check final results."
        actions={tab === 'activities' ? undefined : <CourseSelect courses={data.courses} value={data.course.id} onChange={setCourseId} />}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'activities', label: 'Activity submissions', count: pending },
          { value: 'checks', label: 'Checks and quizzes', count: data.lessons.filter((l) => l.questionCount).length },
          { value: 'finals', label: 'Final assessment', count: data.finals.length },
        ]}
      />
      {tab === 'checks' && (
        <Card className="!p-0 overflow-hidden">
          {data.lessons.filter((l) => l.questionCount).length === 0 && <Empty title="This course has no checks yet" />}
          {data.lessons
            .filter((l) => l.questionCount)
            .map((l) => (
              <div key={l.lessonId} className="border-b border-line last:border-0">
                <button onClick={() => setOpen(open === l.lessonId ? null : l.lessonId)} className="flex w-full flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 text-left transition hover:bg-mist/60" aria-expanded={open === l.lessonId}>
                  <div className="min-w-[200px] flex-1">
                    <div className="font-semibold">{l.title}</div>
                    <div className="text-xs text-ink-soft">
                      {l.moduleTitle} · {l.mode === 'quiz' ? 'Timed quiz' : 'Check'} · {l.questionCount} questions
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="w-[84px]">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Learners</div>
                      <div className="font-display text-lg font-bold">{l.learnersAttempted}</div>
                    </div>
                    <div className="w-[84px]">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">First try</div>
                      <div className="font-display text-lg font-bold" style={{ color: scoreColor(l.avgFirst) }}>
                        {pct(l.avgFirst)}
                      </div>
                    </div>
                    <div className="w-[84px]">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Best</div>
                      <div className="font-display text-lg font-bold" style={{ color: scoreColor(l.avgBest) }}>
                        {pct(l.avgBest)}
                      </div>
                    </div>
                    <ChevronDown className={cx('h-4 w-4 shrink-0 text-ink-soft transition', open === l.lessonId && 'rotate-180')} />
                  </div>
                </button>
                {open === l.lessonId && (
                  <div className="space-y-3 bg-mist/40 px-5 py-4">
                    {l.questions.map((q, i) => (
                      <div key={q.id}>
                        <div className="flex justify-between gap-3 text-sm">
                          <span>
                            <span className="text-ink-faint">Q{i + 1}.</span> {q.question}
                          </span>
                          <span className="shrink-0 font-semibold" style={{ color: scoreColor(q.percentCorrect) }}>
                            {q.percentCorrect === null ? 'No answers' : `${q.percentCorrect}% correct`}
                          </span>
                        </div>
                        <Bar value={q.percentCorrect} color={scoreColor(q.percentCorrect)} height={5} className="mt-1" />
                      </div>
                    ))}
                    <p className="text-xs text-ink-faint">Based on each learner’s first graded attempt. Questions under 60% may need clearer teaching or wording.</p>
                  </div>
                )}
              </div>
            ))}
        </Card>
      )}
      {tab === 'activities' &&
        (subs.error || !subs.data ? (
          <ErrorBox message={subs.error ?? 'Could not load submissions'} onRetry={() => void subs.reload()} />
        ) : (
          <SubmissionsPanel data={subs.data} reload={() => void subs.reload(true)} />
        ))}
      {tab === 'finals' && (
        <Card>
          {data.finals.length === 0 ? (
            <Empty title="No final attempts yet" />
          ) : (
            <div className="divide-y divide-line">
              {data.finals.map((f) => (
                <div key={f.learnerName} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="font-semibold">{f.learnerName}</span>
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    {f.attempts.map((a, i) => (
                      <span key={a.at} title={fmtDateTime(a.at)} className="font-semibold" style={{ color: scoreColor(a.score) }}>
                        #{i + 1}: {a.score}%
                      </span>
                    ))}
                    <Pill color={f.passed ? 'green' : 'pink'}>{f.passed ? 'Passed' : `Below ${data.course.passMark}%`}</Pill>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

interface ActivityData {
  course: { id: string; title: string } | null;
  courses: { id: string; title: string }[];
  rows: { userId: string; name: string; initials: string; engagement: EngagementMetrics }[];
  days: { date: string; minutes: number; logins: number; activeLearners: number }[];
  steps?: { labels: string[]; counts: number[]; stalled: number };
  resources?: { guideViews: number; guideViewers: number; guideDownloads: number; workViews: number; workViewers: number; workDownloads: number; workDownloaders: number };
  feedback?: {
    recommendYes: number;
    recommendAnswered: number;
    usaiiYes: number;
    usaiiAnswered: number;
    courseRating: number | null;
    courseRatings: number;
    lmsRating: number | null;
    lmsRatings: number;
    comments: { id: string; name: string; comment: string; stars: number | null; about: string; at: string }[];
  };
}

/** Where every learner is on Steps to Completion right now, as counts per step. */
function StepsFunnel({ steps, total }: { steps: NonNullable<ActivityData['steps']>; total: number }) {
  const max = Math.max(1, ...steps.counts);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">Where learners are on Steps to Completion</h3>
          <p className="mt-0.5 text-[13px] text-ink-soft">How many learners are on each step right now. The same steps learners see in their sidebar.</p>
        </div>
        {steps.stalled > 0 ? (
          <button onClick={() => navigate('cohort')} className="rounded-full bg-npink-soft px-3 py-1.5 text-[13px] font-bold text-npink hover:underline">
            {steps.stalled} of {total} not moved in 7+ days · See Cohort
          </button>
        ) : (
          <span className="rounded-full bg-ngreen-soft px-3 py-1.5 text-[13px] font-bold text-ngreen-ink">Nobody is stuck</span>
        )}
      </div>
      <div className="mt-5 flex h-44 items-end gap-2 overflow-x-auto scroll-thin pb-1">
        {steps.counts.map((c, i) => {
          const last = i === steps.counts.length - 1;
          return (
            <div key={steps.labels[i]} className="flex min-w-[44px] flex-1 flex-col items-center gap-1.5" title={`${c} learner${c === 1 ? '' : 's'} on ${steps.labels[i]}`}>
              <span className="text-[13px] font-bold" style={{ color: c ? (last ? '#00804F' : '#14142B') : '#9A9AB3' }}>
                {c}
              </span>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, (c / max) * 112)}px` }}
                transition={{ duration: 0.5, delay: i * 0.04 }}
                className="w-full rounded-t-xl"
                style={{ background: last ? 'linear-gradient(180deg,#00C77F,#00A86B)' : c ? 'linear-gradient(180deg,#8B3DFF,#1F6BFF)' : '#EEF0F7' }}
              />
              <span className="whitespace-nowrap text-[11.5px] font-semibold text-ink-soft">{steps.labels[i]}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ResourcesCard({ r, total }: { r: NonNullable<ActivityData['resources']>; total: number }) {
  const tiles = [
    { label: 'Opened the Study Guide', value: `${r.guideViewers} of ${total}`, sub: `${r.guideViews} view${r.guideViews === 1 ? '' : 's'} in the LMS`, color: '#1F6BFF' },
    { label: 'Study Guide PDF downloads', value: String(r.guideDownloads), sub: 'From the Study Guide viewer', color: '#8B3DFF' },
    { label: 'Viewed their own work', value: `${r.workViewers} of ${total}`, sub: `${r.workViews} view${r.workViews === 1 ? '' : 's'} in Your Journey`, color: '#1F6BFF' },
    { label: 'Downloaded their own work', value: `${r.workDownloaders} of ${total}`, sub: `${r.workDownloads} download${r.workDownloads === 1 ? '' : 's'} from View my work`, color: '#00C77F' },
  ];
  return (
    <Card>
      <h3 className="font-bold">Study Guide and learners’ work</h3>
      <p className="mt-0.5 text-[13px] text-ink-soft">Whether learners use the guide inside the LMS and keep what they built.</p>
      <div className="mt-4 space-y-3">
        {tiles.map((t) => (
          <div key={t.label} className="flex items-center justify-between gap-3 rounded-2xl bg-mist/70 px-4 py-3">
            <div>
              <div className="text-sm font-semibold">{t.label}</div>
              <div className="text-[12px] text-ink-faint">{t.sub}</div>
            </div>
            <div className="font-display text-2xl font-extrabold" style={{ color: t.color }}>
              {t.value}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function FeedbackCard({ f }: { f: NonNullable<ActivityData['feedback']> }) {
  const yes = f.recommendAnswered ? Math.round((f.recommendYes / f.recommendAnswered) * 100) : null;
  const usaii = f.usaiiAnswered ? Math.round((f.usaiiYes / f.usaiiAnswered) * 100) : null;
  const stars = (v: number | null, n: number) => (v === null ? '—' : `${v.toFixed(1)} / 5`) + (n ? ` · ${n} rating${n === 1 ? '' : 's'}` : '');
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-bold">Learner feedback</h3>
          <p className="mt-0.5 text-[13px] text-ink-soft">From the Give Feedback page. One voice per learner, their latest answer.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => navigate('feedback')}>
          View all feedback
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <div className="rounded-2xl bg-ngreen-soft/70 px-2 py-3">
          <div className="font-display text-2xl font-extrabold text-ngreen-ink">{usaii === null ? '—' : `${usaii}%`}</div>
          <div className="text-[11.5px] font-semibold text-ink-soft">Would recommend USAII®</div>
          <div className="text-[11px] text-ink-faint">{f.usaiiAnswered} answered</div>
        </div>
        <div className="rounded-2xl bg-ngreen-soft/70 px-2 py-3">
          <div className="font-display text-2xl font-extrabold text-ngreen-ink">{yes === null ? '—' : `${yes}%`}</div>
          <div className="text-[11.5px] font-semibold text-ink-soft">Would recommend USAII® Courses</div>
          <div className="text-[11px] text-ink-faint">{f.recommendAnswered} answered</div>
        </div>
        <div className="rounded-2xl bg-nblue-soft/70 px-2 py-3">
          <div className="font-display text-lg font-extrabold text-nblue">{stars(f.courseRating, 0)}</div>
          <div className="text-[11.5px] font-semibold text-ink-soft">This course</div>
          <div className="text-[11px] text-ink-faint">{f.courseRatings} rating{f.courseRatings === 1 ? '' : 's'}</div>
        </div>
        <div className="rounded-2xl bg-npurple-soft/70 px-2 py-3">
          <div className="font-display text-lg font-extrabold text-npurple">{stars(f.lmsRating, 0)}</div>
          <div className="text-[11.5px] font-semibold text-ink-soft">The LMS</div>
          <div className="text-[11px] text-ink-faint">{f.lmsRatings} rating{f.lmsRatings === 1 ? '' : 's'}</div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {f.comments.length === 0 && <p className="text-sm text-ink-faint">No written comments yet.</p>}
        {f.comments.map((c) => (
          <div key={c.id} className="rounded-2xl border border-line px-4 py-3">
            <div className="flex items-center justify-between gap-2 text-[12px] text-ink-faint">
              <span className="font-semibold text-ink">{c.name}</span>
              <span>
                {c.about}
                {c.stars ? ` · ${c.stars}★` : ''} · {fmtDateTime(c.at)}
              </span>
            </div>
            <p className="mt-1 text-[14px] text-ink-soft">“{c.comment}”</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Bars({ values, labels, format, color }: { values: number[]; labels: string[]; format: (v: number) => string; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-44 items-end gap-2">
      {values.map((v, i) => (
        <div key={labels[i]} className="flex flex-1 flex-col items-center gap-1.5" title={`${labels[i]}: ${format(v)}`}>
          <span className="text-[11px] font-semibold text-ink-soft">{v ? format(v) : ''}</span>
          <motion.div className="w-full max-w-[34px] rounded-lg" style={{ background: v ? color : '#EEF0F7' }} initial={{ height: 0 }} animate={{ height: Math.max(4, (v / max) * 130) }} transition={{ duration: 0.6, delay: i * 0.04 }} />
          <span className="text-[11px] text-ink-faint">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

export function ActivityMetrics() {
  const [courseId, setCourseId] = useState('');
  const [view, setView] = useState<'active' | 'hours'>('active');
  const { data, error, loading, reload } = useLoad(() => api<ActivityData>(`/staff/activity${courseId ? `?courseId=${courseId}` : ''}`), [courseId]);
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Could not load'} onRetry={() => void reload()} />;
  if (!data.course) return <Empty title="No courses yet" text="Activity appears here once learners start a course." />;
  const rows = data.rows;
  const activeCount = rows.filter((r) => r.engagement.activeDaysLast7 > 0).length;
  const avgHours = rows.length ? rows.reduce((a, r) => a + r.engagement.activeMinutesLast7, 0) / rows.length / 60 : 0;
  const week = data.days.slice(-7);
  const labels = week.map((d) => new Date(`${d.date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }));
  const hrs = (m: number) => `${(m / 60).toFixed(1)} h`;
  // Counts, not names: the list stays readable whether a course has 8 learners or 800.
  const total = rows.length;
  const share = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const bands =
    view === 'active'
      ? [
          { label: '5 or more days this week', count: rows.filter((r) => r.engagement.activeDaysLast7 >= 5).length, color: '#00C77F' },
          { label: '3 to 4 days', count: rows.filter((r) => r.engagement.activeDaysLast7 >= 3 && r.engagement.activeDaysLast7 < 5).length, color: '#1F6BFF' },
          { label: '1 to 2 days', count: rows.filter((r) => r.engagement.activeDaysLast7 >= 1 && r.engagement.activeDaysLast7 < 3).length, color: '#8B3DFF' },
          { label: 'Not active at all', count: rows.filter((r) => r.engagement.activeDaysLast7 === 0).length, color: '#FF2E93' },
        ]
      : [
          { label: '3 hours or more', count: rows.filter((r) => r.engagement.activeMinutesLast7 >= 180).length, color: '#00C77F' },
          { label: '1 to 3 hours', count: rows.filter((r) => r.engagement.activeMinutesLast7 >= 60 && r.engagement.activeMinutesLast7 < 180).length, color: '#1F6BFF' },
          { label: 'Under 1 hour', count: rows.filter((r) => r.engagement.activeMinutesLast7 > 0 && r.engagement.activeMinutesLast7 < 60).length, color: '#8B3DFF' },
          { label: 'No study time', count: rows.filter((r) => r.engagement.activeMinutesLast7 === 0).length, color: '#FF2E93' },
        ];
  const trackers = [
    { id: 'active' as const, label: 'Active Learners This Week', value: `${activeCount} / ${rows.length}`, icon: Users, color: '#1F6BFF' },
    { id: 'hours' as const, label: 'Avg Learning Hours', value: `${avgHours.toFixed(1)} h`, icon: Clock, color: '#8B3DFF' },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title="Activity Metrics" subtitle="How much your learners study, where they are on their steps, what they use, and what they say." actions={<CourseSelect courses={data.courses} value={data.course.id} onChange={setCourseId} />} />
      <div className="grid gap-4 sm:grid-cols-2">
        {trackers.map((t) => {
          const on = view === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              aria-pressed={on}
              className={cx('relative overflow-hidden rounded-3xl border p-6 text-left transition', on ? 'border-transparent text-white shadow-xl' : 'border-line bg-white hover:-translate-y-0.5 hover:shadow-lg')}
              style={on ? { background: `linear-gradient(135deg, ${t.color}, #FF2E93)` } : undefined}
            >
              <div className="flex items-center gap-3">
                <span className={cx('flex h-11 w-11 items-center justify-center rounded-2xl', on ? 'bg-white/20' : '')} style={on ? undefined : { background: `${t.color}18`, color: t.color }}>
                  <t.icon className="h-5 w-5" />
                </span>
                <span className={cx('text-[15px] font-semibold', on ? 'text-white/90' : 'text-ink-soft')}>{t.label}</span>
              </div>
              <div className="mt-4 font-display text-[40px] font-extrabold leading-none">{t.value}</div>
            </button>
          );
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <h3 className="mb-4 font-bold">{view === 'active' ? 'Learners active each day' : 'Learning hours each day'}</h3>
          {view === 'active' ? (
            <Bars values={week.map((d) => d.activeLearners)} labels={labels} format={(v) => String(v)} color="linear-gradient(180deg,#00C2FF,#1F6BFF)" />
          ) : (
            <Bars values={week.map((d) => d.minutes)} labels={labels} format={hrs} color="linear-gradient(180deg,#FF2E93,#8B3DFF)" />
          )}
        </Card>
        <Card>
          <h3 className="font-bold">{view === 'active' ? 'How often learners studied this week' : 'How long learners studied this week'}</h3>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {total} learner{total === 1 ? '' : 's'} in this course
          </p>
          <div className="mt-4 space-y-3.5">
            {total === 0 && <p className="text-sm text-ink-faint">No learners in this course yet.</p>}
            {bands.map((b) => (
              <div key={b.label}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-semibold">{b.label}</span>
                  <span className="shrink-0 font-display text-lg font-bold" style={{ color: b.color }}>
                    {b.count}
                    <span className="ml-1 text-[12px] font-semibold text-ink-soft">of {total}</span>
                  </span>
                </div>
                <Bar value={share(b.count)} height={8} color={b.color} className="mt-1" />
              </div>
            ))}
          </div>
        </Card>
      </div>
      {data.steps && <StepsFunnel steps={data.steps} total={total} />}
      <div className="grid gap-4 lg:grid-cols-2">
        {data.resources && <ResourcesCard r={data.resources} total={total} />}
        {data.feedback && <FeedbackCard f={data.feedback} />}
      </div>
    </div>
  );
}
