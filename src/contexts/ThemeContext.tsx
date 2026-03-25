import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ThemePreset {
  id: string;
  label: string;
  accent: string;
  gradient: string;
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
  setThemePreset: (presetId: string) => void;
  setCustomAccent: (hsl: string | null) => void;
  saveThemeToProfile: () => Promise<void>;
  themeSetupDone: boolean | null;
}

const ThemeContext = createContext<ThemeContextType>({
  currentPreset: "default",
  customAccent: null,
  setThemePreset: () => {},
  setCustomAccent: () => {},
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

  root.style.setProperty("--glow-primary", `0 0 20px hsl(${hsl} / 0.4)`);
  root.style.setProperty("--glow-primary-strong", `0 0 30px hsl(${hsl} / 0.6)`);

  const hue = parseInt(hsl.split(" ")[0]) || 204;
  const gradientEnd = `hsl(${hue + 16} 100% 60%)`;
  root.style.setProperty("--gradient-primary", `linear-gradient(135deg, hsl(${hsl}), ${gradientEnd})`);
}

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [currentPreset, setCurrentPreset] = useState("default");
  const [customAccent, setCustomAccentState] = useState<string | null>(null);
  const [themeSetupDone, setThemeSetupDone] = useState<boolean | null>(() => {
    // If localStorage says done, never show onboarding again
    return localStorage.getItem("wheuat_theme_setup_done") ? true : null;
  });

  // Load theme from profile
  useEffect(() => {
    if (!user) {
      setThemeSetupDone(prev => prev === true ? true : null);
      return;
    }

    let isActive = true;

    const load = async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("theme_preset, custom_accent_color")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!isActive) return;

        if (data) {
          const preset = data.theme_preset || "default";
          setCurrentPreset(preset);
          setCustomAccentState(data.custom_accent_color || null);

          if (data.custom_accent_color) {
            applyAccentColor(data.custom_accent_color);
          } else {
            const found = THEME_PRESETS.find(p => p.id === preset);
            if (found) applyAccentColor(found.accent);
          }

          localStorage.setItem("wheuat_theme_setup_done", "true");
          setThemeSetupDone(true);
          return;
        }

        setThemeSetupDone(false);
      } catch {
        if (!isActive) return;
        setThemeSetupDone(false);
      }
    };

    load();

    return () => {
      isActive = false;
    };
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

  const saveThemeToProfile = useCallback(async () => {
    if (!user) return;
    await supabase
      .from("profiles")
      .update({
        theme_preset: currentPreset,
        custom_accent_color: customAccent,
      })
      .eq("user_id", user.id);
    localStorage.setItem("wheuat_theme_setup_done", "true");
    setThemeSetupDone(true);
  }, [user, currentPreset, customAccent]);

  return (
    <ThemeContext.Provider value={{
      currentPreset,
      customAccent,
      setThemePreset,
      setCustomAccent,
      saveThemeToProfile,
      themeSetupDone,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
