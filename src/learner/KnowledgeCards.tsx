import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Layers, RefreshCcw, RotateCw, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ContentBlock, Lesson } from '../../shared/types';
import { cx } from '../components/ui';

export interface KnowledgeCard {
  id: string;
  /** The prompt the learner sees first. */
  front: string;
  /** The answer, kept to a few lines so it can be taken in at a glance. */
  back: string;
  kind: 'idea' | 'tip' | 'question';
}

const trim = (s: string, n = 260) => {
  const t = s.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).replace(/[\s,;:.]+\S*$/, '')}…` : t;
};

/**
 * Build a small deck from what the lesson already contains.
 * Answers to graded quizzes are never turned into cards: only practice checks,
 * ideas and tips, so nobody can use the deck to skip the thinking.
 */
export function buildKnowledgeCards(lesson: Lesson, limit = 6): KnowledgeCard[] {
  const cards: KnowledgeCard[] = [];
  const blocks = lesson.blocks as ContentBlock[];

  if (lesson.summary?.trim()) cards.push({ id: `${lesson.id}-sum`, front: `In one sentence, what is “${lesson.title}” about?`, back: trim(lesson.summary), kind: 'idea' });

  blocks.forEach((b, i) => {
    if (b.type === 'heading' && b.text?.trim()) {
      const next = blocks.slice(i + 1).find((n) => n.type === 'paragraph' && n.text?.trim());
      if (next?.text) cards.push({ id: `${lesson.id}-h${i}`, front: `What do you remember about: ${trim(b.text, 90)}?`, back: trim(next.text), kind: 'idea' });
    }
    if (b.type === 'text' && b.text?.trim()) {
      cards.push({ id: `${lesson.id}-t${i}`, front: b.label ? `Remember: ${trim(b.label, 80)}` : b.tone === 'tip' ? 'What was the tip in this lesson?' : 'What was worth noting here?', back: trim(b.text), kind: 'tip' });
    }
  });

  if (lesson.checkSettings?.mode === 'practice') {
    lesson.check.slice(0, 3).forEach((q, i) => {
      const answer = q.options[q.correctIndex];
      if (answer) cards.push({ id: `${lesson.id}-q${i}`, front: trim(q.question, 180), back: trim(`${answer}${q.rationale ? ` — ${q.rationale}` : ''}`), kind: 'question' });
    });
  }

  return cards.slice(0, limit);
}

const KIND: Record<KnowledgeCard['kind'], { label: string; cls: string }> = {
  idea: { label: 'Key idea', cls: 'from-nblue to-npurple' },
  tip: { label: 'Tip to remember', cls: 'from-ngreen to-nblue' },
  question: { label: 'Quick recall', cls: 'from-npurple to-npink' },
};

/**
 * Knowledge Cards: a two-minute memory check, placed right where the learner
 * has just watched or read something. Swipe, tap to flip, mark what you knew.
 */
export default function KnowledgeCards({ cards, title = 'Knowledge Cards', hint = 'A quick memory check before you move on.' }: { cards: KnowledgeCard[]; title?: string; hint?: string }) {
  const [deck, setDeck] = useState(cards);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);

  useEffect(() => {
    setDeck(cards);
    setI(0);
    setFlipped(false);
    setKnown({});
    setDone(false);
  }, [cards]);

  const card = deck[i];
  const answered = useMemo(() => Object.keys(known).length, [known]);
  const gotIt = useMemo(() => Object.values(known).filter(Boolean).length, [known]);

  const go = (d: 1 | -1) => {
    setFlipped(false);
    setI((v) => {
      const n = v + d;
      if (n >= deck.length) {
        setDone(true);
        return v;
      }
      return Math.max(0, n);
    });
  };

  const mark = (ok: boolean) => {
    if (!card) return;
    setKnown((k) => ({ ...k, [card.id]: ok }));
    if (i >= deck.length - 1) setDone(true);
    else go(1);
  };

  // Arrow keys move, space flips: the same shortcuts people expect from slides.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement?.tagName;
      if (el === 'INPUT' || el === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === ' ' && document.activeElement?.getAttribute('data-kcard') === 'true') {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck.length]);

  if (!deck.length) return null;

  const restart = (onlyMissed: boolean) => {
    const next = onlyMissed ? cards.filter((c) => known[c.id] === false) : cards;
    setDeck(next.length ? next : cards);
    setI(0);
    setFlipped(false);
    setKnown({});
    setDone(false);
  };

  return (
    <section aria-label="Knowledge cards" className="my-8 rounded-3xl border border-npurple/20 bg-gradient-to-br from-npurple-soft/50 via-white to-nblue-soft/40 p-4 sm:p-5" data-tour="cards">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-npurple shadow-sm">
            <Layers className="h-4 w-4" />
          </span>
          <div>
            <div className="font-display text-base font-bold">{title}</div>
            <div className="text-[12px] text-ink-faint">{hint}</div>
          </div>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-[12px] font-bold text-ink-soft">
          {Math.min(i + 1, deck.length)} of {deck.length}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {done ? (
          <motion.div key="done" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 rounded-3xl bg-white p-6 text-center shadow-sm">
            <Sparkles className="mx-auto h-7 w-7 text-npink" />
            <div className="mt-2 font-display text-xl font-bold">
              You knew {gotIt} of {answered || deck.length}
            </div>
            <p className="mt-1 text-sm text-ink-soft">{gotIt === deck.length ? 'Every card. This is ready to use at work.' : 'The cards you marked “Review again” are the ones worth a second look.'}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {Object.values(known).some((v) => v === false) && (
                <button onClick={() => restart(true)} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-nblue to-npurple px-4 py-2 text-sm font-semibold text-white">
                  <RefreshCcw className="h-4 w-4" /> Review the hard ones
                </button>
              )}
              <button onClick={() => restart(false)} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-soft hover:border-npurple hover:text-npurple">
                <RotateCw className="h-4 w-4" /> Start over
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div key={card?.id} className="mt-4">
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.18}
              onDragEnd={(_, info) => {
                if (info.offset.x < -70) go(1);
                else if (info.offset.x > 70) go(-1);
              }}
              className="cursor-grab active:cursor-grabbing"
              style={{ perspective: 1200 }}
            >
              <div
                role="button"
                tabIndex={0}
                data-kcard="true"
                aria-label={flipped ? 'Answer. Press space to flip back.' : 'Question. Press space to see the answer.'}
                onClick={() => setFlipped((f) => !f)}
                onKeyDown={(e) => (e.key === 'Enter' ? setFlipped((f) => !f) : undefined)}
                className={cx('kcard relative min-h-[230px] w-full select-none rounded-3xl', flipped && 'flipped')}
              >
                {/* Front */}
                <div className="kcard-face absolute inset-0 flex flex-col overflow-y-auto rounded-3xl border border-line bg-white p-5 shadow-sm scroll-thin">
                  <span className={cx('self-start rounded-full bg-gradient-to-r px-2.5 py-0.5 text-[11px] font-bold text-white', KIND[card?.kind ?? 'idea'].cls)}>{KIND[card?.kind ?? 'idea'].label}</span>
                  <p className="mt-3 flex-1 font-display text-[19px] font-bold leading-snug">{card?.front}</p>
                  <span className="mt-2 text-[12px] font-semibold text-npurple">Tap the card to see the answer</span>
                </div>
                {/* Back */}
                <div className="kcard-face kcard-back absolute inset-0 flex flex-col overflow-y-auto rounded-3xl border border-npurple/30 bg-gradient-to-br from-white to-npurple-soft/60 p-5 shadow-sm scroll-thin">
                  <span className="self-start rounded-full bg-npurple-soft px-2.5 py-0.5 text-[11px] font-bold text-npurple">Answer</span>
                  <p className="mt-3 flex-1 text-[15px] leading-relaxed text-ink">{card?.back}</p>
                </div>
              </div>
            </motion.div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button onClick={() => go(-1)} disabled={i === 0} aria-label="Previous card" className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white transition hover:border-npurple hover:text-npurple disabled:opacity-40">
                <ArrowLeft className="h-4 w-4" />
              </button>

              <AnimatePresence mode="wait">
                {flipped ? (
                  <motion.div key="mark" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2">
                    <button onClick={() => mark(false)} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-soft transition hover:border-npink hover:text-npink">
                      Review again
                    </button>
                    <button onClick={() => mark(true)} className="inline-flex items-center gap-1.5 rounded-full bg-ngreen px-4 py-2 text-sm font-semibold text-white">
                      <Check className="h-4 w-4" /> I knew it
                    </button>
                  </motion.div>
                ) : (
                  <motion.button key="flip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setFlipped(true)} className="rounded-full bg-gradient-to-r from-nblue to-npurple px-5 py-2 text-sm font-semibold text-white">
                    Show the answer
                  </motion.button>
                )}
              </AnimatePresence>

              <button onClick={() => go(1)} aria-label="Next card" className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white transition hover:border-npurple hover:text-npurple">
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-center gap-1.5">
              {deck.map((c, n) => (
                <span key={c.id} className={cx('h-1.5 rounded-full transition-all', n === i ? 'w-6 bg-gradient-to-r from-nblue to-npurple' : known[c.id] === true ? 'w-1.5 bg-ngreen' : known[c.id] === false ? 'w-1.5 bg-npink' : 'w-1.5 bg-line')} />
              ))}
            </div>
            <p className="mt-2 text-center text-[12px] text-ink-faint">Swipe the card, or use the arrow keys. Nothing here is graded.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
