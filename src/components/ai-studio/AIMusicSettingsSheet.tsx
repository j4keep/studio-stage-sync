import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { X } from "lucide-react";

const GENRE_OPTIONS = [
  { id: "classic", label: "Classic", emoji: "🎼" },
  { id: "country", label: "Country", emoji: "🤠" },
  { id: "pop", label: "Pop", emoji: "🎤" },
  { id: "jazz", label: "Jazz", emoji: "🎷" },
  { id: "rock", label: "Rock", emoji: "🎸" },
  { id: "hiphop", label: "Hip Hop", emoji: "🎧" },
  { id: "rnb", label: "R&B", emoji: "💜" },
  { id: "gospel", label: "Gospel", emoji: "🙏" },
  { id: "afrobeat", label: "Afrobeat", emoji: "🥁" },
  { id: "reggae", label: "Reggae", emoji: "🟢" },
  { id: "latin", label: "Latin", emoji: "💃" },
  { id: "edm", label: "EDM", emoji: "🔊" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  genre: string | null;
  setGenre: (v: string | null) => void;
  gender: string | null;
  setGender: (v: string | null) => void;
  recording: string | null;
  setRecording: (v: string | null) => void;
}

const AIMusicSettingsSheet = ({ open, onOpenChange, genre, setGenre, gender, setGender, recording, setRecording }: Props) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl bg-background border-t border-border max-h-[80vh] overflow-y-auto">
        <SheetHeader className="flex flex-row items-center justify-between pb-4 border-b border-border">
          <SheetTitle className="text-lg font-display font-bold">Settings</SheetTitle>
          <button onClick={() => onOpenChange(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </SheetHeader>

        <div className="py-4 space-y-6">
          {/* Genre */}
          <div>
            <h3 className="text-base font-bold text-foreground mb-1">Select Genre <span className="text-muted-foreground font-normal text-sm">(Optional)</span></h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {GENRE_OPTIONS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGenre(genre === g.id ? null : g.id)}
                  className={`shrink-0 flex flex-col items-center gap-1.5 ${genre === g.id ? "opacity-100" : "opacity-60"}`}
                >
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl ${
                    genre === g.id ? "ring-2 ring-primary bg-primary/10" : "bg-card border border-border"
                  }`}>
                    {g.emoji}
                  </div>
                  <span className="text-xs text-foreground font-medium">{g.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Gender */}
          <div>
            <h3 className="text-base font-bold text-foreground mb-2">Select Gender <span className="text-muted-foreground font-normal text-sm">(Optional)</span></h3>
            <div className="flex gap-3">
              {["Male", "Female"].map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(gender === g ? null : g)}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-between px-4 ${
                    gender === g ? "bg-primary/10 border-2 border-primary text-foreground" : "bg-card border border-border text-muted-foreground"
                  }`}
                >
                  {g}
                  <div className={`w-5 h-5 rounded-full border-2 ${gender === g ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Recording type */}
          <div>
            <h3 className="text-base font-bold text-foreground mb-2">Select Recording <span className="text-muted-foreground font-normal text-sm">(Optional)</span></h3>
            <div className="flex gap-3">
              {["Studio", "Live (Concert)"].map((r) => (
                <button
                  key={r}
                  onClick={() => setRecording(recording === r ? null : r)}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-between px-4 ${
                    recording === r ? "bg-primary/10 border-2 border-primary text-foreground" : "bg-card border border-border text-muted-foreground"
                  }`}
                >
                  {r}
                  <div className={`w-5 h-5 rounded-full border-2 ${recording === r ? "border-primary bg-primary" : "border-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Apply button */}
          <button
            onClick={() => onOpenChange(false)}
            className="w-full py-3.5 rounded-2xl bg-foreground text-background font-bold text-base"
          >
            Apply
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AIMusicSettingsSheet;
