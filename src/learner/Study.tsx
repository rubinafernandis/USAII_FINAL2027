import confetti from 'canvas-confetti';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Focus,
  Headphones,
  CheckCircle2,
  Circle,
  FileText,
  KeyRound,
  Lightbulb,
  MessageCircle,
  Paperclip,
  PartyPopper,
  PlayCircle,
  RotateCcw,
  Send,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { attemptsLeft, flattenLessons, lessonRequirements, progressOf, whereLabel } from '../../shared/analytics';
import { rubricLevelLabel } from '../../shared/metrics';
import { activityInstructionBlocks } from '../../shared/transcript';
import type { ActivitySubmission, CheckQuestion, Enrollment, LearnerSnapshot, Lesson, LessonProgress } from '../../shared/types';
import { api, uploadFile } from '../lib/api';
import { fmtDateTime, fmtSize, scoreColor, timeAgo } from '../lib/format';
import { Blocks } from '../components/Blocks';
import { Button, Card, cx, Empty, ErrorBox, Input, Label, navigate, Pill, Spinner, Textarea, useToast } from '../components/ui';
import { AnswerKey, QuestionForm, ScoreBanner, SubmitBar, TimedIntro, TimerPill, useCountdown, type QResult } from './CheckRunner';
import AudioPlayer, { lessonToScript, speechSupported } from './AudioPlayer';
import { useLearner } from './context';
import KnowledgeCards, { buildKnowledgeCards } from './KnowledgeCards';
import { usePrefs } from './prefs';
import { actionPath } from './widgets';

type Step = 'learn' | 'check' | 'apply' | 'reflect';

export const celebrate = () => {
  const colors = ['#1F6BFF', '#8B3DFF', '#FF2E93', '#00C77F', '#00C2FF'];
  void confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 }, colors, disableForReducedMotion: true });
  setTimeout(() => void confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0 }, colors, disableForReducedMotion: true }), 200);
  setTimeout(() => void confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1 }, colors, disableForReducedMotion: true }), 350);
};

/* ---------------- Active time tracking ---------------- */

function useStudyHeartbeat(courseId: string, lessonId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let last = Date.now();
    const bump = () => (last = Date.now());
    const evts = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    evts.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    document.getElementById('main-scroll')?.addEventListener('scroll', bump, { passive: true });
    const media = () => document.querySelectorAll('video,audio').length && [...document.querySelectorAll<HTMLMediaElement>('video,audio')].some((m) => !m.paused);
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - last > 90_000 && !media()) return;
      void api('/learner/heartbeat', { body: { courseId, lessonId, seconds: 20 } }).catch(() => undefined);
    }, 20_000);
    return () => {
      clearInterval(t);
      evts.forEach((e) => window.removeEventListener(e, bump));
      document.getElementById('main-scroll')?.removeEventListener('scroll', bump);
    };
  }, [courseId, lessonId, enabled]);
}

/* ---------------- Check step ---------------- */

function CheckStep({ courseId, lesson, progress, onUpdate }: { courseId: string; lesson: Lesson; progress: LessonProgress; onUpdate: (r: { snapshot: LearnerSnapshot; enrollment: Enrollment }) => void }) {
  const toast = useToast();
  const { readOnly } = useLearner();
  const isQuiz = lesson.checkSettings.mode === 'quiz';
  const left = attemptsLeft(lesson, progress);
  const graded = progress.attempts.filter((a) => a.kind === 'check');
  const [phase, setPhase] = useState<'summary' | 'intro' | 'running' | 'result' | 'key'>(graded.length ? 'summary' : isQuiz ? 'intro' : 'running');
  const [answers, setAnswers] = useState<number[]>(() => lesson.check.map(() => -1));
  const [results, setResults] = useState<QResult[] | null>(null);
  const [lastScore, setLastScore] = useState<{ score: number; graded: boolean } | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<{ questions: CheckQuestion[]; lastAnswers: number[] } | null>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const resumeOpen = isQuiz && !!progress.quizStartedAt && left > 0;

  const submit = useCallback(
    async (auto = false) => {
      setBusy(true);
      try {
        const r = await api(`/learner/lesson/${courseId}/${lesson.id}/check`, { body: { answers: answersRef.current } });
        setResults(r.results);
        setLastScore({ score: r.attempt.score, graded: r.graded });
        setDeadline(null);
        setPhase('result');
        onUpdate(r);
        if (auto) toast('info', 'Time is up. Your answers were submitted.');
        if (r.attempt.score >= 80) celebrate();
        if (r.credentialIssued) toast('success', 'You earned your credential!');
      } catch (e) {
        toast('error', (e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [courseId, lesson.id, onUpdate, toast],
  );

  const secondsLeft = useCountdown(phase === 'running' ? deadline : null, () => void submit(true));

  const start = async () => {
    setAnswers(lesson.check.map(() => -1));
    setResults(null);
    if (!isQuiz || left <= 0) {
      setPhase('running');
      setDeadline(null);
      return;
    }
    setBusy(true);
    try {
      const r = await api(`/learner/lesson/${courseId}/${lesson.id}/quiz-start`, { body: {} });
      const skew = Date.now() - Date.parse(r.serverNow);
      const lim = lesson.checkSettings.timeLimitMin;
      setDeadline(lim ? Date.parse(r.quizStartedAt) + lim * 60_000 + skew : null);
      setPhase('running');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openKey = async () => {
    setBusy(true);
    try {
      const r = await api(`/learner/lesson/${courseId}/${lesson.id}/answer-key`);
      setKey(r);
      setPhase('key');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const attemptsText = lesson.checkSettings.attemptsAllowed ? `${left} of ${lesson.checkSettings.attemptsAllowed} attempt${lesson.checkSettings.attemptsAllowed > 1 ? 's' : ''} left` : 'Unlimited attempts';
  const answered = answers.filter((a) => a >= 0).length;

  if (readOnly) return <p className="text-sm text-ink-soft">Checks are hidden in the read-only view.</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{isQuiz ? 'Quiz' : 'Check your understanding'}</h2>
          <p className="text-sm text-ink-soft">{isQuiz ? 'Graded and timed. Open book.' : 'Instant feedback. Retake as often as you like; your best score counts.'}</p>
        </div>
        {phase === 'running' && <TimerPill seconds={secondsLeft} />}
      </div>

      {phase === 'summary' && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm text-ink-faint">Best score</div>
              <div className="font-display text-3xl font-bold" style={{ color: scoreColor(Math.max(...graded.map((a) => a.score))) }}>
                {Math.max(...graded.map((a) => a.score))}%
              </div>
              <div className="text-sm text-ink-soft">
                {graded.length} graded attempt{graded.length > 1 ? 's' : ''}, last {timeAgo(graded[graded.length - 1].at)}. {attemptsText}.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={<KeyRound className="h-4 w-4" />} loading={busy} onClick={openKey}>
                View answer key
              </Button>
              {resumeOpen ? (
                <Button onClick={() => setPhase('intro')}>Resume quiz</Button>
              ) : (
                <Button icon={<RotateCcw className="h-4 w-4" />} onClick={() => (isQuiz && left > 0 ? setPhase('intro') : void start())}>
                  {left > 0 ? 'Retake' : 'Practice again'}
                </Button>
              )}
            </div>
          </div>
          {left <= 0 && <p className="mt-3 text-xs text-ink-faint">Practice attempts help you remember. They do not change your grade.</p>}
        </Card>
      )}

      {phase === 'intro' && <TimedIntro minutes={lesson.checkSettings.timeLimitMin} questions={lesson.check.length} attemptsText={attemptsText} onStart={start} busy={busy} resume={resumeOpen} />}

      {(phase === 'running' || phase === 'result') && (
        <>
          {phase === 'result' && lastScore && (
            <div className="mb-5">
              <ScoreBanner score={lastScore.score} graded={lastScore.graded} />
            </div>
          )}
          <QuestionForm questions={lesson.check} answers={answers} setAnswers={setAnswers} results={results} />
          {phase === 'running' ? (
            <SubmitBar answered={answered} total={lesson.check.length} busy={busy} onSubmit={() => void submit(false)} />
          ) : (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => (isQuiz && attemptsLeft(lesson, progress) > 0 ? setPhase('intro') : void start())}>
                {isQuiz && attemptsLeft(lesson, progress) <= 0 ? 'Practice again' : 'Try again'}
              </Button>
            </div>
          )}
        </>
      )}

      {phase === 'key' && key && (
        <>
          <Card className="mb-4 bg-mist/60 !py-3">
            <p className="text-sm text-ink-soft">Answer key with your most recent answers.</p>
          </Card>
          <AnswerKey questions={key.questions} lastAnswers={key.lastAnswers} />
          <Button variant="secondary" className="mt-4" onClick={() => setPhase('summary')}>
            Back
          </Button>
        </>
      )}
    </div>
  );
}

/* ---------------- Apply step ---------------- */

/** The instructor's decision on a submitted activity, in plain words. */
function ReviewBanner({ sub }: { sub: ActivitySubmission }) {
  if (!sub.review) return null;
  const look = {
    approved: { cls: 'border-ngreen/30 bg-ngreen-soft text-ngreen-ink', title: 'Approved by your instructor', text: 'Great work. Nothing more to do here.' },
    resubmit: { cls: 'border-[#F5A300]/40 bg-[#fff4d9] text-[#7a4a00]', title: 'Resubmission requested', text: 'Read the feedback below, then press "Revise and resubmit".' },
    not_approved: { cls: 'border-npink/30 bg-npink-soft text-npink', title: 'Not approved by your instructor', text: 'Read the feedback below. You can revise and resubmit it.' },
  }[sub.review];
  return (
    <div className={cx('mt-4 rounded-2xl border px-4 py-3 text-sm', look.cls)}>
      <b>{look.title}</b>
      {sub.reviewedBy && <span className="opacity-80"> · {sub.reviewedBy}</span>}
      <div className="mt-0.5">{look.text}</div>
    </div>
  );
}

function ApplyStep({ courseId, lesson, progress, onProgress }: { courseId: string; lesson: Lesson; progress: LessonProgress; onProgress: (p: LessonProgress, snap?: LearnerSnapshot) => void }) {
  const toast = useToast();
  const { readOnly } = useLearner();
  const act = lesson.activity!;
  const [fields, setFields] = useState<Record<string, string>>(() => ({ ...(progress.activity?.fields ?? {}) }));
  const [file, setFile] = useState<{ url: string; name: string } | null>(progress.activity?.fileUrl ? { url: progress.activity.fileUrl, name: progress.activity.fileName ?? 'Attachment' } : null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(!progress.activity);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 50 * 1024 * 1024) return toast('error', 'Attachments must be 50 MB or smaller.');
    setUploading(0);
    try {
      const r = await uploadFile(f, setUploading);
      setFile({ url: r.url, name: r.name });
      toast('success', `${r.name} (${fmtSize(r.size)}) attached.`);
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setUploading(null);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const r = await api(`/learner/lesson/${courseId}/${lesson.id}/activity`, { body: { fields, fileUrl: file?.url, fileName: file?.name } });
      onProgress(r.progress, r.snapshot);
      setEditing(false);
      toast('success', 'Activity submitted.');
      if (r.credentialIssued) toast('success', 'You earned your credential!');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const sub = progress.activity;
  const instructionBlocks = activityInstructionBlocks(act);
  return (
    <div>
      <h2 className="text-xl font-bold">{act.title}</h2>
      <p className="mb-4 text-sm text-ink-soft">Put the idea to work on something real from your own life or job.</p>
      {instructionBlocks.length > 0 && (
        <Card className="activity-instructions mb-5 bg-ngreen-soft/30">
          <Blocks blocks={instructionBlocks} />
        </Card>
      )}
      {act.rubricPdf?.url && !(sub && !editing && sub.rubric) && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-line p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-npurple-soft text-npurple">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold">How your work is evaluated</div>
            <p className="text-xs text-ink-faint">Your instructor scores your work against this rubric, out of {act.rubricPdf.maxPoints} points. The result counts toward your Mastery.</p>
          </div>
          <a href={act.rubricPdf.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-npurple/30 px-3.5 py-1.5 text-sm font-semibold text-npurple hover:bg-npurple-soft">
            <FileText className="h-4 w-4" /> Open rubric (PDF)
          </a>
        </div>
      )}
      {!act.rubricPdf?.url && !!act.rubric?.length && !(sub && !editing && sub.rubric) && (
        <div className="mb-5 rounded-2xl border border-line p-4">
          <div className="text-sm font-semibold">What your work is checked for</div>
          <p className="text-xs text-ink-faint">Your instructor scores your work against these criteria. The result counts toward your Mastery.</p>
          <ul className="mt-2 space-y-1.5 text-[14px]">
            {act.rubric.map((c) => (
              <li key={c.id} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
                <span>
                  <b className="font-semibold">{c.label}</b>
                  {c.description && <span className="text-ink-soft">. {c.description}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {sub && !editing ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Pill color="green">
              <CheckCircle2 className="h-3 w-3" /> Submitted {fmtDateTime(sub.submittedAt)}
            </Pill>
            {!readOnly && (
              <Button size="sm" variant={sub.review === 'resubmit' ? 'primary' : 'secondary'} onClick={() => setEditing(true)}>
                {sub.review === 'resubmit' ? 'Revise and resubmit' : 'Edit and resubmit'}
              </Button>
            )}
          </div>
          <ReviewBanner sub={sub} />
          <div className="mt-4 space-y-3">
            {act.fields.map((f) => (
              <div key={f.id}>
                <div className="text-xs font-semibold text-ink-faint">{f.label}</div>
                <p className="whitespace-pre-line text-[15px]">{sub.fields[f.id] || '—'}</p>
              </div>
            ))}
            {sub.fileUrl && (
              <a href={sub.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-nblue hover:underline">
                <Paperclip className="h-4 w-4" /> {sub.fileName}
              </a>
            )}
          </div>
          {sub.rubric && sub.rubric.maxPoints !== undefined && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line p-4">
              <div>
                <div className="text-sm font-semibold">Your rubric score</div>
                <p className="text-xs text-ink-faint">Scored by your instructor against {sub.rubric.rubricName ? `“${sub.rubric.rubricName}”` : 'the rubric'}. This counts toward your Mastery.</p>
              </div>
              <div className="text-right">
                <div className="font-display text-2xl font-extrabold">
                  {sub.rubric.points} <span className="text-base font-semibold text-ink-faint">/ {sub.rubric.maxPoints}</span>
                </div>
                <div className={cx('text-xs font-semibold', sub.rubric.percent >= 80 ? 'text-ngreen-ink' : sub.rubric.percent >= 50 ? 'text-[#9a5b00]' : 'text-npink')}>{sub.rubric.percent}%</div>
              </div>
            </div>
          )}
          {sub.rubric && sub.rubric.maxPoints === undefined && sub.rubric.scores.length > 0 && (
            <div className="mt-5 rounded-2xl border border-line p-4">
              <div className="text-sm font-semibold">How your work met each criterion</div>
              <p className="text-xs text-ink-faint">Scored by your instructor. This counts toward your Mastery.</p>
              <ul className="mt-2 divide-y divide-line">
                {sub.rubric.scores.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-[14px]">
                    <span>{c.label}</span>
                    <span className={cx('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold', c.level === 2 ? 'bg-ngreen-soft text-ngreen-ink' : c.level === 1 ? 'bg-[#fff4d9] text-[#9a5b00]' : 'bg-npink-soft text-npink')}>
                      {rubricLevelLabel(c.level)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {sub.feedback ? (
            <div className="mt-5 rounded-2xl border border-npurple/20 bg-npurple-soft/50 p-4">
              <div className="text-sm font-semibold text-npurple">
                Feedback on activity from {sub.feedbackBy} · {timeAgo(sub.feedbackAt)}
              </div>
              <p className="mt-1 whitespace-pre-line text-[15px]">{sub.feedback}</p>
            </div>
          ) : (
            !sub.review && <p className="mt-4 text-xs text-ink-faint">Your instructor will review this activity. You will get a notification with their decision.</p>
          )}
        </Card>
      ) : readOnly ? (
        <p className="text-sm text-ink-soft">Not submitted yet.</p>
      ) : (
        <Card>
          <div className="space-y-4">
            {act.fields.map((f) => (
              <div key={f.id}>
                <Label hint={f.hint}>{f.label}</Label>
                {f.multiline ? (
                  <Textarea value={fields[f.id] ?? ''} placeholder={f.placeholder} onChange={(e) => setFields({ ...fields, [f.id]: e.target.value })} />
                ) : (
                  <Input value={fields[f.id] ?? ''} placeholder={f.placeholder} onChange={(e) => setFields({ ...fields, [f.id]: e.target.value })} />
                )}
              </div>
            ))}
            {act.allowFile && (
              <div>
                <Label hint="(optional, up to 50 MB)">Attach a file</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-nblue/40 px-4 py-2 text-sm font-semibold text-nblue hover:bg-nblue-soft">
                    <Upload className="h-4 w-4" /> {file ? 'Replace file' : 'Choose file'}
                    <input type="file" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
                  </label>
                  {uploading !== null && <span className="text-sm text-ink-soft">Uploading {uploading}%</span>}
                  {file && uploading === null && (
                    <span className="inline-flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-ink-faint" /> {file.name}
                      <button className="text-npink hover:underline" onClick={() => setFile(null)}>
                        Remove
                      </button>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="mt-5 flex gap-2">
            <Button loading={busy} disabled={uploading !== null} onClick={submit}>
              Submit activity
            </Button>
            {sub && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------------- Reflect step ---------------- */

const CONF = ['Not yet', 'A little', 'Somewhat', 'Confident', 'Could teach it'];

function ReflectStep({ courseId, lesson, progress, onProgress }: { courseId: string; lesson: Lesson; progress: LessonProgress; onProgress: (p: LessonProgress) => void }) {
  const toast = useToast();
  const { readOnly } = useLearner();
  const [conf, setConf] = useState<number | undefined>(progress.selfConfidence);
  const [text, setText] = useState(progress.reflection ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const r = await api(`/learner/lesson/${courseId}/${lesson.id}/reflect`, { body: { selfConfidence: conf, reflection: text } });
      onProgress(r.progress);
      toast('success', 'Reflection saved.');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <h2 className="text-xl font-bold">Reflect</h2>
      <p className="mb-4 text-sm text-ink-soft">Two quick questions. They help you notice what you really know and decide what to do with it.</p>
      <Card>
        <div className="font-semibold">How confident are you that you could explain “{lesson.topic}” to a colleague?</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {CONF.map((l, i) => (
            <button
              key={l}
              disabled={readOnly}
              onClick={() => setConf(i + 1)}
              className={cx('rounded-full border px-4 py-1.5 text-sm font-semibold transition', conf === i + 1 ? 'border-transparent bg-gradient-to-r from-nblue to-npurple text-white' : 'border-line hover:border-npurple')}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="mt-6 font-semibold">What will you try differently at work or in life because of this lesson?</div>
        <Textarea className="mt-2" disabled={readOnly} value={text} onChange={(e) => setText(e.target.value)} placeholder="Next week I will…" />
        {!readOnly && (
          <Button className="mt-4" loading={busy} onClick={save}>
            Save reflection
          </Button>
        )}
      </Card>
    </div>
  );
}

/* ---------------- AI study coach ---------------- */

export function CoachPanel({ courseId, lessonId }: { courseId: string; lessonId?: string }) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<{ q: string; a: string; mode: string; sources: { lesson: string }[] }[]>([]);
  const ask = async () => {
    const question = q.trim();
    if (question.length < 3) return;
    setBusy(true);
    try {
      const r = await api('/ai/tutor', { body: { courseId, lessonId, question } });
      setChat((c) => [...c, { q: question, a: r.answer, mode: r.mode, sources: r.sources }]);
      setQ('');
    } catch (e) {
      setChat((c) => [...c, { q: question, a: (e as Error).message, mode: 'error', sources: [] }]);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-npurple to-npink text-white">
          <Bot className="h-4 w-4" />
        </span>
        <div>
          <div className="text-sm font-bold">Study coach</div>
          <div className="text-[11px] text-ink-faint">Answers from your course material</div>
        </div>
      </div>
      <div className="mt-3 max-h-80 space-y-3 overflow-y-auto scroll-thin">
        {chat.length === 0 && <p className="text-[13px] text-ink-soft">Stuck on an idea? Ask in your own words. The coach explains; it never gives quiz answers.</p>}
        {chat.map((m, i) => (
          <div key={i} className="space-y-1.5">
            <div className="ml-6 rounded-2xl rounded-tr-sm bg-nblue px-3 py-2 text-[13px] text-white">{m.q}</div>
            <div className={cx('mr-2 whitespace-pre-line rounded-2xl rounded-tl-sm px-3 py-2 text-[13px]', m.mode === 'error' ? 'bg-npink-soft text-npink' : 'bg-mist text-ink')}>
              {m.a}
              {m.sources.length > 0 && <div className="mt-1.5 text-[11px] text-ink-faint">From: {[...new Set(m.sources.map((s) => s.lesson))].join(', ')}</div>}
            </div>
          </div>
        ))}
        {busy && <Spinner className="mx-auto" />}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask a question" className="!rounded-full !py-2 text-[13px]" aria-label="Ask the study coach" />
        <Button type="submit" size="sm" className="!h-10 !w-10 shrink-0 !px-0" aria-label="Send" loading={busy}>
          {!busy && <Send className="h-4 w-4" />}
        </Button>
      </form>
    </Card>
  );
}

/* ---------------- Page ---------------- */

export default function Study({ courseId, lessonId, initialStep, autoListen }: { courseId: string; lessonId: string; initialStep?: string; autoListen?: boolean }) {
  const { home, patchItem, readOnly } = useLearner();
  const toast = useToast();
  const item = home.items.find((i) => i.course.id === courseId);
  const flat = useMemo(() => (item ? flattenLessons(item.course) : []), [item]);
  const idx = flat.findIndex((f) => f.lesson.id === lessonId);
  const f = flat[idx];
  const [step, setStep] = useState<Step>((['learn', 'check', 'apply', 'reflect'].includes(initialStep ?? '') ? initialStep : 'learn') as Step);
  const [completing, setCompleting] = useState(false);
  const [justDone, setJustDone] = useState(false);
  const [listening, setListening] = useState(!!autoListen);
  const prefs = usePrefs();
  // Built once per lesson: the listening script and the recall deck.
  const script = useMemo(() => (f ? lessonToScript(f.lesson) : []), [f]);
  const cards = useMemo(() => (f ? buildKnowledgeCards(f.lesson) : []), [f]);

  useEffect(() => {
    setStep((['learn', 'check', 'apply', 'reflect'].includes(initialStep ?? '') ? initialStep : 'learn') as Step);
    setJustDone(false);
    setListening(!!autoListen);
  }, [lessonId, initialStep, autoListen]);

  const updateProgress = useCallback(
    (p: LessonProgress, snapshot?: LearnerSnapshot) => {
      if (!item) return;
      patchItem(courseId, { enrollment: { ...item.enrollment, lessons: { ...item.enrollment.lessons, [lessonId]: p } }, ...(snapshot ? { snapshot } : {}) });
    },
    [item, courseId, lessonId, patchItem],
  );

  // Mark opened.
  useEffect(() => {
    if (readOnly || !f) return;
    let cancelled = false;
    api(`/learner/lesson/${courseId}/${lessonId}/open`, { body: {} })
      .then((r) => {
        if (!cancelled && item && item.enrollment.lessons[lessonId]?.status !== r.progress.status) updateProgress(r.progress);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, lessonId]);

  useStudyHeartbeat(courseId, lessonId, !readOnly && !!f);

  if (!item) return <ErrorBox message="You are not enrolled in this course." onRetry={() => navigate('learning')} />;
  if (!f) return <Empty title="Lesson not found" text="It may have been moved by your instructor." action={<Button onClick={() => navigate('learning')}>Back to Learning</Button>} />;

  const lesson = f.lesson;
  const p = progressOf(item.enrollment, lesson.id);
  const req = lessonRequirements(lesson, p);
  const steps: { id: Step; label: string; done: boolean }[] = [
    { id: 'learn', label: 'Learn', done: p.status !== 'not_started' },
    ...(req.needsCheck ? [{ id: 'check' as Step, label: lesson.checkSettings.mode === 'quiz' ? 'Quiz' : 'Check', done: req.checkDone }] : []),
    ...(req.needsActivity ? [{ id: 'apply' as Step, label: 'Apply', done: req.activityDone }] : []),
    { id: 'reflect', label: 'Reflect', done: !!p.selfConfidence },
  ];
  const curIdx = steps.findIndex((s) => s.id === step);
  const nextStepId = steps[curIdx + 1]?.id;
  const graded = p.attempts.filter((a) => a.kind === 'check');
  const lastCheck = graded.length ? graded[graded.length - 1].score : null;
  const prev = flat[idx - 1];
  const next = flat[idx + 1];

  const complete = async () => {
    setCompleting(true);
    try {
      const r = await api(`/learner/lesson/${courseId}/${lesson.id}/complete`, { body: {} });
      patchItem(courseId, { snapshot: r.snapshot, enrollment: r.enrollment });
      setJustDone(true);
      celebrate();
      if (r.credentialIssued) toast('success', 'You earned your credential!');
      window.dispatchEvent(new Event('lms:refresh-notifications'));
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setCompleting(false);
    }
  };

  const missing = [!req.checkDone && (lesson.checkSettings.mode === 'quiz' ? 'take the quiz' : 'take the check'), !req.activityDone && 'submit the activity'].filter(Boolean);

  return (
    <div className={cx('grid gap-8', prefs.focus ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1fr)_300px]')}>
      <div className="min-w-0">
        <button onClick={() => navigate('learning')} className="hide-in-focus mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-nblue">
          <ArrowLeft className="h-4 w-4" /> {item.course.title}
        </button>
        <div className="text-sm font-semibold text-npurple">{whereLabel(item.course, lesson.id)}</div>
        <h1 className="mt-1 text-[28px] font-extrabold leading-tight sm:text-[34px]">{lesson.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Pill color="gray">{lesson.estimatedMinutes} min</Pill>
          <Pill color="blue">Topic: {lesson.topic}</Pill>
          {lastCheck !== null && (
            <Pill color={lastCheck >= 80 ? 'green' : lastCheck >= 60 ? 'blue' : 'purple'}>Last knowledge check: {lastCheck}%</Pill>
          )}
          {p.status === 'done' && (
            <Pill color="green">
              <CheckCircle2 className="h-3 w-3" /> Completed
            </Pill>
          )}
        </div>

        {/* Step path: the lesson's own "what next" */}
        <nav aria-label="Lesson steps" className="sticky top-0 z-20 -mx-1 mt-6 surface-blur px-1 py-2 backdrop-blur">
          <ol className="flex items-center gap-1 overflow-x-auto rounded-full border border-line bg-white p-1 scroll-thin">
            {steps.map((s, i) => (
              <li key={s.id} className="flex flex-1 items-center">
                <button
                  onClick={() => setStep(s.id)}
                  className={cx('relative flex w-full items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition', step === s.id ? 'text-white' : 'text-ink-soft hover:text-ink')}
                  aria-current={step === s.id ? 'step' : undefined}
                >
                  {step === s.id && <motion.span layoutId="stepbg" className="absolute inset-0 rounded-full bg-gradient-to-r from-nblue via-npurple to-npink" />}
                  <span className="relative flex items-center gap-1.5">
                    {s.done ? <CheckCircle2 className={cx('h-4 w-4', step === s.id ? 'text-white' : 'text-ngreen')} /> : <span className="text-xs opacity-70">{i + 1}</span>}
                    {s.label}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* Two comfort tools, always in the same place, always one click */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {step === 'learn' && speechSupported() && script.length > 0 && (
            <button
              data-tour="listen"
              onClick={() => setListening((v) => !v)}
              aria-pressed={listening}
              className={cx(
                'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
                listening ? 'border-transparent bg-gradient-to-r from-npurple to-npink text-white shadow' : 'border-line bg-white hover:border-npurple hover:text-npurple',
              )}
            >
              <Headphones className="h-4 w-4" /> {listening ? 'Listening' : 'Listen to this lesson'}
            </button>
          )}
          <button
            data-tour="focus"
            onClick={() => prefs.toggle('focus')}
            aria-pressed={prefs.focus}
            title="Hide the menus so only the lesson is left. Press Esc to come back."
            className={cx(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
              prefs.focus ? 'border-transparent bg-gradient-to-r from-nblue to-npurple text-white shadow' : 'border-line bg-white hover:border-nblue hover:text-nblue',
            )}
          >
            <Focus className="h-4 w-4" /> {prefs.focus ? 'Focus mode on' : 'Focus mode'}
          </button>
          <span className="hidden text-[12px] text-ink-faint sm:block">Listen, or hide everything else. Your choice, anytime.</span>
        </div>

        <div className="mt-6">
          {step === 'learn' && (
            <article>
              <AnimatePresence>{listening && <AudioPlayer title={lesson.title} parts={script} onClose={() => setListening(false)} />}</AnimatePresence>
              {lesson.summary && <p className="mb-6 rounded-2xl border-l-4 border-npurple bg-npurple-soft/40 px-5 py-4 text-[1.05rem] text-ink">{lesson.summary}</p>}
              {lesson.blocks.length ? (
                <Blocks blocks={lesson.blocks} ctx={{ courseId, lessonId: lesson.id }} afterFirstVideo={cards.length ? <KnowledgeCards cards={cards} /> : undefined} />
              ) : (
                <p className="text-ink-soft">This lesson has no reading content.</p>
              )}
            </article>
          )}
          {step === 'check' && <CheckStep key={lesson.id} courseId={courseId} lesson={lesson} progress={p} onUpdate={(r) => patchItem(courseId, { snapshot: r.snapshot, enrollment: r.enrollment })} />}
          {step === 'apply' && lesson.activity && <ApplyStep key={lesson.id} courseId={courseId} lesson={lesson} progress={p} onProgress={updateProgress} />}
          {step === 'reflect' && <ReflectStep key={lesson.id} courseId={courseId} lesson={lesson} progress={p} onProgress={(np) => updateProgress(np)} />}
        </div>

        {/* Bottom action: always one obvious thing to do */}
        {!readOnly && (
          <div className="mt-10">
            {justDone ? (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-ngreen/40 bg-gradient-to-r from-ngreen-soft to-nblue-soft/60 text-center">
                  <PartyPopper className="mx-auto h-8 w-8 text-ngreen-ink" />
                  <div className="mt-2 font-display text-xl font-bold">Lesson complete</div>
                  <p className="text-sm text-ink-soft">Up next: {item.snapshot.nextStep.title}</p>
                  <Button className="mt-4" onClick={() => navigate(actionPath(item.snapshot.nextStep.action))}>
                    {item.snapshot.nextStep.label} <ArrowRight className="h-4 w-4" />
                  </Button>
                </Card>
              </motion.div>
            ) : nextStepId ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-mist/60 p-4">
                <span className="text-sm text-ink-soft">
                  Next in this lesson: <span className="font-semibold text-ink">{steps[curIdx + 1].label}</span>
                </span>
                <Button onClick={() => setStep(nextStepId)}>
                  Continue to {steps[curIdx + 1].label} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : p.status === 'done' ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-line bg-mist/60 p-4">
                <span className="text-sm text-ink-soft">You finished this lesson{p.completedAt ? ` ${timeAgo(p.completedAt)}` : ''}.</span>
                <Button onClick={() => navigate(actionPath(item.snapshot.nextStep.action))}>
                  {item.snapshot.nextStep.label} <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-npurple/30 bg-gradient-to-r from-nblue-soft/50 to-npurple-soft/50 p-4">
                <span className="text-sm text-ink-soft">{req.complete ? 'Everything is done. Mark this lesson complete.' : `To finish this lesson, ${missing.join(' and ')}.`}</span>
                <Button variant="success" disabled={!req.complete} loading={completing} onClick={complete} icon={<CheckCircle2 className="h-4 w-4" />}>
                  Mark lesson complete
                </Button>
              </div>
            )}
            <div className="hide-in-focus mt-6 flex justify-between gap-3 text-sm">
              {prev ? (
                <button onClick={() => navigate(`study/${courseId}/${prev.lesson.id}`)} className="inline-flex max-w-[45%] items-center gap-1.5 truncate font-semibold text-ink-soft hover:text-nblue">
                  <ArrowLeft className="h-4 w-4 shrink-0" /> {prev.lesson.title}
                </button>
              ) : (
                <span />
              )}
              {next && (
                <button onClick={() => navigate(`study/${courseId}/${next.lesson.id}`)} className="inline-flex max-w-[45%] items-center gap-1.5 truncate font-semibold text-ink-soft hover:text-nblue">
                  {next.lesson.title} <ArrowRight className="h-4 w-4 shrink-0" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <aside className="hide-in-focus space-y-4 xl:sticky xl:top-2 xl:self-start">
        <Card className="!p-4">
          <div className="mb-2 text-xs font-semibold text-ink-faint">In this module</div>
          <div className="text-sm font-bold">{f.module.title}</div>
          <ul className="mt-3 space-y-1">
            {f.module.lessons.map((l) => {
              const lp = progressOf(item.enrollment, l.id);
              return (
                <li key={l.id}>
                  <button
                    disabled={readOnly}
                    onClick={() => navigate(`study/${courseId}/${l.id}`)}
                    className={cx('flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[13px] transition enabled:hover:bg-mist', l.id === lesson.id && 'bg-nblue-soft font-semibold text-nblue')}
                  >
                    {lp.status === 'done' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-ngreen" /> : lp.status === 'in_progress' ? <PlayCircle className="h-4 w-4 shrink-0 text-nblue" /> : <Circle className="h-4 w-4 shrink-0 text-line" />}
                    <span className="truncate">{l.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        {!readOnly && <CoachPanel courseId={courseId} lessonId={lesson.id} />}
        {!readOnly && (
          <Card className="!p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Lightbulb className="h-4 w-4 text-ngreen" /> Need a person?
            </div>
            <p className="mt-1 text-[13px] text-ink-soft">Ask your instructor privately or ask the whole class.</p>
            <Button size="sm" variant="secondary" className="mt-3" icon={<MessageCircle className="h-4 w-4" />} onClick={() => navigate(`ask?course=${courseId}&lesson=${lesson.id}&new=1`)}>
              Ask about this lesson
            </Button>
          </Card>
        )}
      </aside>
    </div>
  );
}
