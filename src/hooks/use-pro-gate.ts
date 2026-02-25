import { useState, useCallback } from "react";

// For now, pro status is not yet connected to a real subscription.
// This hook provides the gate UI trigger and a way to check pro status.
export const useProGate = () => {
  const [showProModal, setShowProModal] = useState(false);
  const [gatedFeature, setGatedFeature] = useState<string | undefined>();

  // TODO: Replace with real subscription check
  const isPro = false;

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

  return { isPro, showProModal, gatedFeature, requirePro, closeProModal };
};
