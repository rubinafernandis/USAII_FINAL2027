import { Download, MessageSquareHeart, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { FeedbackKind } from '../../shared/types';
import { api } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { Avatar, Button, Card, cx, Empty, ErrorBox, Input, Loading, PageHeader, Select, Tabs, useLoad } from '../components/ui';

interface Entry {
  id: string;
  kind: FeedbackKind;
  learner: { id: string; name: string; email: string; initials: string };
  courseId: string | null;
  courseTitle: string | null;
  stars: number | null;
  recommend: boolean | null;
  recommendUsaii: boolean | null;
  ease: number | null;
  comment: string;
  at: string;
}

interface Data {
  courses: { id: string; title: string }[];
  selected: string;
  summary: {
    recommendUsaii: number | null;
    recommendUsaiiAnswers: number;
    courseRating: number | null;
    courseRatings: number;
    lmsRating: number | null;
    lmsRatings: number;
    recommendLms: number | null;
    recommendLmsAnswers: number;
    checkinRecommend: number | null;
    checkinEase: number | null;
    checkins: number;
    comments: number;
  };
  entries: Entry[];
}

/** Where each answer was given, in the learner's own words on screen. */
const KIND: Record<FeedbackKind, { label: string; where: string; cls: string }> = {
  recommend: { label: 'Would recommend USAII® Courses', where: 'Give Feedback', cls: 'bg-ngreen-soft text-ngreen-ink' },
  course: { label: 'Course rating', where: 'Give Feedback · Rate My Course', cls: 'bg-nblue-soft text-nblue' },
  platform: { label: 'LMS rating', where: 'Give Feedback · Rate the USAII® LMS', cls: 'bg-npurple-soft text-npurple' },
  pulse: { label: 'Check-in', where: 'My Learning · quick check-in', cls: 'bg-mist text-ink-soft' },
};

const Stars = ({ n }: { n: number }) => (
  <span className="inline-flex items-center gap-0.5" aria-label={`${n} of 5 stars`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} className={cx('h-3.5 w-3.5', i <= n ? 'fill-[#F5A300] text-[#F5A300]' : 'text-line')} />
    ))}
  </span>
);

const YesNo = ({ v }: { v: boolean }) => (
  <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', v ? 'bg-ngreen-soft text-ngreen-ink' : 'bg-npink-soft text-npink')}>
    {v ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
    {v ? 'Yes' : 'No'}
  </span>
);

function answerText(e: Entry) {
  const parts: string[] = [];
  if (e.stars) parts.push(`${e.stars} of 5 stars`);
  if (e.recommend !== null) parts.push(`${e.kind === 'pulse' ? 'Would recommend the course' : 'Would recommend USAII® Courses'}: ${e.recommend ? 'Yes' : 'No'}`);
  if (e.recommendUsaii !== null) parts.push(`Would recommend USAII®: ${e.recommendUsaii ? 'Yes' : 'No'}`);
  if (e.ease) parts.push(`Next step ease: ${e.ease} of 5`);
  return parts.join('; ');
}

function downloadCsv(rows: Entry[]) {
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    ['Date', 'Learner', 'Email', 'Type', 'Where', 'Course', 'Stars', 'Recommend', 'Recommend USAII®', 'Next step ease', 'Comment'].map(q).join(','),
    ...rows.map((e) =>
      [
        new Date(e.at).toLocaleString('en-US'),
        e.learner.name,
        e.learner.email,
        KIND[e.kind].label,
        KIND[e.kind].where,
        e.courseTitle ?? '',
        e.stars ? String(e.stars) : '',
        e.recommend === null ? '' : e.recommend ? 'Yes' : 'No',
        e.recommendUsaii === null ? '' : e.recommendUsaii ? 'Yes' : 'No',
        e.ease ? String(e.ease) : '',
        e.comment,
      ]
        .map(q)
        .join(','),
    ),
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'usaii-learner-feedback.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function LearnerFeedback() {
  const [courseId, setCourseId] = useState('all');
  const [tab, setTab] = useState<'all' | FeedbackKind | 'comments'>('all');
  const [query, setQuery] = useState('');
  const { data, error, loading, reload } = useLoad(() => api<Data>(`/staff/feedback?courseId=${courseId}`), [courseId]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.entries ?? [])
      .filter((e) => (tab === 'all' ? true : tab === 'comments' ? !!e.comment : e.kind === tab))
      .filter((e) => !q || e.learner.name.toLowerCase().includes(q) || e.comment.toLowerCase().includes(q) || (e.courseTitle ?? '').toLowerCase().includes(q));
  }, [data, tab, query]);

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Could not load feedback'} onRetry={() => void reload()} />;
  const s = data.summary;
  const count = (k: FeedbackKind) => data.entries.filter((e) => e.kind === k).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Learner Feedback"
        subtitle="Every answer learners give on Give Feedback and in the My Learning check-in. Each learner's latest answer is kept; answering again replaces the earlier one."
        actions={
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="!w-auto min-w-[240px] !rounded-full !py-2" aria-label="Choose course">
            <option value="all">All my courses</option>
            {data.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </Select>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card className="!p-4">
          <div className="text-[13px] font-semibold text-ink-soft">Would recommend USAII®</div>
          <div className="font-display text-[28px] font-extrabold text-ngreen-ink">{s.recommendLms === null ? '—' : `${s.recommendLms}%`}</div>
          <div className="text-xs text-ink-faint">{s.recommendLmsAnswers} answered, on the LMS rating</div>
        </Card>
        <Card className="!p-4">
          <div className="text-[13px] font-semibold text-ink-soft">Would recommend USAII® Courses</div>
          <div className="font-display text-[28px] font-extrabold text-ngreen-ink">{s.recommendUsaii === null ? '—' : `${s.recommendUsaii}%`}</div>
          <div className="text-xs text-ink-faint">{s.recommendUsaiiAnswers} answered Yes or No</div>
        </Card>
        <Card className="!p-4">
          <div className="text-[13px] font-semibold text-ink-soft">Course rating</div>
          <div className="font-display text-[28px] font-extrabold text-nblue">{s.courseRating === null ? '—' : `${s.courseRating.toFixed(1)} / 5`}</div>
          <div className="text-xs text-ink-faint">{s.courseRatings} ratings{courseId === 'all' ? ', all courses' : ''}</div>
        </Card>
        <Card className="!p-4">
          <div className="text-[13px] font-semibold text-ink-soft">USAII® LMS rating</div>
          <div className="font-display text-[28px] font-extrabold text-npurple">{s.lmsRating === null ? '—' : `${s.lmsRating.toFixed(1)} / 5`}</div>
          <div className="text-xs text-ink-faint">{s.lmsRatings} ratings</div>
        </Card>
        <Card className="!p-4">
          <div className="text-[13px] font-semibold text-ink-soft">My Learning check-in</div>
          <div className="font-display text-[28px] font-extrabold">{s.checkinRecommend === null ? '—' : `${s.checkinRecommend}% Yes`}</div>
          <div className="text-xs text-ink-faint">
            {s.checkins} check-ins{s.checkinEase !== null ? ` · next step ease ${s.checkinEase.toFixed(1)} / 5` : ''}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'all', label: 'All', count: data.entries.length },
            { value: 'comments', label: 'With comments', count: s.comments },
            { value: 'course', label: 'Course ratings', count: count('course') },
            { value: 'platform', label: 'LMS ratings', count: count('platform') },
            { value: 'recommend', label: 'Would recommend', count: count('recommend') },
            { value: 'pulse', label: 'Check-ins', count: count('pulse') },
          ]}
        />
        <div className="flex gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search learner, course, or comment" className="!w-[260px]" aria-label="Search feedback" />
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} disabled={!rows.length} onClick={() => downloadCsv(rows)}>
            Export CSV
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty icon={<MessageSquareHeart className="h-6 w-6" />} title="No feedback here yet" text="Answers appear here as soon as learners send them." />
      ) : (
        <Card className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-mist/60 text-[12px] uppercase tracking-wide text-ink-soft">
                  <th className="px-5 py-3 font-bold">Learner</th>
                  <th className="px-4 py-3 font-bold">Feedback</th>
                  <th className="px-4 py-3 font-bold">Answer</th>
                  <th className="px-4 py-3 font-bold">Comment</th>
                  <th className="px-5 py-3 font-bold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((e) => (
                  <tr key={e.id} className="align-top hover:bg-mist/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={e.learner.initials} size={30} />
                        <div className="min-w-0">
                          <div className="font-semibold">{e.learner.name}</div>
                          <div className="truncate text-xs text-ink-faint">{e.learner.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cx('whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', KIND[e.kind].cls)}>{KIND[e.kind].label}</span>
                      <div className="mt-1 text-xs text-ink-faint">{KIND[e.kind].where}</div>
                      {e.courseTitle && <div className="text-xs text-ink-soft">{e.courseTitle}</div>}
                    </td>
                    <td className="space-y-1 px-4 py-3">
                      {e.stars ? <Stars n={e.stars} /> : null}
                      {e.recommend !== null && (
                        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                          {e.kind === 'pulse' && 'Recommend course'}
                          <YesNo v={e.recommend} />
                        </div>
                      )}
                      {e.recommendUsaii !== null && (
                        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                          Recommend USAII®
                          <YesNo v={e.recommendUsaii} />
                        </div>
                      )}
                      {e.ease ? <div className="text-xs text-ink-soft">Next step ease: <b className="text-ink">{e.ease} / 5</b></div> : null}
                      <span className="sr-only">{answerText(e)}</span>
                    </td>
                    <td className="max-w-[360px] px-4 py-3 text-ink-soft">{e.comment ? `“${e.comment}”` : <span className="text-ink-faint">No comment</span>}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-ink-faint">{fmtDateTime(e.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
