import { ReactNode, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useSafetyBalance } from "@/hooks/useSafetyBalance";
import {
  getSocialLockReason,
  isSocialConsumptionPath,
  isUtilityAllowedDuringSocialLock,
} from "@/lib/safety-balance";
import SocialBalanceLockScreen from "./SocialBalanceLockScreen";
import ContinuousUseReminder from "./ContinuousUseReminder";

/**
 * Replaces legacy BreakGuard: enforces detox, quiet hours, and daily social limit
 * on consumption-heavy routes while leaving utility surfaces open.
 */
const SocialBalanceGuard = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const {
    policy,
    continuousMinutes,
    showContinuousReminder,
    dismissReminder,
    takeBreakFromReminder,
  } = useSafetyBalance();

  const lock = useMemo(() => {
    if (!isSocialConsumptionPath(pathname)) return null;
    if (isUtilityAllowedDuringSocialLock(pathname)) return null;
    return getSocialLockReason(policy);
  }, [pathname, policy]);

  if (lock) {
    return (
      <SocialBalanceLockScreen
        reason={lock}
        quietEnd={policy?.quiet_hours_end}
        limitMinutes={policy?.daily_social_limit_minutes}
      />
    );
  }

  return (
    <>
      {children}
      {showContinuousReminder && (
        <ContinuousUseReminder
          minutes={policy?.continuous_reminder_minutes || continuousMinutes}
          onContinue={dismissReminder}
          onBreak={() => void takeBreakFromReminder()}
        />
      )}
    </>
  );
};

export default SocialBalanceGuard;
