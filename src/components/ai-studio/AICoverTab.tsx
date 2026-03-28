import { useState } from "react";
import { Search, Plus, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useProGate } from "@/hooks/use-pro-gate";
import ProGateModal from "@/components/ProGateModal";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const VOICE_CATEGORIES = ["All", "My Voices", "Cartoon", "Famous", "Custom"];

const SAMPLE_VOICES = [
  { id: "create", name: "Create Voice", image: null, isCreate: true },
  { id: "v1", name: "Deep Voice", image: null, isCreate: false },
  { id: "v2", name: "Smooth R&B", image: null, isCreate: false },
  { id: "v3", name: "Rock Edge", image: null, isCreate: false },
  { id: "v4", name: "Pop Star", image: null, isCreate: false },
  { id: "v5", name: "Hip Hop", image: null, isCreate: false },
  { id: "v6", name: "Soul Singer", image: null, isCreate: false },
  { id: "v7", name: "Country", image: null, isCreate: false },
];

const AICoverTab = () => {
  const { isPro, requirePro, showProModal, gatedFeature, closeProModal, activatePro } = useProGate();
  const [songQuery, setSongQuery] = useState("");
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [voiceSearch, setVoiceSearch] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCreate = async () => {
    if (!isPro) {
      requirePro("AI Cover");
      return;
    }
    if (!songQuery.trim()) {
      toast({ title: "Please enter a song link or search", variant: "destructive" });
      return;
    }
    if (!selectedVoice) {
      toast({ title: "Please select a voice", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-music", {
        body: {
          prompt: `Create an AI cover of: ${songQuery}`,
          mode: "cover",
          voiceId: selectedVoice,
        },
      });
      if (error) throw error;
      toast({ title: "🎤 AI Cover created!", description: "Check your library" });
    } catch (e: any) {
      toast({ title: "Cover generation failed", description: e.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-display font-bold text-foreground">Create AI Cover</h1>
        <button className="px-3 py-1.5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> 3/3
        </button>
      </div>

      {/* Pick a song */}
      <div className="mb-6">
        <h2 className="text-base font-bold text-foreground mb-1">Pick a song</h2>
        <p className="text-xs text-muted-foreground mb-3">
          First, choose a song from YouTube that you would like to make a cover for.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={songQuery}
            onChange={(e) => setSongQuery(e.target.value)}
            placeholder="Search on YouTube or paste a link"
            className="pl-9 bg-card border-border rounded-xl"
          />
        </div>
      </div>

      {/* Voices */}
      <div className="mb-6">
        <h2 className="text-base font-bold text-foreground mb-1">Voices</h2>
        <p className="text-xs text-muted-foreground mb-3">Then, choose a voice for the voiceover.</p>

        {/* Category pills */}
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={voiceSearch}
              onChange={(e) => setVoiceSearch(e.target.value)}
              placeholder="Search"
              className="pl-8 pr-3 py-1.5 rounded-full bg-card border border-border text-xs w-24 text-foreground"
            />
          </div>
          {VOICE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeCategory === cat
                  ? "bg-foreground text-background"
                  : "bg-card border border-border text-muted-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Voice grid */}
        <div className="grid grid-cols-4 gap-3">
          {SAMPLE_VOICES.map((voice) => (
            <button
              key={voice.id}
              onClick={() => {
                if (voice.isCreate) {
                  toast({ title: "Voice cloning coming soon!" });
                } else {
                  setSelectedVoice(selectedVoice === voice.id ? null : voice.id);
                }
              }}
              className="flex flex-col items-center gap-1.5"
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                voice.isCreate
                  ? "bg-card border-2 border-dashed border-border"
                  : selectedVoice === voice.id
                    ? "ring-2 ring-primary bg-primary/10"
                    : "bg-card border border-border"
              }`}>
                {voice.isCreate ? (
                  <Plus className="w-6 h-6 text-muted-foreground" />
                ) : (
                  <span className="text-2xl">🎙️</span>
                )}
              </div>
              <span className="text-[10px] text-foreground font-medium truncate w-full text-center">{voice.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Create button */}
      <button
        onClick={handleCreate}
        disabled={isGenerating}
        className="w-full py-3.5 rounded-2xl bg-muted text-foreground font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isGenerating ? (
          <div className="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
        ) : (
          "Create AI Cover"
        )}
      </button>

      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
    </div>
  );
};

export default AICoverTab;
