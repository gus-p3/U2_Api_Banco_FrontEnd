import { create } from 'zustand';

import type { Session, Tokens } from '../domain/entities';

export type SessionStatus = 'booting' | 'authenticated' | 'unauthenticated';
export type EndReason = 'inactivity' | 'refresh-failed' | 'unauthorized' | 'logout';

interface SessionState {
  status: SessionStatus;
  session: Session | null;
  /** Access token solo en memoria; el refresh token se persiste en almacenamiento seguro. */
  accessToken: string | null;
  refreshToken: string | null;
  endReason: EndReason | null;
  /** Segundos restantes del access token actual (null si no se conoce). */
  remainingSeconds: number | null;

  setAuthenticated: (session: Session, tokens: Tokens) => void;
  updateTokens: (session: Session, tokens: Tokens) => void;
  setUnauthenticated: (reason?: EndReason | null) => void;
  setRemainingSeconds: (seconds: number | null) => void;
  patchSession: (patch: Partial<Session>) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  status: 'booting',
  session: null,
  accessToken: null,
  refreshToken: null,
  endReason: null,
  remainingSeconds: null,

  setAuthenticated: (session, tokens) =>
    set({
      status: 'authenticated',
      session,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      endReason: null,
    }),

  updateTokens: (session, tokens) =>
    set({ session, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }),

  setUnauthenticated: (reason = null) =>
    set({
      status: 'unauthenticated',
      session: null,
      accessToken: null,
      refreshToken: null,
      remainingSeconds: null,
      endReason: reason,
    }),

  setRemainingSeconds: (seconds) => set({ remainingSeconds: seconds }),

  patchSession: (patch) =>
    set((state) => (state.session ? { session: { ...state.session, ...patch } } : state)),
}));

export const selectIsAuthenticated = (s: SessionState): boolean => s.status === 'authenticated';
