import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, ChevronDown, ListChecks, Lock } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cx, navigate, useRoute } from '../components/ui';
import { buildCompletion, type Step } from './completion';
import { useLearner } from './context';

const OPEN_KEY = 'usaii.lms.steps.open'; // this session's manual choice
const AUTO_OPEN = ['learning', 'study', 'final', 'steps'];

function Dot({ s, fresh }: { s: Step; fresh: boolean }) {
  const reduce = useReducedMotion();
  if (s.status === 'done')
    return (
      <motion.span
        initial={fresh && !reduce ? { scale: 0.4 } : false}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 14 }}
        className="relative z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ngreen text-white"
      >
        <Check className="h-3 w-3" strokeWidth={3.2} />
      </motion.span>
    );
  if (s.status === 'current')
    return (
      <span className="relative z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full border-[2.5px] border-npurple bg-white shadow-[0_0_0_4px_rgba(139,61,255,0.18)]">
        <span className="h-1.5 w-1.5 rounded-full bg-npurple" />
      </span>
    );
  if (s.status === 'locked')
    return (
      <span className="relative z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-line bg-mist text-ink-faint">
        <Lock className="h-2.5 w-2.5" />
      </span>
    );
  if (s.status === 'started') return <span className="relative z-10 block h-[18px] w-[18px] rounded-full border-2 border-nblue bg-[conic-gradient(#1F6BFF_0_50%,transparent_50%)]" />;
  return <span className="relative z-10 block h-[18px] w-[18px] rounded-full border-2 border-line bg-white" />;
}

/**
 * Steps to Completion, in the sidebar.
 * Collapsed, it is one row with "3/10". Expanded, it lists every step with a
 * checkmark as each one is finished, so the learner sees at a glance what is
 * done and what is left. It opens by itself on learning pages only, and it
 * always respects the learner's own choice to open or close it.
 */
export default function StepsNav() {
  const { active, readOnly } = useLearner();
  const { view } = useRoute();
  const [manual, setManual] = useState<boolean | null>(() => {
    try {
      const v = sessionStorage.getItem(OPEN_KEY);
      return v === null ? null : v === '1';
    } catch {
      return null;
    }
  });
  const open = manual ?? AUTO_OPEN.includes(view);
  const toggle = () => {
    setManual(!open);
    try {
      sessionStorage.setItem(OPEN_KEY, !open ? '1' : '0');
    } catch {
      /* ignore */
    }
  };
  const model = useMemo(() => (active ? buildCompletion(active) : null), [active]);

  // A small reward: a step finished while the learner is here gets its checkmark "pop".
  const seen = useRef<{ course: string; done: Set<string> } | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!model || !active) return;
    const done = new Set(model.steps.filter((s) => s.status === 'done').map((s) => s.id));
    const prev = seen.current;
    if (prev && prev.course === active.course.id) {
      const newly = [...done].filter((id) => !prev.done.has(id));
      if (newly.length) {
        setFresh(new Set(newly));
        setTimeout(() => setFresh(new Set()), 1500);
      }
    }
    seen.current = { course: active.course.id, done };
  }, [model, active]);

  if (!active || !model) return null;
  const onPage = view === 'steps';

  return (
    <div className={cx('my-0.5 rounded-2xl transition-colors', open && 'bg-white/70 ring-1 ring-line')}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="steps-nav-list"
        className={cx('group relative flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] font-semibold transition', onPage ? 'text-ink' : 'text-ink-soft hover:bg-mist hover:text-ink')}
      >
        {onPage && <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-nblue-soft via-npurple-soft to-npink-soft/60 ring-1 ring-npurple/15" />}
        <span className={cx('relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition', onPage ? 'bg-gradient-to-br from-nblue to-npurple text-white' : 'bg-mist text-ink-faint group-hover:bg-nblue-soft group-hover:text-nblue')}>
          <ListChecks className="h-[17px] w-[17px]" />
        </span>
        <span className="relative flex-1 text-left leading-tight">Steps to Completion</span>
        <span className={cx('relative rounded-full px-2 py-0.5 text-[11px] font-extrabold', model.certificate.earned ? 'bg-ngreen-soft text-ngreen-ink' : 'bg-npurple-soft text-npurple')}>
          {model.done}/{model.total}
        </span>
        <ChevronDown className={cx('relative h-4 w-4 shrink-0 text-ink-faint transition-transform duration-200', open && 'rotate-180')} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id="steps-nav-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <ol className="px-1.5 pb-1 pt-0.5" aria-label={`${active.course.title}: ${model.done} of ${model.total} steps complete`}>
              {model.steps.map((s, i) => {
                const last = i === model.steps.length - 1;
                const lineDone = s.status === 'done';
                return (
                  <li key={s.id} className="relative">
                    {!last && <span aria-hidden className={cx('absolute bottom-[-6px] left-[20px] top-[22px] w-[2px]', lineDone ? 'bg-ngreen' : 'bg-line')} />}
                    <button
                      type="button"
                      disabled={readOnly || !s.go}
                      onClick={() => s.go && navigate(s.go)}
                      aria-current={s.status === 'current' ? 'step' : undefined}
                      title={s.status === 'locked' ? 'Unlocks when all lessons are complete' : `${s.label}: ${s.title}`}
                      className={cx(
                        'relative flex w-full items-start gap-2.5 rounded-xl py-1.5 pl-[11px] pr-2 text-left transition',
                        s.status === 'current' ? 'bg-npurple-soft/70' : 'enabled:hover:bg-mist',
                        'disabled:cursor-default',
                      )}
                    >
                      <span className="mt-px">
                        <Dot s={s} fresh={fresh.has(s.id)} />
                      </span>
                      <span className={cx('min-w-0 flex-1', (s.status === 'upcoming' || s.status === 'locked') && 'opacity-60')}>
                        <span className={cx('block text-[10.5px] font-bold', s.status === 'current' ? 'text-npurple' : 'text-ink-faint')}>
                          {s.label}
                          {s.status === 'current' && ' · You are here'}
                        </span>
                        <span className={cx('block truncate text-[12.5px] leading-snug', s.status === 'current' ? 'font-bold text-ink' : 'text-ink-soft')}>{s.title}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <button type="button" onClick={() => navigate('steps')} className="mx-1.5 mb-1.5 flex w-[calc(100%-12px)] items-center justify-between rounded-xl px-3 py-2 text-[12.5px] font-bold text-nblue transition hover:bg-nblue-soft">
              See the full map <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
