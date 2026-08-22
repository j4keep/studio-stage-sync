import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type SkinTone = { id: string; label: string; hex: string };

/** Gold, the default until a player picks something else, plus a realistic spectrum from
 *  fair to deep shared with Boxing's own picker so the same swatches mean the same thing
 *  everywhere in the app. */
export const SKIN_TONES: SkinTone[] = [
  { id: "gold", label: "Gold", hex: "#FFCC4D" },
  { id: "fair", label: "Fair", hex: "#f3d3b3" },
  { id: "light", label: "Light", hex: "#e8c39e" },
  { id: "tan", label: "Tan", hex: "#c58c58" },
  { id: "brown", label: "Brown", hex: "#8a5a3a" },
  { id: "dark-brown", label: "Dark Brown", hex: "#5a3826" },
  { id: "deep", label: "Deep", hex: "#3a2418" },
];

/** The classic emoji-yellow/gold tone — the default for every illustrated character until
 *  a player picks a different one. */
export const DEFAULT_SKIN_TONE = "#FFCC4D";

const STORAGE_KEY = "yaj_character_skin_tone";

interface CharacterAppearanceContextType {
  skinTone: string;
  setSkinTone: (hex: string) => void;
}

const CharacterAppearanceContext = createContext<CharacterAppearanceContextType>({
  skinTone: DEFAULT_SKIN_TONE,
  setSkinTone: () => {},
});

export const useCharacterAppearance = () => useContext(CharacterAppearanceContext);

/** Cross-game character skin tone preference — the illustrated avatar used by Obby, Survival
 *  Island, Neighborhood Adventure, Treasure Rush, City Run, Tower Escape and Fleet Clash all
 *  read this one value, the same way ThemeContext drives the app's accent color. Cached in
 *  localStorage for an instant first paint, synced to the profiles table for signed-in users. */
export const CharacterAppearanceProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [skinTone, setSkinToneState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) || DEFAULT_SKIN_TONE,
  );

  useEffect(() => {
    if (!user) return;
    let isActive = true;
    void (async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("character_skin_tone")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!isActive || !data?.character_skin_tone) return;
      setSkinToneState(data.character_skin_tone);
      localStorage.setItem(STORAGE_KEY, data.character_skin_tone);
    })();
    return () => {
      isActive = false;
    };
  }, [user]);

  const setSkinTone = useCallback(
    (hex: string) => {
      setSkinToneState(hex);
      try {
        localStorage.setItem(STORAGE_KEY, hex);
      } catch {
        /* ignore */
      }
      if (user) {
        void (supabase as any).from("profiles").update({ character_skin_tone: hex }).eq("user_id", user.id);
      }
    },
    [user],
  );

  return (
    <CharacterAppearanceContext.Provider value={{ skinTone, setSkinTone }}>
      {children}
    </CharacterAppearanceContext.Provider>
  );
};
