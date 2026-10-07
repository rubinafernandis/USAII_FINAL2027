import { ArrowLeft, Ban, Compass, Eye, Mail, MessageCircle, Search, UserCheck, UserX, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CompletionEstimate, Course, DirectMessage, Enrollment, InstructorGuidance, LearnerSnapshot, PublicUser, RiskFactor, Thread } from '../../shared/types';
import { api } from '../lib/api';
import { fmtDate, fmtDateTime, pct, scoreColor } from '../lib/format';
import { Avatar, Bar, Button, Card, cx, Empty, ErrorBox, Input, Label, Loading, Modal, navigate, PageHeader, Ring, Select, Tabs, Textarea, useLoad, useToast } from '../components/ui';
import { LearnerProvider } from '../learner/LearnerApp';
import Dashboard from '../learner/Dashboard';
import Progress from '../learner/Progress';
import Learning from '../learner/Learning';
import SuspendModal, { type SuspendTarget } from './SuspendLearner';

export interface CohortCard {
  user: PublicUser;
  enrolledAt: string;
  targetDate?: string;
  passConfidence: number;
  predictedGrade: number;
  predictedLetter: string;
  currentGrade: number | null;
  avgCheck: number | null;
  comprehension: number | null;
  activitiesDone: number;
  activitiesTotal: number;
  studyDays: number;
  loginDays: number;
  avgSession: number;
  activeMinutes7: number;
  engagement: number;
  completion: CompletionEstimate;
  modules: { id: string; title: string; percent: number }[];
  weakAreas: { topic: string; score: number }[];
  risk: { needsSupport: boolean; factors: RiskFactor[] };
  nextStep: string;
  credential: boolean;
  lastActiveAt?: string;
  guidance?: InstructorGuidance;
}

interface CohortData {
  courses: { id: string; title: string; status: string }[];
  course?: { id: string; title: string; passMark: number };
  cards: CohortCard[];
  /** Learners in this course who are suspended; left out of `cards` and `stats`. */
  suspended?: PublicUser[];
  stats: null | { total: number; needsSupport: number; avgConfidence: number | null; avgCheck: number | null; avgCompletion: number | null; avgEngagement: number | null; credentials: number; pendingQuestions: number };
}

export function MessageModal({ to, onClose }: { to: { id: string; name: string; email?: string } | null; onClose: () => void }) {
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!to) return;
    setBusy(true);
    try {
      await api('/staff/message', { body: { toId: to.id, subject, body } });
      toast('success', `Message sent to ${to.name}.`);
      setSubject('');
      setBody('');
      onClose();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={!!to}
      onClose={onClose}
      title={`Message ${to?.name ?? ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={send} icon={<Mail className="h-4 w-4" />}>
            Send message
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-mist px-4 py-2.5 text-sm">
          <span className="text-ink-faint">To: </span>
          <span className="font-semibold">{to?.name}</span>
          {to?.email && <span className="text-ink-soft"> &lt;{to.email}&gt;</span>}
        </div>
        <div>
          <Label>Subject</Label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Checking in on your progress" />
        </div>
        <div>
          <Label>Message</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="!min-h-[140px]" />
        </div>
        <p className="text-xs text-ink-faint">The learner gets a notification and can read it under Ask.</p>
      </div>
    </Modal>
  );
}

export function CourseSelect({ courses, value, onChange }: { courses: { id: string; title: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="!w-auto min-w-[260px] !rounded-full !py-2" aria-label="Course">
      {courses.map((c) => (
        <option key={c.id} value={c.id}>
          {c.title}
        </option>
      ))}
    </Select>
  );
}

function Num({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-2xl bg-mist/70 px-3 py-2 text-center">
      <div className="font-display text-lg font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px] font-medium text-ink-soft">{label}</div>
    </div>
  );
}

function Tile({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <Card className="relative overflow-hidden !p-4" hover>
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: color }} />
      <div className="text-[13px] font-semibold text-ink-soft">{label}</div>
      <div className="mt-1 font-display text-[28px] font-extrabold">{value}</div>
    </Card>
  );
}

/** Someone with no recorded activity for two weeks or more. */
const INACTIVE_DAYS = 14;
const daysSince = (iso?: string) => (iso ? Math.floor((Date.now() - Date.parse(iso)) / 86_400_000) : null);

function InactiveModal({ open, onClose, cards, onMessage }: { open: boolean; onClose: () => void; cards: CohortCard[]; onMessage: (c: CohortCard) => void }) {
  const inactive = cards.filter((c) => !c.credential && (daysSince(c.lastActiveAt) ?? 999) >= INACTIVE_DAYS).sort((a, b) => (daysSince(b.lastActiveAt) ?? 999) - (daysSince(a.lastActiveAt) ?? 999));
  return (
    <Modal open={open} onClose={onClose} title="Inactive Learners" wide footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <p className="text-sm text-ink-soft">Learners with no activity for {INACTIVE_DAYS} days or more. A short message is usually enough to restart them.</p>
      {inactive.length === 0 ? (
        <Empty icon={<Users className="h-6 w-6" />} title="Everybody is active" text="No learner has been away for two weeks." />
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {inactive.map((c) => (
            <li key={c.user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar initials={c.user.initials} />
                <div className="min-w-0">
                  <div className="truncate font-semibold">{c.user.name}</div>
                  <div className="truncate text-[12px] text-ink-soft">{c.user.email}</div>
                  <div className="text-[12px] font-semibold text-npink">
                    Last seen {c.lastActiveAt ? `${fmtDateTime(c.lastActiveAt)} · ${daysSince(c.lastActiveAt)} days ago` : 'never'}
                  </div>
                </div>
              </div>
              <Button size="sm" variant="secondary" icon={<MessageCircle className="h-4 w-4" />} onClick={() => onMessage(c)}>
                Send Message
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/** Personal guidance: what this learner should do next, and what to work on. */
export function GuidanceModal({ target, courseId, onClose, onSaved }: { target: CohortCard | null; courseId: string; onClose: () => void; onSaved?: () => void }) {
  const toast = useToast();
  const [nextStep, setNextStep] = useState('');
  const [workOn, setWorkOn] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setNextStep(target?.guidance?.nextStep ?? '');
    setWorkOn(target?.guidance?.workOn ?? '');
  }, [target]);
  const save = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await api('/staff/guidance', { body: { userId: target.user.id, courseId, nextStep, workOn } });
      toast('success', `Guidance sent to ${target.user.name}.`);
      onSaved?.();
      onClose();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={!!target}
      onClose={onClose}
      title={`Guidance for ${target?.user.name ?? ''}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save} icon={<Compass className="h-4 w-4" />}>
            Send Guidance
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">This appears on the learner&rsquo;s dashboard with your name on it, and they are notified.</p>
      {target && (
        <div className="mt-3 rounded-2xl bg-mist px-4 py-3 text-[13px]">
          <span className="font-semibold">Where they are: </span>
          {target.completion.percent}% complete · next up &ldquo;{target.nextStep}&rdquo;
          {target.weakAreas.length > 0 && <> · weakest topic: {target.weakAreas[0].topic}</>}
        </div>
      )}
      <div className="mt-4 space-y-4">
        <div>
          <Label>What they should do next</Label>
          <Textarea value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="Finish Module 2 this week, then take the practice check before Friday." />
        </div>
        <div>
          <Label>What they need to work on</Label>
          <Textarea value={workOn} onChange={(e) => setWorkOn(e.target.value)} placeholder="Your prompts are clear, but add the audience and the format you want back." />
        </div>
      </div>
      {target?.guidance && <p className="mt-3 text-[12px] text-ink-faint">Last updated {fmtDateTime(target.guidance.updatedAt)} by {target.guidance.byName}. Saving replaces it.</p>}
    </Modal>
  );
}

export default function Cohort({ initialCourseId }: { initialCourseId?: string }) {
  const [courseId, setCourseId] = useState(initialCourseId ?? '');
  useEffect(() => {
    if (initialCourseId) setCourseId(initialCourseId);
  }, [initialCourseId]);
  const [search, setSearch] = useState('');
  const [msgTo, setMsgTo] = useState<{ id: string; name: string; email?: string } | null>(null);
  const [guidanceFor, setGuidanceFor] = useState<CohortCard | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [suspendFor, setSuspendFor] = useState<SuspendTarget | null>(null);
  const { data, error, loading, reload } = useLoad(() => api<CohortData>(`/staff/cohort${courseId ? `?courseId=${courseId}` : ''}`), [courseId]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = data?.cards ?? [];
    if (!q) return all;
    return all.filter((c) => c.user.name.toLowerCase().includes(q) || (c.user.email ?? '').toLowerCase().includes(q));
  }, [data, search]);

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={() => void reload()} />;
  const s = data?.stats;
  const cards = data?.cards ?? [];
  const inactiveCount = cards.filter((c) => !c.credential && (daysSince(c.lastActiveAt) ?? 999) >= INACTIVE_DAYS).length;
  const suspended = data?.suspended ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Cohort" subtitle="Every learner in this course, and how far along they are." actions={data?.courses.length ? <CourseSelect courses={data.courses} value={data.course?.id ?? ''} onChange={setCourseId} /> : undefined} />
      {!s ? (
        <Empty icon={<Users className="h-6 w-6" />} title="No courses yet" text="Create a course and add learners to see them here." action={<Button onClick={() => navigate('courses')}>Go to My Courses</Button>} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Tile label="Total Learners" value={s.total} color="#1F6BFF" />
            <Tile label="Average Completion" value={pct(s.avgCompletion)} color="#8B3DFF" />
            <Tile label="Credentials Earned by Learners" value={s.credentials} color="#00C77F" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by name or email" className="!pl-9" aria-label="Filter learners by name or email" />
            </div>
            <Button variant="secondary" icon={<UserX className="h-4 w-4" />} onClick={() => setShowInactive(true)}>
              Inactive Learners{inactiveCount ? ` (${inactiveCount})` : ''}
            </Button>
          </div>

          {rows.length === 0 ? (
            <Empty icon={<Users className="h-6 w-6" />} title={search ? 'No learner matches that search' : suspended.length ? 'No active learners in this course' : 'No learners in this course yet'} action={search ? undefined : <Button onClick={() => navigate('learners')}>Add Learners</Button>} />
          ) : (
            <Card className="!p-0">
              <div className="overflow-x-auto scroll-thin">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-[12px] uppercase tracking-wide text-ink-soft">
                      <th className="px-4 py-3 font-bold">Learner</th>
                      <th className="px-4 py-3 font-bold">Enrolled In</th>
                      <th className="px-4 py-3 font-bold">Expected Course Completion</th>
                      <th className="px-4 py-3 font-bold">Predicted Score</th>
                      <th className="px-4 py-3 font-bold">Final Score</th>
                      <th className="px-4 py-3 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((c) => (
                      <tr key={c.user.id} className="transition hover:bg-mist/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar initials={c.user.initials} size={32} />
                            <div className="min-w-0">
                              <div className="truncate font-semibold">{c.user.name}</div>
                              <div className="truncate text-[12px] text-ink-soft">{c.user.email}</div>
                            </div>
                          </div>
                          {c.risk.factors.length > 0 && (
                            <details className="mt-1.5 max-w-[320px] text-[12px]">
                              <summary className={cx('cursor-pointer font-semibold', c.risk.needsSupport ? 'text-npink' : 'text-ink-soft')}>
                                {c.risk.needsSupport ? 'Needs support' : 'Watch'}: {c.risk.factors.length} {c.risk.factors.length === 1 ? 'signal' : 'signals'}
                              </summary>
                              <ul className="mt-1 space-y-1.5">
                                {c.risk.factors.map((f) => (
                                  <li key={f.label}>
                                    <span className="font-semibold">{f.severity === 'high' ? 'High' : f.severity === 'medium' ? 'Medium' : 'Low'}: {f.label}.</span>{' '}
                                    <span className="text-ink-soft">Next step: {f.advice}</span>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{data!.course!.title}</div>
                          <div className="text-[12px] text-ink-soft">{c.completion.percent}% complete</div>
                        </td>
                        <td className="px-4 py-3">{c.credential ? <span className="font-semibold text-ngreen-ink">Completed</span> : fmtDate(c.completion.estimatedDate)}</td>
                        <td className="px-4 py-3">
                          {c.credential ? (
                            <span className="text-ink-faint">&mdash;</span>
                          ) : (
                            <span className="font-bold" style={{ color: scoreColor(c.predictedGrade) }}>
                              {c.avgCheck === null ? 'After first quiz' : `${c.predictedGrade}% (${c.predictedLetter})`}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {c.credential ? (
                            <span className="font-bold" style={{ color: scoreColor(c.currentGrade) }}>
                              {pct(c.currentGrade)}
                            </span>
                          ) : (
                            <span className="text-ink-faint">Not passed yet</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5">
                            <Button size="sm" variant="secondary" onClick={() => navigate(`learner/${c.user.id}?course=${data!.course!.id}`)} icon={<Eye className="h-3.5 w-3.5" />}>
                              View
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setGuidanceFor(c)} icon={<Compass className="h-3.5 w-3.5" />}>
                              Guidance
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setMsgTo({ id: c.user.id, name: c.user.name, email: c.user.email })} icon={<MessageCircle className="h-3.5 w-3.5" />}>
                              Message
                            </Button>
                            <Button size="sm" variant="secondary" className="!text-npink hover:!border-npink/40" onClick={() => setSuspendFor(c.user)} icon={<Ban className="h-3.5 w-3.5" />}>
                              Suspend
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {suspended.length > 0 && (
            <Card className="!border-npink/30">
              <div className="mb-3 flex items-center gap-2">
                <Ban className="h-4 w-4 text-npink" />
                <h3 className="font-bold">Suspended learners ({suspended.length})</h3>
                <span className="text-xs text-ink-faint">Not counted in the figures above. They cannot sign in until reinstated.</span>
              </div>
              <div className="divide-y divide-line">
                {suspended.map((u) => (
                  <div key={u.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <Avatar initials={u.initials} size={32} />
                    <div className="min-w-[200px] flex-1">
                      <div className="font-semibold">{u.name}</div>
                      <div className="text-[12px] text-ink-soft">
                        {u.email}
                        {u.suspension && ` · Suspended ${fmtDate(u.suspension.at)} by ${u.suspension.byName}`}
                        {u.suspension?.reason && ` · ${u.suspension.reason}`}
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => navigate(`learner/${u.id}?course=${data!.course!.id}`)} icon={<Eye className="h-3.5 w-3.5" />}>
                      View
                    </Button>
                    <Button size="sm" variant="secondary" className="!text-ngreen-ink" onClick={() => setSuspendFor(u)} icon={<UserCheck className="h-3.5 w-3.5" />}>
                      Reinstate
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
          <InactiveModal open={showInactive} onClose={() => setShowInactive(false)} cards={cards} onMessage={(c) => { setShowInactive(false); setMsgTo({ id: c.user.id, name: c.user.name, email: c.user.email }); }} />
          <GuidanceModal target={guidanceFor} courseId={data?.course?.id ?? ''} onClose={() => setGuidanceFor(null)} onSaved={() => void reload()} />
        </>
      )}
      <MessageModal to={msgTo} onClose={() => setMsgTo(null)} />
      <SuspendModal target={suspendFor} onClose={() => setSuspendFor(null)} onDone={() => void reload(true)} />
    </div>
  );
}

/* ---------------- Read-only learner portal ---------------- */

interface PortalData {
  user: PublicUser;
  items: { course: Course; enrollment: Enrollment; snapshot: LearnerSnapshot }[];
  threads: Thread[];
  messages: DirectMessage[];
}

export function LearnerPortal({ userId, courseId }: { userId: string; courseId?: string }) {
  const [tab, setTab] = useState<'dashboard' | 'progress' | 'learning' | 'activity'>('dashboard');
  const [msg, setMsg] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const { data, setData, error, loading, reload } = useLoad(() => api<PortalData>(`/staff/learner/${userId}`), [userId]);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Not found'} onRetry={() => void reload()} />;
  const home = { items: data.items, messages: data.messages, feedbackDue: false };
  return (
    <div>
      <button onClick={() => history.back()} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-nblue">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 border-npurple/30 bg-npurple-soft/40 !py-3">
        <div className="flex items-center gap-3">
          <Eye className="h-5 w-5 text-npurple" />
          <span className="text-sm">
            Read-only view of <b>{data.user.name}</b>’s portal. Nothing you do here changes their data.
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={<Mail className="h-4 w-4" />} onClick={() => setMsg(true)}>
            Message {data.user.name.split(' ')[0]}
          </Button>
          {data.user.active ? (
            <Button size="sm" variant="secondary" className="!text-npink" icon={<Ban className="h-4 w-4" />} onClick={() => setSuspendOpen(true)}>
              Suspend
            </Button>
          ) : (
            <Button size="sm" variant="secondary" className="!text-ngreen-ink" icon={<UserCheck className="h-4 w-4" />} onClick={() => setSuspendOpen(true)}>
              Reinstate
            </Button>
          )}
        </div>
      </Card>
      {!data.user.active && (
        <Card className="mb-5 flex items-center gap-3 !border-npink/40 bg-npink-soft/40 !py-3 text-sm">
          <Ban className="h-5 w-5 shrink-0 text-npink" />
          <span>
            <b>{data.user.name}</b> is suspended and cannot sign in
            {data.user.suspension ? ` (since ${fmtDate(data.user.suspension.at)}, by ${data.user.suspension.byName}${data.user.suspension.reason ? `: “${data.user.suspension.reason}”` : ''})` : ''}.
          </span>
        </Card>
      )}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'dashboard', label: 'Dashboard' },
          { value: 'progress', label: 'Progress' },
          { value: 'learning', label: 'Lessons' },
          { value: 'activity', label: 'Questions and messages', count: data.threads.length + data.messages.length },
        ]}
      />
      <LearnerProvider home={home} reload={() => reload(true)} learner={data.user} readOnly initialCourseId={courseId}>
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'progress' && <Progress />}
        {tab === 'learning' && <Learning />}
      </LearnerProvider>
      {tab === 'activity' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="font-bold">Questions asked</h3>
            <div className="mt-3 space-y-2">
              {data.threads.length === 0 && <p className="text-sm text-ink-faint">None yet.</p>}
              {data.threads.map((t) => (
                <button key={t.id} onClick={() => navigate(`inbox/${t.id}`)} className="block w-full rounded-xl bg-mist p-3 text-left text-sm hover:bg-nblue-soft">
                  <div className="font-semibold">{t.title}</div>
                  <div className="text-xs text-ink-faint">
                    {fmtDateTime(t.createdAt)}, {t.audience === 'instructor' ? 'private' : 'everyone'}, {t.replies.length} replies
                  </div>
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="font-bold">Messages sent to this learner</h3>
            <div className="mt-3 space-y-2">
              {data.messages.length === 0 && <p className="text-sm text-ink-faint">None yet.</p>}
              {data.messages.map((m) => (
                <div key={m.id} className="rounded-xl bg-mist p-3 text-sm">
                  <div className="font-semibold">{m.subject}</div>
                  <div className="text-xs text-ink-faint">
                    {m.fromName}, {fmtDate(m.createdAt)}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-ink-soft">{m.body}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
      <MessageModal to={msg ? { id: data.user.id, name: data.user.name, email: data.user.email } : null} onClose={() => setMsg(false)} />
      <SuspendModal target={suspendOpen ? data.user : null} onClose={() => setSuspendOpen(false)} onDone={(u) => setData((d) => (d ? { ...d, user: u } : d))} />
    </div>
  );
}
