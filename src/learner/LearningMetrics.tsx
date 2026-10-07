import { Info } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { LearningMetrics as Metrics } from '../../shared/types';
import { METRIC_TEXT } from '../../shared/metrics';
import { scoreColor } from '../lib/format';
import { Bar, cx } from '../components/ui';

/** A small information icon that reveals a short explanation. Click or Enter opens it; Esc or a click outside closes it. */
export function InfoTip({ label, text, align = 'left' }: { label: string; text: string; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-faint transition hover:bg-mist hover:text-nblue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nblue/40"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cx(
            'absolute top-7 z-40 w-[280px] rounded-2xl border border-line bg-white p-3.5 text-left text-[13px] font-normal leading-relaxed text-ink-soft shadow-xl',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          <b className="mb-1 block text-ink">{label}</b>
          {text}
        </span>
      )}
    </span>
  );
}

/** What to say when a metric is not shown yet. Never a misleading 0%. */
function pendingNote(m: Metrics, which: 'comprehension' | 'mastery'): string {
  if (m.scoredCheckpoints < m.checkpointsNeeded) {
    const left = m.checkpointsNeeded - m.scoredCheckpoints;
    return `Shown after ${left} more scored ${left === 1 ? 'checkpoint' : 'checkpoints'}, such as a knowledge check.`;
  }
  if (which === 'comprehension') return 'Shown after your first knowledge check.';
  if (m.awaitingScore) return `${m.awaitingScore === 1 ? 'Your activity is' : `${m.awaitingScore} activities are`} waiting for your instructor to score it.`;
  return 'Shown after your first applied activity is scored.';
}

function MetricTile({ m, which, compact }: { m: Metrics; which: 'comprehension' | 'mastery'; compact?: boolean }) {
  const t = METRIC_TEXT[which];
  const value = m[which];
  return (
    <div className={cx('min-w-0 flex-1', compact ? 'px-4 py-3' : 'p-5')}>
      <div className="flex items-center gap-1 text-sm font-semibold text-ink">
        {t.name}
        <InfoTip label={t.name} text={t.info} align={which === 'mastery' ? 'right' : 'left'} />
      </div>
      {value === null ? (
        <>
          <div className={cx('font-display font-bold text-ink-faint', compact ? 'text-lg' : 'mt-1 text-2xl')}>{t.pending}</div>
          {!compact && <p className="mt-1 text-xs text-ink-faint">{pendingNote(m, which)}</p>}
        </>
      ) : (
        <>
          <div className={cx('font-display font-extrabold leading-tight', compact ? 'text-2xl' : 'mt-1 text-[34px]')} style={{ color: scoreColor(value) }}>
            {value}%
          </div>
          {!compact && <Bar value={value} color={scoreColor(value)} height={6} className="mt-2" />}
        </>
      )}
      {!compact && <p className="mt-2 text-[13px] text-ink-soft">{t.short}</p>}
    </div>
  );
}

/**
 * The two course-level learning metrics, always shown together.
 * `compact` fits beneath the course title; the full version belongs on My Progress.
 */
export default function LearningMetrics({ metrics, compact, className }: { metrics: Metrics; compact?: boolean; className?: string }) {
  return (
    <section aria-label="Comprehension and Mastery" className={cx('flex flex-col divide-y divide-line overflow-visible rounded-2xl border border-line bg-white sm:flex-row sm:divide-x sm:divide-y-0', className)}>
      <MetricTile m={metrics} which="comprehension" compact={compact} />
      <MetricTile m={metrics} which="mastery" compact={compact} />
    </section>
  );
}
