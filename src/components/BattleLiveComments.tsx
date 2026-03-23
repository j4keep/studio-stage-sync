import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface LiveComment {
  id: string;
  content: string;
  display_name: string;
  created_at: string;
  localId: number;
}

interface BattleLiveCommentsProps {
  battleId: string;
  isExpanded: boolean;
}

const BattleLiveComments = ({ battleId, isExpanded }: BattleLiveCommentsProps) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const counterRef = useRef(0);

  const addComment = useCallback((comment: LiveComment) => {
    setComments((prev) => [...prev.slice(-20), comment]);
    // Auto-remove after 5 seconds (fade out)
    setTimeout(() => {
      setComments((prev) => prev.filter((c) => c.localId !== comment.localId));
    }, 5000);
  }, []);

  // Load recent comments and subscribe to new ones
  useEffect(() => {
    if (!battleId || !isExpanded) return;

    // Only listen for new live comments — no historical load

    const channel = supabase
      .channel(`battle-comments-live-${battleId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "battle_comments",
          filter: `battle_id=eq.${battleId}`,
        },
        async (payload: any) => {
          const row = payload.new;
          if (row.user_id === user?.id) return; // Already added optimistically
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", row.user_id)
            .single();
          addComment({
            id: row.id,
            content: row.content,
            display_name: profile?.display_name || "User",
            created_at: row.created_at,
            localId: counterRef.current++,
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [battleId, isExpanded, user?.id, addComment]);

  const handleSend = async () => {
    if (!input.trim() || !user || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    // Optimistic add
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .single();

    addComment({
      id: `temp-${Date.now()}`,
      content: text,
      display_name: myProfile?.display_name || "You",
      created_at: new Date().toISOString(),
      localId: counterRef.current++,
    });

    await supabase.from("battle_comments").insert({
      battle_id: battleId,
      user_id: user.id,
      content: text,
    });
    setSending(false);
  };

  if (!isExpanded) return null;

  return (
    <div className="absolute bottom-20 left-3 right-3 z-[60] pointer-events-none">
      {/* Scrolling comments overlay */}
      <div className="max-h-[40vh] overflow-hidden flex flex-col justify-end mb-2">
        <AnimatePresence>
          {comments.map((c) => (
            <motion.div
              key={c.localId}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.4 }}
              className="mb-1.5 pointer-events-auto"
            >
              <div className="inline-flex items-start gap-1.5 bg-black/50 backdrop-blur-sm rounded-xl px-2.5 py-1.5 max-w-[85%]">
                <span className="text-[10px] font-bold text-primary flex-shrink-0">{c.display_name}</span>
                <span className="text-[11px] text-white/90">{c.content}</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Comment input */}
      <div
        className="pointer-events-auto flex items-center gap-2 bg-card/90 backdrop-blur-xl border border-border rounded-2xl px-3 py-2"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          onFocus={(e) => e.stopPropagation()}
          placeholder="Say something..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
        <button
          onClick={(e) => { e.stopPropagation(); handleSend(); }}
          disabled={!input.trim() || sending}
          className="w-8 h-8 rounded-full bg-primary flex items-center justify-center disabled:opacity-40"
        >
          <Send className="w-4 h-4 text-primary-foreground" />
        </button>
      </div>
    </div>
  );
};

export default BattleLiveComments;
