import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw, Share2, Users } from "lucide-react";
import OpponentPickerSheet from "@/components/games/OpponentPickerSheet";
import { toast } from "@/hooks/use-toast";

type Props = {
  title: string;
  subtitle: string;
  status: string;
  finished: boolean;
  shareText: string;
  onRematch: () => void;
  onChallenge: (opponentId: string, name: string) => void;
  children: ReactNode;
};

export default function GameShell({
  title,
  subtitle,
  status,
  finished,
  shareText,
  onRematch,
  onChallenge,
  children,
}: Props) {
  const navigate = useNavigate();
  const [picker, setPicker] = useState(false);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ text: shareText });
      else {
        await navigator.clipboard.writeText(shareText);
        toast({ title: "Result copied" });
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate("/games")} aria-label="Back" className="rounded-full p-1.5 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-black tracking-tight">{title}</h1>
            <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4">
        <div className="rounded-2xl border border-border bg-card p-3 text-center">
          <p className="text-sm font-black">{status}</p>
        </div>

        <div className="mt-5">{children}</div>

        {finished && (
          <div className="mx-auto mt-6 max-w-[380px] space-y-2">
            <button
              type="button"
              onClick={onRematch}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-black text-primary-foreground active:scale-[0.98]"
            >
              <RotateCcw className="h-4 w-4" /> Rematch
            </button>
            <button
              type="button"
              onClick={() => setPicker(true)}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-3 text-sm font-black active:scale-[0.98]"
            >
              <Users className="h-4 w-4" /> Challenge Someone
            </button>
            <button
              type="button"
              onClick={share}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-3 text-sm font-black active:scale-[0.98]"
            >
              <Share2 className="h-4 w-4" /> Share Result
            </button>
          </div>
        )}
      </main>

      <OpponentPickerSheet
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(p) => {
          setPicker(false);
          onChallenge(p.user_id, p.display_name || "your opponent");
        }}
        title={`Challenge to ${title}`}
      />
    </div>
  );
}
