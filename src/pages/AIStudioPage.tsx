import { useState } from "react";
import { Music, AudioLines, Video, Rewind, Library } from "lucide-react";
import AIMusictab from "@/components/ai-studio/AIMusicTab";
import AICoverTab from "@/components/ai-studio/AICoverTab";
import AIVideoTab from "@/components/ai-studio/AIVideoTab";
import AIReverseTab from "@/components/ai-studio/AIReverseTab";
import AILibraryTab from "@/components/ai-studio/AILibraryTab";
import { useProGate } from "@/hooks/use-pro-gate";
import ProGateModal from "@/components/ProGateModal";

const tabs = [
  { id: "music", label: "W.Studio", icon: Music },
  { id: "cover", label: "AI Cover", icon: AudioLines },
  { id: "video", label: "AI Video", icon: Video },
  { id: "reverse", label: "Reverse", icon: Rewind },
  { id: "library", label: "Library", icon: Library },
] as const;

type TabId = (typeof tabs)[number]["id"];

const AIStudioPage = () => {
  const [activeTab, setActiveTab] = useState<TabId>("music");
  const { isPro, showProModal, gatedFeature, requirePro, closeProModal, activatePro } = useProGate();

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex-1 overflow-y-auto">
        {activeTab === "music" && <AIMusictab />}
        {activeTab === "cover" && <AICoverTab />}
        {activeTab === "video" && <AIVideoTab />}
        {activeTab === "reverse" && <AIReverseTab />}
        {activeTab === "library" && <AILibraryTab />}
      </div>

      {/* Sub-tab navigation */}
      <div className="border-t border-border bg-background/90 backdrop-blur-xl">
        <div className="flex items-center justify-around py-2 px-1 max-w-lg mx-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all duration-200 ${
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "drop-shadow-[0_0_8px_hsl(204,100%,50%,0.6)]" : ""}`} />
                <span className={`text-[10px] font-medium ${isActive ? "text-glow" : ""}`}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
    </div>
  );
};

export default AIStudioPage;
