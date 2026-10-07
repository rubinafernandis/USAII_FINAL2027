import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PublicUser } from '../shared/types';
import { api, setUnauthorizedHandler, tokenStore } from './lib/api';
import { SessionCtx, type Session } from './lib/session';
import Login from './components/Login';
import { ChangePasswordModal } from './components/Shell';
import { ConfirmProvider, Loading, Logo, ToastProvider, useRoute } from './components/ui';
import { PrefsProvider } from './learner/prefs';
import { VerifyPage } from './learner/Credential';
import LearnerApp from './learner/LearnerApp';
import Onboarding from './learner/Onboarding';
import StaffApp from './staff/StaffApp';

function Authed({ user }: { user: PublicUser }) {
  if (user.mustChangePassword)
    return (
      <div className="relative flex min-h-screen items-center justify-center">
        <div className="aurora">
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="absolute left-6 top-5">
          <Logo />
        </div>
        <ChangePasswordModal open forced onClose={() => undefined} />
      </div>
    );
  if (user.role === 'learner' && !user.onboarded) return <Onboarding />;
  return user.role === 'learner' ? <LearnerApp key={user.id} /> : <StaffApp key={user.id} />;
}

export default function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [booting, setBooting] = useState(!!tokenStore.get());
  // Why the server signed this person out (for example, a suspended account), shown on the sign-in screen.
  const [signedOutReason, setSignedOutReason] = useState('');
  const route = useRoute();

  const logout = useCallback(() => {
    tokenStore.set(null);
    setSignedOutReason('');
    setUser(null);
    window.location.hash = '';
  }, []);

  useEffect(() => {
    setUnauthorizedHandler((message) => {
      tokenStore.set(null);
      setUser(null);
      setSignedOutReason(message);
    });
    if (!tokenStore.get()) return;
    api<{ user: PublicUser }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => tokenStore.set(null))
      .finally(() => setBooting(false));
  }, []);

  const session: Session | null = useMemo(() => (user ? { user, setUser, logout } : null), [user, logout]);

  let content;
  if (route.view === 'verify' && route.params[0]) content = <VerifyPage certId={route.params[0]} />;
  else if (booting) content = <Loading label="Signing you in…" />;
  else if (!session)
    content = (
      <Login
        notice={signedOutReason}
        onAuthed={(u) => {
          setSignedOutReason('');
          // Always land on the role's home after sign-in.
          window.location.hash = u.role === 'learner' ? '#/dashboard' : '#/cohort';
          setUser(u);
        }}
      />
    );
  else
    content = (
      <SessionCtx.Provider value={session}>
        <Authed user={session.user} />
      </SessionCtx.Provider>
    );

  return (
    <PrefsProvider>
      <ToastProvider>
        <ConfirmProvider>{content}</ConfirmProvider>
      </ToastProvider>
    </PrefsProvider>
  );
}
