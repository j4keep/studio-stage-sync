import { X } from "lucide-react";

type Props = {
  onQuit: () => void;
  className?: string;
  iconClassName?: string;
};

const DEFAULT_CLASS = "rounded-full bg-black/55 p-2 text-white backdrop-blur-sm active:scale-95";

/** A quit/end-game icon button used across every game's in-play header. Confirms, then
 *  hands off to the page's own quit handler (which marks the match ended server-side via
 *  endGame() so it never silently resumes mid-match next time). */
export default function QuitGameButton({ onQuit, className, iconClassName }: Props) {
  return (
    <button
      type="button"
      onClick={() => {
        if (window.confirm("End this game now? You'll start a new one next time.")) onQuit();
      }}
      aria-label="Quit game"
      className={className ?? DEFAULT_CLASS}
    >
      <X className={iconClassName ?? "h-4 w-4"} />
    </button>
  );
}
