import RecordingStudio from "@/components/w-studio/RecordingStudio";
import { useProGate } from "@/hooks/use-pro-gate";
import ProGateModal from "@/components/ProGateModal";

const AIStudioPage = () => {
  const { showProModal, gatedFeature, closeProModal, activatePro } = useProGate();

  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-background">
      <RecordingStudio />
      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
    </div>
  );
};

export default AIStudioPage;
