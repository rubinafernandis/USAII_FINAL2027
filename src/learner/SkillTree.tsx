import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Award, CheckCircle2, Clock, Sparkles, Star, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { flattenLessons, progressOf } from '../../shared/analytics';
import type { Lesson } from '../../shared/types';
import { Bar, Button, Card, cx, navigate } from '../components/ui';
import { useLearner, type CourseItem } from './context';
import { actionPath } from './widgets';

interface AcquiredSkill {
  lesson: Lesson;
  /** A strong skill was checked at 85% or better. */
  strong: boolean;
  score: number | null;
}

/**
 * Skill Tree.
 * Shows the skills the learner has actually acquired in this course. Nothing
 * still locked is listed: this is a record of what they can now do, not a
 * catalog of what they cannot. The course name is the only label needed.
 */
export default function SkillTree({ item }: { item: CourseItem }) {
  const { readOnly } = useLearner();
  const { course, enrollment, snapshot } = item;
  const [openId, setOpenId] = useState<string | null>(null);

  const { skills, total } = useMemo(() => {
    const flat = flattenLessons(course);
    const topics = new Map(snapshot.topics.map((m) => [m.lessonId, m]));
    const acquired: AcquiredSkill[] = [];
    flat.forEach((f) => {
      if (progressOf(enrollment, f.lesson.id).status !== 'done') return;
      const m = topics.get(f.lesson.id);
      const score = m && m.bestCheck !== null ? m.score : null;
      acquired.push({ lesson: f.lesson, strong: score !== null && score >= 85, score });
    });
    return { skills: acquired, total: flat.length };
  }, [course, enrollment, snapshot.topics]);

  const open = skills.find((s) => s.lesson.id === openId);
  const ns = snapshot.nextStep;
  const pctDone = total ? Math.round((skills.length / total) * 100) : 0;
  const strongCount = skills.filter((s) => s.strong).length;

  return (
    <div className="space-y-5" data-tour="skilltree">
      <Card className="overflow-hidden !p-0">
        {/* The course itself is the heading: no module names needed */}
        <div className="relative overflow-hidden border-b border-line bg-gradient-to-r from-nblue-soft via-npurple-soft to-npink-soft/70 px-5 py-5 sm:px-6">
          <motion.span
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-gradient-to-br from-nblue/25 via-npurple/25 to-npink/20 blur-3xl"
            animate={{ scale: [1, 1.15, 1], opacity: [0.65, 1, 0.65] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[13px] font-bold text-npurple">
                <Sparkles className="h-4 w-4" /> Skills you have acquired
              </div>
              <h2 className="grad-text mt-1 font-display text-[24px] font-extrabold leading-tight sm:text-[28px]">{course.title}</h2>
            </div>
            <div className="text-right">
              <div className="font-display text-3xl font-extrabold">
                {skills.length}
                <span className="text-lg text-ink-faint">/{total}</span>
              </div>
              <div className="text-[12px] font-semibold text-ink-soft">{strongCount ? `${strongCount} strong` : 'skills acquired'}</div>
            </div>
          </div>
          <div className="relative mt-4">
            <Bar value={pctDone} height={10} shimmer />
          </div>
        </div>

        <div className="px-4 py-6 sm:px-6">
          {skills.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-line bg-mist/40 px-6 py-10 text-center">
              <motion.span
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-nblue to-npurple text-white"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Star className="h-7 w-7" />
              </motion.span>
              <div className="mt-3 font-display text-lg font-bold">Your first skill is one lesson away</div>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">Finish a lesson and it appears here as a skill you own. Every skill you collect stays on this map.</p>
              <Button className="mt-4" disabled={readOnly} onClick={() => navigate(actionPath(ns.action))}>
                {ns.label} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-start gap-2 sm:gap-3">
              {skills.map((s, i) => (
                <motion.button
                  key={s.lesson.id}
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: Math.min(0.5, i * 0.05), type: 'spring', stiffness: 260, damping: 20 }}
                  whileHover={{ y: -4 }}
                  onClick={() => setOpenId(s.lesson.id === openId ? null : s.lesson.id)}
                  aria-expanded={s.lesson.id === openId}
                  title={`${s.lesson.title} — ${s.strong ? 'Strong' : 'Acquired'}`}
                  className="flex w-[92px] flex-col items-center gap-2 rounded-2xl p-1 text-center sm:w-[112px]"
                >
                  <span
                    className={cx(
                      'relative flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg ring-4 transition',
                      s.strong ? 'bg-gradient-to-br from-ngreen to-nblue shadow-ngreen/30 ring-ngreen/25' : 'bg-gradient-to-br from-nblue to-npurple shadow-npurple/30 ring-npurple/20',
                      s.lesson.id === openId && 'scale-105',
                    )}
                  >
                    {s.strong ? <Star className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7" />}
                    {s.score !== null && (
                      <span className="absolute -bottom-2 rounded-full bg-white px-1.5 text-[10px] font-bold shadow" style={{ color: s.strong ? '#00804F' : '#1F6BFF' }}>
                        {s.score}%
                      </span>
                    )}
                  </span>
                  <span className={cx('line-clamp-2 text-[11.5px] font-semibold leading-tight', s.lesson.id === openId ? 'text-npurple' : 'text-ink-soft')}>{s.lesson.topic || s.lesson.title}</span>
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* One clear way forward, and the goal at the end of it */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-mist/50 px-5 py-4">
          <span className="inline-flex items-center gap-2.5 text-sm">
            <span className={cx('flex h-10 w-10 items-center justify-center rounded-2xl', snapshot.credentialEarned ? 'bg-ngreen-soft text-ngreen-ink' : 'bg-white text-ink-faint')}>
              {snapshot.credentialEarned ? <Trophy className="h-5 w-5" /> : <Award className="h-5 w-5" />}
            </span>
            <span>
              <span className="block font-bold">{course.credentialName}</span>
              <span className="block text-[12px] text-ink-faint">{snapshot.credentialEarned ? 'Earned. It is in your Milestone Vault.' : `${Math.max(0, total - skills.length)} more skills to go`}</span>
            </span>
          </span>
          {snapshot.credentialEarned ? (
            <Button variant="secondary" disabled={readOnly} onClick={() => navigate(`vault/${course.id}`)}>
              Open my vault
            </Button>
          ) : (
            skills.length > 0 && (
              <Button disabled={readOnly} onClick={() => navigate(actionPath(ns.action))}>
                {ns.label} <ArrowRight className="h-4 w-4" />
              </Button>
            )
          )}
        </div>
      </Card>

      <AnimatePresence mode="wait">
        {open && (
          <motion.div key={open.lesson.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <Card className="border-npurple/30">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-bold">{open.lesson.title}</h3>
                  <p className="mt-1 max-w-2xl text-sm text-ink-soft">{open.lesson.summary}</p>
                </div>
                <span className={cx('rounded-full px-3 py-1 text-[12px] font-bold', open.strong ? 'bg-ngreen-soft text-ngreen-ink' : 'bg-nblue-soft text-nblue')}>{open.strong ? 'Strong' : 'Acquired'}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ink-soft">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> About {open.lesson.estimatedMinutes} min to review
                </span>
                {open.score !== null && <span className="font-semibold">Your best check: {open.score}%</span>}
              </div>
              <Button variant="secondary" className="mt-4" disabled={readOnly} onClick={() => navigate(`study/${course.id}/${open.lesson.id}`)}>
                Review this skill <ArrowRight className="h-4 w-4" />
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
