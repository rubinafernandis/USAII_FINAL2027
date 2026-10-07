import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/**
 * Reading and comfort settings that belong to the person, not to the course.
 * They are saved on this device only, so a learner can set them once and forget them.
 */
export interface Prefs {
  /** Focus mode hides the sidebar, header and every badge so only the lesson is left. */
  focus: boolean;
  /** 0.9 = smaller, 1 = normal, up to 1.4 = much larger text. */
  textScale: number;
  theme: 'light' | 'dark';
}

const DEFAULTS: Prefs = { focus: false, textScale: 1, theme: 'light' };
const KEY = 'usaii.lms.prefs';
export const TEXT_STEPS = [0.9, 1, 1.1, 1.25, 1.4];

export interface PrefsCtx extends Prefs {
  set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  toggle: (key: 'focus') => void;
  toggleTheme: () => void;
  stepText: (dir: 1 | -1) => void;
  reset: () => void;
  /** True when at least one setting is away from the default: used to show a small "on" dot. */
  customized: boolean;
}

const Ctx = createContext<PrefsCtx | null>(null);

const noop = () => undefined;
/** Used when a learner screen is previewed by staff, where personal settings do not apply. */
const FALLBACK: PrefsCtx = { ...DEFAULTS, set: noop, toggle: noop, toggleTheme: noop, stepText: noop, reset: noop, customized: false };

export function usePrefs(): PrefsCtx {
  return useContext(Ctx) ?? FALLBACK;
}

function read(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return {
      focus: false, // focus mode never survives a reload: nobody should be trapped in it
      textScale: TEXT_STEPS.includes(p.textScale ?? 1) ? (p.textScale as number) : 1,
      theme: p.theme === 'dark' ? 'dark' : 'light',
    };
  } catch {
    return DEFAULTS;
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(read);

  // Apply to the page. One attribute per setting keeps the CSS simple and predictable.
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute('data-theme', prefs.theme);
    el.classList.toggle('focus-mode', prefs.focus);
    el.style.setProperty('--ui-scale', String(prefs.textScale));
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...prefs, focus: false }));
    } catch {
      /* private browsing: settings simply do not persist */
    }
  }, [prefs]);

  const set = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => setPrefs((p) => ({ ...p, [key]: value })), []);
  const toggle = useCallback((key: 'focus') => setPrefs((p) => ({ ...p, [key]: !p[key] })), []);
  const toggleTheme = useCallback(() => setPrefs((p) => ({ ...p, theme: p.theme === 'dark' ? 'light' : 'dark' })), []);
  const stepText = useCallback((dir: 1 | -1) => {
    setPrefs((p) => {
      const i = Math.max(0, Math.min(TEXT_STEPS.length - 1, TEXT_STEPS.indexOf(p.textScale) + dir));
      return { ...p, textScale: TEXT_STEPS[i] };
    });
  }, []);
  const reset = useCallback(() => setPrefs({ ...DEFAULTS }), []);

  // Escape always leaves focus mode, so the way out is never hidden.
  useEffect(() => {
    if (!prefs.focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPrefs((p) => ({ ...p, focus: false }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prefs.focus]);

  const value = useMemo<PrefsCtx>(
    () => ({
      ...prefs,
      set,
      toggle,
      toggleTheme,
      stepText,
      reset,
      customized: prefs.theme !== 'light' || prefs.textScale !== 1,
    }),
    [prefs, set, toggle, toggleTheme, stepText, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
