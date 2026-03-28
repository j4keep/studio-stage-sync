import { useState, useRef } from "react";
import { Mic, Square, RotateCcw, Download, Save, Upload, Sliders, Music, Volume2, Gauge } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useStudioEngine, EffectsState, MixerState } from "@/hooks/use-studio-engine";
import { useAuth } from "@/contexts/AuthContext";
import { useProGate } from "@/hooks/use-pro-gate";
import ProGateModal from "@/components/ProGateModal";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Panel = "effects" | "mixer" | null;

const RecordingStudio = () => {
  const { user } = useAuth();
  const { isPro, requirePro, showProModal, gatedFeature, closeProModal, activatePro } = useProGate();
  const engine = useStudioEngine();
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [trackName, setTrackName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBeatUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    engine.loadBeat(file);
    if (!trackName) setTrackName(file.name.replace(/\.[^.]+$/, ""));
  };

  const handleRecord = async () => {
    if (!isPro) { requirePro("Recording Studio"); return; }
    try {
      await engine.startRecording();
    } catch {
      toast({ title: "Microphone access required", description: "Please allow mic access to record.", variant: "destructive" });
    }
  };

  const handleExport = () => {
    const file = engine.getExportFile();
    if (!file) return;
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${trackName || "studio-mix"}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "📥 Exported!", description: `${trackName || "studio-mix"}.webm downloaded` });
  };

  const handleSaveToLibrary = async () => {
    if (!user || !engine.mixedBlob) return;
    try {
      await supabase.from("ai_generations" as any).insert({
        user_id: user.id,
        title: trackName || "Studio Recording",
        type: "Studio Recording",
        genre: null,
        mood: null,
        production_notes: "Recorded in Studio with effects",
      } as any);
      toast({ title: "💾 Saved to Library!", description: `"${trackName || "Studio Recording"}" added` });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
  };

  const updateEffect = <K extends keyof EffectsState>(key: K, value: EffectsState[K]) => {
    engine.setEffects(prev => ({ ...prev, [key]: value }));
  };

  const updateMixer = <K extends keyof MixerState>(key: K, value: MixerState[K]) => {
    engine.setMixer(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-display font-bold text-foreground">Recording Studio</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setActivePanel(activePanel === "effects" ? null : "effects")}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${
              activePanel === "effects" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> FX
          </button>
          <button
            onClick={() => setActivePanel(activePanel === "mixer" ? null : "mixer")}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${
              activePanel === "mixer" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"
            }`}
          >
            <Gauge className="w-3.5 h-3.5" /> Mix
          </button>
        </div>
      </div>

      {/* Beat Upload */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.flac,.aac,.m4a"
          className="hidden"
          onChange={handleBeatUpload}
        />
        {!engine.beatFile ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-8 border-2 border-dashed border-border rounded-xl flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
          >
            <Upload className="w-8 h-8" />
            <span className="text-sm font-medium">Upload your beat / instrumental</span>
            <span className="text-[10px]">MP3, WAV, OGG, FLAC supported</span>
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Music className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{engine.beatFile.name}</p>
              <p className="text-[10px] text-muted-foreground">{(engine.beatFile.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="text-[10px] text-primary font-bold">Change</button>
          </div>
        )}
      </div>

      {/* Track Name */}
      {engine.beatFile && (
        <input
          value={trackName}
          onChange={e => setTrackName(e.target.value)}
          placeholder="Track name..."
          className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      )}

      {/* Recording Indicator */}
      {engine.state === "recording" && (
        <div className="flex items-center justify-center gap-3 py-4 bg-red-500/10 rounded-2xl border border-red-500/30">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-lg font-bold text-red-500 font-mono">{engine.formatTime(engine.elapsed)}</span>
        </div>
      )}

      {/* Preview */}
      {engine.state === "recorded" && engine.mixedUrl && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <p className="text-xs font-bold text-foreground">🎧 Preview your mix</p>
          <audio src={engine.mixedUrl} controls className="w-full h-10" />
        </div>
      )}

      {/* Effects Panel */}
      {activePanel === "effects" && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-4 animate-in slide-in-from-top-2">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-primary" /> Effects Rack
          </h3>

          {/* EQ */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">3-Band EQ</p>
            {([["Low", "eqLow", 320], ["Mid", "eqMid", 1000], ["High", "eqHigh", 3200]] as const).map(([label, key, freq]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-8">{label}</span>
                <Slider value={[engine.effects[key]]} onValueChange={v => updateEffect(key, v[0])} min={-12} max={12} step={0.5} className="flex-1" />
                <span className="text-[10px] font-mono text-primary w-10 text-right">{engine.effects[key] > 0 ? "+" : ""}{engine.effects[key]}dB</span>
              </div>
            ))}
          </div>

          {/* Auto-Tune / Pitch */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Pitch Shift (Auto-Tune)</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-8">Pitch</span>
              <Slider value={[engine.effects.pitchShift]} onValueChange={v => updateEffect("pitchShift", v[0])} min={-12} max={12} step={1} className="flex-1" />
              <span className="text-[10px] font-mono text-primary w-10 text-right">{engine.effects.pitchShift > 0 ? "+" : ""}{engine.effects.pitchShift}st</span>
            </div>
          </div>

          {/* Reverb */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Reverb</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-8">Mix</span>
              <Slider value={[engine.effects.reverbMix]} onValueChange={v => updateEffect("reverbMix", v[0])} min={0} max={100} step={1} className="flex-1" />
              <span className="text-[10px] font-mono text-primary w-8 text-right">{engine.effects.reverbMix}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-8">Decay</span>
              <Slider value={[engine.effects.reverbDecay]} onValueChange={v => updateEffect("reverbDecay", v[0])} min={0.1} max={5} step={0.1} className="flex-1" />
              <span className="text-[10px] font-mono text-primary w-8 text-right">{engine.effects.reverbDecay}s</span>
            </div>
          </div>

          {/* Delay */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Delay</p>
            {([["Time", "delayTime", 0, 1, 0.01, "s"], ["Feedback", "delayFeedback", 0, 90, 1, "%"], ["Mix", "delayMix", 0, 100, 1, "%"]] as const).map(([label, key, min, max, step, unit]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-12">{label}</span>
                <Slider value={[engine.effects[key]]} onValueChange={v => updateEffect(key, v[0])} min={min} max={max} step={step} className="flex-1" />
                <span className="text-[10px] font-mono text-primary w-10 text-right">{engine.effects[key]}{unit}</span>
              </div>
            ))}
          </div>

          {/* Compressor */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Compressor</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-12">Thresh</span>
              <Slider value={[engine.effects.compThreshold]} onValueChange={v => updateEffect("compThreshold", v[0])} min={-60} max={0} step={1} className="flex-1" />
              <span className="text-[10px] font-mono text-primary w-10 text-right">{engine.effects.compThreshold}dB</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-12">Ratio</span>
              <Slider value={[engine.effects.compRatio]} onValueChange={v => updateEffect("compRatio", v[0])} min={1} max={20} step={0.5} className="flex-1" />
              <span className="text-[10px] font-mono text-primary w-10 text-right">{engine.effects.compRatio}:1</span>
            </div>
          </div>

          <button onClick={() => engine.setEffects(engine.DEFAULT_EFFECTS)} className="text-[10px] text-primary font-bold">Reset All Effects</button>
        </div>
      )}

      {/* Mixer Panel */}
      {activePanel === "mixer" && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-4 animate-in slide-in-from-top-2">
          <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-primary" /> Mixing Console
          </h3>

          {/* Beat channel */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Beat Track</p>
            <div className="flex items-center gap-2">
              <Volume2 className="w-3 h-3 text-muted-foreground" />
              <Slider value={[engine.mixer.beatVolume]} onValueChange={v => updateMixer("beatVolume", v[0])} min={0} max={100} step={1} className="flex-1" />
              <span className="text-[10px] font-mono text-primary w-8 text-right">{engine.mixer.beatVolume}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-6">Pan</span>
              <Slider value={[engine.mixer.beatPan]} onValueChange={v => updateMixer("beatPan", v[0])} min={-100} max={100} step={1} className="flex-1" />
              <span className="text-[10px] font-mono text-primary w-8 text-right">{engine.mixer.beatPan > 0 ? "R" : engine.mixer.beatPan < 0 ? "L" : "C"}{engine.mixer.beatPan !== 0 ? Math.abs(engine.mixer.beatPan) : ""}</span>
            </div>
          </div>

          {/* Vocal channel */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Vocal Track</p>
            <div className="flex items-center gap-2">
              <Mic className="w-3 h-3 text-muted-foreground" />
              <Slider value={[engine.mixer.vocalVolume]} onValueChange={v => updateMixer("vocalVolume", v[0])} min={0} max={100} step={1} className="flex-1" />
              <span className="text-[10px] font-mono text-primary w-8 text-right">{engine.mixer.vocalVolume}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-6">Pan</span>
              <Slider value={[engine.mixer.vocalPan]} onValueChange={v => updateMixer("vocalPan", v[0])} min={-100} max={100} step={1} className="flex-1" />
              <span className="text-[10px] font-mono text-primary w-8 text-right">{engine.mixer.vocalPan > 0 ? "R" : engine.mixer.vocalPan < 0 ? "L" : "C"}{engine.mixer.vocalPan !== 0 ? Math.abs(engine.mixer.vocalPan) : ""}</span>
            </div>
          </div>

          {/* Master */}
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">Master Output</p>
            <div className="flex items-center gap-2">
              <Volume2 className="w-3 h-3 text-primary" />
              <Slider value={[engine.mixer.masterVolume]} onValueChange={v => updateMixer("masterVolume", v[0])} min={0} max={100} step={1} className="flex-1" />
              <span className="text-[10px] font-mono text-primary w-8 text-right">{engine.mixer.masterVolume}%</span>
            </div>
          </div>

          <button onClick={() => engine.setMixer(engine.DEFAULT_MIXER)} className="text-[10px] text-primary font-bold">Reset Mixer</button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        {engine.state === "loaded" && (
          <button
            onClick={handleRecord}
            className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all hover:bg-red-600"
          >
            <Mic className="w-4 h-4" /> Start Recording
          </button>
        )}

        {engine.state === "recording" && (
          <button
            onClick={engine.stopRecording}
            className="flex-1 py-3.5 rounded-2xl bg-red-500 text-white font-bold text-sm flex items-center justify-center gap-2 animate-pulse"
          >
            <Square className="w-4 h-4" /> Stop
          </button>
        )}

        {engine.state === "recorded" && (
          <>
            <button
              onClick={engine.resetRecording}
              className="flex-1 py-3 rounded-2xl bg-muted text-muted-foreground font-bold text-xs flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Re-record
            </button>
            <button
              onClick={handleExport}
              className="flex-1 py-3 rounded-2xl bg-card border border-border text-foreground font-bold text-xs flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
            <button
              onClick={handleSaveToLibrary}
              className="flex-1 py-3 rounded-2xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Library
            </button>
          </>
        )}
      </div>

      {/* Idle state hint */}
      {engine.state === "idle" && (
        <p className="text-center text-[10px] text-muted-foreground py-4">
          Upload a beat above, set your effects & mixer levels, then hit record. Your mic captures vocals live over the beat — like a real studio session. 🎙️
        </p>
      )}

      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
    </div>
  );
};

export default RecordingStudio;
