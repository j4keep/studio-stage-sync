import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle } from "lucide-react";
import OpponentPickerSheet from "@/components/games/OpponentPickerSheet";

type Props = {
  title: string;
  subtitle: string;
  turnLabel: string;
  turnActive: boolean;
  boardInfo: string;
  howToPlay?: string[];
  children: ReactNode;
  pickerOpen: boolean;
  onPickerChange: (open: boolean) => void;
  onChallenge: (opponentId: string, name: string) => void;
};

export default function GameShellPro({
  title,
  subtitle,
  turnLabel,
  turnActive,
  boardInfo,
  howToPlay,
  children,
  pickerOpen,
  onPickerChange,
  onChallenge,
}: Props) {
  const navigate = useNavigate();
  const [help, setHelp] = useState(false);

  return (
    <div
      className="min-h-[100dvh] pb-24 text-foreground"
      style={{
        background:
          "radial-gradient(120% 70% at 50% -10%, hsl(266 60% 22%) 0%, hsl(240 45% 10%) 45%, hsl(240 50% 6%) 100%)",
      }}
    >
      <header className="sticky top-0 z-20 border-b border-white/5 bg-black/30 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/games")}
            aria-label="Back"
            className="rounded-full bg-white/5 p-2 text-white active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-lg font-black tracking-tight text-white">{title}</h1>
            <p className="truncate text-[11px] text-white/60">{subtitle}</p>
          </div>
          {howToPlay?.length ? (
            <button
              type="button"
              onClick={() => setHelp((v) => !v)}
              aria-label="How to play"
              className="rounded-full bg-white/5 p-2 text-white active:scale-95"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
          ) : (
            <span className="w-9" />
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${
              turnActive ? "bg-primary/20 text-primary" : "bg-white/5 text-white/60"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${turnActive ? "bg-primary" : "bg-white/40"}`} />
            {turnLabel}
          </span>
          <span className="truncate text-[11px] text-white/70">{boardInfo}</span>
        </div>

        {help && howToPlay?.length ? (
          <ul className="mt-3 space-y-1 rounded-xl bg-white/5 p-3 text-[11px] text-white/75 animate-fade-in">
            {howToPlay.map((line) => (
              <li key={line}>• {line}</li>
            ))}
          </ul>
        ) : null}
      </header>

      <main className="px-3 pt-3">{children}</main>

      <OpponentPickerSheet
        open={pickerOpen}
        onClose={() => onPickerChange(false)}
        onPick={(p) => {
          onPickerChange(false);
          onChallenge(p.user_id, p.display_name || "your opponent");
        }}
        title={`Challenge to ${title}`}
      />
    </div>
  );
}
