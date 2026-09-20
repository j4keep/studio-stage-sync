import { useNavigate } from "react-router-dom";
import type { YajTvLiveWithHost } from "./yajTvLiveStore";

export function YajTvLiveNowRow({ sessions }: { sessions: YajTvLiveWithHost[] }) {
  const navigate = useNavigate();
  if (!sessions.length) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-2 px-4 text-[15px] font-bold text-white">Live Now</h2>
      <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 snap-x snap-mandatory scrollbar-hide">
        {sessions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => navigate(`/tv/live/${s.id}`)}
            className="group flex w-[104px] shrink-0 snap-start flex-col items-center gap-1.5 text-center"
          >
            <div className="relative flex h-[104px] w-[104px] items-center justify-center rounded-full bg-gradient-to-br from-red-600 to-fuchsia-700 p-[3px] transition-transform group-active:scale-95">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-black text-2xl font-bold text-white">
                {s.host_avatar_url ? (
                  <img src={s.host_avatar_url} alt={s.host_display_name || "Host"} className="h-full w-full object-cover" />
                ) : (
                  (s.host_display_name || "Y")[0]?.toUpperCase()
                )}
              </div>
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black tracking-wide text-white">
                LIVE
              </span>
            </div>
            <p className="truncate text-[11px] font-medium text-white/80">{s.host_display_name || "Creator"}</p>
          </button>
        ))}
      </div>
    </section>
  );
}
