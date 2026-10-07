import { ArrowLeft, Award, Lock } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { CheckQuestion } from '../../shared/types';
import { api } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import { Button, Card, Empty, navigate, PageHeader, useToast } from '../components/ui';
import { QuestionForm, ScoreBanner, SubmitBar, TimedIntro, TimerPill, useCountdown, type QResult } from './CheckRunner';
import { useLearner } from './context';
import { celebrate } from './Study';

export default function FinalExam({ courseId }: { courseId: string }) {
  const { home, patchItem } = useLearner();
  const toast = useToast();
  const item = home.items.find((i) => i.course.id === courseId);
  const [phase, setPhase] = useState<'intro' | 'running' | 'result'>('intro');
  const [questions, setQuestions] = useState<CheckQuestion[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [results, setResults] = useState<QResult[] | null>(null);
  const [outcome, setOutcome] = useState<{ score: number; passed: boolean } | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef(answers);
  ref.current = answers;

  const submit = useCallback(
    async (auto = false) => {
      setBusy(true);
      try {
        const r = await api(`/learner/final/${courseId}/submit`, { body: { answers: ref.current } });
        setResults(r.results);
        setOutcome({ score: r.attempt.score, passed: r.passed });
        setPhase('result');
        setDeadline(null);
        patchItem(courseId, { snapshot: r.snapshot, enrollment: r.enrollment });
        if (auto) toast('info', 'Time is up. Your answers were submitted.');
        if (r.passed) celebrate();
        window.dispatchEvent(new Event('lms:refresh-notifications'));
      } catch (e) {
        toast('error', (e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [courseId, patchItem, toast],
  );
  const left = useCountdown(phase === 'running' ? deadline : null, () => void submit(true));

  if (!item) return <Empty title="Course not found" action={<Button onClick={() => navigate('learning')}>Back to Learning</Button>} />;
  const { course, enrollment, snapshot } = item;
  const fe = course.finalExam;
  if (!fe?.questions.length) return <Empty title="This course has no final assessment" action={<Button onClick={() => navigate('learning')}>Back to Learning</Button>} />;
  const attempts = enrollment.finalExam?.attempts ?? [];
  const passed = attempts.some((a) => a.score >= course.passMark);
  const remaining = fe.attemptsAllowed ? fe.attemptsAllowed - attempts.length : Infinity;
  const st = enrollment.finalExam?.startedAt;
  const open = !!st && !attempts.some((a) => Date.parse(a.at) >= Date.parse(st)) && (!fe.timeLimitMin || Date.now() - Date.parse(st) < fe.timeLimitMin * 60_000);

  const start = async () => {
    setBusy(true);
    try {
      const r = await api(`/learner/final/${courseId}/start`, { body: {} });
      const skew = Date.now() - Date.parse(r.serverNow);
      setQuestions(r.questions);
      setAnswers(r.questions.map(() => -1));
      setResults(null);
      setDeadline(r.timeLimitMin ? Date.parse(r.startedAt) + r.timeLimitMin * 60_000 + skew : null);
      setPhase('running');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={() => navigate('learning')} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-nblue">
        <ArrowLeft className="h-4 w-4" /> {course.title}
      </button>
      <PageHeader title="Final assessment" subtitle={`Pass mark ${course.passMark}%. Counts for ${course.grading.finalExam}% of your grade.`} actions={phase === 'running' ? <TimerPill seconds={left} /> : undefined} />

      {phase === 'intro' && (
        <>
          {attempts.length > 0 && (
            <Card className="mb-4">
              <h3 className="font-bold">Your attempts</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {attempts.map((a, i) => (
                  <li key={a.at} className="flex justify-between">
                    <span>
                      Attempt {i + 1}, {fmtDateTime(a.at)}
                    </span>
                    <span className={a.score >= course.passMark ? 'font-bold text-ngreen-ink' : 'font-bold text-npink'}>{a.score}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {passed ? (
            <Card className="text-center">
              <Award className="mx-auto h-10 w-10 text-ngreen" />
              <h3 className="mt-2 text-xl font-bold">You passed</h3>
              <Button className="mt-4" onClick={() => navigate(`vault/${courseId}`)}>
                View my credential
              </Button>
            </Card>
          ) : !snapshot.eligibleForFinal ? (
            <Empty icon={<Lock className="h-6 w-6" />} title="Not unlocked yet" text="Complete every lesson first. Your dashboard shows exactly what is left." action={<Button onClick={() => navigate('dashboard')}>Go to my next step</Button>} />
          ) : remaining <= 0 ? (
            <Empty title="No attempts remaining" text="Contact your instructor through Ask to discuss your options." action={<Button onClick={() => navigate('ask?new=1&private=1')}>Message instructor</Button>} />
          ) : (
            <TimedIntro
              minutes={fe.timeLimitMin}
              questions={fe.questions.length}
              attemptsText={fe.attemptsAllowed ? `${remaining} of ${fe.attemptsAllowed} attempts left` : 'Unlimited attempts'}
              onStart={start}
              busy={busy}
              resume={open}
            />
          )}
        </>
      )}

      {phase !== 'intro' && (
        <>
          {phase === 'result' && outcome && (
            <div className="mb-5 space-y-3">
              <ScoreBanner score={outcome.score} passMark={course.passMark} graded subtitle={outcome.passed ? 'You passed the final assessment.' : 'Not a pass this time. Review your weakest topics, then try again.'} />
              <div className="flex flex-wrap gap-2">
                {outcome.passed ? (
                  <Button onClick={() => navigate(`vault/${courseId}`)}>View my credential</Button>
                ) : (
                  <Button onClick={() => navigate(`progress/${courseId}`)}>See my weak topics</Button>
                )}
                <Button variant="secondary" onClick={() => navigate('dashboard')}>
                  Back to dashboard
                </Button>
              </div>
            </div>
          )}
          <QuestionForm questions={questions} answers={answers} setAnswers={setAnswers} results={results} />
          {phase === 'running' && <SubmitBar answered={answers.filter((a) => a >= 0).length} total={questions.length} busy={busy} onSubmit={() => void submit(false)} label="Submit final assessment" />}
        </>
      )}
    </div>
  );
}
