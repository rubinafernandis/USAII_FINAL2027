import { Mail } from 'lucide-react';
import { useState } from 'react';
import { flattenLessons } from '../../shared/analytics';
import { fmtDateTime } from '../lib/format';
import ThreadBoard from '../components/ThreadBoard';
import { Card, Empty, navigate, PageHeader, Tabs } from '../components/ui';
import { useLearner } from './context';

export default function Ask({ threadId, query }: { threadId?: string; query: URLSearchParams }) {
  const { home, active } = useLearner();
  const [tab, setTab] = useState<'questions' | 'messages'>((query.get('tab') as 'messages') ?? 'questions');
  const courses = home.items.map((i) => ({ id: i.course.id, title: i.course.title, lessons: flattenLessons(i.course).map((f) => ({ id: f.lesson.id, title: f.lesson.title })) }));
  return (
    <div>
      <PageHeader title="Ask" subtitle="Send a private question to your instructor. Only your instructor can see it." />
      <Tabs
        value={tab}
        onChange={(v) => {
          setTab(v);
          if (threadId) navigate('ask');
        }}
        tabs={[
          { value: 'questions', label: 'My Questions' },
          { value: 'messages', label: 'From My Instructor', count: home.messages.length },
        ]}
      />
      {tab === 'questions' && (courses.length ? <ThreadBoard courses={courses} threadId={threadId} basePath="ask" query={query} /> : <Empty title="Enroll in a course to ask questions" />)}
      {tab === 'messages' && (
        <div className="max-w-3xl space-y-3">
          {home.messages.length === 0 && <Empty icon={<Mail className="h-6 w-6" />} title="No messages yet" text="Personal notes from your instructor appear here." />}
          {home.messages.map((m) => (
            <Card key={m.id}>
              <div className="flex flex-wrap justify-between gap-2">
                <div className="font-bold">{m.subject}</div>
                <div className="text-xs text-ink-faint">{fmtDateTime(m.createdAt)}</div>
              </div>
              <div className="text-sm text-npurple">From {m.fromName}</div>
              <p className="mt-2 whitespace-pre-line">{m.body}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
