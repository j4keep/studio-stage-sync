import type { PublicLiveWithHost } from "@/lib/circle-live";

interface Props {
  session: PublicLiveWithHost;
  onOpen: () => void;
}

/** Same card footprint as FeedThumbCard (so it sits naturally in the Posts list) but for
 *  a live-in-progress instead of a static post — host's photo as the backdrop, a pulsing
 *  LIVE badge, tap straight into the room. */
export default function LiveNowCard({ session, onOpen }: Props) {
  const name = session.host_display_name || "Someone";
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left rounded-2xl overflow-hidden bg-black shadow-xl border border-red-500/50 active:scale-[0.98] transition-transform cursor-pointer"
    >
      <div className="relative w-full aspect-[4/5] bg-neutral-900">
        {session.host_avatar_url ? (
          <img src={session.host_avatar_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-red-900/50 to-black" />
        )}

        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-red-600 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
        </div>

        <div className="absolute inset-x-0 bottom-0 p-2 pt-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
          <p className="text-xs font-black leading-tight text-white">{name} is live</p>
          <p className="text-[10px] font-semibold text-white/70">Tap to watch</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 bg-black px-2 py-1.5 text-[10px] text-white/80">
        <div className="h-4 w-4 shrink-0 overflow-hidden rounded-full bg-white/15">
          {session.host_avatar_url && <img src={session.host_avatar_url} alt="" className="h-full w-full object-cover" />}
        </div>
        <span className="truncate font-semibold">{name}</span>
      </div>
    </button>
  );
}
