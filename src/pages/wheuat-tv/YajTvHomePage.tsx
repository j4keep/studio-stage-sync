import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Radio } from "lucide-react";
import { WheuatTv, type WheuatTvItem } from "./wheuatTvStore";
import { listActiveYajTvLiveSessions, type YajTvLiveWithHost } from "./yajTvLiveStore";
import { YajTvShell } from "./YajTvShell";
import { YajTvRow } from "./YajTvRow";
import { YajTvPosterCard } from "./YajTvPosterCard";
import { YajTvLiveNowRow } from "./YajTvLiveNowRow";
import { YajTvWelcomeSheet, hasSeenYajTvWelcome } from "./YajTvWelcomeSheet";
import { HOME_SECTIONS, selectByCategory, type CategorySelection } from "./yajTvMeta";

const YajTvHomePage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<WheuatTvItem[]>([]);
  const [liveSessions, setLiveSessions] = useState<YajTvLiveWithHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<CategorySelection>("all");
  const [showWelcome, setShowWelcome] = useState(() => !hasSeenYajTvWelcome());

  const refresh = async () => {
    const [tv, live] = await Promise.all([
      WheuatTv.list(),
      listActiveYajTvLiveSessions().catch(() => []),
    ]);
    setItems(tv);
    setLiveSessions(live);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      await refresh();
      if (active) setLoading(false);
    })();
    const h = () => refresh();
    window.addEventListener("wheuat-tv-updated", h);
    const poll = window.setInterval(() => void listActiveYajTvLiveSessions().then((live) => active && setLiveSessions(live)).catch(() => {}), 20000);
    return () => {
      active = false;
      window.removeEventListener("wheuat-tv-updated", h);
      window.clearInterval(poll);
    };
  }, []);

  if (showWelcome) {
    return <YajTvWelcomeSheet onEnter={() => setShowWelcome(false)} />;
  }

  if (loading) {
    return (
      <YajTvShell category={category} onCategoryChange={setCategory}>
        <div className="flex justify-center py-16 text-white/50">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </YajTvShell>
    );
  }

  if (!items.length && !liveSessions.length) {
    return (
      <YajTvShell category={category} onCategoryChange={setCategory}>
        <div className="px-4 py-16 text-center text-sm text-white/50">
          Nothing on YAJ.TV yet. Be the first to publish.
        </div>
      </YajTvShell>
    );
  }

  return (
    <YajTvShell category={category} onCategoryChange={setCategory}>
      {category === "all" ? (
        <div className="pt-1">
          <YajTvLiveNowRow sessions={liveSessions} />
          {HOME_SECTIONS.map((section) => (
            <YajTvRow key={section.key} title={section.title} items={selectByCategory(items, section.key)} />
          ))}
        </div>
      ) : category === "live-tv" ? (
        liveSessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 pt-16 text-center text-sm text-white/40">
            <Radio className="h-6 w-6" />
            No one's live right now.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 px-4 pt-1 sm:grid-cols-3 md:grid-cols-4">
            {liveSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => navigate(`/tv/live/${s.id}`)}
                className="relative flex aspect-[3/4] flex-col items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-red-600/30 to-fuchsia-700/20 p-3 text-center"
              >
                <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-black">
                  LIVE
                </span>
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-black text-lg font-bold text-white">
                  {s.host_avatar_url ? (
                    <img src={s.host_avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (s.host_display_name || "Y")[0]?.toUpperCase()
                  )}
                </div>
                <p className="truncate text-[12px] font-semibold text-white">{s.host_display_name || "Creator"}</p>
              </button>
            ))}
          </div>
        )
      ) : (
        <div className="grid grid-cols-3 gap-x-2 gap-y-4 px-4 pt-1 sm:grid-cols-4 md:grid-cols-5">
          {selectByCategory(items, category).map((item) => (
            <YajTvPosterCard key={item.id} item={item} fluid />
          ))}
        </div>
      )}
    </YajTvShell>
  );
};

export default YajTvHomePage;
