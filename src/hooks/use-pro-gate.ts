import { useState, useCallback } from "react";
import { usePersistedState } from "./use-persisted-state";

export const useProGate = () => {
  const [showProModal, setShowProModal] = useState(false);
  const [gatedFeature, setGatedFeature] = useState<string | undefined>();
  const [isPro, setIsPro] = usePersistedState<boolean>("wheuat_pro_status", false);

  const requirePro = useCallback((featureName: string, onAllowed?: () => void) => {
    if (isPro) {
      onAllowed?.();
      return true;
    }
    setGatedFeature(featureName);
    setShowProModal(true);
    return false;
  }, [isPro]);

  const closeProModal = useCallback(() => {
    setShowProModal(false);
    setGatedFeature(undefined);
  }, []);

  const activatePro = useCallback(() => {
    setIsPro(true);
    setShowProModal(false);
    setGatedFeature(undefined);
  }, [setIsPro]);

  const deactivatePro = useCallback(() => {
    setIsPro(false);
  }, [setIsPro]);

  return { isPro, showProModal, gatedFeature, requirePro, closeProModal, activatePro, deactivatePro };
};
