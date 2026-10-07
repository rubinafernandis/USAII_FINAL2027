import { motion } from 'motion/react';
import { CheckCircle2, Clock, Timer, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CheckQuestion } from '../../shared/types';
import { scoreColor } from '../lib/format';
import { Button, Card, cx, Pill, Ring, useConfirm } from '../components/ui';

export interface QResult {
  questionId: string;
  chosen: number;
  correct: boolean;
  correctIndex: number;
  rationale: string;
}

export function useCountdown(deadline: number | null, onExpire: () => void) {
  const [left, setLeft] = useState<number | null>(null);
  const cb = useRef(onExpire);
  cb.current = onExpire;
  useEffect(() => {
    if (deadline === null) {
      setLeft(null);
      return;
    }
    let fired = false;
    const tick = () => {
      const l = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      setLeft(l);
      if (l === 0 && !fired) {
        fired = true;
        cb.current();
      }
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [deadline]);
  return left;
}

export function TimerPill({ seconds }: { seconds: number | null }) {
  if (seconds === null) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const low = seconds <= 120;
  return (
    <span
      role="timer"
      aria-live={low ? 'assertive' : 'off'}
      className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-display text-sm font-bold tabular-nums', low ? 'animate-pulse bg-npink text-white' : 'bg-nblue-soft text-nblue')}
    >
      <Timer className="h-4 w-4" /> {m}:{String(s).padStart(2, '0')}
    </span>
  );
}

/** Renders a question set, collects answers, and shows graded feedback. */
export function QuestionForm({
  questions,
  answers,
  setAnswers,
  results,
  disabled,
}: {
  questions: CheckQuestion[];
  answers: number[];
  setAnswers: (a: number[]) => void;
  results?: QResult[] | null;
  disabled?: boolean;
}) {
  return (
    <ol className="space-y-5">
      {questions.map((q, qi) => {
        const r = results?.[qi];
        return (
          <li key={q.id} className="rounded-3xl border border-line p-5">
            <div className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mist text-sm font-bold text-ink-soft">{qi + 1}</span>
              <p className="pt-0.5 font-semibold leading-snug">{q.question}</p>
            </div>
            <div className="mt-4 grid gap-2 pl-10" role="radiogroup" aria-label={`Question ${qi + 1}`}>
              {q.options.map((o, oi) => {
                const chosen = answers[qi] === oi;
                const isCorrect = r && r.correctIndex === oi;
                const isWrongPick = r && chosen && !r.correct;
                return (
                  <button
                    key={oi}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    disabled={disabled || !!results}
                    onClick={() => {
                      const next = [...answers];
                      next[qi] = oi;
                      setAnswers(next);
                    }}
                    className={cx(
                      'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[14.5px] transition',
                      !r && chosen && 'border-nblue bg-nblue-soft ring-4 ring-nblue/10',
                      !r && !chosen && 'border-line hover:border-nblue/40 hover:bg-mist',
                      isCorrect && 'border-ngreen bg-ngreen-soft',
                      isWrongPick && 'border-npurple bg-npurple-soft',
                      r && !isCorrect && !isWrongPick && 'border-line opacity-60',
                    )}
                  >
                    <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', chosen ? 'border-nblue' : 'border-line')}>
                      {chosen && <span className="h-2.5 w-2.5 rounded-full bg-nblue" />}
                    </span>
                    <span className="flex-1">{o}</span>
                    {isCorrect && <CheckCircle2 className="h-5 w-5 text-ngreen" />}
                    {isWrongPick && <XCircle className="h-5 w-5 text-npurple" />}
                  </button>
                );
              })}
            </div>
            {r && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cx('ml-10 mt-3 rounded-2xl px-4 py-3 text-sm', r.correct ? 'bg-ngreen-soft text-ngreen-ink' : 'bg-npurple-soft/70 text-ink')}>
                <span className="font-semibold">{r.correct ? 'Correct. ' : r.chosen < 0 ? 'Not answered. ' : 'Not quite. '}</span>
                {r.rationale}
              </motion.div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ScoreBanner({ score, passMark, graded, subtitle }: { score: number; passMark?: number; graded: boolean; subtitle?: string }) {
  const msg = score >= 90 ? 'Excellent work.' : score >= 75 ? 'Solid understanding.' : score >= 60 ? 'Getting there.' : 'This topic needs another look.';
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
      <Card className="flex flex-wrap items-center gap-5 bg-gradient-to-r from-nblue-soft/60 via-white to-npurple-soft/60">
        <Ring value={score} size={96} stroke={9} />
        <div>
          <div className="font-display text-xl font-bold" style={{ color: scoreColor(score) }}>
            {msg}
          </div>
          <p className="text-sm text-ink-soft">
            {subtitle ?? (graded ? 'This attempt counts toward your grade and your Comprehension.' : 'Practice attempt: great for memory, it does not change your grade.')}
            {passMark !== undefined && ` Pass mark: ${passMark}%.`}
          </p>
        </div>
      </Card>
    </motion.div>
  );
}

export function TimedIntro({ minutes, questions, attemptsText, onStart, busy, resume }: { minutes: number; questions: number; attemptsText: string; onStart: () => void; busy: boolean; resume?: boolean }) {
  return (
    <Card className="text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-npurple-soft text-npurple">
        <Clock className="h-7 w-7" />
      </div>
      <h3 className="mt-3 text-xl font-bold">{resume ? 'Your quiz is still open' : 'Ready when you are'}</h3>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        <Pill color="blue">{questions} questions</Pill>
        <Pill color="purple">{minutes ? `${minutes} minutes` : 'No time limit'}</Pill>
        <Pill color="green">Open book</Pill>
        <Pill color="gray">{attemptsText}</Pill>
      </div>
      <p className="mx-auto mt-3 max-w-md text-sm text-ink-soft">
        {minutes ? 'The timer keeps running if you leave the page. When it reaches zero, your answers are submitted automatically.' : 'Take your time.'} You will see the answer key right after you submit.
      </p>
      <Button size="lg" className="mt-5" loading={busy} onClick={onStart}>
        {resume ? 'Resume quiz' : 'Start quiz'}
      </Button>
    </Card>
  );
}

export function AnswerKey({ questions, lastAnswers }: { questions: CheckQuestion[]; lastAnswers: number[] }) {
  const results: QResult[] = questions.map((q, i) => ({ questionId: q.id, chosen: lastAnswers[i] ?? -1, correct: lastAnswers[i] === q.correctIndex, correctIndex: q.correctIndex, rationale: q.rationale }));
  return <QuestionForm questions={questions} answers={lastAnswers} setAnswers={() => undefined} results={results} disabled />;
}

export function SubmitBar({ answered, total, onSubmit, busy, label = 'Submit answers' }: { answered: number; total: number; onSubmit: () => void; busy: boolean; label?: string }) {
  const confirm = useConfirm();
  const go = useCallback(async () => {
    if (answered < total) {
      const ok = await confirm({ title: 'Submit with unanswered questions?', text: `You have answered ${answered} of ${total}. Unanswered questions count as incorrect.`, confirm: 'Submit anyway' });
      if (!ok) return;
    }
    onSubmit();
  }, [answered, total, onSubmit, confirm]);
  return (
    <div className="sticky bottom-4 z-10 mt-6 flex items-center justify-between gap-3 rounded-full border border-line surface-blur py-2 pl-5 pr-2 shadow-xl backdrop-blur">
      <span className="text-sm text-ink-soft">
        {answered} of {total} answered
      </span>
      <Button loading={busy} onClick={go}>
        {label}
      </Button>
    </div>
  );
}

