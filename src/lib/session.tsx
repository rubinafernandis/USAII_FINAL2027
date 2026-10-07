import { createContext, useContext } from 'react';
import type { PublicUser } from '../../shared/types';

export interface Session {
  user: PublicUser;
  setUser: (u: PublicUser) => void;
  logout: () => void;
}

export const SessionCtx = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(SessionCtx);
  if (!s) throw new Error('useSession outside provider');
  return s;
}
