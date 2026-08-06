import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gamepad2 } from "lucide-react";

/** Explore → Games */
export default function GamesPage() {
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 pb-24 pt-3 text-foreground">
      <header className="mb-6 flex items-center gap-2">
        <button
          type="button"
          onClick={() => nav("/explore")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-lg font-black">Games</h1>
          <p className="text-[11px] text-muted-foreground">Play. Earn. Level up.</p>
        </div>
      </header>

      <div className="rounded-2xl border border-violet-300/60 bg-gradient-to-br from-violet-100 via-purple-100 to-indigo-100 px-5 py-10 text-center">
        <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-white/70 text-violet-700 shadow-sm">
          <Gamepad2 className="h-7 w-7" />
        </div>
        <p className="text-base font-black text-neutral-900">Games are on the way</p>
        <p className="mx-auto mt-2 max-w-xs text-sm text-neutral-600">
          Competitive play and rewards are coming to YAJ. Check back soon.
        </p>
      </div>
    </div>
  );
}
