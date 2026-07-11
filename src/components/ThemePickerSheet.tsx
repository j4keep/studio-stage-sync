import { useState } from "react";
import { motion } from "framer-motion";
import { Palette, Check, Info, Flag } from "lucide-react";
import { useTheme, THEME_PRESETS } from "@/contexts/ThemeContext";
import { useToast } from "@/hooks/use-toast";
import { FLAG_THEMES } from "@/lib/flag-themes";
import Flag3D from "@/components/Flag3D";

interface ThemePickerSheetProps {
  isOnboarding?: boolean;
  onComplete?: () => void;
}

const ThemePickerSheet = ({ isOnboarding = false, onComplete }: ThemePickerSheetProps) => {
  const {
    currentPreset,
    customAccent,
    countryFlag,
    setThemePreset,
    setCustomAccent,
    setCountryFlag,
    saveThemeToProfile,
  } = useTheme();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [customHue, setCustomHue] = useState(204);
  const [tab, setTab] = useState<"theme" | "flag">("theme");

  const handlePresetSelect = (presetId: string) => {
    setThemePreset(presetId);
    setCustomAccent(null);
  };

  const handleCustomHueChange = (hue: number) => {
    setCustomHue(hue);
    setCustomAccent(`${hue} 80% 55%`);
  };

  const handleSave = async () => {
    setSaving(true);
    await saveThemeToProfile();
    setSaving(false);
    toast({ title: "Saved!", description: "Your theme and flag are applied." });
    onComplete?.();
  };

  return (
    <div className="w-full flex flex-col">
      {isOnboarding && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center glow-primary mb-4">
            <Palette className="w-7 h-7 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-1">Choose Your Vibe</h2>
          <p className="text-sm text-muted-foreground text-center">Pick a theme color for your JHi experience</p>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted mb-4">
        <button
          onClick={() => setTab("theme")}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            tab === "theme" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          Theme Color
        </button>
        <button
          onClick={() => setTab("flag")}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            tab === "flag" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Flag className="w-3.5 h-3.5" />
          Flag Background
        </button>
      </div>

      {tab === "theme" ? (
        <>
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
                  <div className="w-10 h-10 rounded-full" style={{ background: preset.gradient }} />
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
        </>
      ) : (
        <>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Represent Your Flag
          </p>
          <p className="text-[11px] text-muted-foreground mb-3">
            Sets your feed page background. Pick your country or identity flag.
          </p>

          <button
            onClick={() => setCountryFlag(null)}
            className={`w-full mb-3 p-2.5 rounded-xl border text-xs font-semibold ${
              !countryFlag ? "border-primary bg-primary/10 text-foreground" : "border-border bg-card text-muted-foreground"
            }`}
          >
            None (black background)
          </button>

          <div className="grid grid-cols-3 gap-2 max-h-[50vh] overflow-y-auto scrollbar-hide pr-1">
            {FLAG_THEMES.map((flag) => {
              const isSelected = countryFlag === flag.id;
              return (
                <button
                  key={flag.id}
                  onClick={() => setCountryFlag(flag.id)}
                  className={`relative p-2 rounded-xl border transition-all flex flex-col items-center gap-1.5 ${
                    isSelected ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <Flag3D flag={flag} variant="thumb" className="w-full" />
                  <span className="text-[10px] font-medium text-foreground text-center leading-tight truncate w-full">
                    {flag.emoji} {flag.label}
                  </span>
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {isOnboarding && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20 mt-4 mb-3">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Change these anytime in <span className="text-primary font-semibold">Settings → Appearance</span>
          </p>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 mt-4 rounded-xl gradient-primary text-primary-foreground font-display font-bold text-sm glow-primary disabled:opacity-50"
      >
        {saving ? "Saving..." : isOnboarding ? "Continue to JHi" : "Save"}
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
