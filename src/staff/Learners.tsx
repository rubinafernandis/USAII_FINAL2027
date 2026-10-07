import { Ban, Check, Eye, KeyRound, Mail, Plus, Search, UserCheck, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PublicUser } from '../../shared/types';
import { api } from '../lib/api';
import { fmtDate, timeAgo } from '../lib/format';
import { Avatar, Button, Card, cx, Empty, ErrorBox, Input, Label, Loading, Modal, navigate, PageHeader, PasswordField, Segmented, useConfirm, useLoad, useToast } from '../components/ui';
import { SetPasswordModal } from './SetPasswordModal';
import { MessageModal } from './Cohort';
import SuspendModal, { SuspendedBadge, type SuspendTarget } from './SuspendLearner';

interface LearnerRow {
  user: PublicUser;
  courses: { courseId: string; title: string; percent: number; credential: boolean }[];
  lastActive: string;
}
interface LearnersData {
  learners: LearnerRow[];
  courses: { id: string; title: string; status: string }[];
}

function AddLearner({ open, onClose, courses, onDone }: { open: boolean; onClose: () => void; courses: LearnersData['courses']; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ name: string; email: string; password: string; created: boolean; suspended: boolean } | null>(null);
  const close = () => {
    setDone(null);
    setName('');
    setEmail('');
    setPassword('');
    setSel([]);
    onClose();
  };
  const save = async () => {
    setBusy(true);
    try {
      const r = await api('/staff/learners', { body: { name, email, password, courseIds: sel } });
      setDone({ name: r.user.name, email: r.user.email, password, created: r.created, suspended: !!r.suspended });
      onDone();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={close}
      title={done ? 'Learner is ready' : 'Add a learner'}
      footer={
        done ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button loading={busy} onClick={save} icon={<UserPlus className="h-4 w-4" />}>
              Add learner
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="space-y-3">
          <div className="rounded-2xl border border-ngreen/40 bg-ngreen-soft p-4">
            <div className="font-semibold">{done.suspended ? `${done.name} is suspended` : `${done.name} can sign in now`}</div>
            <div className="mt-2 grid grid-cols-[90px_1fr] gap-y-1 text-sm">
              <span className="text-ink-soft">Email</span>
              <code className="font-mono">{done.email}</code>
              {done.created && (
                <>
                  <span className="text-ink-soft">Password</span>
                  <code className="font-mono">{done.password}</code>
                </>
              )}
            </div>
          </div>
          {!done.created && <p className="text-sm text-ink-soft">This learner already had an account, so only the course access was added. Their password did not change.</p>}
          {done.suspended && <p className="text-sm text-npink">This account is suspended, so they cannot sign in yet. Reinstate them from their row on this page.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <Label htmlFor="al-name">Full name</Label>
            <Input id="al-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam Patel" />
          </div>
          <div>
            <Label htmlFor="al-email">Email</Label>
            <Input id="al-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sam@company.com" />
          </div>
          <PasswordField id="al-pw" value={password} onChange={setPassword} />
          <div>
            <Label>Courses</Label>
            <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-2xl border border-line p-2 scroll-thin">
              {courses.length === 0 && <span className="text-sm text-ink-faint">Create a course first.</span>}
              {courses.map((c) => {
                const on = sel.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSel(on ? sel.filter((x) => x !== c.id) : [...sel, c.id])}
                    className={cx('flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition', on ? 'border-transparent bg-gradient-to-r from-nblue to-npurple text-white' : 'border-line text-ink-soft hover:border-nblue')}
                  >
                    {on ? <Check className="h-4 w-4 shrink-0" /> : <Plus className="h-4 w-4 shrink-0" />}
                    <span className="flex-1 truncate">{c.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Learners() {
  const toast = useToast();
  const confirm = useConfirm();
  const [add, setAdd] = useState(false);
  const [pwUser, setPwUser] = useState<PublicUser | null>(null);
  const [msgTo, setMsgTo] = useState<{ id: string; name: string; email?: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'suspended'>('all');
  const [suspendFor, setSuspendFor] = useState<SuspendTarget | null>(null);
  const { data, setData, error, loading, reload } = useLoad(() => api<LearnersData>('/staff/learners'), []);
  const rows = useMemo(
    () =>
      (data?.learners ?? [])
        .filter((r) => status === 'all' || (status === 'suspended' ? !r.user.active : r.user.active))
        .filter((r) => `${r.user.name} ${r.user.email}`.toLowerCase().includes(q.toLowerCase())),
    [data, q, status],
  );
  const suspendedCount = (data?.learners ?? []).filter((r) => !r.user.active).length;
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Could not load learners'} onRetry={() => void reload()} />;

  const applyUser = (u: PublicUser) => setData((d) => (d ? { ...d, learners: d.learners.map((x) => (x.user.id === u.id ? { ...x, user: u } : x)) } : d));

  const toggle = async (r: LearnerRow, c: { id: string; title: string }) => {
    const has = r.courses.some((x) => x.courseId === c.id);
    if (has && !(await confirm({ title: `Remove ${r.user.name} from ${c.title}?`, text: 'Their progress in this course will be deleted.', confirm: 'Remove access', danger: true }))) return;
    const key = `${r.user.id}:${c.id}`;
    setBusy(key);
    try {
      await api('/staff/access', { body: { userId: r.user.id, courseId: c.id, grant: !has } });
      setData((d) =>
        d
          ? {
              ...d,
              learners: d.learners.map((x) =>
                x.user.id !== r.user.id
                  ? x
                  : { ...x, courses: has ? x.courses.filter((y) => y.courseId !== c.id) : [...x.courses, { courseId: c.id, title: c.title, percent: 0, credential: false }] },
              ),
            }
          : d,
      );
      toast('success', has ? `Removed from ${c.title}.` : `${r.user.name.split(' ')[0]} can now open ${c.title}.`);
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Learners & Access"
        subtitle="Tap a course to give or remove access. Scroll the course list to see them all."
        actions={
          <Button icon={<UserPlus className="h-4 w-4" />} onClick={() => setAdd(true)}>
            Add Learner
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search learners" className="!rounded-full pl-10" />
        </div>
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'suspended', label: `Suspended${suspendedCount ? ` (${suspendedCount})` : ''}` },
          ]}
        />
      </div>
      {rows.length === 0 ? (
        data.learners.length === 0 ? (
          <Empty icon={<UserPlus className="h-6 w-6" />} title="No learners yet" action={<Button onClick={() => setAdd(true)}>Add Learner</Button>} />
        ) : (
          <Empty icon={<Search className="h-6 w-6" />} title={status === 'suspended' && !q ? 'No suspended learners' : 'No learner matches'} />
        )
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.user.id} className={cx('!p-4', !r.user.active && '!border-npink/40 bg-npink-soft/30')}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex min-w-[220px] flex-1 items-center gap-3">
                  <Avatar initials={r.user.initials} size={40} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{r.user.name}</span>
                      <SuspendedBadge user={r.user} />
                    </div>
                    <div className="truncate text-xs text-ink-faint">
                      {r.user.email} · active {timeAgo(r.lastActive || null)}
                    </div>
                    {!r.user.active && r.user.suspension && (
                      <div className="mt-0.5 text-xs text-npink">
                        Suspended {fmtDate(r.user.suspension.at)} by {r.user.suspension.byName}
                        {r.user.suspension.reason ? ` · ${r.user.suspension.reason}` : ''}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" icon={<Eye className="h-4 w-4" />} disabled={!r.courses.length} onClick={() => navigate(`learner/${r.user.id}`)}>
                    View
                  </Button>
                  <Button size="sm" variant="ghost" icon={<Mail className="h-4 w-4" />} onClick={() => setMsgTo({ id: r.user.id, name: r.user.name, email: r.user.email })}>
                    Message
                  </Button>
                  <Button size="sm" variant="ghost" icon={<KeyRound className="h-4 w-4" />} onClick={() => setPwUser(r.user)}>
                    Password
                  </Button>
                  {r.user.active ? (
                    <Button size="sm" variant="ghost" className="!text-npink hover:!bg-npink-soft" icon={<Ban className="h-4 w-4" />} onClick={() => setSuspendFor(r.user)}>
                      Suspend
                    </Button>
                  ) : (
                    <Button size="sm" variant="secondary" className="!text-ngreen-ink" icon={<UserCheck className="h-4 w-4" />} onClick={() => setSuspendFor(r.user)}>
                      Reinstate
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-3 max-h-44 space-y-1.5 overflow-y-auto border-t border-line pt-3 scroll-thin">
                {data.courses.map((c) => {
                  const enr = r.courses.find((x) => x.courseId === c.id);
                  const key = `${r.user.id}:${c.id}`;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={busy === key}
                      onClick={() => void toggle(r, c)}
                      title={enr ? 'Has access. Tap to remove.' : 'No access. Tap to give access.'}
                      className={cx(
                        'flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-[13px] font-semibold transition disabled:opacity-50',
                        enr ? 'border-transparent bg-gradient-to-r from-nblue to-npurple text-white shadow-sm' : 'border-dashed border-line text-ink-soft hover:border-nblue hover:text-nblue',
                      )}
                    >
                      {enr ? <Check className="h-4 w-4 shrink-0" /> : <Plus className="h-4 w-4 shrink-0" />}
                      <span className="flex-1 truncate">{c.title}</span>
                      <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[11px]', enr ? 'bg-white/25' : 'bg-mist')}>{enr ? (enr.credential ? 'Done' : `${enr.percent}%`) : 'No access'}</span>
                    </button>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      )}
      <AddLearner open={add} onClose={() => setAdd(false)} courses={data.courses} onDone={() => void reload(true)} />
      <SetPasswordModal user={pwUser} endpoint={`/staff/learners/${pwUser?.id}/password`} onClose={() => setPwUser(null)} />
      <MessageModal to={msgTo} onClose={() => setMsgTo(null)} />
      <SuspendModal target={suspendFor} onClose={() => setSuspendFor(null)} onDone={applyUser} />
    </div>
  );
}
