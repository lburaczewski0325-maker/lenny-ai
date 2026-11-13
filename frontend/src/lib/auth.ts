// Google sign-in for Boss AI.
// Identity is the Google account, NOT the IP: one account = one user = one
// set of free quotas. Lenny's server keys only serve Lenny (verified by the
// backend against LENNY_EMAIL); everyone else uses their own free key.

export const LENNY_EMAIL = "lburaczewski0325@gmail.com";

export type Session = {
  email: string;
  name: string;
  picture: string;
  idToken: string;
  exp: number; // unix seconds
};

const SESSION_KEY = "bossai.session";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: {
            client_id: string;
            callback: (resp: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            el: HTMLElement,
            opts: { theme?: string; size?: string; width?: number },
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s.idToken || !s.email) return null;
    if (s.exp && s.exp * 1000 < Date.now()) return null; // expired
    return s;
  } catch {
    return null;
  }
}

export function saveSession(idToken: string): Session | null {
  const payload = decodeJwt(idToken);
  if (!payload || typeof payload.email !== "string") return null;
  const s: Session = {
    email: payload.email,
    name: typeof payload.name === "string" ? payload.name : payload.email,
    picture: typeof payload.picture === "string" ? payload.picture : "",
    idToken,
    exp: typeof payload.exp === "number" ? payload.exp : 0,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  return s;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function isLenny(session: Session | null): boolean {
  return !!session && session.email.toLowerCase() === LENNY_EMAIL;
}

/** Render the Google sign-in button into `el`. Calls onSession when signed in. */
export function renderGoogleButton(
  el: HTMLElement,
  clientId: string,
  onSession: (s: Session) => void,
) {
  if (!window.google?.accounts?.id) return false;
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (resp) => {
      const s = saveSession(resp.credential);
      if (s) onSession(s);
    },
  });
  el.innerHTML = "";
  window.google.accounts.id.renderButton(el, {
    theme: "filled_black",
    size: "large",
    width: 280,
  });
  return true;
}
