import { AnimatePresence, motion } from 'motion/react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, HelpCircle, Info, Loader2, RefreshCw, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { scoreColor } from '../lib/format';

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ');

/* ---------------- Hash router ---------------- */

export function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { view: parts[0] ?? '', params: parts.slice(1), query: new URLSearchParams(query) };
}
export const navigate = (path: string) => {
  const next = `#/${path.replace(/^\/+/, '')}`;
  if (window.location.hash !== next) window.location.hash = next;
};
export function useRoute() {
  const [r, setR] = useState(parseHash);
  useEffect(() => {
    const on = () => {
      setR(parseHash());
      document.getElementById('main-scroll')?.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return r;
}

/* ---------------- Data loading ---------------- */

export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const load = useCallback(
    async (quiet = false) => {
      const my = ++seq.current;
      if (!quiet) setLoading(true);
      setError(null);
      try {
        const d = await fn();
        if (my === seq.current) setData(d);
      } catch (e) {
        if (my === seq.current) setError((e as Error).message);
      } finally {
        if (my === seq.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );
  useEffect(() => {
    void load();
  }, [load]);
  return { data, setData, error, loading, reload: load };
}

/* ---------------- Toasts ---------------- */

type Toast = { id: number; kind: 'success' | 'error' | 'info'; text: string };
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex w-[min(380px,calc(100vw-40px))] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              className={cx(
                'flex items-start gap-3 rounded-2xl border bg-white px-4 py-3 text-sm shadow-xl shadow-ink/10',
                t.kind === 'success' && 'border-ngreen/40',
                t.kind === 'error' && 'border-npink/40',
                t.kind === 'info' && 'border-nblue/30',
              )}
            >
              {t.kind === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ngreen" />
              ) : t.kind === 'error' ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-npink" />
              ) : (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-nblue" />
              )}
              <span className="flex-1 text-ink">{t.text}</span>
              <button aria-label="Dismiss" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-ink-faint hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------------- Buttons ---------------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
};
export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, type = 'button', ...rest }: BtnProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        'group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-all duration-200 disabled:opacity-50',
        size === 'sm' && 'h-8 px-3.5 text-[13px]',
        size === 'md' && 'h-10 px-5 text-sm',
        size === 'lg' && 'h-12 px-7 text-[15px]',
        variant === 'primary' &&
          'bg-gradient-to-r from-nblue via-npurple to-npink bg-[length:200%_100%] bg-left text-white shadow-lg shadow-npurple/25 hover:bg-right hover:shadow-npurple/40 active:scale-[0.98]',
        variant === 'secondary' && 'border border-line bg-white text-ink hover:border-nblue/40 hover:text-nblue active:scale-[0.98]',
        variant === 'ghost' && 'text-ink-soft hover:bg-mist hover:text-ink',
        variant === 'danger' && 'border border-npink/30 bg-white text-npink hover:bg-npink hover:text-white',
        variant === 'success' && 'bg-ngreen text-white shadow-lg shadow-ngreen/25 hover:brightness-105 active:scale-[0.98]',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export const IconButton = ({ label, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={cx('inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft transition hover:bg-mist hover:text-ink disabled:opacity-40', className)}
    {...rest}
  >
    {children}
  </button>
);

/* ---------------- Surfaces ---------------- */

export function Card({ className, children, hover }: { className?: string; children: ReactNode; hover?: boolean }) {
  return (
    <div
      className={cx(
        'lift rounded-3xl border border-line bg-white p-5 shadow-[0_1px_0_rgba(20,20,43,0.02),0_10px_30px_-24px_rgba(20,20,43,0.25)]',
        hover && 'hover:border-nblue/30',
        className,
      )}
    >
      {children}
    </div>
  );
}

export const FadeIn = ({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) => (
  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }} className={className}>
    {children}
  </motion.div>
);

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <FadeIn className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-sm font-semibold text-npurple">{eyebrow}</div>}
        <h1 className="grad-text text-2xl font-extrabold sm:text-[30px]">{title}</h1>
        <div className="title-rule mt-1.5 w-16" aria-hidden />
        {subtitle && <p className="mt-2 max-w-2xl text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </FadeIn>
  );
}

export function Pill({ children, color = 'blue', className }: { children: ReactNode; color?: 'blue' | 'purple' | 'pink' | 'green' | 'gray'; className?: string }) {
  const map = {
    blue: 'bg-nblue-soft text-nblue',
    purple: 'bg-npurple-soft text-npurple',
    pink: 'bg-npink-soft text-npink',
    green: 'bg-ngreen-soft text-ngreen-ink',
    gray: 'bg-mist text-ink-soft',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', map[color], className)}>{children}</span>;
}

export function Avatar({ initials, size = 36, className }: { initials: string; size?: number; className?: string }) {
  const hues = ['from-nblue to-nblue-glow', 'from-npurple to-npink', 'from-npink to-npurple', 'from-ngreen to-nblue-glow'];
  const i = (initials.charCodeAt(0) + (initials.charCodeAt(1) || 0)) % hues.length;
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white', hues[i], className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

/* ---------------- Data viz ---------------- */

export function Ring({ value, size = 120, stroke = 11, color, label, sub }: { value: number | null; size?: number; stroke?: number; color?: string; label?: ReactNode; sub?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = value === null ? 0 : Math.max(0, Math.min(100, value));
  const col = color ?? scoreColor(value);
  const id = useRef(`g${Math.random().toString(36).slice(2)}`).current;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={col} />
            <stop offset="100%" stopColor={col} stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#EEF0F7" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (v / 100) * c }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: `drop-shadow(0 0 6px ${col}66)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="font-display font-bold leading-none" style={{ fontSize: size * 0.24 }}>
          {label ?? (value === null ? '—' : `${Math.round(value)}%`)}
        </div>
        {sub && <div className="mt-1 text-[11px] font-medium text-ink-faint">{sub}</div>}
      </div>
    </div>
  );
}

export function Bar({ value, color, height = 8, className, shimmer }: { value: number | null; color?: string; height?: number; className?: string; shimmer?: boolean }) {
  const v = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-[#EEF0F7]', className)} style={{ height }}>
      <motion.div
        className={cx('h-full rounded-full', shimmer && 'shimmer')}
        style={{ background: color ?? `linear-gradient(90deg, #1F6BFF, #8B3DFF, #FF2E93)` }}
        initial={{ width: 0 }}
        animate={{ width: `${v}%` }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

export function Stat({ label, value, sub, icon, color = '#1F6BFF', help }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; color?: string; help?: string }) {
  return (
    <Card className="relative overflow-hidden !p-4" hover>
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-[0.12] blur-xl" style={{ background: color }} />
      <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft" title={help}>
        {icon && (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg" style={{ background: `${color}18`, color }}>
            {icon}
          </span>
        )}
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-ink-soft">{sub}</div>}
    </Card>
  );
}

/** 14-day sparkline bars. */
export function DayBars({ days, max, height = 64 }: { days: { date: string; minutes: number; login?: boolean }[]; max?: number; height?: number }) {
  const m = Math.max(max ?? 0, ...days.map((d) => d.minutes), 10);
  return (
    <div className="flex items-end gap-1" style={{ height: height + 18 }}>
      {days.map((d, i) => {
        const h = Math.max(3, (d.minutes / m) * height);
        const dt = new Date(`${d.date}T12:00:00`);
        return (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}: ${d.minutes} min${d.login ? ' · signed in' : ''}`}>
            <motion.div
              className="w-full max-w-[18px] rounded-md"
              style={{ background: d.minutes ? 'linear-gradient(180deg,#8B3DFF,#1F6BFF)' : d.login ? '#D6E4FF' : '#EEF0F7' }}
              initial={{ height: 0 }}
              animate={{ height: h }}
              transition={{ duration: 0.6, delay: i * 0.025 }}
            />
            <span className="text-[9px] font-medium text-ink-faint">{dt.toLocaleDateString('en-US', { weekday: 'narrow' })}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- States ---------------- */

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cx('h-5 w-5 animate-spin text-npurple', className)} />;

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-ink-soft">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-nblue border-r-npurple" />
        <div className="absolute inset-2 animate-spin rounded-full border-[3px] border-transparent border-b-npink border-l-ngreen [animation-direction:reverse]" />
      </div>
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="mx-auto my-10 max-w-lg text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-npink" />
      <p className="mt-3 font-medium">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" icon={<RefreshCw className="h-4 w-4" />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-line px-6 py-12 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-mist text-npurple">{icon}</div>}
      <div className="font-display font-semibold">{title}</div>
      {text && <p className="mt-1 max-w-sm text-sm text-ink-soft">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------- Forms ---------------- */

export const Label = ({ children, hint, htmlFor }: { children: ReactNode; hint?: string; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-ink">
    {children}
    {hint && <span className="ml-1 font-normal text-ink-faint">{hint}</span>}
  </label>
);

const fieldCls =
  'w-full rounded-2xl border border-line bg-white px-3.5 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-ink-faint focus:border-nblue focus:ring-4 focus:ring-nblue/10 disabled:bg-mist';

export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input className={cx(fieldCls, className)} {...p} />;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={cx(fieldCls, 'min-h-[96px] resize-y', className)} {...p} />;
export const Select = ({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={cx(fieldCls, 'appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238A8AA3' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p}>
    {children}
  </select>
);

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div role="radiogroup" className={cx('inline-flex rounded-full border border-line bg-mist p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'relative rounded-full px-4 py-1.5 text-[13px] font-semibold transition-all duration-200',
            value === o.value ? 'bg-gradient-to-r from-nblue to-npurple text-white shadow' : 'text-ink-soft hover:text-ink',
          )}
        >
          <span className="relative z-10 inline-flex items-center gap-1.5">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; count?: number }[] }) {
  return (
    <div
      role="tablist"
      className="mb-5 flex gap-1 overflow-x-auto border-b border-line scroll-thin"
      onKeyDown={(e) => {
        // Arrow keys move between tabs (WAI-ARIA tabs pattern).
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const i = tabs.findIndex((t) => t.value === value);
        const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        onChange(next.value);
        requestAnimationFrame(() => (e.currentTarget.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus());
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={value === t.value}
          tabIndex={value === t.value ? 0 : -1}
          onClick={() => onChange(t.value)}
          className={cx('relative whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition', value === t.value ? 'text-ink' : 'text-ink-faint hover:text-ink')}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-mist px-1.5 text-[11px] text-ink-soft">{t.count}</span>}
          {value === t.value && <motion.span layoutId={`tab-${tabs.map((x) => x.value).join('')}`} className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-gradient-to-r from-nblue via-npurple to-npink" />}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Modal & confirm ---------------- */

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean | 'xl'; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  // Rendered into <body>, so an animated or transformed page can never trap it
  // behind the header or inside a scrolling panel.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[300] overflow-y-auto overscroll-contain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
          <div className="flex min-h-full items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={cx('relative flex w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:my-6 sm:rounded-3xl', wide === 'xl' ? 'sm:max-w-6xl' : wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
          >
            <div className="h-1 w-full bg-gradient-to-r from-nblue via-npurple to-npink" />
            <div className="flex items-center justify-between gap-4 px-6 pb-2 pt-5">
              <h2 className="text-lg font-bold">{title}</h2>
              <IconButton label="Close" onClick={onClose}>
                <X className="h-5 w-5" />
              </IconButton>
            </div>
            <div className="px-6 pb-6 pt-2">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-mist/60 px-6 py-4">{footer}</div>}
          </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * A short explainer that stays out of the way until it is wanted.
 * Used for "How to read this page" so the meaning of every number is one click away.
 */
export function Collapse({ title, children, icon }: { title: string; children: ReactNode; icon?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm font-semibold transition hover:bg-mist/60">
        <span className="flex items-center gap-2">
          {icon ?? <HelpCircle className="h-4 w-4 text-nblue" />} {title}
        </span>
        <ChevronDown className={cx('h-4 w-4 shrink-0 transition', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
            <div className="px-5 pb-4 text-sm text-ink-soft">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type ConfirmOpts = { title: string; text?: string; confirm?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title}
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {state?.confirm ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <p className="text-ink-soft">{state?.text}</p>
      </Modal>
    </ConfirmCtx.Provider>
  );
}

/* ---------------- Brand ---------------- */

/** The official USAII logo, used as supplied (public/usaii-logo.png). */
export function Logo({ compact, width }: { compact?: boolean; width?: number }) {
  const w = width ?? (compact ? 150 : 224);
  return <img src="/usaii-logo.png" alt="USAII, United States Artificial Intelligence Institute" width={w} height={Math.round((w * 148) / 866)} className="block h-auto select-none" style={{ width: w }} draggable={false} />;
}

/** Screen-wide flag used to show copyable temporary passwords. */
export function SecretBox({ label, value }: { label: string; value: string }) {
  const toast = useToast();
  return (
    <div className="rounded-2xl border border-ngreen/40 bg-ngreen-soft p-4">
      <div className="text-xs font-semibold text-ngreen-ink">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <code className="font-mono text-lg font-bold text-ink">{value}</code>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(
              () => toast('success', 'Copied to clipboard.'),
              () => toast('info', 'Select the text to copy it.'),
            );
          }}
        >
          Copy
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink-soft">Share this securely. They will be asked to choose their own password on first sign-in.</p>
    </div>
  );
}

/** Password input with show/hide and a "suggest" button. Rules match the server: 8+ chars, letters and numbers. */
/** The same rule the server enforces (server/auth.ts validatePassword). */
export const passwordOk = (v: string) => v.length >= 12 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v) && /[^A-Za-z0-9]/.test(v);

export function PasswordField({ value, onChange, id, label = 'Password' }: { value: string; onChange: (v: string) => void; id?: string; label?: string }) {
  const [show, setShow] = useState(false);
  // A random 16-character password from the browser's secure generator, meeting the server's rule.
  const suggest = () => {
    const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#%^&*-_=+?'];
    const all = sets.join('');
    const rnd = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n;
    const chars = sets.map((set) => set[rnd(set.length)]);
    while (chars.length < 16) chars.push(all[rnd(all.length)]);
    for (let i = chars.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    onChange(chars.join(''));
    setShow(true);
  };
  const ok = passwordOk(value);
  return (
    <div>
      <Label htmlFor={id} hint="(12+ characters: upper and lower case, a number, a symbol)">
        {label}
      </Label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input id={id} type={show ? 'text' : 'password'} autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} className={cx('pr-16', value && (ok ? '!border-ngreen' : '!border-npink/50'))} />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-faint hover:text-ink">
            {show ? 'Hide' : 'Show'}
          </button>
        </div>
        <Button type="button" variant="secondary" onClick={suggest}>
          Suggest
        </Button>
      </div>
    </div>
  );
}
