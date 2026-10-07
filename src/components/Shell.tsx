import { AnimatePresence, motion } from 'motion/react';
import { Bell, CheckCheck, KeyRound, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { Fragment, useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import type { Notification } from '../../shared/types';
import { api, tokenStore } from '../lib/api';
import { timeAgo } from '../lib/format';
import { useSession } from '../lib/session';
import { usePrefs } from '../learner/prefs';
import { Avatar, Button, cx, IconButton, Input, Label, Logo, Modal, navigate, useToast } from './ui';

export interface NavItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  badge?: number;
  /** Other route views that should highlight this item. */
  also?: string[];
}

export function notificationPath(n: Notification, role: string): string {
  const l = n.link;
  if (!l) return role === 'learner' ? 'dashboard' : 'cohort';
  if (role === 'learner') {
    switch (l.view) {
      case 'ask':
        return l.threadId ? `ask/${l.threadId}` : 'ask';
      case 'messages':
        return 'ask?tab=messages';
      case 'study':
        // Activity reviews open straight on the activity.
        return l.courseId && l.lessonId ? `study/${l.courseId}/${l.lessonId}${n.kind === 'feedback' ? '?step=apply' : ''}` : 'learning';
      case 'progress':
        return l.courseId ? `progress/${l.courseId}` : 'progress';
      default:
        return 'dashboard';
    }
  }
  switch (l.view) {
    case 'cohort':
      return l.courseId ? `cohort?course=${l.courseId}` : 'cohort';
    case 'learners':
      return 'learners';
    case 'inbox':
      return l.threadId ? `inbox/${l.threadId}` : 'inbox';
    case 'assessments':
      return 'assessments';
    case 'activity':
      return 'activity';
    default:
      return 'cohort';
  }
}

/** Light or dark, available to learners and instructors alike. */
export function ThemeToggle() {
  const p = usePrefs();
  const dark = p.theme === 'dark';
  return (
    <IconButton label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={p.toggleTheme}>
      <motion.span key={p.theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} transition={{ duration: 0.3 }} className="block">
        {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </motion.span>
    </IconButton>
  );
}

function Notifications() {
  const { user } = useSession();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const lastUnread = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ notifications: Notification[]; unread: number }>('/notifications');
      setList(r.notifications);
      setUnread(r.unread);
      if (lastUnread.current !== null && r.unread > lastUnread.current && r.notifications[0]) toast('info', r.notifications[0].title);
      lastUnread.current = r.unread;
    } catch {
      /* silent: bell is non-critical */
    }
  }, [toast]);

  useEffect(() => {
    void load();
    const t = setInterval(load, 45_000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    window.addEventListener('lms:refresh-notifications', onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('lms:refresh-notifications', onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const markRead = async (ids?: string[]) => {
    try {
      await api('/notifications/read', { body: { ids } });
      setList((l) => l.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)));
      setUnread((u) => (ids ? Math.max(0, u - ids.filter((id) => list.find((n) => n.id === id && !n.read)).length) : 0));
      lastUnread.current = ids ? Math.max(0, (lastUnread.current ?? 0) - ids.length) : 0;
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <IconButton label="Notifications" onClick={() => setOpen((o) => !o)} className="relative">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-npink px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </motion.span>
        )}
      </IconButton>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute right-0 top-11 z-50 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-3xl border border-line bg-white shadow-2xl shadow-ink/10"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="font-display font-semibold">Notifications</div>
              {unread > 0 && (
                <button onClick={() => void markRead()} className="inline-flex items-center gap-1 text-xs font-semibold text-nblue hover:underline">
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto scroll-thin">
              {list.length === 0 && <div className="px-4 py-10 text-center text-sm text-ink-faint">You are all caught up.</div>}
              {list.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read) void markRead([n.id]);
                    setOpen(false);
                    navigate(notificationPath(n, user.role));
                  }}
                  className={cx('flex w-full gap-3 border-b border-line/70 px-4 py-3 text-left transition hover:bg-mist', !n.read && 'bg-nblue-soft/40')}
                >
                  <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-gradient-to-br from-nblue to-npink')} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{n.title}</span>
                    <span className="block text-[13px] text-ink-soft">{n.body}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-faint">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ChangePasswordModal({ open, onClose, forced }: { open: boolean; onClose: () => void; forced?: boolean }) {
  const { setUser } = useSession();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setErr('');
    if (next !== confirm) return setErr('The two new passwords do not match.');
    setBusy(true);
    try {
      const r = await api('/auth/change-password', { body: { current, next } });
      // The server ends every sign-in made with the old password and sends a fresh token for this browser.
      if (r.token) tokenStore.set(r.token);
      setUser(r.user);
      toast('success', 'Password updated.');
      setCurrent('');
      setNext('');
      setConfirm('');
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={forced ? () => undefined : onClose}
      title={forced ? 'Choose your own password' : 'Change password'}
      footer={
        <>
          {!forced && (
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button loading={busy} onClick={save}>
            Save password
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {forced && <p className="text-sm text-ink-soft">You signed in with a temporary password. Please choose a personal one to continue.</p>}
        {!forced && (
          <div>
            <Label>Current password</Label>
            <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </div>
        )}
        <div>
          <Label hint="(12+ characters: upper and lower case, a number, a symbol)">New password</Label>
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </div>
        <div>
          <Label>Confirm new password</Label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
        {err && <div className="rounded-2xl bg-npink-soft px-4 py-2.5 text-sm text-npink">{err}</div>}
      </div>
    </Modal>
  );
}

function ProfileMenu() {
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const roleLabel = user.role === 'instructor' ? 'Instructor' : 'Learner';
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full p-1 pr-3 transition hover:bg-mist" aria-label="Account menu">
        <Avatar initials={user.initials} size={34} />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-[13px] font-semibold">{user.name}</span>
          <span className="block text-[11px] text-ink-faint">{roleLabel}</span>
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-2xl shadow-ink/10">
            <div className="px-3 py-2">
              <div className="truncate text-sm font-semibold">{user.name}</div>
              <div className="truncate text-xs text-ink-faint">{user.email}</div>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                setPw(true);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-mist hover:text-ink"
            >
              <KeyRound className="h-4 w-4" /> Change password
            </button>
            <button onClick={logout} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-npink hover:bg-npink-soft">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <ChangePasswordModal open={pw} onClose={() => setPw(false)} />
    </div>
  );
}

export default function Shell({
  nav,
  secondary,
  current,
  sidebarExtra,
  children,
  floating,
  focus,
  headerExtra,
  navExtra,
}: {
  nav: NavItem[];
  secondary?: NavItem[];
  current: string;
  sidebarExtra?: ReactNode;
  children: ReactNode;
  floating?: ReactNode;
  /** Focus mode: the menu, header and alerts step aside so only the content is left. */
  focus?: boolean;
  headerExtra?: ReactNode;
  /** A section placed in the main menu right after the item with this id (the learner's Steps to Completion). */
  navExtra?: { after: string; node: ReactNode };
}) {
  const [mobile, setMobile] = useState(false);
  const { user } = useSession();
  useEffect(() => setMobile(false), [current]);

  const renderItem = (it: NavItem, animated: boolean) => {
    const active = current === it.id || (it.also ?? []).includes(current);
    return (
      <button
        key={it.id}
        onClick={() => navigate(it.id)}
        className={cx('group relative flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] font-semibold transition', active ? 'text-ink' : 'text-ink-soft hover:bg-mist hover:text-ink')}
        aria-current={active ? 'page' : undefined}
      >
        {active && animated && (
          <motion.span
            layoutId="navactive"
            className="absolute inset-0 rounded-2xl bg-gradient-to-r from-nblue-soft via-npurple-soft to-npink-soft/60 ring-1 ring-npurple/15"
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          />
        )}
        {active && !animated && <span className="absolute inset-0 rounded-2xl bg-gradient-to-r from-nblue-soft via-npurple-soft to-npink-soft/60 ring-1 ring-npurple/15" />}
        {active && animated && <motion.span layoutId="navbar" className="absolute -left-4 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-nblue to-npink" />}
        <span className={cx('relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition', active ? 'bg-gradient-to-br from-nblue to-npurple text-white shadow-sm shadow-npurple/30' : 'bg-mist text-ink-faint group-hover:bg-nblue-soft group-hover:text-nblue')}>
          <it.icon className="h-[17px] w-[17px]" />
        </span>
        <span className="relative flex-1 text-left">{it.label}</span>
        {!!it.badge && <span className="relative rounded-full bg-npink px-2 py-0.5 text-[11px] font-bold text-white">{it.badge}</span>}
      </button>
    );
  };

  const sidebar = (animated: boolean) => (
    <div className="flex h-full flex-col">
      <div className="relative px-5 pb-6 pt-6">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-nblue via-npurple to-npink" />
        <button onClick={() => navigate('')} aria-label="Home" className="transition hover:opacity-80">
          <Logo />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-4 scroll-thin" aria-label="Main">
        {nav.map((it) => (
          <Fragment key={it.id}>
            {renderItem(it, animated)}
            {navExtra && navExtra.after === it.id && navExtra.node}
          </Fragment>
        ))}
        {secondary && secondary.length > 0 && <div className="my-4 h-px bg-line" />}
        {secondary?.map((it) => renderItem(it, animated))}
      </nav>
      {sidebarExtra && <div className="px-4 pb-3">{sidebarExtra}</div>}
      <div className="border-t border-line px-5 py-4 text-[11px] text-ink-faint">
        Signed in as <span className="font-semibold text-ink-soft">{user.role === 'instructor' ? 'Instructor' : 'Learner'}</span>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {!focus && <aside className="relative hidden w-[264px] shrink-0 border-r border-line bg-white lg:block">{sidebar(true)}</aside>}
      <AnimatePresence>
        {mobile && (
          <motion.div className="fixed inset-0 z-[80] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setMobile(false)} />
            <motion.aside initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="absolute inset-y-0 left-0 w-[280px] bg-white shadow-2xl">
              <IconButton label="Close menu" className="absolute right-3 top-6" onClick={() => setMobile(false)}>
                <X className="h-5 w-5" />
              </IconButton>
              {sidebar(false)}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex min-w-0 flex-1 flex-col">
        {!focus && (
        <header className="no-print relative z-40 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line surface-blur px-4 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-2">
            <IconButton label="Open menu" className="lg:hidden" onClick={() => setMobile(true)}>
              <Menu className="h-5 w-5" />
            </IconButton>
            <div className="lg:hidden">
              <Logo compact />
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {headerExtra}
            <ThemeToggle />
            <Notifications />
            <ProfileMenu />
          </div>
          <div className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-npurple/30 to-transparent" />
        </header>
        )}
        <main id="main-scroll" className="relative flex-1 overflow-y-auto scroll-thin">
          <div className="page-wash" aria-hidden />
          <motion.div
            key={current}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={cx('relative z-10 mx-auto w-full px-4 py-6 sm:px-8 sm:py-8', focus ? 'max-w-[860px] pt-14 focus-reading' : 'max-w-[1200px]')}
          >
            {children}
          </motion.div>
        </main>
      </div>
      {floating}
    </div>
  );
}
