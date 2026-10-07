import { AnimatePresence, motion } from 'motion/react';
import { ALargeSmall, ArrowRight, Compass, GitBranch, Headphones, Pencil, Sparkles, Target, ThumbsDown, ThumbsUp, Trophy, Video, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { fmtDateTime, greeting } from '../lib/format';
import { useSession } from '../lib/session';
import { Button, Card, Collapse, cx, Empty, IconButton, Input, Label, Modal, navigate, Select, Textarea, useToast } from '../components/ui';
import { useLearner, type CourseItem } from './context';
import { DoingCard, GuidanceCard, HabitsRow, NextStepCard, PlanCard } from './widgets';


export function CourseSwitcher() {
  const { home, activeId, setActiveId } = useLearner();
  if (home.items.length < 2) return null;
  return (
    <Select value={activeId} onChange={(e) => setActiveId(e.target.value)} className="!w-auto min-w-[240px] !rounded-full !py-2" aria-label="Choose course">
      {home.items.map((i) => (
        <option key={i.course.id} value={i.course.id}>
          {i.course.title}
        </option>
      ))}
    </Select>
  );
}

function GoalLine() {
  const { setUser } = useSession();
  const { readOnly, learner } = useLearner();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [statement, setStatement] = useState(learner.goal?.statement ?? '');
  const [why, setWhy] = useState(learner.goal?.why ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api('/auth/profile', { method: 'PATCH', body: { goal: { statement, why, minutesPerDay: learner.goal?.minutesPerDay ?? 20, daysPerWeek: learner.goal?.daysPerWeek ?? 4 } } });
      setUser(r.user);
      setOpen(false);
      toast('success', 'Goal saved.');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="mt-1 flex items-center gap-2 text-ink-soft">
        <Target className="h-4 w-4 shrink-0 text-ngreen" />
        <span className="truncate">{learner.goal?.statement ? `My goal: ${learner.goal.statement}` : 'Set a goal to keep yourself motivated.'}</span>
        {!readOnly && (
          <IconButton label="Edit goal" className="!h-7 !w-7" onClick={() => setOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
        )}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="My learning goal" footer={<Button loading={busy} onClick={save}>Save goal</Button>}>
        <div className="space-y-4">
          <div>
            <Label>What do you want to be able to do?</Label>
            <Input value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="Use AI to write my weekly report in 15 minutes" />
          </div>
          <div>
            <Label>Why does it matter to you?</Label>
            <Textarea value={why} onChange={(e) => setWhy(e.target.value)} />
          </div>
        </div>
      </Modal>
    </>
  );
}

function FeedbackPrompt() {
  const { home, reload, readOnly, active } = useLearner();
  const toast = useToast();
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('fb-hide') === '1');
  const [recommend, setRecommend] = useState<boolean | null>(null);
  const [ease, setEase] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  if (!home.feedbackDue || hidden || readOnly) return null;
  const send = async () => {
    if (recommend === null || ease === null) return;
    setBusy(true);
    try {
      await api('/feedback', { body: { recommend, ease, comment: '', courseId: active?.course.id } });
      toast('success', 'Thank you for your feedback.');
      await reload();
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const choice = (active: boolean) => cx('inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition', active ? 'border-transparent bg-gradient-to-r from-nblue to-npurple text-white' : 'border-line hover:border-nblue');
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="relative">
          <IconButton
            label="Not now"
            className="absolute right-3 top-3"
            onClick={() => {
              sessionStorage.setItem('fb-hide', '1');
              setHidden(true);
            }}
          >
            <X className="h-4 w-4" />
          </IconButton>
          <div className="grid gap-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div>
              <div className="mb-2 font-semibold">Would you recommend {active ? active.course.title : 'this course'}?</div>
              <div className="flex gap-2">
                <button className={choice(recommend === true)} onClick={() => setRecommend(true)}>
                  <ThumbsUp className="h-4 w-4" /> Yes
                </button>
                <button className={choice(recommend === false)} onClick={() => setRecommend(false)}>
                  <ThumbsDown className="h-4 w-4" /> No
                </button>
              </div>
            </div>
            <div>
              <div className="mb-2 font-semibold">How easy is it to know your next step?</div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setEase(n)} className={cx('h-9 w-9 rounded-xl border text-sm font-bold transition', ease === n ? 'border-transparent bg-ngreen text-white' : 'border-line hover:border-ngreen')} aria-label={`${n} of 5`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <Button loading={busy} disabled={recommend === null || ease === null} onClick={send}>
              Send
            </Button>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Dashboard() {
  const { home, active, readOnly, learner: user } = useLearner();
  if (!home.items.length || !active) {
    return (
      <div className="py-10">
        <h1 className="text-2xl font-bold">{greeting(user.name)}</h1>
        <div className="mt-6">
          <Empty
            icon={<Compass className="h-6 w-6" />}
            title="No course yet"
            text="Find a course to begin. Your first step will appear here."
            action={!readOnly && <Button onClick={() => navigate('explore')}>Explore courses</Button>}
          />
        </div>
      </div>
    );
  }
  const sections = [
    <NextStepCard key="next" item={active} readOnly={readOnly} />,
    <GuidanceCard key="guidance" item={active} />,
    <Collapse key="how" title="How to read this page">
      <ul className="space-y-1.5">
        <li>
          <b className="text-ink">Understanding</b> is how well you answered quizzes on each topic, using your best and most recent scores.
        </li>
        <li>
          <b className="text-ink">Chance of passing</b> compares your projected grade with the pass mark. It gets more accurate as you take more quizzes.
        </li>
        <li>
          <b className="text-ink">Expected Course Completion Date</b> is based on how much time you have studied in the last two weeks.
        </li>
        <li>
          <b className="text-ink">Goals</b> show what successful learners usually do. Aim for “On track” on each row.
        </li>
      </ul>
    </Collapse>,
    <DoingCard key="doing" item={active} />,
    <HabitsRow key="habits" item={active} />,
    <PlanCard key="plan" item={active} readOnly={readOnly} />,
    <FeedbackPrompt key="fb" />,
  ];
  return (
    <div className="space-y-7">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-r from-nblue-soft/70 via-npurple-soft/50 to-npink-soft/40 px-5 py-5 sm:px-7"
      >
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-nblue/25 via-npurple/20 to-npink/20 blur-3xl"
          animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[30px] font-extrabold leading-tight sm:text-[34px]">
              {readOnly ? `${user.name.split(' ')[0]}'s dashboard` : <span className="neon-text">{greeting(user.name)}</span>}
            </h1>
            <GoalLine />
          </div>
          <CourseSwitcher />
        </div>
      </motion.div>

      {sections.map((node, i) => (
        <motion.div key={node.key} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 * i, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}>
          {node}
        </motion.div>
      ))}
    </div>
  );
}
