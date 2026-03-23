import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-battle-emoji`;

interface FloatingEffect {
  id: string;
  imageUrl?: string;
  emoji?: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  animationType: "float-up" | "fly-across" | "burst" | "spiral";
}

interface BattleEffectsOverlayProps {
  battleId: string;
  side: "left" | "right";
  isExpanded: boolean;
}

const ANIMATION_VARIANTS = {
  "float-up": {
    initial: { y: "100%", x: 0, opacity: 0, scale: 0.3, rotate: 0 },
    animate: { y: "-120%", x: [0, 30, -20, 40, 0], opacity: [0, 1, 1, 1, 0], scale: [0.3, 1.2, 1, 1.1, 0.8], rotate: [0, -10, 15, -5, 10] },
    transition: { duration: 4, ease: "easeOut" },
  },
  "fly-across": {
    initial: { x: "-100%", y: "50%", opacity: 0, scale: 0.5, rotate: -30 },
    animate: { x: "200%", y: ["50%", "30%", "60%", "40%"], opacity: [0, 1, 1, 0], scale: [0.5, 1.3, 1, 0.6], rotate: [-30, 10, -15, 20] },
    transition: { duration: 3.5, ease: "easeInOut" },
  },
  "burst": {
    initial: { scale: 0, opacity: 0, rotate: 0 },
    animate: { scale: [0, 2, 1.5, 2.2, 0], opacity: [0, 1, 1, 0.8, 0], rotate: [0, 45, -30, 60, 0] },
    transition: { duration: 3, ease: "easeOut" },
  },
  "spiral": {
    initial: { scale: 0, opacity: 0, x: 0, y: 0 },
    animate: { 
      scale: [0, 1.5, 1, 1.8, 0], 
      opacity: [0, 1, 1, 1, 0], 
      x: [0, 60, -40, 80, 20],
      y: [0, -40, -100, -160, -250],
      rotate: [0, 180, 360, 540, 720],
    },
    transition: { duration: 4.5, ease: "easeOut" },
  },
};

const ANIM_TYPES: Array<FloatingEffect["animationType"]> = ["float-up", "fly-across", "burst", "spiral"];

const BattleEffectsOverlay = ({ battleId, side, isExpanded }: BattleEffectsOverlayProps) => {
  const { user } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [effects, setEffects] = useState<FloatingEffect[]>([]);
  const counterRef = useRef(0);

  const addEffect = useCallback((imageUrl?: string, emoji?: string) => {
    const id = `effect-${counterRef.current++}`;
    const animType = ANIM_TYPES[Math.floor(Math.random() * ANIM_TYPES.length)];
    const newEffect: FloatingEffect = {
      id,
      imageUrl,
      emoji,
      x: 10 + Math.random() * 60,
      y: 20 + Math.random() * 40,
      scale: 0.8 + Math.random() * 0.6,
      rotation: Math.random() * 40 - 20,
      animationType: animType,
    };
    setEffects((prev) => [...prev, newEffect]);
    // Remove after animation completes
    setTimeout(() => {
      setEffects((prev) => prev.filter((e) => e.id !== id));
    }, 5000);
  }, []);

  // Listen for realtime effects from other users
  useEffect(() => {
    if (!battleId || !isExpanded) return;

    const channel = supabase
      .channel(`battle-effects-${battleId}-${side}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "battle_effects",
          filter: `battle_id=eq.${battleId}`,
        },
        (payload: any) => {
          const row = payload.new;
          if (row.side === side && row.user_id !== user?.id) {
            addEffect(row.image_url, row.prompt);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [battleId, side, isExpanded, user?.id, addEffect]);

  const handleSendEffect = async () => {
    if (!prompt.trim() || loading || !user) return;
    const currentPrompt = prompt.trim();
    setPrompt("");
    setLoading(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ prompt: currentPrompt }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to generate effect");
      }

      const data = await resp.json();
      const imgUrl = data.type === "image" ? data.imageUrl : undefined;
      const emojiText = data.type === "text" ? data.emoji : undefined;

      // Show locally immediately
      addEffect(imgUrl, emojiText || currentPrompt);

      // Save to DB for other viewers to see via realtime
      await supabase.from("battle_effects" as any).insert({
        battle_id: battleId,
        user_id: user.id,
        image_url: imgUrl || currentPrompt,
        prompt: currentPrompt,
        side,
      });
    } catch (e: any) {
      toast.error(e.message || "Couldn't generate effect");
      // Fallback: show text-based effect anyway
      addEffect(undefined, currentPrompt);
    } finally {
      setLoading(false);
    }
  };

  if (!isExpanded) return null;

  return (
    <>
      {/* Floating effects layer */}
      <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
        <AnimatePresence>
          {effects.map((effect) => {
            const anim = ANIMATION_VARIANTS[effect.animationType];
            return (
              <motion.div
                key={effect.id}
                initial={anim.initial}
                animate={anim.animate}
                transition={anim.transition}
                className="absolute pointer-events-none"
                style={{
                  left: `${effect.x}%`,
                  top: `${effect.y}%`,
                }}
              >
                {effect.imageUrl && effect.imageUrl.startsWith("data:") ? (
                  <img
                    src={effect.imageUrl}
                    alt="effect"
                    className="w-24 h-24 md:w-32 md:h-32 object-contain drop-shadow-2xl"
                    style={{ filter: "drop-shadow(0 0 15px rgba(255,165,0,0.6))" }}
                  />
                ) : effect.imageUrl && effect.imageUrl.startsWith("http") ? (
                  <img
                    src={effect.imageUrl}
                    alt="effect"
                    className="w-24 h-24 md:w-32 md:h-32 object-contain drop-shadow-2xl"
                    style={{ filter: "drop-shadow(0 0 15px rgba(255,165,0,0.6))" }}
                  />
                ) : (
                  <div className="text-6xl md:text-7xl drop-shadow-2xl" style={{ filter: "drop-shadow(0 0 20px rgba(255,100,0,0.7))" }}>
                    {effect.emoji || "🔥"}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Input bar at the bottom of expanded card */}
      <div className="absolute bottom-4 left-3 right-3 z-50">
        <div className="flex items-center gap-2 bg-card/90 backdrop-blur-md border border-border rounded-2xl px-3 py-2 shadow-lg">
          <Sparkles className="w-4 h-4 text-primary shrink-0" />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSendEffect(); } }}
            placeholder="Type an effect... (fire, lightning, kick)"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
            disabled={loading}
          />
          <button
            onClick={handleSendEffect}
            disabled={!prompt.trim() || loading}
            className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground disabled:opacity-40 transition-opacity shrink-0"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-center text-[9px] text-muted-foreground/60 mt-1">
          ✨ AI-powered effects • Type anything!
        </p>
      </div>
    </>
  );
};

export default BattleEffectsOverlay;
