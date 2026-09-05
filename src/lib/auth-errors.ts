/** Human-friendly auth errors when the Supabase host is unreachable. */

const NETWORK_RE =
  /load failed|failed to fetch|networkerror|network request failed|fetch failed|the internet connection appears to be offline|could not connect|err_name_not_resolved|err_connection/i;

export function isAuthNetworkError(message: string | null | undefined): boolean {
  if (!message) return false;
  return NETWORK_RE.test(message);
}

export function formatAuthError(message: string | null | undefined, action: "login" | "signup" | "reset"): {
  title: string;
  description: string;
} {
  const raw = (message || "").trim() || "Something went wrong.";
  if (isAuthNetworkError(raw)) {
    return {
      title: "Can't reach YAJ servers",
      description:
        "Your device couldn't connect to the backend (often a paused or disconnected Cloud/Supabase project). In Lovable open Cloud and confirm the backend is active, then try again.",
    };
  }
  if (action === "login") return { title: "Login failed", description: raw };
  if (action === "signup") return { title: "Signup failed", description: raw };
  return { title: "Error", description: raw };
}

/** Lightweight reachability probe used on the auth screen. */
export async function probeSupabaseAuthReachable(timeoutMs = 4000): Promise<boolean> {
  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!base || !key) return false;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/auth/v1/health`, {
      method: "GET",
      headers: { apikey: key },
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}
