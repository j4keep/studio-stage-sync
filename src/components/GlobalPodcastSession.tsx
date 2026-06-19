import { useNavigate } from "react-router-dom";
import { usePodcastSession } from "@/pages/podcast/podcastSessionStore";
import PodcastStudioPage from "@/pages/podcast/PodcastStudioPage";
import { Mic, Maximize2, X } from "lucide-react";

/**
 * Renders the podcast studio persistently above the app shell so the recording
 * survives navigation. When the user minimizes, we hide the studio with CSS
 * (keeps engine + media streams alive) and show a floating pill instead.
 */
export default function GlobalPodcastSession() {
  const active = usePodcastSession((s) => s.active);
  const minimized = usePodcastSession((s) => s.minimized);
  const restore = usePodcastSession((s) => s.restore);
  const close = usePodcastSession((s) => s.close);
  const navigate = useNavigate();

  if (!active) return null;

  return (
    <>
      {/* The studio stays mounted (engine, streams, recording continue).
          When minimized we just visually hide it. */}
      <div className={minimized ? "hidden" : "contents"}>
        <PodcastStudioPage />
      </div>

      {minimized && (
        <div className="fixed bottom-24 right-4 z-[70] flex items-center gap-2 rounded-full bg-neutral-950 border border-neutral-800 shadow-2xl px-3 py-2 text-white">
          <span className="relative flex w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60" />
            <span className="relative rounded-full bg-red-500 w-2 h-2" />
          </span>
          <Mic className="w-4 h-4 text-neutral-300" />
          <span className="text-xs font-medium">Studio live</span>
          <button
            onClick={() => { restore(); navigate("/tv/podcast"); }}
            title="Return to studio"
            className="ml-1 w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 grid place-items-center"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={close}
            title="End session"
            className="w-7 h-7 rounded-full bg-red-600 hover:bg-red-500 grid place-items-center"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </>
  );
}
