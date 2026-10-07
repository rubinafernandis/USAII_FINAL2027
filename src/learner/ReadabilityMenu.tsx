import { AnimatePresence, motion } from 'motion/react';
import { ALargeSmall, Check, Focus, Minus, Moon, Plus, RotateCcw, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../components/ui';
import { TEXT_STEPS, usePrefs } from './prefs';

const SIZE_NAMES = ['Small', 'Normal', 'Large', 'Larger', 'Largest'];

/** A plain on/off row: big tap target, label, one line of plain English. */
function SwitchRow({ icon, title, hint, on, onChange }: { icon: ReactNode; title: string; hint: string; on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={cx('flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition', on ? 'border-npurple/40 bg-npurple-soft/50' : 'border-line hover:border-nblue/40 hover:bg-mist')}
    >
      <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition', on ? 'bg-gradient-to-br from-nblue to-npurple text-white' : 'bg-mist text-ink-soft')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-[12px] leading-snug text-ink-faint">{hint}</span>
      </span>
      <span className={cx('relative h-6 w-11 shrink-0 rounded-full transition', on ? 'bg-ngreen' : 'bg-line')}>
        <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 32 }} className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow', on ? 'left-[22px]' : 'left-0.5')} />
      </span>
    </button>
  );
}

/**
 * Readability controls.
 * One floating button, bottom left, always in the same place on every page.
 */
export default function ReadabilityMenu() {
  const p = usePrefs();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const idx = Math.max(0, TEXT_STEPS.indexOf(p.textScale));

  // Any screen can open these settings: the dashboard tile uses this.
  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener('lms:open-readability', openIt);
    return () => window.removeEventListener('lms:open-readability', openIt);
  }, []);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', h);
    window.addEventListener('keydown', k);
    return () => {
      document.removeEventListener('mousedown', h);
      window.removeEventListener('keydown', k);
    };
  }, [open]);

  return (
    <div ref={ref} className="no-print fixed bottom-5 left-5 z-[70]" data-tour="readability">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
            transition={{ type: 'spring', damping: 24, stiffness: 320 }}
            className="absolute bottom-16 left-0 w-[min(330px,calc(100vw-40px))] overflow-hidden rounded-3xl border border-line bg-white p-4 shadow-2xl shadow-ink/20"
            role="dialog"
            aria-label="Reading comfort settings"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-display text-base font-bold">Reading comfort</div>
                <div className="text-[12px] text-ink-faint">Saved on this device. Change it anytime.</div>
              </div>
              <button aria-label="Close" onClick={() => setOpen(false)} className="text-ink-faint hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Text size */}
            <div className="rounded-2xl border border-line p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Text size</span>
                <span className="rounded-full bg-mist px-2.5 py-0.5 text-[12px] font-semibold text-ink-soft">{SIZE_NAMES[idx]}</span>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={() => p.stepText(-1)}
                  disabled={idx === 0}
                  aria-label="Smaller text"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-line transition hover:border-nblue hover:text-nblue disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="flex h-10 flex-1 items-center gap-1 rounded-xl bg-mist px-2">
                  {TEXT_STEPS.map((s, i) => (
                    <span key={s} className={cx('h-1.5 flex-1 rounded-full transition', i <= idx ? 'bg-gradient-to-r from-nblue to-npurple' : 'bg-line')} />
                  ))}
                </div>
                <button
                  onClick={() => p.stepText(1)}
                  disabled={idx === TEXT_STEPS.length - 1}
                  aria-label="Larger text"
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-line transition hover:border-nblue hover:text-nblue disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-2.5 space-y-2.5">
              <SwitchRow
                icon={p.theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                title="Dark mode"
                hint="Easier on the eyes at night."
                on={p.theme === 'dark'}
                onChange={p.toggleTheme}
              />
              <SwitchRow icon={<Focus className="h-4 w-4" />} title="Focus mode" hint="Hide menus and alerts. Press Esc to come back." on={p.focus} onChange={() => p.toggle('focus')} />
            </div>

            {p.customized && (
              <button onClick={p.reset} className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-faint hover:text-nblue">
                <RotateCcw className="h-3.5 w-3.5" /> Back to the standard view
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.94 }}
        whileHover={{ scale: 1.04 }}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Reading comfort settings: text size, dark mode, dyslexia-friendly font"
        title="Reading comfort: text size, dark mode, focus mode"
        className="relative flex h-14 items-center gap-2 rounded-full border border-line bg-white pl-4 pr-5 font-semibold shadow-xl shadow-ink/10"
      >
        <ALargeSmall className="h-5 w-5 text-npurple" />
        <span className="hidden text-sm sm:block">Reading</span>
        {p.customized && <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-ngreen" />}
      </motion.button>
    </div>
  );
}

/** The way out of focus mode: always visible, never more than one click away. */
export function FocusExitBar() {
  const p = usePrefs();
  return (
    <AnimatePresence>
      {p.focus && (
        <motion.div initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -60, opacity: 0 }} className="no-print fixed left-1/2 top-3 z-[75] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-full border border-line bg-white px-3 py-1.5 shadow-xl shadow-ink/15">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-npurple">
              <Check className="h-3.5 w-3.5" /> Focus mode on
            </span>
            <span className="hidden text-[12px] text-ink-faint sm:block">Menus are hidden so you can read</span>
            <button onClick={() => p.set('focus', false)} className="rounded-full bg-gradient-to-r from-nblue to-npurple px-3 py-1 text-[13px] font-semibold text-white">
              Exit (Esc)
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
