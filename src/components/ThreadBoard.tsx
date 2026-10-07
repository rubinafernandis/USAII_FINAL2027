import { ArrowLeft, Globe2, Heart, Lock, MessageCircle, Plus, Send, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Thread } from '../../shared/types';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useSession } from '../lib/session';
import { Avatar, Button, Card, cx, Empty, ErrorBox, IconButton, Input, Label, Loading, Modal, navigate, Pill, Select, Textarea, useConfirm, useLoad, useToast } from './ui';

export interface BoardCourse {
  id: string;
  title: string;
  lessons: { id: string; title: string }[];
}

const roleTag = (r: string) => (r === 'instructor' ? 'Instructor' : null);

function Composer({
  open,
  onClose,
  courses,
  initial,
  onCreated,
  staff,
}: {
  open: boolean;
  onClose: () => void;
  courses: BoardCourse[];
  initial: { courseId?: string; lessonId?: string };
  onCreated: (t: Thread) => void;
  staff: boolean;
}) {
  const toast = useToast();
  const [courseId, setCourseId] = useState(initial.courseId ?? courses[0]?.id ?? '');
  const [lessonId, setLessonId] = useState(initial.lessonId ?? '');
  // Learners write privately to their own instructor; instructors post to the class.
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const tooShort = title.trim().length < 5;
  useEffect(() => {
    if (open) {
      setErr('');
      setCourseId(initial.courseId ?? courses[0]?.id ?? '');
      setLessonId(initial.lessonId ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const lessons = courses.find((c) => c.id === courseId)?.lessons ?? [];
  const send = async () => {
    if (tooShort) {
      setErr('Please write at least five characters so your instructor knows what you are asking.');
      return;
    }
    setErr('');
    setBusy(true);
    try {
      const r = await api('/threads', { body: { courseId, lessonId: lessonId || undefined, title, body } });
      toast('success', staff ? 'Posted to the class.' : 'Sent to your instructor.');
      setTitle('');
      setBody('');
      onCreated(r.thread);
    } catch (e) {
      setErr((e as Error).message);
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={staff ? 'Post to the Class' : 'Ask Your Instructor'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} disabled={tooShort} onClick={send} icon={<Send className="h-4 w-4" />}>
            {staff ? 'Post to the Class' : 'Send to My Instructor'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {err && <ErrorBox message={err} />}
        {!staff && (
          <div className="flex items-start gap-3 rounded-2xl border border-npurple/25 bg-npurple-soft/50 p-3.5">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-npurple" />
            <p className="text-[13px] leading-snug text-ink-soft">
              This goes straight to <span className="font-semibold text-ink">your instructor</span>. No one else can see it.
            </p>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Course</Label>
            <Select
              value={courseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setLessonId('');
              }}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label hint="(optional)">Lesson</Label>
            <Select value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
              <option value="">General</option>
              {lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label>{staff ? 'Title' : 'Your question'}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={staff ? 'Reminder: finish Day 3 by Friday' : 'How do I tell if an AI answer is reliable?'} />
          {tooShort && <p className="mt-1 text-[12px] text-ink-faint">{title.trim().length === 0 ? 'Type your question to turn on the send button.' : 'A few more characters, please.'}</p>}
        </div>
        <div>
          <Label hint="(optional)">Details</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function ThreadDetail({ thread, onChange, onDelete, onBack }: { thread: Thread; onChange: (t: Thread) => void; onDelete: () => void; onBack: () => void }) {
  const { user } = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const staff = user.role !== 'learner';
  useEffect(() => {
    if (!thread.readBy.includes(user.id)) {
      void api(`/threads/${thread.id}/read`, { body: {} })
        .then(() => {
          onChange({ ...thread, readBy: [...thread.readBy, user.id] });
          window.dispatchEvent(new Event('lms:reload-home'));
        })
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id]);
  const reply = async () => {
    setBusy(true);
    try {
      const r = await api(`/threads/${thread.id}/reply`, { body: { text } });
      onChange(r.thread);
      setText('');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const like = async (replyId?: string) => {
    try {
      const r = await api(`/threads/${thread.id}/like`, { body: { replyId } });
      onChange(r.thread);
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };
  const del = async () => {
    if (!(await confirm({ title: 'Delete this thread?', text: 'The question and all replies will be removed.', confirm: 'Delete', danger: true }))) return;
    try {
      await api(`/threads/${thread.id}`, { method: 'DELETE' });
      toast('success', 'Thread deleted.');
      onDelete();
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };
  return (
    <Card className="!p-0">
      <div className="border-b border-line p-5">
        <div className="flex items-start justify-between gap-3">
          <button onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-ink-soft hover:text-nblue lg:hidden">
            <ArrowLeft className="h-4 w-4" /> All questions
          </button>
          {(staff || thread.authorId === user.id) && (
            <IconButton label="Delete thread" onClick={del} className="ml-auto hover:!text-npink">
              <Trash2 className="h-4 w-4" />
            </IconButton>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {thread.audience === 'instructor' ? (
            <Pill color="purple">
              <Lock className="h-3 w-3" /> Private: you and your instructor
            </Pill>
          ) : (
            <Pill color="blue">
              <Globe2 className="h-3 w-3" /> Announcement
            </Pill>
          )}
          {thread.lessonTitle && <Pill color="gray">{thread.lessonTitle}</Pill>}
        </div>
        <h2 className="mt-2 text-xl font-bold">{thread.title}</h2>
        <div className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
          <Avatar initials={thread.authorName.split(' ').map((w) => w[0]).join('').slice(0, 2)} size={26} />
          {thread.authorName}
          {roleTag(thread.authorRole) && <Pill color="green">{roleTag(thread.authorRole)}</Pill>}
          <span className="text-ink-faint">{timeAgo(thread.createdAt)}</span>
        </div>
        {thread.body && <p className="mt-3 whitespace-pre-line">{thread.body}</p>}
        <button onClick={() => void like()} className={cx('mt-3 inline-flex items-center gap-1.5 text-sm font-semibold', thread.likes.includes(user.id) ? 'text-npink' : 'text-ink-faint hover:text-npink')}>
          <Heart className={cx('h-4 w-4', thread.likes.includes(user.id) && 'fill-current')} /> {thread.likes.length || ''} Helpful
        </button>
      </div>
      <div className="divide-y divide-line">
        {thread.replies.map((r) => (
          <div key={r.id} className={cx('p-5', r.authorRole !== 'learner' && 'bg-ngreen-soft/30')}>
            <div className="flex items-center gap-2 text-sm">
              <Avatar initials={r.authorName.split(' ').map((w) => w[0]).join('').slice(0, 2)} size={26} />
              <span className="font-semibold">{r.authorName}</span>
              {roleTag(r.authorRole) && <Pill color="green">{roleTag(r.authorRole)}</Pill>}
              <span className="text-ink-faint">{timeAgo(r.createdAt)}</span>
            </div>
            <p className="mt-2 whitespace-pre-line pl-8">{r.text}</p>
            <button onClick={() => void like(r.id)} className={cx('ml-8 mt-2 inline-flex items-center gap-1 text-xs font-semibold', r.likes.includes(user.id) ? 'text-npink' : 'text-ink-faint hover:text-npink')}>
              <Heart className={cx('h-3.5 w-3.5', r.likes.includes(user.id) && 'fill-current')} /> {r.likes.length || ''}
            </button>
          </div>
        ))}
        {thread.replies.length === 0 && <p className="p-5 text-sm text-ink-faint">No replies yet.</p>}
      </div>
      <div className="border-t border-line p-4">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply" className="!min-h-[72px]" />
        <div className="mt-2 flex justify-end">
          <Button size="sm" loading={busy} disabled={text.trim().length < 2} onClick={reply} icon={<Send className="h-4 w-4" />}>
            Reply
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function ThreadBoard({ courses, threadId, basePath, query }: { courses: BoardCourse[]; threadId?: string; basePath: string; query: URLSearchParams }) {
  const { user } = useSession();
  const staff = user.role !== 'learner';
  const [courseFilter, setCourseFilter] = useState(query.get('course') ?? '');
  const [filter, setFilter] = useState<'all' | 'open' | 'private' | 'mine' | 'notices'>(staff ? 'open' : 'all');
  const [composer, setComposer] = useState(query.get('new') === '1');
  const { data, setData, error, loading, reload } = useLoad(() => api<{ threads: Thread[] }>('/threads'), []);

  useEffect(() => {
    if (query.get('new') === '1') setComposer(true);
  }, [query]);

  const threads = useMemo(() => {
    let t = data?.threads ?? [];
    if (staff) t = t.filter((x) => x.authorRole === 'learner');
    if (courseFilter) t = t.filter((x) => x.courseId === courseFilter);
    if (filter === 'open') t = t.filter((x) => !x.replies.some((r) => r.authorRole !== 'learner') && x.authorRole === 'learner');
    if (filter === 'private') t = t.filter((x) => x.audience === 'instructor');
    if (filter === 'mine') t = t.filter((x) => x.authorId === user.id);
    if (filter === 'notices') t = t.filter((x) => x.authorRole !== 'learner');
    return t;
  }, [data, courseFilter, filter, user.id, staff]);
  const selected = data?.threads.find((t) => t.id === threadId);
  const setThread = (t: Thread) => setData((d) => (d ? { threads: d.threads.map((x) => (x.id === t.id ? t : x)) } : d));

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={() => void reload()} />;

  const courseTitle = (id: string) => courses.find((c) => c.id === id)?.title ?? '';
  const filters = staff
    ? ([
        ['open', 'Needs an answer'],
        ['private', 'Private'],
        ['all', 'All'],
      ] as const)
    : ([
        ['all', 'All'],
        ['mine', 'My questions'],
        ['notices', 'From my instructor'],
      ] as const);

  return (
    <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <div className={cx(selected && 'hidden lg:block')}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => setComposer(true)} icon={<Plus className="h-4 w-4" />} disabled={!courses.length}>
            {staff ? 'New Post' : 'Ask My Instructor'}
          </Button>
          {courses.length > 1 && (
            <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} className="!w-auto !rounded-full !py-2 text-[13px]" aria-label="Filter by course">
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          )}
        </div>
        <div className="mb-3 flex gap-1.5">
          {filters.map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className={cx('rounded-full px-3 py-1 text-[13px] font-semibold transition', filter === v ? 'bg-ink text-white' : 'bg-mist text-ink-soft hover:text-ink')}>
              {l}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {threads.length === 0 && <Empty icon={<MessageCircle className="h-6 w-6" />} title={filter === 'open' ? 'Every question has an answer' : 'No questions here yet'} text={staff ? undefined : 'Ask anything about your course. Only your instructor sees it.'} />}
          {threads.map((t) => {
            const unread = !t.readBy.includes(user.id);
            const answered = t.replies.some((r) => r.authorRole !== 'learner');
            return (
              <button
                key={t.id}
                onClick={() => navigate(`${basePath}/${t.id}`)}
                className={cx('block w-full rounded-2xl border p-4 text-left transition', t.id === threadId ? 'border-nblue bg-nblue-soft/50' : 'border-line bg-white hover:border-nblue/30')}
              >
                <div className="flex items-start gap-2">
                  {unread && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-npink" aria-label="Unread" />}
                  <span className="line-clamp-2 flex-1 font-semibold">{t.title}</span>
                  {t.audience === 'instructor' && <Lock className="h-4 w-4 shrink-0 text-npurple" aria-label="Private" />}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
                  <span>{t.authorName}</span>
                  <span>{timeAgo(t.replies.length ? t.replies[t.replies.length - 1].createdAt : t.createdAt)}</span>
                  <span>
                    {t.replies.length} repl{t.replies.length === 1 ? 'y' : 'ies'}
                  </span>
                  {answered && <Pill color="green">Answered</Pill>}
                </div>
                {courses.length > 1 && <div className="mt-1 truncate text-[11px] text-ink-faint">{courseTitle(t.courseId)}</div>}
              </button>
            );
          })}
        </div>
      </div>
      <div className={cx(!selected && 'hidden lg:block')}>
        {selected ? (
          <ThreadDetail
            key={selected.id}
            thread={selected}
            onChange={setThread}
            onBack={() => navigate(basePath)}
            onDelete={() => {
              setData((d) => (d ? { threads: d.threads.filter((x) => x.id !== selected.id) } : d));
              navigate(basePath);
            }}
          />
        ) : (
          <Empty icon={<MessageCircle className="h-6 w-6" />} title="Choose a conversation" text="Pick a question on the left to read and reply." />
        )}
      </div>
      <Composer
        open={composer}
        onClose={() => setComposer(false)}
        courses={courses}
        staff={staff}
        initial={{ courseId: query.get('course') ?? undefined, lessonId: query.get('lesson') ?? undefined }}
        onCreated={(t) => {
          setComposer(false);
          setData((d) => ({ threads: [t, ...(d?.threads ?? [])] }));
          navigate(`${basePath}/${t.id}`);
        }}
      />
    </div>
  );
}
