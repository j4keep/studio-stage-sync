import { useEffect, useRef, useState } from "react";
import { Eye, Send, Volume2, VolumeX, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGameVoice } from "@/hooks/use-game-voice";
import {
  GameLiveComment,
  LiveGameCard,
  fetchGameLiveComments,
  gameLiveChannelId,
  postGameLiveComment,
} from "@/lib/game-live";

/**
 * Spectator-only view of a live match, opened in place over the feed — like opening a
 * regular post, not a navigation into the actual game. Viewers can watch who's playing,
 * listen in on voice, and chat, but there is no path from here into the interactive board;
 * that page is for the two players only.
 */
export default function WatchLiveGameModal({ game, onClose }: { game: LiveGameCard; onClose: () => void }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<GameLiveComment[]>([]);
  const [draft, setDraft] = useState("");
  const [viewers, setViewers] = useState(0);
  const [listening, setListening] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);

  const { conn } = useGameVoice({
    gameId: game.id,
    userId: user?.id,
    enabled: listening && !!user,
    canPublish: false,
  });

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel(gameLiveChannelId(game.id), {
      config: { presence: { key: user.id } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>;
        setViewers(Math.max(0, Object.keys(state).length - 1));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ role: "viewer", at: Date.now() });
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [game.id, user?.id]);

  const loadComments = async () => {
    try {
      setComments(await fetchGameLiveComments(game.id));
    } catch {
      /* chat is non-critical */
    }
  };

  useEffect(() => {
    void loadComments();
  }, [game.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`game-chat-${game.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_live_comments", filter: `game_id=eq.${game.id}` },
        () => void loadComments(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [game.id]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  const send = async () => {
    if (!user || !draft.trim()) return;
    const text = draft;
    setDraft("");
    try {
      await postGameLiveComment(game.id, user.id, text);
      await loadComments();
    } catch {
      /* best effort */
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" /> Live · {game.label}
          </p>
          <p className="truncate text-sm font-black text-white">
            {game.playerNames.length ? game.playerNames.join(" vs ") : "Match in progress"}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full bg-white/10 p-2 text-white active:scale-95">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex -space-x-3">
          {game.playerAvatars.length ? (
            game.playerAvatars.map((a, i) => (
              <span key={i} className="h-16 w-16 overflow-hidden rounded-full border-2 border-black bg-white/10">
                {a ? <img src={a} alt="" className="h-full w-full object-cover" /> : null}
              </span>
            ))
          ) : (
            <span className="h-16 w-16 overflow-hidden rounded-full border-2 border-black bg-white/10" />
          )}
        </div>
        <p className="text-sm text-white/60">Spectator view — you're watching, not playing</p>
        <button
          type="button"
          onClick={() => setListening((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-white active:scale-95"
        >
          {listening ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          {listening ? (conn === "connected" ? "Listening in" : "Connecting…") : "Muted"}
        </button>
        <span className="flex items-center gap-1.5 text-xs text-white/50">
          <Eye className="h-3.5 w-3.5" /> {viewers} watching
        </span>
      </div>

      <div ref={listRef} className="max-h-[32dvh] space-y-2 overflow-y-auto border-t border-white/10 px-4 py-3">
        {comments.length === 0 ? (
          <p className="py-4 text-center text-xs text-white/40">No messages yet — say something.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <span className="mt-0.5 h-6 w-6 shrink-0 overflow-hidden rounded-full bg-white/10">
                {c.avatar_url ? <img src={c.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
              </span>
              <p className="text-xs text-white/85">
                <span className="font-black text-white">{c.display_name || "Viewer"}</span> {c.body}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder="Add a comment…"
          maxLength={300}
          className="flex-1 rounded-full border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none"
        />
        <button type="button" onClick={() => void send()} aria-label="Send" className="rounded-full bg-primary p-2.5 text-primary-foreground active:scale-95">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
