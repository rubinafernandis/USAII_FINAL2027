import { navigate, Ring } from '../components/ui';
import { scoreColor } from '../lib/format';
import type { CourseItem } from './context';

/**
 * The projected grade for the course the learner is working on, always visible at the top right.
 * It is the same number as "Projected grade" on My Dashboard, and opens My Progress, where
 * "How your grade is made" explains it.
 */
export default function ProjectedGrade({ item }: { item: CourseItem }) {
  const p = item.snapshot.prediction;
  const measured = p.evidence !== 'none';
  const value = measured ? p.predictedGrade : null;
  const color = measured ? scoreColor(p.predictedGrade) : '#C9CBDA';
  const title = measured
    ? `Projected grade for ${item.course.title}: likely ${p.range.low} to ${p.range.high}% (most likely ${p.predictedGrade}%). ${p.evidenceNote} Open My Progress to see how your grade is made.`
    : `Projected grade for ${item.course.title}: shown after your first quiz.`;
  return (
    <button
      type="button"
      onClick={() => navigate('progress')}
      title={title}
      aria-label={title}
      className="mr-1 flex items-center gap-2 rounded-full border border-line bg-white/80 py-1 pl-1 pr-3 transition hover:border-npurple/40 hover:bg-npurple-soft/40"
    >
      <Ring
        value={value}
        size={38}
        stroke={4}
        color={color}
        label={<span className="font-display text-[12px] font-extrabold" style={{ color: measured ? color : '#8A8AA3' }}>{measured ? p.predictedGrade : '–'}</span>}
      />
      <span className="hidden text-left leading-tight md:block">
        <span className="block text-[13px] font-bold text-ink">{measured ? `${p.range.low} to ${p.range.high}%` : 'After your first quiz'}</span>
        <span className="block text-[11px] text-ink-faint">{p.evidence === 'early' ? 'Early estimate' : 'Projected grade'}</span>
      </span>
    </button>
  );
}
