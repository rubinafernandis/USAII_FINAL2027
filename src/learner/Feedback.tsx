import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, GraduationCap, Send, Sparkles, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';
import { Button, Card, Empty, PageHeader, Select, Textarea, cx, useLoad, useToast } from '../components/ui';
import { useLearner } from './context';

type Target = 'course' | 'platform';

/** Five stars, large enough to tap on a phone, with the meaning spelled out. */
export function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const words = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
  return (
    <div>
      <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Rating out of five stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <motion.button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.92 }}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className="rounded-xl p-1"
          >
            <Star className={cx('h-10 w-10 transition', n <= shown ? 'fill-current text-[#FFB020]' : 'text-line')} />
          </motion.button>
        ))}
      </div>
      <div className="mt-1 h-5 text-[13px] font-semibold text-npurple">{words[shown] ?? ''}</div>
    </div>
  );
}

/**
 * Feedback.
 * Two things a learner might want to rate: a course they are taking, or the
 * USAII LMS itself. Each is a card of its own, so nothing is hidden behind a tab.
 */
function RatingCard({
  target,
  title,
  hint,
  icon,
  color,
  courseChoice,
  current,
  askRecommend,
  onSent,
}: {
  target: Target;
  title: string;
  hint: string;
  icon: React.ReactNode;
  color: string;
  courseChoice?: { value: string; onChange: (v: string) => void; options: { id: string; title: string }[] };
  /** The learner's current rating for this target, shown so they know a new one replaces it. */
  current?: { stars: number | null; at: string; recommendUsaii?: boolean | null } | null;
  /** Asks "Would you recommend USAII® to others?" under the comment box (Rate the USAII® LMS). */
  askRecommend?: boolean;
  onSent: () => void;
}) {
  const toast = useToast();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [recommend, setRecommend] = useState<boolean | null>(null);
  useEffect(() => setRecommend(current?.recommendUsaii ?? null), [current?.recommendUsaii]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const send = async () => {
    if (!stars) return toast('error', 'Please choose a star rating first.');
    if (askRecommend && recommend === null) return toast('error', 'Please answer whether you would recommend USAII® to others.');
    setBusy(true);
    try {
      await api('/feedback/rating', {
        body: {
          kind: target,
          courseId: target === 'course' ? courseChoice?.value : undefined,
          stars,
          comment,
          ...(askRecommend && recommend !== null ? { recommendUsaii: recommend } : {}),
        },
      });
      setDone(true);
      setStars(0);
      setComment('');
      onSent();
      toast('success', 'Thank you. Your feedback has been sent.');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="relative h-full overflow-hidden">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ background: `linear-gradient(90deg, ${color}, ${color}66)` }} />
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white" style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}>
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <p className="text-[13px] text-ink-soft">{hint}</p>
          {current?.stars ? (
            <p className="mt-1 text-xs font-semibold text-ink-faint">
              Your current rating: {current.stars} of 5 stars · {fmtDate(current.at)}. A new rating replaces it.
            </p>
          ) : null}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {done ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mt-5 rounded-2xl bg-ngreen-soft px-4 py-5 text-center">
            <CheckCircle2 className="mx-auto h-7 w-7 text-ngreen-ink" />
            <p className="mt-2 font-semibold text-ngreen-ink">Thank you. Your rating has been sent.</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => setDone(false)}>
              Rate Again
            </Button>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-5 space-y-4">
            {courseChoice && courseChoice.options.length > 1 && (
              <div>
                <label className="mb-1 block text-sm font-semibold" htmlFor={`fb-course-${target}`}>
                  Which course?
                </label>
                <Select id={`fb-course-${target}`} value={courseChoice.value} onChange={(e) => courseChoice.onChange(e.target.value)}>
                  {courseChoice.options.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div>
              <div className="mb-1 text-sm font-semibold">Your rating</div>
              <Stars value={stars} onChange={setStars} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold" htmlFor={`fb-comment-${target}`}>
                Tell us more <span className="font-normal text-ink-soft">(optional)</span>
              </label>
              <Textarea
                id={`fb-comment-${target}`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={target === 'course' ? 'What worked well? What would you change?' : 'What would make the portal easier to use?'}
              />
            </div>
            {askRecommend && (
              <div className="rounded-2xl border border-line bg-mist/50 p-4">
                <div className="text-sm font-semibold">Would you recommend USAII® to others?</div>
                <div className="mt-2.5 flex gap-2">
                  {[
                    { value: true, label: 'Yes', icon: <ThumbsUp className="h-4 w-4" />, on: 'border-transparent bg-ngreen text-white shadow' },
                    { value: false, label: 'No', icon: <ThumbsDown className="h-4 w-4" />, on: 'border-transparent bg-npink text-white shadow' },
                  ].map((o) => {
                    const chosen = recommend === o.value;
                    return (
                      <button
                        key={o.label}
                        type="button"
                        role="radio"
                        aria-checked={chosen}
                        onClick={() => setRecommend(o.value)}
                        className={cx(
                          'inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition',
                          chosen ? o.on : 'border-line bg-white text-ink-soft hover:border-npurple hover:text-npurple',
                        )}
                      >
                        {o.icon} {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <Button loading={busy} onClick={send} icon={<Send className="h-4 w-4" />}>
              Send Feedback
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

/** The one Yes/No question, asked plainly and answered in a single tap. */
function RecommendCard({ initial }: { initial: boolean | null }) {
  const toast = useToast();
  const [answer, setAnswer] = useState<boolean | null>(initial);
  useEffect(() => setAnswer(initial), [initial]);
  const [fresh, setFresh] = useState(false);
  const [busy, setBusy] = useState<boolean | null>(null);
  const send = async (value: boolean) => {
    setBusy(value);
    try {
      await api('/feedback/recommend', { body: { recommend: value } });
      setAnswer(value);
      setFresh(true);
      toast('success', 'Thank you. Your answer has been recorded.');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Card className="relative overflow-hidden">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-ngreen to-nblue" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-[240px] flex-1">
          <h2 className="font-display text-lg font-bold">Would you recommend USAII® Courses to others?</h2>
          <p className="text-[13px] text-ink-soft">One tap. You can change your answer at any time.</p>
        </div>
        <div className="flex gap-2.5">
          {[true, false].map((value) => {
            const on = answer === value;
            return (
              <motion.button
                key={String(value)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                disabled={busy !== null}
                onClick={() => void send(value)}
                aria-pressed={on}
                className={cx(
                  'flex min-w-[104px] items-center justify-center gap-2 rounded-2xl border-2 px-5 py-3 text-sm font-bold transition disabled:opacity-60',
                  on && value && 'border-transparent bg-gradient-to-r from-ngreen to-nblue text-white shadow-lg shadow-ngreen/25',
                  on && !value && 'border-transparent bg-gradient-to-r from-npink to-npurple text-white shadow-lg shadow-npink/25',
                  !on && 'border-line bg-white text-ink hover:border-nblue hover:text-nblue',
                )}
              >
                {value ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
                {value ? 'Yes' : 'No'}
              </motion.button>
            );
          })}
        </div>
      </div>
      {answer !== null && !fresh && <p className="mt-4 text-[13px] text-ink-soft">Your current answer: <b className="text-ink">{answer ? 'Yes' : 'No'}</b>. Tap the other button to change it.</p>}
      {answer !== null && fresh && (
        <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl bg-ngreen-soft px-4 py-2.5 text-sm font-semibold text-ngreen-ink">
          {answer ? 'Thank you. It means a lot that you would recommend us.' : 'Thank you for telling us. Your ratings above help us put it right.'}
        </motion.p>
      )}
    </Card>
  );
}

interface Mine {
  recommend: boolean | null;
  platform: { stars: number | null; comment: string; at: string; recommendUsaii: boolean | null } | null;
  courses: Record<string, { stars: number | null; comment: string; at: string }>;
}

export default function Feedback() {
  const { home, active, readOnly } = useLearner();
  const [courseId, setCourseId] = useState(active?.course.id ?? home.items[0]?.course.id ?? '');
  const [sent, setSent] = useState(0);
  const mine = useLoad(() => (readOnly ? Promise.resolve(null) : api<Mine>('/feedback/mine')), [sent, readOnly]);

  if (readOnly) return <Empty title="Feedback is written by the learner" text="This page is where your learners rate their course and the portal." />;

  return (
    <div>
      <PageHeader title="Give Feedback" subtitle="Tell us how it is going. Your rating goes straight to the USAII team." />
      <div className="grid gap-5 lg:grid-cols-2">
        {home.items.length > 0 && (
          <RatingCard
            target="course"
            title="Rate My Course"
            hint="The lessons, quizzes and materials of a course you are taking."
            icon={<GraduationCap className="h-5 w-5" />}
            color="#1F6BFF"
            courseChoice={{ value: courseId, onChange: setCourseId, options: home.items.map((i) => ({ id: i.course.id, title: i.course.title })) }}
            current={mine.data?.courses[courseId] ?? null}
            onSent={() => setSent((n) => n + 1)}
          />
        )}
        <RatingCard
          target="platform"
          title="Rate the USAII® LMS"
          hint="The portal itself: how easy it is to find things and get around."
          icon={<Sparkles className="h-5 w-5" />}
          color="#8B3DFF"
          askRecommend
          current={mine.data?.platform ?? null}
          onSent={() => setSent((n) => n + 1)}
        />
      </div>
      {sent > 0 && <p className="mt-5 text-center text-[13px] text-ink-soft">You can come back and rate again anytime. A new rating replaces your last one.</p>}
      {/* The one Yes/No question is always the last thing on this page. */}
      <div className="mt-5">
        <RecommendCard initial={mine.data?.recommend ?? null} />
      </div>
    </div>
  );
}
