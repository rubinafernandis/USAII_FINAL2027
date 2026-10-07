import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BookOpen, CheckCircle2, Circle, Download, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { flattenLessons, progressOf } from '../../shared/analytics';
import { cx } from '../components/ui';
import { lessonMarkdown } from '../lib/markdown';
import { downloadStudyGuidePdf } from '../lib/pdf';
import type { CourseItem } from './context';
import { track } from './track';

marked.setOptions({ gfm: true, breaks: false });

/** Markdown → safe HTML. Links open in a new tab so the learner never leaves the LMS. */
function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  return clean.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
}

/**
 * View Study Guide.
 * The whole study guide, readable inside the LMS as a formatted Markdown document.
 * It slides in over the page, opens at the lesson the learner is on, and closes
 * back to exactly where they were. Download (PDF) stays available.
 */
export default function StudyGuideViewer({ item, open, onClose, readOnly }: { item: CourseItem; open: boolean; onClose: () => void; readOnly?: boolean }) {
  const { course, enrollment, snapshot } = item;
  const reduce = useReducedMotion();
  const flat = useMemo(() => flattenLessons(course), [course]);
  const here = snapshot.nextStep.action.lessonId ?? flat.find((f) => progressOf(enrollment, f.lesson.id).status !== 'done')?.lesson.id ?? flat[0]?.lesson.id;
  const [active, setActive] = useState(here);
  const [progress, setProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => new Map(flat.map((f) => [f.lesson.id, renderMarkdown(lessonMarkdown(f.lesson))])), [flat]);

  const jump = (id: string, smooth = true) => {
    const box = scrollRef.current;
    const el = box?.querySelector<HTMLElement>(`[data-lesson="${id}"]`);
    if (!box || !el) return;
    box.scrollTo({ top: el.offsetTop - 16, behavior: smooth && !reduce ? 'smooth' : 'auto' });
    setActive(id);
  };

  // Open at "you are here", count the view, and lock the page behind.
  useEffect(() => {
    if (!open) return;
    if (!readOnly) track(course.id, 'guide_view');
    const back = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      if (here) jump(here, false);
      panelRef.current?.querySelector<HTMLElement>('button')?.focus();
    }, 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
      back?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onScroll = () => {
    const box = scrollRef.current;
    if (!box) return;
    const max = box.scrollHeight - box.clientHeight;
    setProgress(max > 0 ? box.scrollTop / max : 1);
    let cur = active;
    for (const s of box.querySelectorAll<HTMLElement>('[data-lesson]')) if (s.offsetTop - 120 <= box.scrollTop) cur = s.dataset.lesson!;
    if (cur !== active) setActive(cur);
  };

  const download = () => {
    downloadStudyGuidePdf(course);
    if (!readOnly) track(course.id, 'guide_download');
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Study Guide: ${course.title}`}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={reduce ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute inset-y-0 right-0 flex w-full flex-col overflow-hidden bg-white shadow-2xl sm:w-[min(960px,94vw)] sm:rounded-l-3xl"
          >
            <div className="h-[3px] shrink-0 bg-[#EEF0F7]" aria-hidden>
              <div className="h-full bg-gradient-to-r from-nblue via-npurple to-npink" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-nblue to-npurple text-white">
                <BookOpen className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[17px] font-bold leading-tight">Study Guide</div>
                <div className="truncate text-[12.5px] text-ink-soft">{course.title}</div>
              </div>
              <button onClick={download} className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-sm font-semibold transition hover:border-nblue hover:text-nblue">
                <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span> PDF
              </button>
              <button onClick={onClose} aria-label="Close (Esc)" className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition hover:bg-mist hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </header>

            {/* Contents on small screens */}
            <div className="shrink-0 border-b border-line px-4 py-2 md:hidden">
              <select value={active} onChange={(e) => jump(e.target.value)} aria-label="Jump to a lesson" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold">
                {flat.map((f, i) => (
                  <option key={f.lesson.id} value={f.lesson.id}>
                    {f.lesson.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-h-0 flex-1">
              <nav aria-label="Contents" className="hidden w-[250px] shrink-0 overflow-y-auto border-r border-line bg-mist/40 px-2.5 py-4 scroll-thin md:block">
                <div className="mb-2 px-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-faint">Contents</div>
                {course.modules.map((m, mi) => (
                  <div key={m.id} className="mb-3">
                    <div className="px-2 pb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-npurple">Module {mi + 1}: {m.title}</div>
                    {m.lessons.map((l) => {
                      const n = flat.findIndex((f) => f.lesson.id === l.id) + 1;
                      const done = progressOf(enrollment, l.id).status === 'done';
                      const on = l.id === active;
                      return (
                        <button
                          key={l.id}
                          onClick={() => jump(l.id)}
                          aria-current={on ? 'location' : undefined}
                          className={cx('flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left text-[13px] transition', on ? 'bg-white font-bold text-ink shadow-sm' : 'text-ink-soft hover:bg-white/70 hover:text-ink')}
                        >
                          {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ngreen" /> : <Circle className={cx('mt-0.5 h-4 w-4 shrink-0', l.id === here ? 'text-npurple' : 'text-ink-faint/50')} />}
                          <span className="min-w-0">
                            <span className="block leading-snug">
                              {l.title}
                            </span>
                            {l.id === here && <span className="text-[11px] font-semibold text-npurple">You are here</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </nav>

              <div ref={scrollRef} onScroll={onScroll} className="relative min-w-0 flex-1 overflow-y-auto scroll-thin">
                <article className="mx-auto max-w-[720px] px-5 py-7 sm:px-9">
                  <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-faint">Study Guide · {course.credentialName || 'USAII® Micro-Credential'}</p>
                  <h1 className="mt-1 font-display text-[30px] font-extrabold leading-tight">{course.title}</h1>
                  {course.subtitle && <p className="mt-2 text-[16px] text-ink-soft">{course.subtitle}</p>}
                  {course.modules.map((m, mi) => (
                    <section key={m.id} className="mt-10">
                      <div className="rounded-2xl border border-line bg-mist/60 px-5 py-4">
                        <div className="text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-npurple">
                          Module {mi + 1}
                        </div>
                        <h2 className="font-display text-xl font-bold">{m.title}</h2>
                        {m.summary && <p className="mt-1 text-[14.5px] text-ink-soft">{m.summary}</p>}
                      </div>
                      {m.lessons.map((l) => {
                        const n = flat.findIndex((f) => f.lesson.id === l.id) + 1;
                        return (
                          <div key={l.id} data-lesson={l.id} className="mt-9">
                            <div className="text-[12px] font-bold uppercase tracking-wide text-ink-faint">
                              Lesson {n}
                              {l.estimatedMinutes ? ` · ${l.estimatedMinutes} min` : ''}
                            </div>
                            <h3 className="mt-0.5 font-display text-[24px] font-extrabold leading-tight">{l.title}</h3>
                            <div className="md-guide mt-3" dangerouslySetInnerHTML={{ __html: html.get(l.id) ?? '' }} />
                          </div>
                        );
                      })}
                    </section>
                  ))}
                  <p className="mt-12 border-t border-line pt-5 text-center text-[13px] text-ink-faint">End of the study guide.</p>
                </article>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
