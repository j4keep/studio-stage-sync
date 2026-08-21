import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Loader2, MessageCircle, Mic, MicOff, Radio, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useGameVoice } from "@/hooks/use-game-voice";
import {
  GameLiveComment,
  fetchGameLiveComments,
  gameLiveChannelId,
  postGameLiveComment,
  setGameLive,
} from "@/lib/game-live";

type Props = {
  gameId: string | undefined;
  userId: string | undefined;
  /** true when this user is one of the players (not a spectator) */
  isPlayer: boolean;
  /** live flag straight off the games row */
  isLive: boolean;
  /** solo matches have no one to talk to */
  hasHumanOpponent: boolean;
  /** hide the whole dock (e.g. no match loaded yet) */
  disabled?: boolean;
  /** "float" = pill centred at the bottom; "rail" = compact vertical stack for a side rail. */
  placement?: "float" | "rail";
  onChanged?: () => void;
};

/**
 * Floating live-broadcast dock shared by every competitive game:
 * go live so the app can watch, talk mic-to-mic with your opponent, read the crowd's chat.
 */
export default function GameLiveDock({
  gameId,
  userId,
  isPlayer,
  isLive,
  hasHumanOpponent,
  disabled,
  placement = "float",
  onChanged,
}: Props) {
  const rail = placement === "rail";
  const [busy, setBusy] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [comments, setComments] = useState<GameLiveComment[]>([]);
  const [draft, setDraft] = useState("");
  const [viewers, setViewers] = useState(0);
  const [voiceWanted, setVoiceWanted] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  const voiceEnabled = Boolean(
    gameId && userId && !disabled && ((isPlayer && hasHumanOpponent && voiceWanted) || (!isPlayer && isLive)),
  );
  const { conn, micOn, toggleMic, error: voiceError } = useGameVoice({
    gameId,
    userId,
    enabled: voiceEnabled,
    canPublish: isPlayer,
  });

  useEffect(() => {
    if (voiceError) toast({ title: "Voice chat", description: voiceError, variant: "destructive" });
  }, [voiceError]);

  // Presence: how many people are in the room right now.
  useEffect(() => {
    if (!gameId || !userId || disabled) return;
    const channel = supabase.channel(gameLiveChannelId(gameId), {
      config: { presence: { key: userId } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>;
        const total = Object.keys(state).length;
        setViewers(Math.max(0, total - (isPlayer ? 1 : 0)));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ role: isPlayer ? "player" : "viewer", at: Date.now() });
        }
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [gameId, userId, isPlayer, disabled]);

  const loadComments = useCallback(async () => {
    if (!gameId) return;
    try {
      setComments(await fetchGameLiveComments(gameId));
    } catch {
      /* chat is non-critical */
    }
  }, [gameId]);

  useEffect(() => {
    if (!chatOpen) return;
    void loadComments();
  }, [chatOpen, loadComments]);

  useEffect(() => {
    if (!gameId || !chatOpen) return;
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
  }, [gameId, chatOpen, loadComments]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length]);

  const toggleLive = async () => {
    if (!gameId || busy) return;
    setBusy(true);
    try {
      await setGameLive(gameId, !isLive);
      if (!isLive && hasHumanOpponent) setVoiceWanted(true);
      toast({ title: !isLive ? "You're live — the app can watch" : "Live ended" });
      onChanged?.();
    } catch (e: any) {
      toast({ title: "Could not change live status", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!gameId || !userId || !draft.trim()) return;
    const text = draft;
    setDraft("");
    try {
      await postGameLiveComment(gameId, userId, text);
      await loadComments();
    } catch (e: any) {
      toast({ title: "Message not sent", description: e?.message, variant: "destructive" });
    }
  };

  const voiceLabel = useMemo(() => {
    if (conn === "connecting") return "Connecting…";
    if (conn === "connected") return micOn ? "Mic on" : "Muted";
    return "Talk";
  }, [conn, micOn]);

  const [open, setOpen] = useState(false);

  if (disabled || !gameId) return null;

  return (
    <>
      <div className={rail ? "relative shrink-0" : "fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 z-40"}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Live options"
          aria-expanded={open}
          className={`relative flex items-center justify-center rounded-full border border-white/15 bg-black/70 text-white shadow-lg backdrop-blur-xl transition active:scale-95 ${
            rail ? "h-8 w-8" : "h-11 w-11"
          }`}
        >
          <Radio className={rail ? "h-4 w-4" : "h-5 w-5"} />
          {isLive && (
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border border-black/60 bg-red-500" />
          )}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div
              className={`absolute z-40 flex w-44 flex-col gap-1.5 rounded-2xl border border-white/15 bg-black/85 p-2 shadow-xl backdrop-blur-xl ${
                rail ? "right-0 top-full mt-2" : "bottom-full right-0 mb-2"
              }`}
            >
              {isPlayer ? (
                <button
                  type="button"
                  onClick={toggleLive}
                  disabled={busy}
                  aria-label={isLive ? "End live" : "Go live"}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wide transition active:scale-95 ${
                    isLive ? "bg-red-500 text-white" : "bg-white/10 text-white"
                  }`}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Radio className="h-3.5 w-3.5" />}
                  {isLive ? "End Live" : "Go Live"}
                </button>
              ) : (
                <span className="flex items-center gap-2 rounded-xl bg-red-500/20 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-red-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                  {isLive ? "Watching live" : "Not live"}
                </span>
              )}

              {isPlayer && hasHumanOpponent ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!voiceWanted) {
                      setVoiceWanted(true);
                      return;
                    }
                    if (conn === "connected") void toggleMic();
                    else setVoiceWanted(false);
                  }}
                  aria-label="Talk to your opponent"
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-black text-white transition active:scale-95 ${
                    conn === "connected" && micOn ? "bg-emerald-500/80" : "bg-white/10"
                  }`}
                >
                  {conn === "connected" && micOn ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                  {voiceLabel}
                </button>
              ) : null}

              <div className="flex items-center gap-1.5">
                <span className="flex flex-1 items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[11px] font-black text-white">
                  <Eye className="h-3.5 w-3.5" /> {viewers}
                </span>
                <button
                  type="button"
                  onClick={() => setChatOpen(true)}
                  aria-label="Live chat"
                  className="rounded-xl bg-white/10 p-2 text-white transition active:scale-95"
                >
                  <MessageCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {chatOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm" onClick={() => setChatOpen(false)}>
          <div
            className="max-h-[70dvh] w-full rounded-t-3xl border-t border-white/10 bg-[hsl(234_45%_8%)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-black text-white">Live chat</p>
              <button type="button" onClick={() => setChatOpen(false)} aria-label="Close" className="rounded-full bg-white/10 p-1.5 text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div ref={listRef} className="max-h-[40dvh] space-y-2 overflow-y-auto">
              {comments.length === 0 ? (
                <p className="py-6 text-center text-xs text-white/50">No messages yet — say something.</p>
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

            <div className="mt-3 flex items-center gap-2">
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
              <button
                type="button"
                onClick={() => void send()}
                aria-label="Send"
                className="rounded-full bg-primary p-2.5 text-primary-foreground active:scale-95"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
