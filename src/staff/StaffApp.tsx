import { Activity, BookMarked, Gauge, MessageSquareHeart, ClipboardCheck, MessageCircle, Radio, Users, UsersRound } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { Course } from '../../shared/types';
import { flattenLessons } from '../../shared/analytics';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import Shell, { type NavItem } from '../components/Shell';
import ThreadBoard, { type BoardCourse } from '../components/ThreadBoard';
import { ErrorBox, Loading, PageHeader, useLoad, useRoute } from '../components/ui';
import Cohort, { LearnerPortal } from './Cohort';
import CourseBuilder from './CourseBuilder';
import Courses from './Courses';
import { ActivityMetrics, Assessments } from './Insights';
import Learners from './Learners';
import Metrics from './Metrics';
import LearnerFeedback from './LearnerFeedback';
import NavVideoManager from './NavVideoManager';

function useStaffCourses() {
  return useLoad(async () => {
    const list = await api<{ courses: { id: string; title: string }[] }>('/staff/courses');
    const full = await Promise.all(list.courses.map((c) => api<{ course: Course }>(`/staff/courses/${c.id}`).then((r) => r.course)));
    return full.map<BoardCourse>((c) => ({ id: c.id, title: c.title, lessons: flattenLessons(c).map((f) => ({ id: f.lesson.id, title: f.lesson.title })) }));
  }, []);
}

function Inbox({ threadId, query }: { threadId?: string; query: URLSearchParams }) {
  const { data, error, loading, reload } = useStaffCourses();
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Could not load'} onRetry={() => void reload()} />;
  return (
    <div>
      <PageHeader title="Questions" subtitle="Every question your learners have sent you. Each one is private between you and that learner." />
      <ThreadBoard courses={data} threadId={threadId} basePath="inbox" query={query} />
    </div>
  );
}

export default function StaffApp() {
  const { user } = useSession();
  const { view, params, query } = useRoute();
  const [open, setOpen] = useState(0);

  // Badge: learner questions still waiting for a staff answer.
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<{ threads: { replies: { authorRole: string }[]; authorRole: string }[] }>('/threads')
        .then((r) => alive && setOpen(r.threads.filter((t) => t.authorRole === 'learner' && !t.replies.some((x) => x.authorRole !== 'learner')).length))
        .catch(() => undefined);
    void load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [view]);

  const v = view || 'cohort';

  const nav: NavItem[] = [
    { id: 'cohort', label: 'Cohort', icon: UsersRound, also: ['learner'] },
    { id: 'learners', label: 'Learners & Access', icon: Users },
    { id: 'metrics', label: 'Comprehension & Mastery', icon: Gauge },
    { id: 'assessments', label: 'Assessments', icon: ClipboardCheck },
    { id: 'feedback', label: 'Learner Feedback', icon: MessageSquareHeart },
    { id: 'activity', label: 'Activity Metrics', icon: Activity },
    { id: 'inbox', label: 'Questions', icon: MessageCircle, badge: open },
  ];
  const secondary: NavItem[] = [{ id: 'courses', label: 'My Courses', icon: BookMarked }];

  let page: ReactNode;
  switch (v) {
    case 'learner':
      page = <LearnerPortal userId={params[0] ?? ''} courseId={query.get('course') ?? undefined} />;
      break;
    case 'learners':
      page = <Learners />;
      break;
    case 'metrics':
      page = <Metrics />;
      break;
    case 'feedback':
      page = <LearnerFeedback />;
      break;
    case 'assessments':
      page = <Assessments />;
      break;
    case 'activity':
      page = <ActivityMetrics />;
      break;
    case 'inbox':
      page = <Inbox threadId={params[0]} query={query} />;
      break;
    case 'courses':
      page = params[0] === 'new' ? <CourseBuilder key="new" /> : params[0] === 'edit' && params[1] ? <CourseBuilder key={params[1]} courseId={params[1]} /> : <Courses />;
      break;
    default:
      page = <Cohort initialCourseId={query.get('course') ?? undefined} />;
  }

  return (
    <Shell nav={nav} secondary={secondary} current={v} headerExtra={<NavVideoManager />}>
      {page}
    </Shell>
  );
}
