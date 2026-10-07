import { animate, motion, useInView, useReducedMotion } from 'motion/react';
import { ArrowRight, Award, CalendarCheck, Check, ChevronDown, Clock, Flag, Lock, Trophy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, cx, Empty, navigate, PageHeader } from '../components/ui';
import { fmtDate, fmtMinutes } from '../lib/format';
import { buildCompletion, type Step } from './completion';
import { useLearner } from './context';
import { CourseSwitcher } from './Dashboard';

/** A number that counts up once, when it first appears. */
function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = String(to);
      return;
    }
    const c = animate(0, to, { duration: 0.9, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => (el.textContent = String(Math.round(v))) });
    return () => c.stop();
  }, [to, reduce]);
  return <span ref={ref}>0</span>;
}

const STATUS_TEXT: Record<Step['status'], string> = { done: 'Done', current: 'You are here', started: 'Started', upcoming: 'Up next', locked: 'Locked' };

function StepCard({ s, index, readOnly }: { s: Step; index: number; readOnly?: boolean }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(s.status === 'current');
  const ref = useRef<HTMLLIElement>(null);
  const seen = useInView(ref, { once: true, margin: '-40px' });
  const doneCount = s.requirements.filter((r) => r.done).length;
  const tone =
    s.status === 'done'
      ? 'border-ngreen/30 bg-white'
      : s.status === 'current'
        ? 'border-npurple/40 bg-gradient-to-br from-white to-npurple-soft/50 shadow-xl shadow-npurple/10'
        : 'border-line bg-white';
  return (
    <motion.li
      ref={ref}
      initial={reduce ? false : { opacity: 0, x: -18 }}
      animate={seen ? { opacity: 1, x: 0 } : undefined}
      transition={{ duration: 0.45, delay: Math.min(index, 4) * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="relative pl-14"
    >
      {/* The marker on the path */}
      <motion.span
        initial={reduce ? false : { scale: 0 }}
        animate={seen ? { scale: 1 } : undefined}
        transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 0.1 }}
        className={cx(
          'absolute left-0 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full font-display text-sm font-extrabold',
          s.status === 'done' && 'bg-ngreen text-white shadow-lg shadow-ngreen/30',
          s.status === 'current' && 'bg-gradient-to-br from-nblue to-npurple text-white shadow-lg shadow-npurple/40',
          (s.status === 'upcoming' || s.status === 'started') && 'border-2 border-line bg-white text-ink-soft',
          s.status === 'locked' && 'border-2 border-line bg-mist text-ink-faint',
        )}
      >
        {s.status === 'current' && !reduce && <span className="absolute inset-0 animate-ping rounded-full bg-npurple/30" />}
        {s.status === 'done' ? <Check className="h-5 w-5" strokeWidth={3} /> : s.status === 'locked' ? <Lock className="h-4 w-4" /> : s.kind === 'final' ? <Flag className="h-4 w-4" /> : s.n}
      </motion.span>

      <div className={cx('rounded-3xl border p-4 transition sm:p-5', tone)}>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start justify-between gap-3 text-left">
          <div className="min-w-0">
            <div className={cx('text-[12px] font-bold uppercase tracking-wide', s.status === 'current' ? 'text-npurple' : s.status === 'done' ? 'text-ngreen-ink' : 'text-ink-faint')}>
              {s.label} · {STATUS_TEXT[s.status]}
            </div>
            <div className="mt-0.5 font-display text-[17px] font-bold leading-snug">{s.title}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-soft">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {fmtMinutes(s.minutes)}
              </span>
              {s.builds && <span>Activity: {s.builds}</span>}
              {s.completedAt && <span className="text-ngreen-ink">Completed {fmtDate(s.completedAt)}</span>}
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-mist px-2.5 py-1 text-[12px] font-bold text-ink-soft">
              {doneCount}/{s.requirements.length}
            </span>
            <ChevronDown className={cx('h-4 w-4 text-ink-faint transition-transform', open && 'rotate-180')} />
          </span>
        </button>

        <motion.div initial={false} animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
          <ol className="mt-4 space-y-2">
            {s.requirements.map((r, i) => {
              const actionable = !r.done && !!r.go && !readOnly && s.status !== 'locked';
              return (
                <motion.li
                  key={r.label}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={open ? { opacity: 1, y: 0 } : undefined}
                  transition={{ delay: 0.05 * i }}
                  className={cx('flex items-center gap-3 rounded-2xl px-3.5 py-2.5', r.done ? 'bg-ngreen-soft/60' : 'bg-mist/70')}
                >
                  <span className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold', r.done ? 'bg-ngreen text-white' : 'border-2 border-line bg-white text-ink-faint')}>
                    {r.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cx('block text-[14px] font-semibold', r.done ? 'text-ngreen-ink' : 'text-ink')}>{r.label}</span>
                    {r.detail && <span className="block text-[12.5px] text-ink-soft">{r.detail}</span>}
                  </span>
                  {actionable && (
                    <button onClick={() => navigate(r.go!)} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[12.5px] font-bold text-nblue shadow-sm transition hover:bg-nblue hover:text-white">
                      Go <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </motion.li>
              );
            })}
          </ol>
        </motion.div>
      </div>
    </motion.li>
  );
}

/**
 * Steps to Completion.
 * Exactly how to earn this course's certificate, step by step: the three rules,
 * then every step on one animated path, each with a checklist of what it takes.
 */
export default function StepsPage() {
  const { home, active, readOnly } = useLearner();
  const reduce = useReducedMotion();
  const model = useMemo(() => (active ? buildCompletion(active) : null), [active]);
  const pathRef = useRef<HTMLOListElement>(null);
  const pathSeen = useInView(pathRef, { once: true });
  if (!active || !model) return <Empty title="No courses yet" text="Your steps appear here once you have access to a course." action={<Button onClick={() => navigate('explore')}>Explore Courses</Button>} />;

  const { course } = active;
  const pct = model.total ? model.done / model.total : 0;
  const finished = model.certificate.earned;
  const lessonsCount = model.steps.filter((s) => s.kind === 'lesson').length;
  const hasFinal = model.steps.some((s) => s.kind === 'final');
  const rules = [
    { icon: CalendarCheck, color: '#1F6BFF', title: `Complete all ${lessonsCount} lesson${lessonsCount === 1 ? '' : 's'}`, text: 'In each one: work through the lesson, take the check, submit your activity, and mark it complete.' },
    ...(hasFinal ? [{ icon: Flag, color: '#8B3DFF', title: `Pass the final with ${course.passMark}%`, text: 'It unlocks as soon as every lesson is complete.' }] : []),
    { icon: Award, color: '#00C77F', title: 'Receive your certificate', text: 'It is issued automatically and saved in your Milestone Vault.' },
  ];

  // Group the path by stage, so the course framework stays visible.
  let idx = 0;
  return (
    <div className="space-y-6">
      <PageHeader title="Steps to Completion" subtitle="Exactly what it takes to earn your certificate, one step at a time." actions={home.items.length > 1 ? <CourseSwitcher /> : undefined} />

      {/* Where you stand */}
      <motion.div initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="beam">
        <div className="beam-inner relative overflow-hidden p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-bold uppercase tracking-[0.12em] text-npurple">Your path to</div>
              <h2 className="mt-1 font-display text-2xl font-extrabold leading-tight sm:text-[28px]">{model.certificate.name}</h2>
              <p className="mt-2 text-[15px] text-ink-soft">
                {finished ? (
                  'Every step is complete. Congratulations!'
                ) : (
                  <>
                    <b className="text-ink">
                      <CountUp to={model.total - model.done} /> {model.total - model.done === 1 ? 'step' : 'steps'}
                    </b>{' '}
                    left to your certificate.
                  </>
                )}
              </p>
            </div>
            <div className="text-right">
              <div className="font-display text-5xl font-extrabold leading-none">
                <span className="grad-text">
                  <CountUp to={model.done} />
                </span>
                <span className="text-2xl text-ink-faint">/{model.total}</span>
              </div>
              <div className="mt-1 text-[13px] font-semibold text-ink-soft">steps complete</div>
            </div>
          </div>

          {/* One segment per step, filling in order */}
          <div className="mt-6 flex gap-1.5" aria-hidden>
            {model.steps.map((s, i) => (
              <span key={s.id} className="relative h-3 flex-1 overflow-hidden rounded-full bg-[#EEF0F7]">
                <motion.span
                  className={cx('absolute inset-y-0 left-0 rounded-full', s.status === 'done' ? 'bg-ngreen' : s.status === 'current' ? 'bg-gradient-to-r from-nblue to-npurple' : '')}
                  initial={{ width: 0 }}
                  animate={{ width: s.status === 'done' ? '100%' : s.status === 'current' ? '45%' : 0 }}
                  transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : 0.15 + i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                />
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-[13px] font-semibold">
              {!finished && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-nblue-soft px-3 py-1.5 text-nblue">
                  <Clock className="h-4 w-4" /> About {fmtMinutes(model.minutesLeft)} to go
                </span>
              )}
              {!finished && model.finishDate && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-npurple-soft px-3 py-1.5 text-npurple">
                  <CalendarCheck className="h-4 w-4" /> On pace to finish {fmtDate(model.finishDate)}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1.5 text-ink-soft">{Math.round(pct * 100)}% of the way there</span>
            </div>
            {!readOnly && model.next && (
              <Button onClick={() => navigate(model.next!.go)}>
                Continue: {model.next.label} <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {!readOnly && finished && (
              <Button onClick={() => navigate('vault')}>
                View your certificate <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </motion.div>

      {/* How to earn it, in three rules */}
      <div className={cx('grid gap-3', rules.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
        {rules.map((r, i) => (
          <motion.div key={r.title} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.1 }}>
            <Card className="relative h-full overflow-hidden !p-5">
              <span className="absolute right-4 top-3 font-display text-4xl font-extrabold text-ink/5">{i + 1}</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-white" style={{ background: `linear-gradient(135deg, ${r.color}, ${r.color}aa)` }}>
                <r.icon className="h-5 w-5" />
              </span>
              <div className="mt-3 font-bold">{r.title}</div>
              <p className="mt-1 text-[13.5px] text-ink-soft">{r.text}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* The path */}
      <div className="relative">
        {/* The line draws itself down the page */}
        <div className="absolute bottom-6 left-5 top-6 w-[3px] -translate-x-1/2 overflow-hidden rounded-full bg-line" aria-hidden>
          <motion.div
            className="w-full origin-top rounded-full bg-gradient-to-b from-ngreen via-nblue to-npurple"
            initial={{ height: 0 }}
            animate={pathSeen ? { height: `${Math.max(4, pct * 100)}%` } : undefined}
            transition={{ duration: reduce ? 0 : 1.2, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <ol ref={pathRef} className="space-y-4" aria-label="Every step to your certificate">
          {model.stages.map((st) => {
            const own = model.steps.filter((s) => s.stageIndex === st.index);
            if (!own.length) return null;
            return (
              <li key={st.index} className="space-y-4">
                <div className="relative flex flex-wrap items-center gap-3 pl-14">
                  <span className={cx('absolute left-[11px] top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-md', st.done === st.total ? 'bg-ngreen' : 'bg-npurple/80')} aria-hidden />
                  <span className="rounded-full bg-ink px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-white">{st.name}</span>
                  <span className="font-semibold text-ink-soft">{st.title}</span>
                  <span className="text-[12.5px] font-bold text-ink-faint">
                    {st.done}/{st.total} done
                  </span>
                </div>
                <ol className="space-y-4">
                  {own.map((s) => (
                    <StepCard key={s.id} s={s} index={idx++} readOnly={readOnly} />
                  ))}
                </ol>
              </li>
            );
          })}

          {/* The finish line */}
          <motion.li initial={reduce ? false : { opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="relative pl-14">
            <span className={cx('absolute left-0 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full', finished ? 'bg-gradient-to-br from-[#F5A300] to-npink text-white shadow-lg shadow-npink/30' : 'border-2 border-line bg-white text-ink-faint')}>
              <Trophy className="h-5 w-5" />
            </span>
            <div className={cx('rounded-3xl border p-5', finished ? 'border-[#F5A300]/40 bg-gradient-to-br from-[#fff8e6] to-npink-soft/40' : 'border-dashed border-line bg-white')}>
              <div className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">Finish line</div>
              <div className="font-display text-lg font-bold">{model.certificate.name}</div>
              <p className="mt-1 text-[13.5px] text-ink-soft">{finished ? `Earned ${fmtDate(model.certificate.at)}. It is saved in your Milestone Vault.` : 'Issued automatically the moment you pass the final. View it, share it, download it, and add it to your profile.'}</p>
              {finished && !readOnly && (
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => navigate('vault')}>
                  Open Milestone Vault
                </Button>
              )}
            </div>
          </motion.li>
        </ol>
      </div>
    </div>
  );
}
