import type { AuthSession, AuthSessionRepository } from './GatewayClient';

const sessionKey = 'tutormatching.auth.session';

function parse(value: string | null): AuthSession | undefined {
  if (!value) return undefined;
  try {
    const session = JSON.parse(value) as AuthSession;
    return session.accessToken && session.refreshToken ? session : undefined;
  } catch {
    return undefined;
  }
}

export const browserSession: AuthSessionRepository = {
  load() {
    if (typeof window === 'undefined') return undefined;
    return parse(window.sessionStorage.getItem(sessionKey)) ?? parse(window.localStorage.getItem(sessionKey));
  },
  save(session, persistent = false) {
    if (typeof window === 'undefined') return;
    const target = persistent ? window.localStorage : window.sessionStorage;
    const other = persistent ? window.sessionStorage : window.localStorage;
    other.removeItem(sessionKey);
    target.setItem(sessionKey, JSON.stringify(session));
  },
  clear() {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(sessionKey);
    window.localStorage.removeItem(sessionKey);
  },
};
