import { Outlet } from "react-router-dom";
import { SessionProvider } from "./session/SessionContext";
import { useProGate } from "@/hooks/use-pro-gate";
import ProGateModal from "@/components/ProGateModal";

/** Full-viewport shell for remote session flows (no DAW). */
export function WStudioLayout() {
  const { showProModal, gatedFeature, closeProModal, activatePro } = useProGate();

  return (
    <SessionProvider>
      <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
        <Outlet />
      </div>
      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
    </SessionProvider>
  );
}
