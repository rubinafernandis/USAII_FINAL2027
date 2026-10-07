import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Award, BarChart3, BookOpen, LayoutDashboard, MessageCircle, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { Button, cx, Input, Label, Logo, Textarea, useToast } from '../components/ui';

const IDEAS = ['Use AI to save time on writing and reports', 'Understand AI well enough to lead my team through it', 'Make better decisions with data and AI', 'Start a new career path in AI-enabled work'];
const TOUR = [
  { name: 'My Dashboard', text: 'Your next step and how you are doing.', icon: LayoutDashboard, color: '#1F6BFF' },
  { name: 'Learning', text: 'All lessons in order, plus resources.', icon: BookOpen, color: '#8B3DFF' },
  { name: 'Progress', text: 'Your scores, topics, and study habits.', icon: BarChart3, color: '#FF2E93' },
  { name: 'Ask', text: 'Questions for your class or just your instructor.', icon: MessageCircle, color: '#00C77F' },
  { name: 'Certificate & Badge', text: 'What is left to earn your certificate.', icon: Award, color: '#00C2FF' },
];

export default function Onboarding() {
  const { user, setUser } = useSession();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [statement, setStatement] = useState(user.goal?.statement ?? '');
  const [why, setWhy] = useState(user.goal?.why ?? '');
  const [minutes, setMinutes] = useState(user.goal?.minutesPerDay ?? 20);
  const [days, setDays] = useState(user.goal?.daysPerWeek ?? 4);
  const [busy, setBusy] = useState(false);

  const finish = async (skip = false) => {
    setBusy(true);
    try {
      const r = await api('/auth/profile', {
        method: 'PATCH',
        body: skip ? { onboarded: true } : { onboarded: true, goal: { statement, why, minutesPerDay: minutes, daysPerWeek: days } },
      });
      setUser(r.user);
      window.location.hash = '#/dashboard';
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    <div key="0">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-nblue via-npurple to-npink text-white shadow-xl shadow-npurple/30">
        <Sparkles className="h-8 w-8" />
      </div>
      <h1 className="mt-6 text-center text-3xl font-extrabold">Welcome, {user.name.split(' ')[0]}</h1>
      <p className="mx-auto mt-3 max-w-md text-center text-ink-soft">Every time you sign in, you will see one clear next step, how you are doing, and how to improve. This takes about a minute: two quick questions, then a short tour.</p>
      <div className="mt-8 flex justify-center">
        <Button size="lg" onClick={() => setStep(1)}>
          Let’s go <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>,
    <div key="1">
      <h2 className="text-2xl font-bold">What do you want to be able to do?</h2>
      <p className="mt-1 text-ink-soft">You set the goal. We keep it in front of you.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {IDEAS.map((i) => (
          <button key={i} onClick={() => setStatement(i)} className={cx('rounded-full border px-3 py-1.5 text-[13px] font-medium transition', statement === i ? 'border-transparent bg-nblue text-white' : 'border-line hover:border-nblue')}>
            {i}
          </button>
        ))}
      </div>
      <div className="mt-5 space-y-4">
        <div>
          <Label>My goal</Label>
          <Input value={statement} onChange={(e) => setStatement(e.target.value)} placeholder="Or write your own" />
        </div>
        <div>
          <Label hint="(optional)">Why it matters to me</Label>
          <Textarea value={why} onChange={(e) => setWhy(e.target.value)} className="!min-h-[72px]" placeholder="So I can…" />
        </div>
      </div>
    </div>,
    <div key="2">
      <h2 className="text-2xl font-bold">How much time can you give it?</h2>
      <p className="mt-1 text-ink-soft">Small and steady beats long and rare. You can change this any time.</p>
      <div className="mt-6 space-y-6">
        <div>
          <div className="flex justify-between">
            <Label htmlFor="ob-min">Minutes on a study day</Label>
            <span className="font-display text-lg font-bold text-nblue">{minutes} min</span>
          </div>
          <input id="ob-min" type="range" min={5} max={90} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="w-full accent-[#1F6BFF]" />
        </div>
        <div>
          <Label>Days per week</Label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <button key={d} onClick={() => setDays(d)} className={cx('h-11 flex-1 rounded-2xl border font-display font-bold transition', days === d ? 'border-transparent bg-gradient-to-br from-npurple to-npink text-white' : 'border-line hover:border-npurple')}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <p className="rounded-2xl bg-ngreen-soft px-4 py-3 text-sm text-ngreen-ink">That is {minutes * days} minutes a week. Your dashboard will show the finish date this plan gives you.</p>
      </div>
    </div>,
    <div key="3">
      <h2 className="text-2xl font-bold">Here is your learning space</h2>
      <p className="mt-1 text-ink-soft">Five places, always in the main menu.</p>
      <div className="mt-6 space-y-2.5">
        {TOUR.map((t, i) => (
          <motion.div key={t.name} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.12 }} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: t.color }}>
              <t.icon className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold">{t.name}</div>
              <div className="text-sm text-ink-soft">{t.text}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>,
  ];

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <div className="aurora">
        <span />
        <span />
        <span />
        <span />
      </div>
      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Logo />
        <button onClick={() => void finish(true)} className="text-sm font-semibold text-ink-soft hover:text-ink">
          Skip for now
        </button>
      </header>
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-10">
        <div className="w-full max-w-xl rounded-[32px] border border-white/70 bg-white/85 p-8 shadow-[0_30px_80px_-30px_rgba(139,61,255,0.35)] backdrop-blur-xl sm:p-10">
          {step > 0 && (
            <div className="mb-6 flex gap-1.5" aria-label={`Step ${step} of 3`}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist">
                  <motion.div className="h-full bg-gradient-to-r from-nblue to-npink" initial={false} animate={{ width: i <= step ? '100%' : '0%' }} />
                </div>
              ))}
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}>
              {steps[step]}
            </motion.div>
          </AnimatePresence>
          {step > 0 && (
            <div className="mt-8 flex justify-between">
              <Button variant="ghost" onClick={() => setStep(step - 1)} icon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
              {step < 3 ? (
                <Button onClick={() => setStep(step + 1)} disabled={step === 1 && statement.trim().length < 3}>
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button loading={busy} onClick={() => void finish()}>
                  Show my next step <ArrowRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
