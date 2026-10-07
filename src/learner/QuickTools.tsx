import { motion } from 'motion/react';
import { ALargeSmall, ArrowRight, Focus, GitBranch, Headphones, Trophy } from 'lucide-react';
import type { ReactNode } from 'react';
import { Empty, PageHeader, cx, navigate } from '../components/ui';
import { useLearner } from './context';
import { usePrefs } from './prefs';

interface Tool {
  id: string;
  label: string;
  hint: string;
  icon: ReactNode;
  color: string;
  go: () => void;
}

/**
 * Quick Tools.
 * The ways of learning that are not lessons: the skills you own, audio, your
 * vault and your reading settings. Reached from the sidebar so the dashboard
 * stays about one thing — what to do next.
 */
export default function QuickTools() {
  const { active, readOnly } = useLearner();
  const prefs = usePrefs();

  if (!active) return <Empty title="Join a course first" text="Quick Tools work alongside a course you are taking." />;

  const lessonId = active.snapshot.nextStep.action.lessonId ?? active.course.modules[0]?.lessons[0]?.id;
  const tools: Tool[] = [
    { id: 'tree', label: 'Skill Tree', hint: 'See the skills you have acquired in this course', icon: <GitBranch className="h-6 w-6" />, color: '#1F6BFF', go: () => navigate('skills') },
    {
      id: 'listen',
      label: 'Listen',
      hint: 'Play your next lesson as audio, hands free',
      icon: <Headphones className="h-6 w-6" />,
      color: '#00C77F',
      go: () => (lessonId ? navigate(`study/${active.course.id}/${lessonId}?listen=1`) : navigate('learning')),
    },
    { id: 'vault', label: 'Milestone Vault', hint: 'Your certifications and digital badges', icon: <Trophy className="h-6 w-6" />, color: '#8B3DFF', go: () => navigate('vault') },
    { id: 'reading', label: 'Reading Comfort', hint: 'Text size and dark mode', icon: <ALargeSmall className="h-6 w-6" />, color: '#FF2E93', go: () => window.dispatchEvent(new Event('lms:open-readability')) },
    { id: 'focus', label: 'Focus Mode', hint: 'Hide the menus and read without distraction', icon: <Focus className="h-6 w-6" />, color: '#00C2FF', go: () => prefs.toggle('focus') },
  ];

  return (
    <div>
      <PageHeader title="Quick Tools" subtitle="Learn the way that suits you today." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {tools.map((t, i) => (
          <motion.button
            key={t.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 220, damping: 22 }}
            whileHover={{ y: -5 }}
            whileTap={{ scale: 0.99 }}
            disabled={readOnly}
            onClick={t.go}
            className="group relative overflow-hidden rounded-3xl border border-line bg-white p-5 text-left transition enabled:hover:border-npurple/40 disabled:opacity-60"
          >
            <span className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-[0.14] blur-2xl transition group-hover:opacity-30" style={{ background: t.color }} />
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}bb)` }}>
              {t.icon}
            </span>
            <span className="mt-3 flex items-center gap-1.5 font-display text-lg font-bold">
              {t.label}
              <ArrowRight className="h-4 w-4 text-ink-faint transition group-hover:translate-x-0.5 group-hover:text-npurple" />
            </span>
            <span className={cx('mt-1 block text-[13px] leading-snug text-ink-soft')}>{t.hint}</span>
            {t.id === 'focus' && prefs.focus && <span className="mt-2 inline-block rounded-full bg-ngreen-soft px-2.5 py-0.5 text-[11px] font-bold text-ngreen-ink">On now</span>}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
