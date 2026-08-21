import { useEffect, useRef, useState } from "react";
import { Eye, Send, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGameVoice } from "@/hooks/use-game-voice";
import {
  GameLiveComment,
  fetchGameLiveComments,
  gameLiveChannelId,
  postGameLiveComment,
} from "@/lib/game-live";

/**
 * The chat/voice/viewer-count strip under a live game's board — embedded directly in the
 * feed slide, not a popup. Spectator-only: there is no control here that leads into the
 * actual interactive board, only listening in and chatting.
 */
export default function LiveGameWatchPanel({ gameId, active }: { gameId: string; active: boolean }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<GameLiveComment[]>([]);
  const [draft, setDraft] = useState("");
  const [viewers, setViewers] = useState(0);
  const [listening, setListening] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const { conn } = useGameVoice({
    gameId,
    userId: user?.id,
    enabled: active && listening && !!user,
    canPublish: false,
  });

  useEffect(() => {
    if (!active) setListening(false);
  }, [active]);

  useEffect(() => {
    if (!user?.id || !active) return;
    const channel = supabase.channel(gameLiveChannelId(gameId), {
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
  }, [gameId, user?.id, active]);

  const loadComments = async () => {
    try {
      setComments(await fetchGameLiveComments(gameId));
    } catch {
      /* chat is non-critical */
    }
  };

  useEffect(() => {
    void loadComments();
  }, [gameId]);

  useEffect(() => {
    if (!active) return;
    const channel = supabase
      .channel(`game-chat-${gameId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_live_comments", filter: `game_id=eq.${gameId}` },
        () => void loadComments(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gameId, active]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  const send = async () => {
    if (!user || !draft.trim()) return;
    const text = draft;
    setDraft("");
    try {
      await postGameLiveComment(gameId, user.id, text);
      await loadComments();
    } catch {
      /* best effort */
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-2">
        <button
          type="button"
          onClick={() => setListening((v) => !v)}
          className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-black text-white active:scale-95"
        >
          {listening ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          {listening ? (conn === "connected" ? "Listening in" : "Connecting…") : "Muted"}
        </button>
        <span className="flex items-center gap-1.5 text-xs text-white/50">
          <Eye className="h-3.5 w-3.5" /> {viewers} watching
        </span>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-2">
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

      <div className="flex items-center gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
