import { AlertTriangle, CheckCircle2, Eye, Gauge, Info } from 'lucide-react';
import { useState } from 'react';
import type { PublicUser } from '../../shared/types';
import { METRIC_TEXT, QUESTION_KIND_LABEL } from '../../shared/metrics';
import type { AssessmentDesign } from '../../shared/metrics';
import { api } from '../lib/api';
import { pct, scoreColor } from '../lib/format';
import { Avatar, Bar, Button, Card, cx, Empty, ErrorBox, Loading, navigate, PageHeader, Tabs, useLoad } from '../components/ui';
import { InfoTip } from '../learner/LearningMetrics';
import { CourseSelect } from './Cohort';

type Flag = 'not_measured' | 'completed_needs_practice' | 'concepts' | 'application' | 'building' | 'on_track';

interface MetricsData {
  course: { id: string; title: string; passMark: number } | null;
  courses: { id: string; title: string }[];
  summary: {
    learners: number;
    avgComprehension: number | null;
    comprehensionMeasured: number;
    avgMastery: number | null;
    masteryMeasured: number;
    completedNeedsPractice: number;
    applicationGap: number;
    awaitingScore: number;
  };
  distribution: Record<'comprehension' | 'mastery', { label: string; count: number; tone: 'good' | 'near' | 'low' | 'none' }[]>;
  evidence: { key: string; label: string; metric: 'comprehension' | 'mastery'; weight: number; avg: number | null; learners: number }[];
  objectives: { objectiveId: string; title: string; where: string; comprehension: number | null; comprehensionLearners: number; mastery: number | null; masteryLearners: number }[];
  rubrics: {
    lessonId: string;
    lessonTitle: string;
    activityTitle: string;
    scored: number;
    awaiting: number;
    avgPercent: number | null;
    rubricPdf?: { name: string; url: string; maxPoints: number };
    bands?: { high: number; mid: number; low: number };
    criteria: { id: string; label: string; met: number; partially: number; notMet: number; percent: number | null }[];
  }[];
  finalItems: { id: string; question: string; kind: 'knowledge' | 'scenario'; objective: string; answered: number; percentCorrect: number | null }[];
  design: AssessmentDesign;
  forecast?: { attempts: number; meanError: number | null; withinRange: number | null };
  rows: {
    user: PublicUser;
    completion: number;
    lessonsDone: number;
    lessonsTotal: number;
    credential: boolean;
    comprehension: number | null;
    mastery: number | null;
    checkpoints: number;
    awaitingScore: number;
    flag: Flag;
  }[];
}

const FLAG: Record<Flag, { label: string; hint: string; cls: string }> = {
  completed_needs_practice: { label: 'Finished, needs practice', hint: 'Every lesson is complete, but the score is below the pass mark.', cls: 'bg-npink-soft text-npink' },
  concepts: { label: 'Needs work on concepts', hint: 'Comprehension is below the pass mark.', cls: 'bg-npink-soft text-npink' },
  application: { label: 'Understands, needs application', hint: 'Comprehension is at or above the pass mark; Mastery is below it. More applied practice will help.', cls: 'bg-[#fff4d9] text-[#9a5b00]' },
  building: { label: 'Building evidence', hint: 'Comprehension is measured; no applied work has been scored yet.', cls: 'bg-nblue-soft text-nblue' },
  on_track: { label: 'On track', hint: 'Both metrics are at or above the pass mark.', cls: 'bg-ngreen-soft text-ngreen-ink' },
  not_measured: { label: 'Not measured yet', hint: 'Fewer than two scored checkpoints so far.', cls: 'bg-mist text-ink-soft' },
};

const TONE = { good: '#00C77F', near: '#1F6BFF', low: '#FF2E93', none: '#C9CBDA' };

function Tile({ label, value, sub, color, info }: { label: string; value: string; sub: string; color?: string; info?: string }) {
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-1 text-[13px] font-semibold text-ink-soft">
        {label}
        {info && <InfoTip label={label} text={info} />}
      </div>
      <div className="mt-1 font-display text-[28px] font-extrabold leading-tight" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-ink-faint">{sub}</div>
    </Card>
  );
}

function Distribution({ title, bands, total }: { title: string; bands: MetricsData['distribution']['comprehension']; total: number }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-semibold">{title}</div>
      <div className="flex h-3 overflow-hidden rounded-full bg-mist">
        {bands.map((b) => (b.count ? <div key={b.label} title={`${b.label}: ${b.count}`} style={{ width: `${(b.count / Math.max(1, total)) * 100}%`, background: TONE[b.tone] }} /> : null))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
        {bands.map((b) => (
          <span key={b.label} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: TONE[b.tone] }} />
            {b.label}: <b className="text-ink">{b.count}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Metrics() {
  const [courseId, setCourseId] = useState('');
  const [tab, setTab] = useState<'learners' | 'objectives' | 'rubrics' | 'final' | 'design'>('learners');
  const { data, error, loading, reload } = useLoad(() => api<MetricsData>(`/staff/metrics${courseId ? `?courseId=${courseId}` : ''}`), [courseId]);
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Could not load'} onRetry={() => void reload()} />;
  if (!data.course)
    return <Empty icon={<Gauge className="h-6 w-6" />} title="No courses yet" text="Create a course to see Comprehension and Mastery." action={<Button onClick={() => navigate('courses')}>Go to My Courses</Button>} />;

  const s = data.summary;
  const P = data.course.passMark;
  const warn = data.design.issues.filter((i) => i.severity === 'warn').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Comprehension & Mastery"
        subtitle="How well learners understand the concepts, and how well they can apply them at work. Completion is tracked separately."
        actions={<CourseSelect courses={data.courses} value={data.course.id} onChange={setCourseId} />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Average Comprehension" value={pct(s.avgComprehension)} sub={`${s.comprehensionMeasured} of ${s.learners} learners measured`} color={scoreColor(s.avgComprehension)} info="How well learners understand the concepts, principles, terminology, and appropriate choices. From knowledge checks (45%), scenario judgment questions (25%), and final assessment knowledge items (30%). Averaged over measured learners." />
        <Tile label="Average Mastery" value={pct(s.avgMastery)} sub={`${s.masteryMeasured} of ${s.learners} learners measured`} color={scoreColor(s.avgMastery)} info="How well learners can apply the concepts in a realistic workplace task. From Comprehension (30%), rubric-scored applied activities (45%), and final scenario items (25%). Averaged over measured learners." />
        <Tile label="Understand, need application" value={String(s.applicationGap)} sub={`Comprehension ${P}%+, Mastery below ${P}%`} />
        <Tile label="Activities to score" value={String(s.awaitingScore)} sub="Scoring them turns applied work into Mastery evidence" />
      </div>

      {warn > 0 && (
        <button type="button" onClick={() => setTab('design')} className="flex w-full items-center gap-2 rounded-2xl border border-[#F5A300]/40 bg-[#fff4d9] px-4 py-3 text-left text-sm text-[#7a4a00]">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          This course is missing some evidence the metrics need ({warn} {warn === 1 ? 'item' : 'items'}). See Assessment design.
        </button>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="space-y-5">
          <h3 className="text-lg font-bold">Where learners are</h3>
          <Distribution title="Comprehension" bands={data.distribution.comprehension} total={s.learners} />
          <Distribution title="Mastery" bands={data.distribution.mastery} total={s.learners} />
          {s.completedNeedsPractice > 0 && (
            <p className="rounded-xl bg-npink-soft px-3 py-2 text-[13px] text-npink">
              {s.completedNeedsPractice} {s.completedNeedsPractice === 1 ? 'learner has' : 'learners have'} completed every lesson but still {s.completedNeedsPractice === 1 ? 'needs' : 'need'} more practice.
            </p>
          )}
        </Card>
        <Card>
          <h3 className="text-lg font-bold">Evidence behind the metrics</h3>
          <p className="text-xs text-ink-faint">Class average for each kind of evidence, with its recommended weight.</p>
          {(['comprehension', 'mastery'] as const).map((m) => (
            <div key={m} className="mt-4">
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-faint">{METRIC_TEXT[m].name}</div>
              <div className="space-y-2.5">
                {m === 'mastery' && (
                  <div className="flex items-center justify-between text-sm text-ink-soft">
                    <span>Comprehension score <span className="text-ink-faint">(30%)</span></span>
                    <span className="font-semibold">{pct(s.avgComprehension)}</span>
                  </div>
                )}
                {data.evidence
                  .filter((e) => e.metric === m)
                  .map((e) => (
                    <div key={e.key}>
                      <div className="flex justify-between gap-2 text-sm">
                        <span>
                          {e.label} <span className="text-ink-faint">({e.weight}%)</span>
                        </span>
                        <span className="shrink-0 font-semibold" style={{ color: scoreColor(e.avg) }}>
                          {e.avg === null ? 'No evidence yet' : `${e.avg}%`}
                          <span className="ml-1 text-xs font-normal text-ink-faint">{e.learners ? `· ${e.learners}` : ''}</span>
                        </span>
                      </div>
                      <Bar value={e.avg} color={scoreColor(e.avg)} height={6} className="mt-1" />
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </Card>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'learners', label: 'Learners', count: data.rows.length },
          { value: 'objectives', label: 'By learning objective', count: data.objectives.length },
          { value: 'rubrics', label: 'Rubrics', count: data.rubrics.length },
          { value: 'final', label: 'Final assessment items', count: data.finalItems.length },
          { value: 'design', label: 'Assessment design', count: warn },
        ]}
      />

      {tab === 'learners' &&
        (data.rows.length === 0 ? (
          <Empty title="No learners in this course yet" />
        ) : (
          <Card className="!p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-mist/60 text-[12px] uppercase tracking-wide text-ink-soft">
                    <th className="px-5 py-3 font-bold">Learner</th>
                    <th className="px-4 py-3 font-bold">Completion</th>
                    <th className="px-4 py-3 font-bold">Comprehension</th>
                    <th className="px-4 py-3 font-bold">Mastery</th>
                    <th className="px-4 py-3 font-bold">What they need</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.rows.map((r) => (
                    <tr key={r.user.id} className="hover:bg-mist/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar initials={r.user.initials} size={30} />
                          <div className="min-w-0">
                            <div className="truncate font-semibold">{r.user.name}</div>
                            <div className="text-xs text-ink-faint">{r.checkpoints} scored checkpoints{r.awaitingScore ? ` · ${r.awaitingScore} to score` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.lessonsDone}/{r.lessonsTotal} lessons
                        <div className="text-xs text-ink-faint">{r.credential ? 'Certificate earned' : `${r.completion}%`}</div>
                      </td>
                      <td className="px-4 py-3 font-bold" style={{ color: r.comprehension === null ? '#8A8AA3' : scoreColor(r.comprehension) }}>
                        {r.comprehension === null ? <span className="font-normal">{METRIC_TEXT.comprehension.pending}</span> : `${r.comprehension}%`}
                      </td>
                      <td className="px-4 py-3 font-bold" style={{ color: r.mastery === null ? '#8A8AA3' : scoreColor(r.mastery) }}>
                        {r.mastery === null ? <span className="font-normal">{METRIC_TEXT.mastery.pending}</span> : `${r.mastery}%`}
                      </td>
                      <td className="px-4 py-3">
                        <span title={FLAG[r.flag].hint} className={cx('whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', FLAG[r.flag].cls)}>
                          {FLAG[r.flag].label}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Button size="sm" variant="secondary" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => navigate(`learner/${r.user.id}?course=${data.course!.id}`)}>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-line px-5 py-3 text-xs text-ink-faint">Sorted with the learners who most need help first. Pass mark: {P}%.</p>
          </Card>
        ))}

      {tab === 'objectives' && (
        <Card className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-mist/60 text-[12px] uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3 font-bold">Learning objective</th>
                  <th className="px-4 py-3 font-bold">Comprehension</th>
                  <th className="px-4 py-3 font-bold">Mastery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.objectives.map((o) => {
                  const low = (o.comprehension !== null && o.comprehension < P) || (o.mastery !== null && o.mastery < P);
                  return (
                    <tr key={o.objectiveId}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 font-semibold">
                          {low && <AlertTriangle className="h-3.5 w-3.5 text-npink" aria-label="Below pass mark" />}
                          {o.title}
                        </div>
                        <div className="text-xs text-ink-faint">{o.where}</div>
                      </td>
                      {([
                        [o.comprehension, o.comprehensionLearners],
                        [o.mastery, o.masteryLearners],
                      ] as const).map(([v, n], i) => (
                        <td key={i} className="w-[200px] px-4 py-3">
                          {v === null ? (
                            <span className="text-ink-faint">No evidence yet</span>
                          ) : (
                            <>
                              <div className="flex justify-between text-sm">
                                <b style={{ color: scoreColor(v) }}>{v}%</b>
                                <span className="text-xs text-ink-faint">{n} learners</span>
                              </div>
                              <Bar value={v} color={scoreColor(v)} height={5} className="mt-1" />
                            </>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-faint">Each lesson is one learning objective. A course's metrics are the average of its objectives, so a topic with many questions cannot outweigh the others.</p>
        </Card>
      )}

      {tab === 'rubrics' &&
        (data.rubrics.length === 0 ? (
          <Empty title="No activity has a rubric yet" text="Upload a rubric PDF to activities in Course Builder so applied work counts toward Mastery." action={<Button onClick={() => navigate(`courses/edit/${data.course!.id}`)}>Open Course Builder</Button>} />
        ) : (
          <div className="space-y-4">
            {data.rubrics.map((r) => (
              <Card key={r.lessonId}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="font-semibold">{r.activityTitle}</div>
                    <div className="text-xs text-ink-faint">{r.lessonTitle}</div>
                  </div>
                  <div className="text-sm text-ink-soft">
                    {r.scored} scored{r.awaiting ? ` · ${r.awaiting} to score` : ''} · average <b style={{ color: scoreColor(r.avgPercent) }}>{pct(r.avgPercent)}</b>
                  </div>
                </div>
                {r.rubricPdf && r.bands && (
                  <div className="mt-3">
                    <a href={r.rubricPdf.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-nblue hover:underline">
                      Rubric: {r.rubricPdf.name} (out of {r.rubricPdf.maxPoints})
                    </a>
                    {(() => {
                      const n = r.bands.high + r.bands.mid + r.bands.low;
                      return (
                        <div className="mt-2 grid items-center gap-2 sm:grid-cols-[1fr_auto]">
                          <div className="flex h-2.5 overflow-hidden rounded-full bg-mist">
                            {n > 0 && (
                              <>
                                <div style={{ width: `${(r.bands.high / n) * 100}%`, background: '#00C77F' }} />
                                <div style={{ width: `${(r.bands.mid / n) * 100}%`, background: '#F5A300' }} />
                                <div style={{ width: `${(r.bands.low / n) * 100}%`, background: '#FF2E93' }} />
                              </>
                            )}
                          </div>
                          <span className="text-xs text-ink-soft">
                            80%+ {r.bands.high} · 50 to 79% {r.bands.mid} · under 50% {r.bands.low}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
                <div className="mt-3 space-y-2.5">
                  {r.criteria.map((c) => {
                    const n = c.met + c.partially + c.notMet;
                    return (
                      <div key={c.id} className="grid items-center gap-2 sm:grid-cols-[1fr_240px_60px]">
                        <span className="text-sm">{c.label}</span>
                        <div className="flex h-2.5 overflow-hidden rounded-full bg-mist" title={`Met ${c.met} · Partially met ${c.partially} · Not met ${c.notMet}`}>
                          {n > 0 && (
                            <>
                              <div style={{ width: `${(c.met / n) * 100}%`, background: '#00C77F' }} />
                              <div style={{ width: `${(c.partially / n) * 100}%`, background: '#F5A300' }} />
                              <div style={{ width: `${(c.notMet / n) * 100}%`, background: '#FF2E93' }} />
                            </>
                          )}
                        </div>
                        <span className="text-right text-sm font-semibold" style={{ color: scoreColor(c.percent) }}>
                          {pct(c.percent)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {r.criteria.length > 0 && (
                <div className="mt-3 flex gap-4 text-xs text-ink-faint">
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-ngreen" />Met</span>
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#F5A300]" />Partially met</span>
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-npink" />Not met</span>
                </div>
                )}
              </Card>
            ))}
          </div>
        ))}

      {tab === 'final' &&
        (data.finalItems.length === 0 ? (
          <Empty title="This course has no final assessment" />
        ) : (
          <Card className="!p-0">
            <div className="divide-y divide-line">
              {data.finalItems.map((q, i) => (
                <div key={q.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="w-6 text-xs font-bold text-ink-faint">{i + 1}</span>
                  <div className="min-w-[240px] flex-1">
                    <div className="text-sm">{q.question}</div>
                    <div className="text-xs text-ink-faint">
                      {QUESTION_KIND_LABEL[q.kind]} → {q.kind === 'scenario' ? 'Mastery' : 'Comprehension'} · {q.objective}
                    </div>
                  </div>
                  <div className="w-[140px] text-right text-sm">
                    {q.percentCorrect === null ? <span className="text-ink-faint">Not answered yet</span> : <b style={{ color: scoreColor(q.percentCorrect) }}>{q.percentCorrect}% correct</b>}
                    {q.answered > 0 && <div className="text-xs text-ink-faint">{q.answered} learners</div>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}

      {tab === 'design' && (
        <Card>
          <h3 className="text-lg font-bold">Assessment design</h3>
          <p className="text-sm text-ink-soft">What this course, as built in Course Builder, gives each metric.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              ['Lesson questions', `${data.design.lessonKnowledge} knowledge · ${data.design.lessonScenario} scenario`],
              ['Final questions', `${data.design.finalKnowledge} knowledge · ${data.design.finalScenario} scenario`],
              ['Activities with a rubric', `${data.design.activitiesWithRubric} of ${data.design.activities}`],
              ['Forecast accuracy (final attempts)', data.forecast?.attempts ? `${data.forecast.attempts} attempts · off by ${data.forecast.meanError} points on average · ${data.forecast.withinRange}% inside the predicted range` : 'No final attempts yet'],
            ].map(([l, v]) => (
              <div key={l} className="rounded-2xl bg-mist px-4 py-3">
                <div className="text-xs text-ink-faint">{l}</div>
                <div className="font-semibold">{v}</div>
              </div>
            ))}
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {data.design.issues.length === 0 && (
              <li className="flex items-center gap-2 text-ngreen-ink">
                <CheckCircle2 className="h-4 w-4" /> Every kind of evidence is in place.
              </li>
            )}
            {data.design.issues.map((x) => (
              <li key={x.text} className="flex gap-2">
                {x.severity === 'warn' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#F5A300]" /> : <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />}
                {x.text}
              </li>
            ))}
          </ul>
          <Button className="mt-4" variant="secondary" onClick={() => navigate(`courses/edit/${data.course!.id}`)}>
            Open Course Builder
          </Button>
        </Card>
      )}
    </div>
  );
}
