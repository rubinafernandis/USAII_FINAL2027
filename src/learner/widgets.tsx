import { motion } from 'motion/react';
import { ArrowRight, BookOpen, CalendarCheck, Clock, Compass, Repeat, Sparkles, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { simulateWhatIf } from '../../shared/analytics';
import type { NextAction, TopicStatus } from '../../shared/types';
import { api } from '../lib/api';
import { fmtDate, fmtMinutes, pct, scoreColor } from '../lib/format';
import { useSession } from '../lib/session';
import { Bar, Button, Card, cx, DayBars, navigate, Pill, Ring, useToast } from '../components/ui';
import { useLearner, type CourseItem } from './context';

export function actionPath(a: NextAction): string {
  switch (a.kind) {
    case 'lesson':
    case 'review':
      return a.courseId && a.lessonId ? `study/${a.courseId}/${a.lessonId}` : 'learning';
    case 'check':
      return a.courseId && a.lessonId ? `study/${a.courseId}/${a.lessonId}?step=check` : 'learning';
    case 'activity':
      return a.courseId && a.lessonId ? `study/${a.courseId}/${a.lessonId}?step=apply` : 'learning';
    case 'final':
      return `final/${a.courseId}`;
    case 'credential':
      return `vault/${a.courseId}`;
    case 'thread':
      return a.threadId ? `ask/${a.threadId}` : 'ask';
    default:
      return 'explore';
  }
}

/** Average topic score across topics that have been checked. */
export function understandingOf(item: CourseItem): number | null {
  const m = item.snapshot.topics.filter((t) => t.bestCheck !== null);
  return m.length ? Math.round(m.reduce((a, t) => a + t.score, 0) / m.length) : null;
}

/* ---------------- 1. Next step (the one bold element) ---------------- */

export function NextStepCard({ item, readOnly }: { item: CourseItem; readOnly?: boolean }) {
  const { snapshot: s } = item;
  const ns = s.nextStep;
  return (
    <div className="beam">
      <div className="beam-inner relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gradient-to-br from-nblue/15 via-npurple/15 to-npink/10 blur-2xl" />
        <div className="relative">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-npurple">
            <span className="pulse-dot h-2 w-2 rounded-full bg-nblue" /> Your next step
          </div>
          <motion.h2 key={ns.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-[26px] font-extrabold leading-tight sm:text-[32px]">
            {ns.title}
          </motion.h2>
          <p className="mt-2 max-w-2xl text-ink-soft">{ns.reason}</p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button size="lg" disabled={readOnly} onClick={() => navigate(actionPath(ns.action))}>
              {ns.label} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Button>
            <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
              <BookOpen className="h-4 w-4" /> {ns.where}
            </span>
            {ns.minutes > 0 && (
              <span className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
                <Clock className="h-4 w-4" /> {ns.minutes} min
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 2. How you are doing ---------------- */

function useNarrow(limit = 640) {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < limit);
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < limit);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, [limit]);
  return narrow;
}

/** Personal guidance from the instructor who added this learner to the course. */
export function GuidanceCard({ item }: { item: CourseItem }) {
  const g = item.enrollment.guidance;
  if (!g || (!g.nextStep.trim() && !g.workOn.trim())) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 24 }}>
      <Card className="relative overflow-hidden border-npurple/30">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-nblue via-npurple to-npink" />
        <div className="flex flex-wrap items-center justify-between gap-2 pl-2">
          <h3 className="flex items-center gap-2 text-lg font-bold">
            <Compass className="h-5 w-5 text-npurple" /> Guidance From Your Instructor
          </h3>
          <span className="text-[12px] font-semibold text-ink-soft">
            {g.byName} · {fmtDate(g.updatedAt)}
          </span>
        </div>
        <div className="mt-4 grid gap-3 pl-2 sm:grid-cols-2">
          {g.nextStep.trim() && (
            <div className="rounded-2xl bg-nblue-soft/60 p-4">
              <div className="text-[12px] font-bold uppercase tracking-wide text-nblue">Do this next</div>
              <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{g.nextStep}</p>
            </div>
          )}
          {g.workOn.trim() && (
            <div className="rounded-2xl bg-npurple-soft/60 p-4">
              <div className="text-[12px] font-bold uppercase tracking-wide text-npurple">Work on this</div>
              <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{g.workOn}</p>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

export function DoingCard({ item }: { item: CourseItem }) {
  const narrow = useNarrow();
  const s = item.snapshot;
  const p = s.prediction;
  const u = understandingOf(item);
  const rings = [
    { label: 'Course completed', value: s.completion.percent as number | null, color: '#8B3DFF' },
    { label: 'Understanding', value: u, color: scoreColor(u) },
    { label: 'Chance of passing', value: p.evidence === 'none' ? null : p.passConfidence, color: scoreColor(p.passConfidence) },
  ];
  return (
    <Card>
      <h3 className="text-lg font-bold">How you are doing</h3>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {rings.map((r) => (
          <div key={r.label} className="flex flex-col items-center text-center">
            <Ring value={r.value} size={narrow ? 84 : 112} stroke={narrow ? 8 : 10} color={r.color} />
            <div className="mt-2 text-[13px] font-semibold leading-tight sm:text-sm">{r.label}</div>
          </div>
        ))}
      </div>
      <CoursePath item={item} />
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-mist px-4 py-3">
          <div className="text-xs text-ink-faint">Projected grade</div>
          <div className="font-display text-xl font-bold" style={{ color: p.evidence === 'none' ? undefined : scoreColor(p.predictedGrade) }}>
            {p.evidence === 'none' ? 'After your first quiz' : p.finalExamScore !== null ? `${p.predictedGrade}% (${p.predictedLetter})` : `${p.range.low} to ${p.range.high}%`}
          </div>
          <div className="mt-0.5 text-[11.5px] leading-snug text-ink-faint">{p.evidenceNote}</div>
        </div>
        <div className="rounded-2xl bg-mist px-4 py-3">
          <div className="text-xs text-ink-faint">Expected Course Completion Date</div>
          <div className="font-display text-xl font-bold">{s.credentialEarned ? 'Completed' : fmtDate(s.completion.estimatedDate)}</div>
        </div>
        <div className="rounded-2xl bg-mist px-4 py-3">
          <div className="text-xs text-ink-faint">Certificate / Digital Badge</div>
          <div className={cx('font-display text-xl font-bold', s.credentialEarned && 'text-ngreen-ink')}>
            {s.credentialEarned ? 'Earned' : s.eligibleForFinal ? 'Final test open' : `${s.completion.lessonsTotal - s.completion.lessonsDone} lessons to go`}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Module-by-module tracker: where you are in the course at a glance. */
export function CoursePath({ item }: { item: CourseItem }) {
  const e = item.enrollment;
  const current = item.snapshot.nextStep.action.lessonId;
  return (
    <div className="mt-6">
      <div className="mb-2 text-xs font-semibold text-ink-faint">Your course path</div>
      <div className="flex gap-1.5">
        {item.course.modules.map((m, i) => {
          const done = m.lessons.filter((l) => e.lessons[l.id]?.status === 'done').length;
          const pctDone = m.lessons.length ? Math.round((done / m.lessons.length) * 100) : 0;
          const here = m.lessons.some((l) => l.id === current);
          return (
            <div key={m.id} className="min-w-0 flex-1" title={`${m.title}: ${done} of ${m.lessons.length} lessons done`}>
              <div className={cx('relative h-2.5 overflow-hidden rounded-full bg-[#EEF0F7]', here && 'ring-2 ring-nblue/30 ring-offset-1')}>
                <motion.div className="h-full rounded-full bg-gradient-to-r from-nblue to-npurple" initial={{ width: 0 }} animate={{ width: `${pctDone}%` }} transition={{ duration: 0.8, delay: i * 0.08 }} />
              </div>
              <div className={cx('mt-1 truncate text-[11px]', here ? 'font-bold text-nblue' : 'text-ink-faint')}>
                {here ? 'You are here' : `Module ${i + 1}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- 3. Study habits ---------------- */

export function HabitsRow({ item }: { item: CourseItem }) {
  const e = item.snapshot.engagement;
  const p = item.snapshot.prediction;
  const tiles = [
    { label: 'Days signed in this week', value: `${e.loginDaysLast7} of 7`, color: '#1F6BFF' },
    { label: 'Study time this week', value: fmtMinutes(e.activeMinutesLast7), color: '#8B3DFF' },
    { label: 'Study streak', value: e.streak ? `${e.streak} day${e.streak === 1 ? '' : 's'}` : 'Start today', color: '#00C77F' },
    { label: 'Average quiz score', value: pct(p.avgCheckScore), color: '#FF2E93' },
  ];
  return (
    <div>
      <h3 className="mb-3 text-lg font-bold">Your study habits</h3>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t, i) => (
          <motion.div key={t.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="relative overflow-hidden rounded-3xl border border-line bg-white p-4">
            <span className="absolute left-0 top-4 h-8 w-1 rounded-r-full" style={{ background: t.color }} />
            <div className="text-[13px] font-medium text-ink-soft">{t.label}</div>
            <div className="mt-1 font-display text-2xl font-bold">{t.value}</div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 4. Improve next ---------------- */

export function ImproveCard({ item, readOnly }: { item: CourseItem; readOnly?: boolean }) {
  const recs = item.snapshot.recommendations.slice(0, 3);
  return (
    <Card className="h-full">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-npink" />
        <h3 className="text-lg font-bold">Improve next</h3>
      </div>
      <div className="mt-4 space-y-2">
        {recs.length === 0 && <p className="rounded-2xl bg-ngreen-soft px-4 py-3 text-sm text-ngreen-ink">You are doing well. Keep following your next step.</p>}
        {recs.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={readOnly}
            onClick={() => navigate(actionPath(r.action))}
            className="group flex w-full items-center gap-3 rounded-2xl border border-line p-3.5 text-left transition enabled:hover:border-npurple/40 enabled:hover:bg-npurple-soft/30"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{r.title}</span>
              <span className="block text-[13px] text-ink-soft">{r.detail}</span>
              {r.why && <span className="mt-0.5 block text-[12px] text-ink-faint">Why it matters: {r.why}</span>}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint transition group-hover:translate-x-1 group-hover:text-npurple" />
          </button>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- 5. Plan ahead (what-if) ---------------- */

export function PlanCard({ item, readOnly }: { item: CourseItem; readOnly?: boolean }) {
  const { setUser } = useSession();
  const { learner: user } = useLearner();
  const toast = useToast();
  const s = item.snapshot;
  const [minutes, setMinutes] = useState(user.goal?.minutesPerDay ?? 20);
  const [days, setDays] = useState(user.goal?.daysPerWeek ?? 4);
  const [saving, setSaving] = useState(false);
  const now = useMemo(() => Date.now(), []);
  const sim = useMemo(() => simulateWhatIf(item.course, item.enrollment, s.engagement, s.topics, minutes, days, now), [item, s, minutes, days, now]);
  const done = s.credentialEarned || s.completion.minutesRemaining === 0;

  const savePlan = async () => {
    setSaving(true);
    try {
      const r = await api('/auth/profile', { method: 'PATCH', body: { goal: { statement: user.goal?.statement ?? '', why: user.goal?.why ?? '', minutesPerDay: minutes, daysPerWeek: days } } });
      setUser(r.user);
      toast('success', `Plan saved: ${minutes} minutes, ${days} days a week.`);
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="h-full">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-npurple" />
        <h3 className="text-lg font-bold">Plan ahead</h3>
      </div>
      {done ? (
        <p className="mt-4 rounded-2xl bg-ngreen-soft px-4 py-3 text-sm text-ngreen-ink">Course finished. Nothing left to plan.</p>
      ) : (
        <>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="flex justify-between text-sm font-semibold">
                Minutes a day <span className="text-nblue">{minutes}</span>
              </span>
              <input type="range" min={5} max={120} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="mt-1 w-full accent-[#1F6BFF]" />
            </label>
            <label className="block">
              <span className="flex justify-between text-sm font-semibold">
                Days a week <span className="text-npurple">{days}</span>
              </span>
              <input type="range" min={1} max={7} step={1} value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-1 w-full accent-[#8B3DFF]" />
            </label>
          </div>
          <motion.div
            key={sim.estimatedDate}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="relative mt-5 overflow-hidden rounded-3xl bg-gradient-to-r from-nblue-soft via-npurple-soft to-npink-soft/70 px-5 py-4"
          >
            <motion.span
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-nblue/25 to-npink/20 blur-2xl"
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div className="relative">
              <div className="text-[13px] font-semibold text-npurple">At this pace you would finish on</div>
              <div className="grad-text font-display text-[30px] font-extrabold leading-tight">{fmtDate(sim.estimatedDate)}</div>
              <div className="mt-1 text-[13px] font-semibold text-ink-soft">
                {!sim.estimatedDate || !s.completion.estimatedDate
                  ? 'Set a pace to see your finish date'
                  : sim.estimatedDate < s.completion.estimatedDate
                    ? 'Earlier than your current pace'
                    : sim.estimatedDate > s.completion.estimatedDate
                      ? 'Later than your current pace'
                      : 'The same as your current pace'}
              </div>
            </div>
          </motion.div>
          {!readOnly && (
            <Button size="sm" variant="secondary" className="mt-4" loading={saving} onClick={savePlan} icon={<CalendarCheck className="h-4 w-4" />}>
              Save as my plan
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

/* ---------------- Progress page pieces ---------------- */

const STATE_COLOR: Record<string, string> = {
  'Not started': '#C9CBDA',
  Seen: '#9DBDFF',
  Practicing: '#FF2E93',
  Developing: '#8B3DFF',
  Solid: '#1F6BFF',
  Strong: '#00C77F',
};

export function TopicsCard({ item, readOnly }: { item: CourseItem; readOnly?: boolean }) {
  return (
    <Card>
      <h3 className="text-lg font-bold">Understanding by topic</h3>
      <div className="mt-4 space-y-5">
        {item.course.modules.map((m) => {
          const topics = item.snapshot.topics.filter((t) => t.moduleId === m.id);
          return (
            <div key={m.id}>
              <div className="mb-1.5 text-xs font-semibold text-ink-faint">{m.title}</div>
              <div className="space-y-1">
                {topics.map((t) => (
                  <TopicRow key={t.lessonId} t={t} courseId={item.course.id} readOnly={readOnly} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TopicRow({ t, courseId, readOnly }: { t: TopicStatus; courseId: string; readOnly?: boolean }) {
  const shown = t.bestCheck === null ? null : t.score;
  return (
    <button type="button" disabled={readOnly} onClick={() => navigate(`study/${courseId}/${t.lessonId}`)} className="grid w-full grid-cols-[1fr_120px_90px] items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm transition enabled:hover:bg-mist">
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate">{t.topic}</span>
        {t.reviewDue && (
          <Pill color="purple">
            <Repeat className="h-3 w-3" /> review
          </Pill>
        )}
      </span>
      <Bar value={shown ?? (t.state === 'Seen' ? 6 : 0)} color={STATE_COLOR[t.state]} height={7} />
      <span className="text-right text-xs font-semibold" style={{ color: STATE_COLOR[t.state] }}>
        {shown === null ? t.state : `${shown}% ${t.state}`}
      </span>
    </button>
  );
}

export function StudyTimeCard({ item }: { item: CourseItem }) {
  const e = item.snapshot.engagement;
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-bold">Study time</h3>
        <span className="text-sm text-ink-soft">{fmtMinutes(e.totalActiveMinutes)} in total</span>
      </div>
      <div className="mt-4">
        <DayBars days={e.daily} height={90} />
      </div>
    </Card>
  );
}
