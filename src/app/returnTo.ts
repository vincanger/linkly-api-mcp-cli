import { useEffect } from "react";
import { useNavigate } from "react-router";

// Remembers where to go after logging in. The OAuth consent page uses it so
// the full authorization request survives the login (or signup) detour.
const KEY = "linkly:returnTo";

export function rememberReturnTo(path: string): void {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // Storage unavailable: the user lands on /links after login instead.
  }
}

export function useReturnAfterLogin(loggedIn: boolean): void {
  const navigate = useNavigate();
  useEffect(() => {
    if (!loggedIn) return;
    let target: string | null = null;
    try {
      target = sessionStorage.getItem(KEY);
      sessionStorage.removeItem(KEY);
    } catch {
      return;
    }
    if (target && target.startsWith("/")) navigate(target, { replace: true });
  }, [loggedIn, navigate]);
}
