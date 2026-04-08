import { useState, useCallback } from "react";
import { usePersistedState } from "./use-persisted-state";

/**
 * When false, all Pro checks pass and subscription UI stays off. Flip to true when billing gates return.
 */
export const PRO_GATES_ENABLED = false;

export const useProGate = () => {
  const [showProModal, setShowProModal] = useState(false);
  const [gatedFeature, setGatedFeature] = useState<string | undefined>();
  const [isProStored, setIsProStored] = usePersistedState<boolean>("wheuat_pro_status", false);
  const isPro = PRO_GATES_ENABLED ? isProStored : true;

  const requirePro = useCallback(
    (featureName: string, onAllowed?: () => void) => {
      if (isPro) {
        onAllowed?.();
        return true;
      }
      setGatedFeature(featureName);
      setShowProModal(true);
      return false;
    },
    [isPro],
  );

  const closeProModal = useCallback(() => {
    setShowProModal(false);
    setGatedFeature(undefined);
  }, []);

  const activatePro = useCallback(() => {
    setIsProStored(true);
    setShowProModal(false);
    setGatedFeature(undefined);
  }, [setIsProStored]);

  const deactivatePro = useCallback(() => {
    if (PRO_GATES_ENABLED) setIsProStored(false);
  }, [setIsProStored]);

  return {
    isPro,
    showProModal: PRO_GATES_ENABLED ? showProModal : false,
    gatedFeature: PRO_GATES_ENABLED ? gatedFeature : undefined,
    requirePro,
    closeProModal,
    activatePro,
    deactivatePro,
  };
};
