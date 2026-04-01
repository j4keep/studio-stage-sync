import RecordingStudio from "@/components/w-studio/RecordingStudio";
import { useProGate } from "@/hooks/use-pro-gate";
import ProGateModal from "@/components/ProGateModal";

const AIStudioPage = () => {
  const { showProModal, gatedFeature, closeProModal, activatePro } = useProGate();

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#1a1a1a]">
      <RecordingStudio />
      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
    </div>
  );
};

export default AIStudioPage;
