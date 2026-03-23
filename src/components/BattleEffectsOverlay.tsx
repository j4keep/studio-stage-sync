import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ───────── 30 preset animated emojis ───────── */
const PRESET_EMOJIS = [
  { label: "Fire", emoji: "🔥" },
  { label: "Lightning", emoji: "⚡" },
  { label: "Heart", emoji: "❤️" },
  { label: "Skull", emoji: "💀" },
  { label: "Crown", emoji: "👑" },
  { label: "Punch", emoji: "👊" },
  { label: "Flexed", emoji: "💪" },
  { label: "Star", emoji: "🌟" },
  { label: "Sparkles", emoji: "✨" },
  { label: "Boom", emoji: "💥" },
  { label: "Diamond", emoji: "💎" },
  { label: "Dragon", emoji: "🐉" },
  { label: "Lion", emoji: "🦁" },
  { label: "Mic", emoji: "🎤" },
  { label: "Music", emoji: "🎵" },
  { label: "Guitar", emoji: "🎸" },
  { label: "Trophy", emoji: "🏆" },
  { label: "100", emoji: "💯" },
  { label: "Rage", emoji: "😤" },
  { label: "Laugh", emoji: "😂" },
  { label: "Cool", emoji: "😎" },
  { label: "Ghost", emoji: "👻" },
  { label: "Alien", emoji: "👽" },
  { label: "Robot", emoji: "🤖" },
  { label: "Clap", emoji: "👏" },
  { label: "Tornado", emoji: "🌪️" },
  { label: "Rocket", emoji: "🚀" },
  { label: "Bomb", emoji: "💣" },
  { label: "Snake", emoji: "🐍" },
  { label: "Eyes", emoji: "👀" },
];

/* ───────── animation variants ───────── */
interface FloatingEffect {
  id: string;
  emoji: string;
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
      scale: [0.3, 1.4, 1.1, 1.3, 0.8],
      rotate: [0, -15, 20, -10, 15],
    },
    transition: { duration: 3.5, ease: "easeOut" as const },
  },
  "fly-across": {
    initial: { x: "-100%", y: "50%", opacity: 0, scale: 0.5, rotate: -30 },
    animate: {
      x: "200%",
      y: ["50%", "20%", "60%", "35%"],
      opacity: [0, 1, 1, 0],
      scale: [0.5, 1.5, 1.2, 0.6],
      rotate: [-30, 15, -20, 25],
    },
    transition: { duration: 3, ease: "easeInOut" as const },
  },
  burst: {
    initial: { scale: 0, opacity: 0, rotate: 0 },
    animate: {
      scale: [0, 2.2, 1.6, 2.5, 0],
      opacity: [0, 1, 1, 0.8, 0],
      rotate: [0, 45, -30, 60, 0],
    },
    transition: { duration: 2.5, ease: "easeOut" as const },
  },
  spiral: {
    initial: { scale: 0, opacity: 0, x: 0, y: 0 },
    animate: {
      scale: [0, 1.8, 1.2, 2, 0],
      opacity: [0, 1, 1, 1, 0],
      x: [0, 60, -40, 80, 20],
      y: [0, -40, -100, -160, -250],
      rotate: [0, 180, 360, 540, 720],
    },
    transition: { duration: 4, ease: "easeOut" as const },
  },
};

const ANIM_TYPES: Array<FloatingEffect["animationType"]> = [
  "float-up",
  "fly-across",
  "burst",
  "spiral",
];

/* ───────── component ───────── */
interface BattleEffectsOverlayProps {
  battleId: string;
  side: "left" | "right";
  isExpanded: boolean;
}

const BattleEffectsOverlay = ({
  battleId,
  side,
  isExpanded,
}: BattleEffectsOverlayProps) => {
  const { user } = useAuth();
  const [effects, setEffects] = useState<FloatingEffect[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const counterRef = useRef(0);

  const addEffect = useCallback((emoji: string) => {
    const id = `effect-${counterRef.current++}`;
    const animType = ANIM_TYPES[Math.floor(Math.random() * ANIM_TYPES.length)];
    const newEffect: FloatingEffect = {
      id,
      emoji,
      x: 5 + Math.random() * 70,
      y: 10 + Math.random() * 50,
      animationType: animType,
    };
    setEffects((prev) => [...prev, newEffect]);
    setTimeout(() => {
      setEffects((prev) => prev.filter((e) => e.id !== id));
    }, 5000);
  }, []);

  /* realtime listener for other users' effects */
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
            addEffect(row.prompt);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [battleId, side, isExpanded, user?.id, addEffect]);

  const handleSendEmoji = async (emoji: string) => {
    if (!user) return;

    /* show locally right away — fire 3 at once for impact */
    addEffect(emoji);
    setTimeout(() => addEffect(emoji), 150);
    setTimeout(() => addEffect(emoji), 350);

    /* broadcast to other viewers */
    await supabase.from("battle_effects" as any).insert({
      battle_id: battleId,
      user_id: user.id,
      image_url: emoji,
      prompt: emoji,
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
                <span
                  className="text-7xl md:text-8xl block"
                  style={{
                    filter:
                      "drop-shadow(0 0 12px rgba(255,165,0,0.6)) drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
                    textShadow: "0 0 30px rgba(255,200,0,0.5)",
                  }}
                >
                  {effect.emoji}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* emoji picker toggle button */}
      <div className="absolute bottom-4 left-3 right-3 z-50">
        {showPicker && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="mb-2 bg-card/95 backdrop-blur-xl border border-border rounded-2xl p-3 shadow-2xl max-h-52 overflow-y-auto"
          >
            <div className="grid grid-cols-6 gap-2">
              {PRESET_EMOJIS.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    handleSendEmoji(item.emoji);
                  }}
                  className="w-full aspect-square rounded-xl flex items-center justify-center text-3xl hover:bg-primary/20 active:scale-90 transition-all duration-150"
                  title={item.label}
                >
                  {item.emoji}
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
