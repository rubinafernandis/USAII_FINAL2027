import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, Copy, Eye, EyeOff, MoreHorizontal, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { ACCENT } from '../lib/format';
import { useSession } from '../lib/session';
import { Button, Card, Empty, ErrorBox, IconButton, Loading, navigate, PageHeader, useConfirm, useLoad, useToast } from '../components/ui';

interface CourseRow {
  id: string;
  title: string;
  status: 'draft' | 'published';
  accent: string;
  price: number;
  priceSet: boolean;
  learners: number;
  createdById: string;
}

function MoreMenu({ items }: { items: { label: string; icon: typeof Copy; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <IconButton label="More actions" onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal className="h-5 w-5" />
      </IconButton>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="absolute right-0 top-10 z-20 w-44 rounded-2xl border border-line bg-white p-1.5 shadow-xl">
            {items.map((it) => (
              <button
                key={it.label}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm ${it.danger ? 'text-npink hover:bg-npink-soft' : 'text-ink-soft hover:bg-mist hover:text-ink'}`}
              >
                <it.icon className="h-4 w-4" /> {it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Courses() {
  const { user } = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState('');
  const { data, error, loading, reload } = useLoad(() => api<{ courses: CourseRow[] }>('/staff/courses'), []);
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
      await reload(true);
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy('');
    }
  };
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? 'Could not load courses'} onRetry={() => void reload()} />;
  return (
    <div className="space-y-5">
      <PageHeader
        title="My courses"
        actions={
          <Button size="lg" icon={<Plus className="h-5 w-5" />} onClick={() => navigate('courses/new')}>
            Create course
          </Button>
        }
      />
      {data.courses.length === 0 && <Empty icon={<BookOpen className="h-6 w-6" />} title="No courses yet" action={<Button onClick={() => navigate('courses/new')}>Create your first course</Button>} />}
      <div className="space-y-3">
        {data.courses.map((c, i) => {
          const published = c.status === 'published';
          const canDelete = c.createdById === user.id && c.learners === 0;
          const del = async () => {
            const ok = await confirm({
              title: `Delete ${c.title}?`,
              text: c.learners ? `${c.learners} learners will lose this course and their progress. This cannot be undone.` : 'This cannot be undone.',
              confirm: 'Delete course',
              danger: true,
            });
            if (ok)
              await run(`x${c.id}`, async () => {
                await api(`/staff/courses/${c.id}`, { method: 'DELETE' });
                toast('success', 'Course deleted.');
              });
          };
          return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card hover className="flex flex-wrap items-center gap-4 !py-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${ACCENT[c.accent]?.hex ?? ACCENT.blue.hex}, #8B3DFF)` }}>
                  <BookOpen className="h-5 w-5" />
                </span>
                <button className="min-w-0 flex-1 text-left" onClick={() => navigate(`courses/edit/${c.id}`)}>
                  <div className="truncate font-display text-lg font-bold hover:text-nblue">{c.title}</div>
                  <div className="mt-0.5 flex items-center gap-3 text-sm text-ink-soft">
                    <span className={`inline-flex items-center gap-1.5 font-semibold ${published ? 'text-ngreen-ink' : 'text-ink-faint'}`}>
                      <span className={`h-2 w-2 rounded-full ${published ? 'bg-ngreen' : 'bg-ink-faint'}`} />
                      {published ? 'Published' : 'Draft'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {c.learners}
                    </span>
                    <span className={c.priceSet ? 'font-semibold' : 'font-semibold text-npink'}>{c.priceSet ? (c.price === 0 ? 'Free' : `$${c.price}`) : 'Price not set'}</span>
                  </div>
                </button>
                <div className="flex items-center gap-2">
                  <Button icon={<Pencil className="h-4 w-4" />} onClick={() => navigate(`courses/edit/${c.id}`)}>
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    loading={busy === `s${c.id}`}
                    icon={published ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    onClick={() =>
                      run(`s${c.id}`, async () => {
                        await api(`/staff/courses/${c.id}/status`, { body: { status: published ? 'draft' : 'published' } });
                        toast('success', published ? 'Moved to draft.' : 'Published. Learners can find it now.');
                      })
                    }
                  >
                    {published ? 'Unpublish' : 'Publish'}
                  </Button>
                  <MoreMenu
                    items={[
                      {
                        label: 'Duplicate',
                        icon: Copy,
                        onClick: () =>
                          void run(`d${c.id}`, async () => {
                            await api(`/staff/courses/${c.id}/duplicate`, { body: {} });
                            toast('success', 'Copied as a draft.');
                          }),
                      },
                      ...(canDelete ? [{ label: 'Delete', icon: Trash2, onClick: () => void del(), danger: true }] : []),
                    ]}
                  />
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
