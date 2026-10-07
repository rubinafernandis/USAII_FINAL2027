import { AnimatePresence, motion } from 'motion/react';
import { Headphones, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ContentBlock, Lesson } from '../../shared/types';
import { cx } from '../components/ui';

export interface AudioPart {
  /** A short name for the part, shown while it plays: "Section: Why prompts matter". */
  label: string;
  text: string;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

/** Turn a lesson into a listening script, in the same order a reader would meet it. */
export function lessonToScript(lesson: Lesson): AudioPart[] {
  const parts: AudioPart[] = [];
  const push = (label: string, text?: string) => {
    const t = (text ?? '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
    if (t.length > 1) parts.push({ label, text: t });
  };
  push('Lesson', `${lesson.title}. ${lesson.summary ?? ''}`);
  let section = 'Lesson';
  (lesson.blocks as ContentBlock[]).forEach((b) => {
    switch (b.type) {
      case 'heading':
        section = b.text?.trim() || section;
        push('Section', `${b.text}.`);
        break;
      case 'paragraph':
        push(section, b.text);
        break;
      case 'text':
        push(b.tone === 'tip' ? 'Tip' : 'Note', `${b.label ? `${b.label}. ` : ''}${b.text ?? ''}`);
        break;
      case 'quote':
        push('Quote', `${b.text}${b.attribution ? `, said ${b.attribution}` : ''}`);
        break;
      case 'list':
        (b.items ?? []).filter((i) => i.trim()).forEach((i, n) => push(section, `${b.ordered ? `Step ${n + 1}. ` : ''}${i}`));
        break;
      case 'video':
      case 'audio':
        if (b.transcript) push(b.label || (b.type === 'video' ? 'Video' : 'Audio'), b.transcript);
        break;
      default:
        break;
    }
  });
  return parts;
}

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

/**
 * Audio-First Player.
 * Reads the lesson aloud with the voice already built into the device, so there is
 * nothing to download and nothing to set up. Speed and skip controls are large
 * enough to use without looking at the screen.
 */
export default function AudioPlayer({ title, parts, onClose }: { title: string; parts: AudioPart[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(() => Number(localStorage.getItem('usaii.lms.audioRate') ?? 1) || 1);
  const [finished, setFinished] = useState(false);
  const indexRef = useRef(0);
  const rateRef = useRef(rate);
  const stoppedByUs = useRef(false);
  rateRef.current = rate;
  indexRef.current = index;

  const supported = speechSupported();
  const total = parts.length;

  const voice = useMemo(() => {
    if (!supported) return null;
    const list = window.speechSynthesis.getVoices();
    return list.find((v) => v.lang === 'en-US' && v.localService) ?? list.find((v) => v.lang?.startsWith('en')) ?? null;
  }, [supported]);

  const speak = useCallback(
    (i: number) => {
      if (!supported || !parts[i]) return;
      const synth = window.speechSynthesis;
      stoppedByUs.current = true;
      synth.cancel();
      stoppedByUs.current = false;
      const u = new SpeechSynthesisUtterance(parts[i].text);
      u.rate = rateRef.current;
      u.pitch = 1;
      if (voice) u.voice = voice;
      u.onend = () => {
        if (stoppedByUs.current) return;
        const next = indexRef.current + 1;
        if (next < parts.length) {
          setIndex(next);
          indexRef.current = next;
          speak(next);
        } else {
          setPlaying(false);
          setFinished(true);
        }
      };
      u.onerror = () => setPlaying(false);
      synth.speak(u);
      setPlaying(true);
      setFinished(false);
    },
    [parts, supported, voice],
  );

  const stop = useCallback(() => {
    if (!supported) return;
    stoppedByUs.current = true;
    window.speechSynthesis.cancel();
    stoppedByUs.current = false;
    setPlaying(false);
  }, [supported]);

  const jump = (delta: number) => {
    const i = Math.max(0, Math.min(total - 1, index + delta));
    setIndex(i);
    indexRef.current = i;
    if (playing || finished) speak(i);
  };

  const changeRate = (r: number) => {
    setRate(r);
    rateRef.current = r;
    localStorage.setItem('usaii.lms.audioRate', String(r));
    if (playing) speak(indexRef.current);
  };

  // Some browsers cut long speech short; a gentle nudge keeps it running.
  useEffect(() => {
    if (!playing || !supported) return;
    const t = setInterval(() => {
      const s = window.speechSynthesis;
      if (s.speaking && !s.paused) {
        s.pause();
        s.resume();
      }
    }, 9000);
    return () => clearInterval(t);
  }, [playing, supported]);

  // Never keep talking after the learner leaves the lesson.
  useEffect(() => () => { if (speechSupported()) window.speechSynthesis.cancel(); }, []);

  const part = parts[index];
  const pctDone = total ? Math.round(((index + (playing ? 0.5 : 0)) / total) * 100) : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: -10, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -10, height: 0 }}
      aria-label="Listen to this lesson"
      className="mb-6 overflow-hidden rounded-3xl border border-npurple/25 bg-gradient-to-br from-npurple-soft/70 via-white to-nblue-soft/60"
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={cx('flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-npurple shadow-sm', playing && 'ring-2 ring-npurple/30')}>
              {playing ? (
                <span className="eq flex h-4 items-end text-npurple" aria-hidden>
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
              ) : (
                <Headphones className="h-5 w-5" />
              )}
            </span>
            <div className="min-w-0">
              <div className="font-display text-base font-bold">Listen to this lesson</div>
              <div className="truncate text-[13px] text-ink-soft">{supported ? `${title} · ${total} short parts` : 'Your browser cannot read pages aloud.'}</div>
            </div>
          </div>
          <button onClick={() => { stop(); onClose(); }} aria-label="Close the player" className="text-ink-faint hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        {supported && total > 0 && (
          <>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={() => jump(-1)} disabled={index === 0} aria-label="Previous part" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white transition hover:border-npurple hover:text-npurple disabled:opacity-40">
                <SkipBack className="h-5 w-5" />
              </button>
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => (playing ? stop() : speak(index))}
                aria-label={playing ? 'Pause' : 'Play'}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-nblue via-npurple to-npink text-white shadow-lg shadow-npurple/30"
              >
                {playing ? <Pause className="h-6 w-6" /> : <Play className="ml-0.5 h-6 w-6" />}
              </motion.button>
              <button onClick={() => jump(1)} disabled={index >= total - 1} aria-label="Next part" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white transition hover:border-npurple hover:text-npurple disabled:opacity-40">
                <SkipForward className="h-5 w-5" />
              </button>

              <div className="ml-1 min-w-0 flex-1">
                <div className="flex items-center justify-between text-[12px] font-semibold text-ink-soft">
                  <span className="truncate">{part?.label}</span>
                  <span className="shrink-0">
                    Part {index + 1} of {total}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white">
                  <motion.div className="h-full rounded-full bg-gradient-to-r from-nblue to-npurple" animate={{ width: `${pctDone}%` }} transition={{ ease: 'linear', duration: 0.4 }} />
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-semibold text-ink-faint">Speed</span>
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  onClick={() => changeRate(s)}
                  className={cx('rounded-full px-3 py-1 text-[12px] font-bold transition', rate === s ? 'bg-gradient-to-r from-nblue to-npurple text-white' : 'border border-line bg-white text-ink-soft hover:border-npurple')}
                >
                  {s}×
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.p key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 max-h-28 overflow-y-auto rounded-2xl bg-white/80 p-3 text-[14px] leading-relaxed text-ink-soft scroll-thin">
                {part?.text}
              </motion.p>
            </AnimatePresence>

            {finished && (
              <div className="mt-3 rounded-2xl bg-ngreen-soft px-4 py-2.5 text-sm font-semibold text-ngreen-ink">
                That is the whole lesson. Press play to hear it again, or move on to your next step.
              </div>
            )}
            <p className="mt-3 text-[12px] text-ink-faint">Tip: keep listening while you take notes. Skip forward or back one part at a time.</p>
          </>
        )}

        {!supported && <p className="mt-3 text-sm text-ink-soft">Try Chrome, Edge or Safari to have lessons read aloud. The written lesson stays below.</p>}
      </div>
    </motion.section>
  );
}
