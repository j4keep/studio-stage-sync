import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ThemePreset {
  id: string;
  label: string;
  accent: string; // HSL values like "204 100% 50%"
  gradient: string; // CSS gradient
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: "default", label: "Electric Blue", accent: "204 100% 50%", gradient: "linear-gradient(135deg, hsl(204 100% 50%), hsl(220 100% 60%))" },
  { id: "violet", label: "Violet Storm", accent: "270 80% 60%", gradient: "linear-gradient(135deg, hsl(270 80% 60%), hsl(290 80% 50%))" },
  { id: "emerald", label: "Emerald Wave", accent: "160 84% 39%", gradient: "linear-gradient(135deg, hsl(160 84% 39%), hsl(140 70% 45%))" },
  { id: "rose", label: "Rose Gold", accent: "350 80% 60%", gradient: "linear-gradient(135deg, hsl(350 80% 60%), hsl(20 80% 55%))" },
  { id: "amber", label: "Sunset Amber", accent: "38 92% 50%", gradient: "linear-gradient(135deg, hsl(38 92% 50%), hsl(20 90% 48%))" },
  { id: "crimson", label: "Crimson Fire", accent: "0 72% 51%", gradient: "linear-gradient(135deg, hsl(0 72% 51%), hsl(330 80% 50%))" },
];

interface ThemeContextType {
  currentPreset: string;
  customAccent: string | null;
  backgroundImageUrl: string | null;
  setThemePreset: (presetId: string) => void;
  setCustomAccent: (hsl: string | null) => void;
  setBackgroundImage: (url: string | null) => void;
  saveThemeToProfile: () => Promise<void>;
  themeSetupDone: boolean | null;
}

const ThemeContext = createContext<ThemeContextType>({
  currentPreset: "default",
  customAccent: null,
  backgroundImageUrl: null,
  setThemePreset: () => {},
  setCustomAccent: () => {},
  setBackgroundImage: () => {},
  saveThemeToProfile: async () => {},
  themeSetupDone: null,
});

export const useTheme = () => useContext(ThemeContext);

function applyAccentColor(hsl: string) {
  const root = document.documentElement;
  root.style.setProperty("--primary", hsl);
  root.style.setProperty("--accent", hsl);
  root.style.setProperty("--ring", hsl);
  root.style.setProperty("--sidebar-primary", hsl);
  root.style.setProperty("--sidebar-ring", hsl);

  // Update glow and gradient
  root.style.setProperty("--glow-primary", `0 0 20px hsl(${hsl} / 0.4)`);
  root.style.setProperty("--glow-primary-strong", `0 0 30px hsl(${hsl} / 0.6)`);

  // Parse hue for gradient secondary
  const hue = parseInt(hsl.split(" ")[0]) || 204;
  const gradientEnd = `hsl(${hue + 16} 100% 60%)`;
  root.style.setProperty("--gradient-primary", `linear-gradient(135deg, hsl(${hsl}), ${gradientEnd})`);
}

function applyBackgroundImage(url: string | null) {
  const appRoot = document.getElementById("app-bg-layer");
  if (appRoot) {
    if (url) {
      appRoot.style.backgroundImage = `url(${url})`;
      appRoot.style.backgroundSize = "cover";
      appRoot.style.backgroundPosition = "center";
      appRoot.style.backgroundAttachment = "fixed";
    } else {
      appRoot.style.backgroundImage = "";
    }
  }
}

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [currentPreset, setCurrentPreset] = useState("default");
  const [customAccent, setCustomAccentState] = useState<string | null>(null);
  const [backgroundImageUrl, setBgUrl] = useState<string | null>(null);
  const [themeSetupDone, setThemeSetupDone] = useState<boolean | null>(null);

  // Load theme from profile
  useEffect(() => {
    if (!user) {
      setThemeSetupDone(null);
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("theme_preset, custom_accent_color, background_image_url")
        .eq("user_id", user.id)
        .single();

      if (data) {
        const preset = data.theme_preset || "default";
        setCurrentPreset(preset);
        setCustomAccentState(data.custom_accent_color || null);
        setBgUrl(data.background_image_url || null);

        // Apply
        if (data.custom_accent_color) {
          applyAccentColor(data.custom_accent_color);
        } else {
          const found = THEME_PRESETS.find(p => p.id === preset);
          if (found) applyAccentColor(found.accent);
        }
        applyBackgroundImage(data.background_image_url || null);

        // If theme_preset is still 'default' and no custom color, user hasn't set up
        setThemeSetupDone(preset !== "default" || !!data.custom_accent_color || !!data.background_image_url);
      } else {
        setThemeSetupDone(false);
      }
    };
    load();
  }, [user]);

  const setThemePreset = useCallback((presetId: string) => {
    setCurrentPreset(presetId);
    setCustomAccentState(null);
    const found = THEME_PRESETS.find(p => p.id === presetId);
    if (found) applyAccentColor(found.accent);
  }, []);

  const setCustomAccent = useCallback((hsl: string | null) => {
    setCustomAccentState(hsl);
    if (hsl) applyAccentColor(hsl);
  }, []);

  const setBackgroundImage = useCallback((url: string | null) => {
    setBgUrl(url);
    applyBackgroundImage(url);
  }, []);

  const saveThemeToProfile = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({
        theme_preset: currentPreset,
        custom_accent_color: customAccent,
        background_image_url: backgroundImageUrl,
      })
      .eq("user_id", user.id);
    setThemeSetupDone(true);
  }, [user, currentPreset, customAccent, backgroundImageUrl]);

  return (
    <ThemeContext.Provider value={{
      currentPreset,
      customAccent,
      backgroundImageUrl,
      setThemePreset,
      setCustomAccent,
      setBackgroundImage,
      saveThemeToProfile,
      themeSetupDone,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
