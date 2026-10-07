import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, CheckCircle2, Eye, EyeOff, GraduationCap, Lock, Mail, Presentation, ShieldCheck } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import type { PublicUser } from '../../shared/types';
import { api, tokenStore } from '../lib/api';
import { cx, Input, Label, Logo } from './ui';

/** Soft floating dots in the brand colors. */
function Particles() {
  const dots = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        left: `${(i * 41) % 100}%`,
        bottom: `${(i * 17) % 30}%`,
        delay: `${(i * 0.9) % 10}s`,
        dur: `${10 + ((i * 7) % 8)}s`,
        color: ['#1F6BFF', '#8B3DFF', '#FF2E93', '#00C77F'][i % 4],
      })),
    [],
  );
  return (
    <>
      {dots.map((d, i) => (
        <span key={i} className="particle" style={{ left: d.left, bottom: d.bottom, animationDelay: d.delay, animationDuration: d.dur, background: d.color, boxShadow: `0 0 10px ${d.color}` }} />
      ))}
    </>
  );
}

const HEADLINE = ['AI', 'is', 'for', 'Everyone.'];

export default function Login({ onAuthed, notice }: { onAuthed: (u: PublicUser) => void; notice?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(notice ?? '');
  const [success, setSuccess] = useState<PublicUser | null>(null);
  const [shake, setShake] = useState(0);
  // Three doors into the same portal: it tells people they are in the right place.
  const [role, setRole] = useState<'learner' | 'instructor'>('learner');
  const ROLES = [
    { id: 'learner' as const, label: 'Learner', icon: GraduationCap, color: '#1F6BFF', hint: 'Take courses and earn your micro-credential.' },
    { id: 'instructor' as const, label: 'Instructor', icon: Presentation, color: '#8B3DFF', hint: 'Teach, guide and track your learners.' },
  ];
  const current = ROLES.find((r) => r.id === role)!;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      setShake((s) => s + 1);
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ token: string; user: PublicUser }>('/auth/login', { body: { email, password, role } });
      tokenStore.set(res.token);
      setSuccess(res.user);
      setTimeout(() => onAuthed(res.user), 900);
    } catch (err) {
      setError((err as Error).message);
      setShake((s) => s + 1);
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      <div className="aurora">
        <span />
        <span />
        <span />
        <span />
      </div>
      <Particles />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <motion.header initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Logo width={320} />
        </motion.header>

        <main className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[1.15fr_1fr]">
          {/* The promise, in three lines */}
          <div className="text-center lg:text-left">
            <h1 className="text-[44px] font-extrabold leading-[1.04] sm:text-[62px]">
              {HEADLINE.map((w, i) => (
                <span key={w}>
                  <motion.span
                    initial={{ opacity: 0, y: 28, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{ delay: 0.15 + i * 0.11, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className={`inline-block ${w === 'Everyone.' ? 'neon-text' : ''}`}
                  >
                    {w}
                  </motion.span>
                  {i < HEADLINE.length - 1 ? ' ' : ''}
                </span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.72, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mt-5 max-w-xl font-display text-[24px] font-bold leading-snug text-ink sm:text-[30px] lg:mx-0"
            >
              {['Learn AI.', 'Work smarter.', 'Save time.'].map((chunk, i) => (
                <motion.span
                  key={chunk}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.78 + i * 0.14, duration: 0.45 }}
                  className="mr-2 inline-block"
                  style={{ color: ['#1F6BFF', '#8B3DFF', '#FF2E93'][i] }}
                >
                  {chunk}
                </motion.span>
              ))}
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.25, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mt-4 max-w-xl text-[20px] font-semibold leading-relaxed text-ink-soft sm:text-[23px] lg:mx-0"
            >
              Level up your career with <span className="grad-text font-extrabold">USAII&reg; Micro-Credentials!</span>
            </motion.p>

            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 1.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mt-8 h-1.5 w-48 origin-left rounded-full bg-gradient-to-r from-nblue via-npurple to-npink lg:mx-0"
            />
          </div>

          {/* Sign in */}
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 20, delay: 0.3 }} className="mx-auto w-full max-w-md">
            <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }} className="beam">
              <div className="beam-inner relative overflow-hidden p-8 sm:p-10">
                <AnimatePresence mode="wait">
                  {success ? (
                    <motion.div key="ok" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} className="flex min-h-[300px] flex-col items-center justify-center text-center">
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 10 }}>
                        <CheckCircle2 className="h-16 w-16 text-ngreen" />
                      </motion.div>
                      <div className="mt-4 font-display text-2xl font-bold">Welcome, {success.name.split(' ')[0]}</div>
                      <p className="mt-1 text-ink-soft">Opening your workspace…</p>
                    </motion.div>
                  ) : (
                    <motion.div key="form" exit={{ opacity: 0, y: -10 }}>
                      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-mist p-1.5" role="tablist" aria-label="Choose how you are signing in">
                        {ROLES.map((r) => {
                          const on = role === r.id;
                          return (
                            <button
                              key={r.id}
                              type="button"
                              role="tab"
                              aria-selected={on}
                              onClick={() => {
                                setRole(r.id);
                                setError('');
                              }}
                              className={cx('relative flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[12px] font-bold transition', on ? 'text-white' : 'text-ink-soft hover:text-ink')}
                            >
                              {on && <motion.span layoutId="role-pill" className="absolute inset-0 rounded-xl" style={{ background: `linear-gradient(135deg, ${r.color}, ${r.color}bb)` }} transition={{ type: 'spring', damping: 26, stiffness: 320 }} />}
                              <r.icon className="relative h-4 w-4" />
                              <span className="relative">{r.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.p key={role} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-2.5 text-sm text-ink-soft">
                          {current.hint}
                        </motion.p>
                      </AnimatePresence>
                      <form onSubmit={submit} className="mt-7 space-y-5" noValidate>
                        <div>
                          <Label htmlFor="email">Email</Label>
                          <div className="group relative">
                            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint transition group-focus-within:text-nblue" />
                            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" placeholder="you@example.com" autoFocus />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="password">Password</Label>
                          <div className="group relative">
                            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint transition group-focus-within:text-npurple" />
                            <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-11" />
                            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
                              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <AnimatePresence>
                          {error && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} role="alert" className="rounded-2xl bg-npink-soft px-4 py-2.5 text-sm font-medium text-npink">
                              {error}
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="submit"
                          disabled={busy}
                          className="btn-shine group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-nblue via-npurple to-npink bg-[length:200%_100%] bg-left font-semibold text-white shadow-lg shadow-npurple/30 transition-[background-position] duration-500 hover:bg-right disabled:opacity-70"
                        >
                          {busy ? (
                            <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white" />
                          ) : (
                            <>
                              Sign in as {current.label} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                            </>
                          )}
                        </motion.button>
                      </form>
                      <p className="mt-4 text-center text-xs text-ink-faint">{role === 'learner' ? 'Don’t have an account? Ask your instructor.' : 'Forgot your password? Contact your LMS administrator.'}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        </main>

        <footer className="text-center text-xs text-ink-faint">© {new Date().getFullYear()} United States Artificial Intelligence Institute</footer>
      </div>
    </div>
  );
}
