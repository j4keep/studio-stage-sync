import { useState } from "react";
import { motion } from "framer-motion";
import { Palette, Check, Upload, X, Info } from "lucide-react";
import { useTheme, THEME_PRESETS } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";

interface ThemePickerSheetProps {
  isOnboarding?: boolean;
  onComplete?: () => void;
}

const ThemePickerSheet = ({ isOnboarding = false, onComplete }: ThemePickerSheetProps) => {
  const { currentPreset, customAccent, backgroundImageUrl, setThemePreset, setCustomAccent, setBackgroundImage, saveThemeToProfile } = useTheme();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [customHue, setCustomHue] = useState(204);

  const handlePresetSelect = (presetId: string) => {
    setThemePreset(presetId);
    setCustomAccent(null);
  };

  const handleCustomHueChange = (hue: number) => {
    setCustomHue(hue);
    setCustomAccent(`${hue} 80% 55%`);
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB for background images.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setBackgroundImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    await saveThemeToProfile();
    setSaving(false);
    toast({ title: "Theme saved!", description: "Your custom theme has been applied." });
    onComplete?.();
  };

  return (
    <div className={`w-full flex flex-col ${isOnboarding ? "" : ""}`}>
      {isOnboarding && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center glow-primary mb-4">
            <Palette className="w-7 h-7 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-1">Choose Your Vibe</h2>
          <p className="text-sm text-muted-foreground text-center">Pick a theme color for your WHEUAT experience</p>
        </motion.div>
      )}

      {/* Preset Colors */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Color Presets</p>
      <div className="grid grid-cols-3 gap-2 mb-5">
        {THEME_PRESETS.map((preset) => {
          const isSelected = currentPreset === preset.id && !customAccent;
          return (
            <button
              key={preset.id}
              onClick={() => handlePresetSelect(preset.id)}
              className={`relative p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                isSelected ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div
                className="w-10 h-10 rounded-full"
                style={{ background: preset.gradient }}
              />
              <span className="text-[10px] font-medium text-foreground">{preset.label}</span>
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-primary-foreground" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Custom Color Picker */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Custom Color</p>
      <div className="p-3 rounded-xl bg-card border border-border mb-5">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-8 h-8 rounded-lg border border-border"
            style={{ backgroundColor: `hsl(${customAccent || `${customHue} 80% 55%`})` }}
          />
          <span className="text-xs text-muted-foreground">Drag to pick your color</span>
        </div>
        <input
          type="range"
          min={0}
          max={360}
          value={customHue}
          onChange={(e) => handleCustomHueChange(Number(e.target.value))}
          className="w-full h-3 rounded-full appearance-none cursor-pointer"
          style={{
            background: "linear-gradient(to right, hsl(0 80% 55%), hsl(60 80% 55%), hsl(120 80% 55%), hsl(180 80% 55%), hsl(240 80% 55%), hsl(300 80% 55%), hsl(360 80% 55%))",
          }}
        />
      </div>

      {/* Background Image */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Background Image (Optional)</p>
      <div className="p-3 rounded-xl bg-card border border-border mb-5">
        {backgroundImageUrl ? (
          <div className="relative">
            <img src={backgroundImageUrl} alt="Background" className="w-full h-24 rounded-lg object-cover" />
            <button
              onClick={() => setBackgroundImage(null)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center"
            >
              <X className="w-3 h-3 text-white" />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center gap-2 py-4 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
            <Upload className="w-5 h-5" />
            <span className="text-xs">Upload a background image</span>
            <input type="file" accept="image/*" onChange={handleBgUpload} className="hidden" />
          </label>
        )}
      </div>

      {/* Info note */}
      {isOnboarding && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 mb-5">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            You can change your theme anytime in <span className="text-primary font-semibold">Settings → Appearance</span>
          </p>
        </div>
      )}

      {/* Save / Continue */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-sm glow-primary disabled:opacity-50"
      >
        {saving ? "Saving..." : isOnboarding ? "Continue to WHEUAT" : "Save Theme"}
      </button>

      {isOnboarding && (
        <button
          onClick={() => { onComplete?.(); }}
          className="w-full py-2.5 mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      )}
    </div>
  );
};

export default ThemePickerSheet;
