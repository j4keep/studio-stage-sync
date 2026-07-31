import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * Beta avatar capture entry — matches “Your avatar / Capture a selfie video” flow.
 * Full selfie-video pipeline can plug in later; Get started unlocks the camera intent.
 */
export default function YajAiAvatarPage() {
  const navigate = useNavigate();

  const getStarted = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera not supported on this device.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: true,
      });
      stream.getTracks().forEach((t) => t.stop());
      toast({
        title: "Avatar capture — coming soon",
        description:
          "Camera access works. Selfie-video avatar creation is in beta and will unlock in a follow-up update.",
      });
    } catch (e) {
      toast({
        title: "Camera",
        description: e instanceof Error ? e.message : "Couldn't open the camera.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/ask-yaj/settings"))}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="flex-1 text-center text-base font-semibold">Your avatar</h1>
        <span className="w-9" />
      </header>

      <div className="flex flex-1 flex-col items-center px-8 pb-10 pt-10">
        <div className="relative mb-3 flex h-28 w-28 items-center justify-center">
          <svg viewBox="0 0 120 120" className="h-full w-full text-foreground" aria-hidden>
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray="2 6"
              opacity="0.35"
            />
            <circle cx="44" cy="52" r="4" fill="currentColor" />
            <circle cx="76" cy="52" r="4" fill="currentColor" />
            <path
              d="M40 74c6 10 34 10 40 0"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="mb-5 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Beta
        </span>
        <h2 className="text-center text-2xl font-black tracking-tight">Capture a selfie video</h2>
        <p className="mt-3 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
          Create an avatar to add to any frame you create. Look and sound like yourself whenever you
          use it. Your avatar can only be used by you.{" "}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() =>
              toast({
                title: "About avatars",
                description:
                  "Avatar video stays on your device until you save it. Only you can use your YAJ avatar.",
              })
            }
          >
            Learn more
          </button>
        </p>

        <div className="mt-auto w-full max-w-sm pt-10">
          <button
            type="button"
            onClick={() => void getStarted()}
            className="h-12 w-full rounded-full bg-muted text-sm font-bold text-foreground"
          >
            Get started
          </button>
        </div>
      </div>
    </div>
  );
}
