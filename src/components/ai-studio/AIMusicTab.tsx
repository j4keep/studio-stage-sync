import { useState } from "react";
import { Music, Sparkles, Mic } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import AIMusicSettingsSheet from "./AIMusicSettingsSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useProGate } from "@/hooks/use-pro-gate";
import ProGateModal from "@/components/ProGateModal";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import RecordingStudio from "./RecordingStudio";

const MOODS = ["Suggest me", "Happy", "Chill", "Confident", "Sad", "Energetic", "Romantic"];

const AIMusicTab = () => {
  const { user } = useAuth();
  const { isPro, requirePro, showProModal, gatedFeature, closeProModal, activatePro } = useProGate();
  const [studioMode, setStudioMode] = useState<"studio" | "ai">("studio");
  const [mode, setMode] = useState<"description" | "lyrics">("description");
  const [prompt, setPrompt] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [gender, setGender] = useState<string | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCreate = async () => {
    if (!isPro) {
      requirePro("AI Music Generator");
      return;
    }
    if (!prompt.trim()) {
      toast({ title: "Please enter a description or lyrics", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-music", {
        body: {
          prompt: prompt.trim(),
          mode,
          instrumental,
          mood: selectedMood,
          genre,
          gender,
          recording,
        },
      });

      if (error) throw error;

      // Save to database
      if (data?.title && user) {
        await supabase.from("ai_generations" as any).insert({
          user_id: user.id,
          title: data.title,
          lyrics: data.lyrics || null,
          genre: data.genre || null,
          mood: data.mood || null,
          production_notes: data.production_notes || null,
          bpm: data.bpm || null,
          musical_key: data.key || null,
          type: mode === "lyrics" ? "AI Music" : "AI Music",
        } as any);
      }

      toast({ title: "🎵 Song generated!", description: `"${data?.title}" saved to your Library` });
      setPrompt("");
    } catch (e: any) {
      console.error("Generate music error:", e);
      toast({ title: "Generation failed", description: e.message || "Please try again", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Studio/AI Mode Toggle */}
      <div className="bg-card rounded-2xl border border-border p-1 mb-4">
        <div className="flex">
          <button
            onClick={() => setStudioMode("studio")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              studioMode === "studio" ? "bg-foreground text-background" : "text-muted-foreground"
            }`}
          >
            <Mic className="w-4 h-4" /> Recording Studio
          </button>
          <button
            onClick={() => setStudioMode("ai")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              studioMode === "ai" ? "bg-foreground text-background" : "text-muted-foreground"
            }`}
          >
            <Sparkles className="w-4 h-4" /> AI Generate
          </button>
        </div>
      </div>

      {studioMode === "studio" ? (
        <RecordingStudio />
      ) : (
      <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-display font-bold text-foreground">Create Music</h1>
        <button className="px-3 py-1.5 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Pro
        </button>
      </div>

      {/* Mode toggle */}
      <div className="bg-card rounded-2xl border border-border p-1 mb-4">
        <div className="flex">
          <button
            onClick={() => setMode("description")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              mode === "description" ? "bg-foreground text-background" : "text-muted-foreground"
            }`}
          >
            <Music className="w-4 h-4" /> Song description
          </button>
          <button
            onClick={() => setMode("lyrics")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              mode === "lyrics" ? "bg-foreground text-background" : "text-muted-foreground"
            }`}
          >
            ✏️ Lyrics Mode
          </button>
        </div>
      </div>

      {/* Text area */}
      <div className="bg-card rounded-2xl border border-border p-4 mb-4 min-h-[200px]">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            mode === "description"
              ? "A chill pop song about the place where we used to go with my love"
              : "Write your lyrics here...\n\n[Verse 1]\nWalking down the street...\n\n[Chorus]\nWe were young and free..."
          }
          className="bg-transparent border-none resize-none min-h-[180px] text-sm placeholder:text-muted-foreground/60 focus-visible:ring-0 p-0"
        />
      </div>

      {/* Settings & Instrumental */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setShowSettings(true)}
          className="px-4 py-2 rounded-xl bg-card border border-border text-sm font-medium flex items-center gap-2 text-foreground"
        >
          <Sparkles className="w-3.5 h-3.5" /> Settings
        </button>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Instrumental</span>
          <Switch checked={instrumental} onCheckedChange={setInstrumental} />
        </div>
      </div>

      {/* Mood tags */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {MOODS.map((mood) => (
          <button
            key={mood}
            onClick={() => setSelectedMood(selectedMood === mood ? null : mood)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedMood === mood
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground"
            }`}
          >
            {mood === "Suggest me" && "✨ "}{mood}
          </button>
        ))}
      </div>

      {/* Create button */}
      <button
        onClick={handleCreate}
        disabled={isGenerating || !prompt.trim()}
        className="w-full py-3.5 rounded-2xl bg-muted text-foreground font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
      >
        {isGenerating ? (
          <div className="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Music className="w-4 h-4" /> Create
          </>
        )}
      </button>

      <AIMusicSettingsSheet
        open={showSettings}
        onOpenChange={setShowSettings}
        genre={genre}
        setGenre={setGenre}
        gender={gender}
        setGender={setGender}
        recording={recording}
        setRecording={setRecording}
      />

      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
    </div>
  );
};

export default AIMusicTab;
