import { useState } from "react";
import { Rewind, Upload, Music } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useProGate } from "@/hooks/use-pro-gate";
import ProGateModal from "@/components/ProGateModal";

const AIReverseTab = () => {
  const { isPro, requirePro, showProModal, gatedFeature, closeProModal, activatePro } = useProGate();

  const handleReverse = () => {
    if (!isPro) {
      requirePro("AI Reverse");
      return;
    }
    toast({ title: "Reverse audio feature coming soon!" });
  };

  return (
    <div className="px-4 pt-4 pb-4">
      <h1 className="text-xl font-display font-bold text-foreground mb-2">Reverse Audio</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Upload a song and reverse it to create unique audio effects and hidden messages.
      </p>

      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-24 h-24 rounded-full bg-card border-2 border-dashed border-border flex items-center justify-center mb-4">
          <Rewind className="w-10 h-10 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mb-6 text-center max-w-[240px]">
          Upload an audio file to reverse it and hear it backwards
        </p>
        <button
          onClick={handleReverse}
          className="px-6 py-3 rounded-2xl bg-card border border-border text-foreground font-bold flex items-center gap-2"
        >
          <Upload className="w-4 h-4" /> Upload Audio
        </button>
      </div>

      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
    </div>
  );
};

export default AIReverseTab;
