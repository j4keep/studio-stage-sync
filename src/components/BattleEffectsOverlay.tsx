import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EMOJI_CHARACTERS, EMOJI_MAP } from "@/lib/emoji-characters";

/* ───────── animation variants with body movement ───────── */
interface FloatingEffect {
  id: string;
  emojiId: string;
  src: string;
  x: number;
  y: number;
  animationType: "float-up" | "fly-across" | "burst" | "spiral";
}

const ANIMATION_VARIANTS = {
  "float-up": {
    initial: { y: "100%", x: 0, opacity: 0, scale: 0.3, rotate: 0 },
    animate: {
      y: "-120%",
      x: [0, 30, -20, 40, 0],
      opacity: [0, 1, 1, 1, 0],
      scale: [0.3, 1.2, 0.9, 1.1, 0.7],
      rotate: [0, -10, 15, -8, 10],
    },
    transition: { duration: 3.5, ease: "easeOut" as const },
  },
  "fly-across": {
    initial: { x: "-100%", y: "50%", opacity: 0, scale: 0.5, rotate: -20 },
    animate: {
      x: "200%",
      y: ["50%", "20%", "60%", "35%"],
      opacity: [0, 1, 1, 0],
      scale: [0.5, 1.3, 1, 0.6],
      rotate: [-20, 10, -15, 20],
    },
    transition: { duration: 3, ease: "easeInOut" as const },
  },
  burst: {
    initial: { scale: 0, opacity: 0, rotate: 0 },
    animate: {
      scale: [0, 1.8, 1.3, 2, 0],
      opacity: [0, 1, 1, 0.8, 0],
      rotate: [0, 30, -20, 40, 0],
    },
    transition: { duration: 2.5, ease: "easeOut" as const },
  },
  spiral: {
    initial: { scale: 0, opacity: 0, x: 0, y: 0 },
    animate: {
      scale: [0, 1.5, 1, 1.6, 0],
      opacity: [0, 1, 1, 1, 0],
      x: [0, 50, -30, 60, 15],
      y: [0, -30, -80, -130, -200],
      rotate: [0, 180, 360, 540, 720],
    },
    transition: { duration: 4, ease: "easeOut" as const },
  },
};

const ANIM_TYPES: Array<FloatingEffect["animationType"]> = [
  "float-up", "fly-across", "burst", "spiral",
];

/* ───────── component ───────── */
interface BattleEffectsOverlayProps {
  battleId: string;
  side: "left" | "right";
  isExpanded: boolean;
}

const BattleEffectsOverlay = ({ battleId, side, isExpanded }: BattleEffectsOverlayProps) => {
  const { user } = useAuth();
  const [effects, setEffects] = useState<FloatingEffect[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const counterRef = useRef(0);

  const addEffect = useCallback((emojiId: string, src: string) => {
    const id = `effect-${counterRef.current++}`;
    const animType = ANIM_TYPES[Math.floor(Math.random() * ANIM_TYPES.length)];
    const newEffect: FloatingEffect = {
      id,
      emojiId,
      src,
      x: 5 + Math.random() * 70,
      y: 10 + Math.random() * 50,
      animationType: animType,
    };
    setEffects((prev) => [...prev, newEffect]);
    setTimeout(() => {
      setEffects((prev) => prev.filter((e) => e.id !== id));
    }, 5000);
  }, []);

  /* realtime listener */
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
            const src = EMOJI_MAP[row.prompt] || EMOJI_CHARACTERS[0].src;
            addEffect(row.prompt, src);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [battleId, side, isExpanded, user?.id, addEffect]);

  const handleSendEmoji = async (item: typeof EMOJI_CHARACTERS[0]) => {
    if (!user) return;
    addEffect(item.id, item.src);
    setTimeout(() => addEffect(item.id, item.src), 150);
    setTimeout(() => addEffect(item.id, item.src), 350);
    setShowPicker(false);

    await supabase.from("battle_effects" as any).insert({
      battle_id: battleId,
      user_id: user.id,
      image_url: item.id,
      prompt: item.id,
      side,
    });
  };

  if (!isExpanded) return null;

  return (
    <>
      {/* floating effects layer */}
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
                style={{ left: `${effect.x}%`, top: `${effect.y}%` }}
              >
                <motion.div
                  animate={{
                    rotate: [0, -8, 8, -6, 6, -4, 4, 0],
                    scaleX: [1, 1.05, 0.95, 1.05, 0.95, 1],
                    scaleY: [1, 0.95, 1.05, 0.95, 1.05, 1],
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <img
                    src={effect.src}
                    alt=""
                    className="w-28 h-28 md:w-36 md:h-36 object-contain"
                    style={{
                      filter: "drop-shadow(0 0 12px rgba(255,165,0,0.6)) drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
                    }}
                  />
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* emoji picker */}
      <div className="absolute bottom-4 left-3 right-3 z-50">
        {showPicker && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="mb-2 bg-card/95 backdrop-blur-xl border border-border rounded-2xl p-3 shadow-2xl max-h-72 overflow-y-auto"
          >
            <div className="grid grid-cols-5 gap-2">
              {EMOJI_CHARACTERS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSendEmoji(item)}
                  className="w-full aspect-square rounded-xl flex items-center justify-center hover:bg-primary/20 active:scale-90 transition-all duration-150 p-1"
                  title={item.label}
                >
                  <img src={item.src} alt={item.label} className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
        <button
          onClick={() => setShowPicker((p) => !p)}
          className="w-full py-2.5 rounded-2xl gradient-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
        >
          <span className="text-lg">✨</span>
          {showPicker ? "Close Effects" : "Send Effects"}
        </button>
      </div>
    </>
  );
};

export default BattleEffectsOverlay;
