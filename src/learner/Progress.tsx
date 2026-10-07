import { useState } from 'react';
import { BENCHMARK, flattenLessons, letterFor, progressOf } from '../../shared/analytics';
import { pct, scoreColor } from '../lib/format';
import { Bar, Button, Card, cx, Empty, navigate, PageHeader } from '../components/ui';
import { CourseSwitcher } from './Dashboard';
import { useLearner, type CourseItem } from './context';
import { StudyTimeCard, TopicsCard } from './widgets';

function status(value: number | null, good: number, close: number) {
  if (value === null) return { text: 'No data yet', cls: 'bg-mist text-ink-faint' };
  if (value >= good) return { text: 'On track', cls: 'bg-ngreen-soft text-ngreen-ink' };
  if (value >= close) return { text: 'Almost there', cls: 'bg-nblue-soft text-nblue' };
  return { text: 'Needs attention', cls: 'bg-npurple-soft text-npurple' };
}

/** The four core learning metrics from the program overview, in plain words. */
function MetricsCard({ item }: { item: CourseItem }) {
  const e = item.snapshot.engagement;
  const p = item.snapshot.prediction;
  const rows = [
    { name: 'Study consistency', what: 'Days you studied this week', value: `${e.activeDaysLast7} of 7 days`, goal: `${BENCHMARK.daysPerWeek} days`, st: status(e.activeDaysLast7, BENCHMARK.daysPerWeek, 3) },
    { name: 'Focused study time', what: 'Average length of a study session', value: `${e.avgSessionMinutes} min`, goal: '20 min or more', st: status(e.totalActiveMinutes ? e.avgSessionMinutes : null, 20, 10) },
    { name: 'Cumulative quiz score', what: 'Average of your best quiz scores', value: pct(p.avgCheckScore), goal: `${item.course.passMark}% or more`, st: status(p.avgCheckScore, item.course.passMark, item.course.passMark - 15) },
    { name: 'Interaction depth', what: 'Quizzes, activities, and questions', value: pct(e.engagementScore), goal: '70% or more', st: status(e.engagementScore, 70, 45) },
  ];
  return (
    <Card className="!p-0 overflow-hidden">
      <h3 className="px-5 pt-5 text-lg font-bold">Your learning metrics</h3>
      <div className="mt-3 divide-y divide-line">
        {rows.map((r) => (
          <div key={r.name} className="grid items-center gap-2 px-5 py-3.5 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
            <div>
              <div className="font-semibold">{r.name}</div>
              <div className="text-xs text-ink-faint">{r.what}</div>
            </div>
            <div className="font-display text-lg font-bold">{r.value}</div>
            <div className="text-sm text-ink-soft">Goal: {r.goal}</div>
            <span className={cx('justify-self-start rounded-full px-2.5 py-1 text-xs font-bold sm:justify-self-end', r.st.cls)}>{r.st.text}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}


function ScoresCard({ item, readOnly }: { item: CourseItem; readOnly?: boolean }) {
  const rows = flattenLessons(item.course)
    .filter((f) => f.lesson.check.length)
    .map((f) => {
      const g = progressOf(item.enrollment, f.lesson.id).attempts.filter((a) => a.kind === 'check');
      return { f, best: g.length ? Math.max(...g.map((a) => a.score)) : null };
    });
  return (
    <Card>
      <h3 className="text-lg font-bold">Quiz scores</h3>
      <div className="mt-4 divide-y divide-line">
        {rows.map(({ f, best }) => (
          <div key={f.lesson.id} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm">{f.lesson.title}</span>
            {best === null ? (
              <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => navigate(`study/${item.course.id}/${f.lesson.id}?step=check`)}>
                Pending · Take quiz
              </Button>
            ) : (
              <span className="font-display font-bold" style={{ color: scoreColor(best) }}>
                {best}% <span className="ml-1 inline-block w-5 text-left">{letterFor(best)}</span>
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function GradeCard({ item }: { item: CourseItem }) {
  const p = item.snapshot.prediction;
  return (
    <Card>
      <h3 className="text-lg font-bold">How your grade is made</h3>
      <div className="mt-4 space-y-4">
        {p.breakdown.map((b) => (
          <div key={b.label}>
            <div className="flex justify-between text-sm">
              <span>
                {b.label} <span className="text-ink-faint">({b.weight}%)</span>
              </span>
              <span className="font-bold" style={{ color: scoreColor(b.score) }}>
                {b.score === null ? 'Not yet' : `${b.score}%`}
              </span>
            </div>
            <Bar value={b.score} color={scoreColor(b.score)} height={7} className="mt-1" />
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-between rounded-2xl bg-mist px-4 py-3 text-sm">
        <span>Grade so far</span>
        <span className="font-display font-bold">{pct(p.currentGrade)}</span>
      </div>
    </Card>
  );
}

export default function Progress() {
  const { active, home, readOnly } = useLearner();
  if (!active) return <Empty title="No progress yet" text="Start a course to see your progress." />;
  return (
    <div className="space-y-6">
      <PageHeader title="My Progress" subtitle="What you have learned so far." actions={home.items.length > 1 ? <CourseSwitcher /> : undefined} />
      <MetricsCard item={active} />
      <TopicsCard item={active} readOnly={readOnly} />
      <div className="grid gap-5 lg:grid-cols-2">
        <ScoresCard item={active} readOnly={readOnly} />
        <GradeCard item={active} />
      </div>
      <StudyTimeCard item={active} />
    </div>
  );
}
