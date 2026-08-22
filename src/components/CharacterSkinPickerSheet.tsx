import { Check } from "lucide-react";
import { SKIN_TONES, useCharacterAppearance } from "@/contexts/CharacterAppearanceContext";

/** Skin tone picker for the illustrated character used across Obby, Survival Island,
 *  Neighborhood Adventure, Treasure Rush, City Run, Tower Escape and Fleet Clash. One
 *  selection here applies everywhere those games draw your avatar. */
const CharacterSkinPickerSheet = () => {
  const { skinTone, setSkinTone } = useCharacterAppearance();

  return (
    <div className="w-full">
      <p className="mb-3 text-[11px] text-muted-foreground">
        Choose a skin tone for your character. It carries across every game that uses the
        illustrated avatar.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {SKIN_TONES.map((tone) => {
          const isSelected = skinTone === tone.hex;
          return (
            <button
              key={tone.id}
              type="button"
              onClick={() => setSkinTone(tone.hex)}
              className={`relative flex flex-col items-center gap-2 rounded-xl border p-3 transition-all ${
                isSelected ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/30"
              }`}
            >
              <div className="h-10 w-10 rounded-full border border-black/10" style={{ backgroundColor: tone.hex }} />
              <span className="text-[10px] font-medium text-foreground">{tone.label}</span>
              {isSelected && (
                <div className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                  <Check className="h-2.5 w-2.5 text-primary-foreground" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CharacterSkinPickerSheet;
