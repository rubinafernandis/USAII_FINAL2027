import { BookOpen, CheckCircle2, Clock, Lock, Users } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { ACCENT, fmtMinutes } from '../lib/format';
import { Button, Card, Empty, ErrorBox, Loading, navigate, PageHeader, Pill, useConfirm, useLoad, useToast } from '../components/ui';
import { useLearner } from './context';

interface CatalogCourse {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  credentialName: string;
  durationLabel: string;
  level: string;
  price: number;
  access: 'open' | 'invite';
  accent: string;
  coverImage?: string;
  modules: { title: string; lessons: number }[];
  lessons: number;
  minutes: number;
  hasFinal: boolean;
  enrolled: boolean;
  learners: number;
  requested: boolean;
}

export default function Explore() {
  const { reload: reloadHome, setActiveId, readOnly } = useLearner();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, loading, reload } = useLoad(() => api<{ courses: CatalogCourse[] }>('/learner/catalog'), []);
  const [busy, setBusy] = useState('');

  const enroll = async (c: CatalogCourse) => {
    if (c.price > 0) {
      const ok = await confirm({
        title: `Enroll in ${c.title}?`,
        text: `This micro-credential costs $${c.price} once, with nothing else to buy. Payment is not connected in this local build, so you will be enrolled right away.`,
        confirm: `Enroll for $${c.price}`,
      });
      if (!ok) return;
    }
    setBusy(c.id);
    try {
      await api(`/learner/enroll/${c.id}`, { body: {} });
      await reloadHome();
      setActiveId(c.id);
      toast('success', `You are enrolled in ${c.title}.`);
      navigate('dashboard');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const request = async (c: CatalogCourse) => {
    setBusy(c.id);
    try {
      await api(`/learner/request-access/${c.id}`, { body: {} });
      toast('success', 'Request sent. An instructor will respond soon.');
      await reload(true);
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy('');
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={() => void reload()} />;
  const courses = data?.courses ?? [];

  return (
    <div>
      <PageHeader title="Explore Courses" subtitle="Short, practical AI credentials for everyone. No coding. One fair price, nothing to upgrade." />
      {courses.length === 0 && <Empty icon={<BookOpen className="h-6 w-6" />} title="No courses published yet" />}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {courses.map((c) => {
          const a = ACCENT[c.accent] ?? ACCENT.blue;
          return (
            <Card key={c.id} hover className="flex flex-col !p-0 overflow-hidden">
              <div className="relative h-28 overflow-hidden" style={{ background: c.coverImage ? undefined : `linear-gradient(135deg, ${a.hex}, ${a.hex}88 60%, #ffffff)` }}>
                {c.coverImage && <img src={c.coverImage} alt="" className="h-full w-full object-cover" />}
                <div className="absolute bottom-3 left-4 flex gap-1.5">
                  <span className="on-color rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-bold" style={{ color: a.text }}>
                    {c.price === 0 ? 'Free' : `$${c.price}`}
                  </span>
                  {c.access === 'invite' && (
                    <span className="on-color inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
                      <Lock className="h-3 w-3" /> By invitation
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-lg font-bold leading-snug">{c.title}</h3>
                <p className="mt-1 text-sm text-ink-soft">{c.subtitle}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Pill color="gray">
                    <Clock className="h-3 w-3" /> {c.durationLabel || fmtMinutes(c.minutes)}
                  </Pill>
                  <Pill color="gray">
                    {c.lessons} lessons{c.hasFinal ? ' + final' : ''}
                  </Pill>
                  <Pill color="gray">
                    <Users className="h-3 w-3" /> {c.learners}
                  </Pill>
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-ink-soft">{c.description}</p>
                <p className="mt-2 text-xs text-ink-faint">Earn: {c.credentialName}</p>
                <div className="mt-auto pt-5">
                  {c.enrolled ? (
                    <Button
                      variant="secondary"
                      className="w-full"
                      icon={<CheckCircle2 className="h-4 w-4 text-ngreen" />}
                      onClick={() => {
                        setActiveId(c.id);
                        navigate('dashboard');
                      }}
                    >
                      Enrolled: go to course
                    </Button>
                  ) : c.access === 'invite' ? (
                    <Button variant="secondary" className="w-full" disabled={readOnly || c.requested} loading={busy === c.id} onClick={() => void request(c)}>
                      {c.requested ? 'Access requested' : 'Request access'}
                    </Button>
                  ) : (
                    <Button className="w-full" disabled={readOnly} loading={busy === c.id} onClick={() => void enroll(c)}>
                      {c.price === 0 ? 'Start for free' : `Enroll for $${c.price}`}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
