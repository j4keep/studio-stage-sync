import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  AccountSafetyPolicy,
  ageBandFromDob,
  generateParentLinkCode,
  isSocialConsumptionPath,
  localDateString,
  normalizePolicyRow,
  policyForDob,
  youthDefaults,
  adultDefaults,
} from "@/lib/safety-balance";

const LEGACY_BREAK_KEY = "wheuat_take_a_break";
const localKey = (userId: string) => `yaj_safety_policy_${userId}`;

function readLocalPolicy(userId: string): AccountSafetyPolicy | null {
  try {
    const raw = localStorage.getItem(localKey(userId));
    if (!raw) return null;
    return normalizePolicyRow(JSON.parse(raw) as unknown as Record<string, unknown>, userId);
  } catch {
    return null;
  }
}

function writeLocalPolicy(policy: AccountSafetyPolicy) {
  try {
    localStorage.setItem(localKey(policy.user_id), JSON.stringify(policy));
  } catch {
    /* ignore quota */
  }
}

type SafetyContextValue = {
  policy: AccountSafetyPolicy | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<AccountSafetyPolicy | null>;
  updatePolicy: (patch: Partial<AccountSafetyPolicy>) => Promise<AccountSafetyPolicy | null>;
  ensurePolicyFromDob: (dob: string) => Promise<AccountSafetyPolicy | null>;
  markYouthWelcomeSeen: () => Promise<AccountSafetyPolicy | null>;
  createParentInvite: () => Promise<AccountSafetyPolicy | null>;
  claimParentCode: (code: string) => Promise<string>;
  extendTeenSocialTime: (extraMinutes: number, teenUserId: string) => Promise<AccountSafetyPolicy | null>;
  listLinkedTeens: () => Promise<AccountSafetyPolicy[]>;
  updateTeenPolicy: (teenUserId: string, patch: Partial<AccountSafetyPolicy>) => Promise<AccountSafetyPolicy | null>;
  continuousMinutes: number;
  showContinuousReminder: boolean;
  dismissReminder: () => void;
  takeBreakFromReminder: () => Promise<AccountSafetyPolicy | null>;
  ageBandFromDob: typeof ageBandFromDob;
  youthDefaults: typeof youthDefaults;
  adultDefaults: typeof adultDefaults;
};

const SafetyBalanceContext = createContext<SafetyContextValue | null>(null);

async function fetchPolicy(userId: string): Promise<AccountSafetyPolicy | null> {
  const { data, error } = await supabase
    .from("account_safety_policies" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[safety] fetchPolicy", error.message);
    return readLocalPolicy(userId);
  }
  if (!data) return readLocalPolicy(userId);
  const normalized = normalizePolicyRow(data as unknown as Record<string, unknown>, userId);
  writeLocalPolicy(normalized);
  return normalized;
}

async function upsertPolicy(policy: Partial<AccountSafetyPolicy> & { user_id: string }) {
  const existing = (await fetchPolicy(policy.user_id)) || adultDefaults(policy.user_id, policy.date_of_birth ?? null);
  const merged = normalizePolicyRow({ ...existing, ...policy } as unknown as Record<string, unknown>, policy.user_id);

  const { data, error } = await supabase
    .from("account_safety_policies" as any)
    .upsert(merged as any, { onConflict: "user_id" })
    .select("*")
    .maybeSingle();

  if (error) {
    console.warn("[safety] upsertPolicy falling back to local", error.message);
    writeLocalPolicy(merged);
    return merged;
  }
  const normalized = data
    ? normalizePolicyRow(data as unknown as Record<string, unknown>, policy.user_id)
    : merged;
  writeLocalPolicy(normalized);
  return normalized;
}

export function SafetyBalanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [policy, setPolicy] = useState<AccountSafetyPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tickRef = useRef<number | null>(null);
  const continuousRef = useRef(0);
  const [continuousMinutes, setContinuousMinutes] = useState(0);
  const [reminderDismissedAt, setReminderDismissedAt] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setPolicy(null);
      setLoading(false);
      setError(null);
      return null;
    }
    setLoading(true);
    try {
      let next = await fetchPolicy(user.id);
      if (next && !next.detox_until && localStorage.getItem(LEGACY_BREAK_KEY) === "true") {
        const until = new Date();
        until.setDate(until.getDate() + 1);
        until.setHours(6, 0, 0, 0);
        next = await upsertPolicy({ user_id: user.id, detox_until: until.toISOString() });
        localStorage.setItem(LEGACY_BREAK_KEY, "false");
        window.dispatchEvent(new Event("wheuat-take-a-break-changed"));
      }
      setPolicy(next);
      setError(null);
      return next;
    } catch (e: any) {
      setError(e?.message || "Failed to load safety policy");
      setPolicy(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updatePolicy = useCallback(
    async (patch: Partial<AccountSafetyPolicy>) => {
      if (!user) return null;
      const next = await upsertPolicy({ user_id: user.id, ...patch });
      if (next) setPolicy(next);
      if ("detox_until" in patch) {
        const active = next ? Boolean(next.detox_until && new Date(next.detox_until) > new Date()) : false;
        localStorage.setItem(LEGACY_BREAK_KEY, String(active));
        window.dispatchEvent(new Event("wheuat-take-a-break-changed"));
      }
      if (patch.profile_privacy) {
        localStorage.setItem("wheuat_private", String(patch.profile_privacy === "private"));
      }
      return next;
    },
    [user],
  );

  const ensurePolicyFromDob = useCallback(
    async (dob: string) => {
      if (!user) return null;
      const draft = policyForDob(user.id, dob);
      const existing = await fetchPolicy(user.id);
      if (existing?.date_of_birth && existing.age_band !== "unknown") {
        setPolicy(existing);
        setLoading(false);
        return existing;
      }
      const saved = await upsertPolicy({
        ...(existing || {}),
        ...draft,
        user_id: user.id,
        parent_account_id: existing?.parent_account_id ?? null,
        social_minutes_used_today: existing?.social_minutes_used_today ?? 0,
        social_usage_date: existing?.social_usage_date ?? localDateString(),
        youth_welcome_seen_at: existing?.youth_welcome_seen_at ?? null,
      });
      setPolicy(saved);
      setLoading(false);
      return saved;
    },
    [user],
  );

  const markYouthWelcomeSeen = useCallback(async () => {
    return updatePolicy({ youth_welcome_seen_at: new Date().toISOString() });
  }, [updatePolicy]);

  const createParentInvite = useCallback(async () => {
    if (!user) return null;
    const code = generateParentLinkCode();
    const expires = new Date();
    expires.setHours(expires.getHours() + 48);
    return updatePolicy({
      parent_link_code: code,
      parent_link_code_expires_at: expires.toISOString(),
    });
  }, [user, updatePolicy]);

  const claimParentCode = useCallback(
    async (code: string) => {
      const { data, error: rpcError } = await supabase.rpc("link_parent_to_teen" as any, {
        p_code: code.trim(),
      });
      if (rpcError) throw rpcError;
      await refresh();
      return data as string;
    },
    [refresh],
  );

  const updateTeenPolicy = useCallback(
    async (teenUserId: string, patch: Partial<AccountSafetyPolicy>) => {
      const { data, error: upError } = await supabase
        .from("account_safety_policies" as any)
        .update(patch as any)
        .eq("user_id", teenUserId)
        .select("*")
        .maybeSingle();
      if (upError) throw upError;
      return data ? normalizePolicyRow(data as unknown as Record<string, unknown>, teenUserId) : null;
    },
    [],
  );

  const extendTeenSocialTime = useCallback(
    async (extraMinutes: number, teenUserId: string) => {
      const { data: row } = await supabase
        .from("account_safety_policies" as any)
        .select("*")
        .eq("user_id", teenUserId)
        .maybeSingle();
      if (!row) return null;
      const teen = normalizePolicyRow(row as unknown as Record<string, unknown>, teenUserId);
      const today = localDateString();
      const used = teen.social_usage_date === today ? teen.social_minutes_used_today : 0;
      const limit = teen.daily_social_limit_minutes ?? 90;
      return updateTeenPolicy(teenUserId, {
        daily_social_limit_minutes: limit + extraMinutes,
        social_minutes_used_today: used,
        social_usage_date: today,
      });
    },
    [updateTeenPolicy],
  );

  const listLinkedTeens = useCallback(async () => {
    if (!user) return [] as AccountSafetyPolicy[];
    const { data, error: qError } = await supabase
      .from("account_safety_policies" as any)
      .select("*")
      .eq("parent_account_id", user.id);
    if (qError) {
      console.warn("[safety] listLinkedTeens", qError.message);
      return [];
    }
    return (data || []).map((row: any) => normalizePolicyRow(row, row.user_id));
  }, [user]);

  useEffect(() => {
    if (!user || !policy) return;
    const onSocial = isSocialConsumptionPath(location.pathname);
    if (!onSocial) {
      continuousRef.current = 0;
      setContinuousMinutes(0);
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    tickRef.current = window.setInterval(() => {
      continuousRef.current += 1;
      setContinuousMinutes(continuousRef.current);

      setPolicy((prev) => {
        if (!prev) return prev;
        const today = localDateString();
        const used = prev.social_usage_date === today ? prev.social_minutes_used_today : 0;
        const nextUsed = used + 1;
        void supabase
          .from("account_safety_policies" as any)
          .update({
            social_minutes_used_today: nextUsed,
            social_usage_date: today,
          } as any)
          .eq("user_id", user.id);
        return {
          ...prev,
          social_minutes_used_today: nextUsed,
          social_usage_date: today,
        };
      });
    }, 60_000);

    return () => {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [user, policy?.user_id, location.pathname]);

  const showContinuousReminder = useMemo(() => {
    const interval = policy?.continuous_reminder_minutes;
    if (!interval || interval <= 0) return false;
    if (continuousMinutes < interval) return false;
    if (reminderDismissedAt > 0 && continuousMinutes < reminderDismissedAt + interval) return false;
    return true;
  }, [policy?.continuous_reminder_minutes, continuousMinutes, reminderDismissedAt]);

  const dismissReminder = useCallback(() => {
    setReminderDismissedAt(continuousMinutes);
  }, [continuousMinutes]);

  const takeBreakFromReminder = useCallback(async () => {
    setReminderDismissedAt(continuousMinutes);
    continuousRef.current = 0;
    setContinuousMinutes(0);
    const until = new Date();
    until.setMinutes(until.getMinutes() + 15);
    return updatePolicy({ detox_until: until.toISOString() });
  }, [continuousMinutes, updatePolicy]);

  const value = useMemo<SafetyContextValue>(
    () => ({
      policy,
      loading,
      error,
      refresh,
      updatePolicy,
      ensurePolicyFromDob,
      markYouthWelcomeSeen,
      createParentInvite,
      claimParentCode,
      extendTeenSocialTime,
      listLinkedTeens,
      updateTeenPolicy,
      continuousMinutes,
      showContinuousReminder,
      dismissReminder,
      takeBreakFromReminder,
      ageBandFromDob,
      youthDefaults,
      adultDefaults,
    }),
    [
      policy,
      loading,
      error,
      refresh,
      updatePolicy,
      ensurePolicyFromDob,
      markYouthWelcomeSeen,
      createParentInvite,
      claimParentCode,
      extendTeenSocialTime,
      listLinkedTeens,
      updateTeenPolicy,
      continuousMinutes,
      showContinuousReminder,
      dismissReminder,
      takeBreakFromReminder,
    ],
  );

  return <SafetyBalanceContext.Provider value={value}>{children}</SafetyBalanceContext.Provider>;
}

export function useSafetyBalance() {
  const ctx = useContext(SafetyBalanceContext);
  if (!ctx) {
    throw new Error("useSafetyBalance must be used within SafetyBalanceProvider");
  }
  return ctx;
}
