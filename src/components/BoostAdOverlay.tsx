import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Volume2, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getR2DownloadUrl } from "@/lib/r2-storage";
import { useProGate } from "@/hooks/use-pro-gate";

interface BoostAd {
  id: string;
  content_type: string;
  content_id: string;
  title: string;
  artist_name: string;
  cover_url: string;
  cta_label: string;
  cta_path: string;
}

interface BoostAdOverlayProps {
  /** Number of songs played since last ad — parent tracks this */
  songPlayCount: number;
  /** Called when ad finishes so parent can reset counter */
  onAdComplete: () => void;
  /** Interval: show ad every N songs */
  interval?: number;
}

const SKIP_DELAY_MS = 3000; // 3 seconds before skip is available
const AUTO_DISMISS_MS = 15000; // auto-close after 15 seconds

const BoostAdOverlay = ({ songPlayCount, onAdComplete, interval = 3 }: BoostAdOverlayProps) => {
  const { isPro } = useProGate();
  const navigate = useNavigate();
  const [ad, setAd] = useState<BoostAd | null>(null);
  const [visible, setVisible] = useState(false);
  const [canSkip, setCanSkip] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const skipTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const countdownRef = useRef<ReturnType<typeof setInterval>>();
  const lastFetchCount = useRef(0);

  const fetchRandomAd = useCallback(async () => {
    try {
      // Get a random active boost
      const { data: boosts } = await (supabase as any)
        .from("boosts")
        .select("id, content_type, content_id")
        .eq("status", "active")
        .gt("end_date", new Date().toISOString())
        .limit(20);

      if (!boosts || boosts.length === 0) return null;

      const boost = boosts[Math.floor(Math.random() * boosts.length)];

      // Fetch content details based on type
      let title = "", artist_name = "", cover_url = "", cta_label = "", cta_path = "";

      if (boost.content_type === "song") {
        const { data: song } = await (supabase as any)
          .from("songs")
          .select("title, cover_url, user_id")
          .eq("id", boost.content_id)
          .single();
        if (song) {
          const { data: profile } = await (supabase as any)
            .from("profiles")
            .select("display_name")
            .eq("id", song.user_id)
            .single();
          title = song.title;
          artist_name = profile?.display_name || "Artist";
          cover_url = song.cover_url || "";
          cta_label = "Listen Now";
          cta_path = "/browse-songs";
        }
      } else if (boost.content_type === "video") {
        const { data: video } = await (supabase as any)
          .from("videos")
          .select("title, cover_url, user_id")
          .eq("id", boost.content_id)
          .single();
        if (video) {
          const { data: profile } = await (supabase as any)
            .from("profiles")
            .select("display_name")
            .eq("id", video.user_id)
            .single();
          title = video.title;
          artist_name = profile?.display_name || "Artist";
          cover_url = video.cover_url || "";
          cta_label = "Watch Now";
          cta_path = "/browse-videos";
        }
      } else if (boost.content_type === "studio") {
        const { data: studio } = await (supabase as any)
          .from("studios")
          .select("name, location, user_id")
          .eq("id", boost.content_id)
          .single();
        if (studio) {
          title = studio.name;
          artist_name = studio.location;
          cover_url = "";
          cta_label = "Book Studio";
          cta_path = "/studios";
        }
      } else if (boost.content_type === "store_product") {
        const { data: product } = await (supabase as any)
          .from("store_products")
          .select("title, cover_url, artist_name")
          .eq("id", boost.content_id)
          .single();
        if (product) {
          title = product.title;
          artist_name = product.artist_name || "Artist";
          cover_url = product.cover_url || "";
          cta_label = "Shop Now";
          cta_path = "/store";
        }
      }

      if (!title) return null;

      // Increment impressions
      await (supabase as any)
        .from("boosts")
        .update({ impressions: (boost as any).impressions ? (boost as any).impressions + 1 : 1 })
        .eq("id", boost.id);

      // Actually use RPC or raw increment — simpler: just increment
      await (supabase as any).rpc("increment_boost_impressions", { boost_id: boost.id }).catch(() => {});

      return {
        id: boost.id,
        content_type: boost.content_type,
        content_id: boost.content_id,
        title,
        artist_name,
        cover_url,
        cta_label,
        cta_path,
      } as BoostAd;
    } catch {
      return null;
    }
  }, []);

  // Trigger ad when songPlayCount hits interval
  useEffect(() => {
    if (isPro) return; // PRO users never see ads
    if (songPlayCount < interval) return;
    if (songPlayCount === lastFetchCount.current) return;
    lastFetchCount.current = songPlayCount;

    fetchRandomAd().then((result) => {
      if (result) {
        setAd(result);
        setVisible(true);
        setCanSkip(false);
        setCountdown(3);

        // Countdown timer
        let c = 3;
        countdownRef.current = setInterval(() => {
          c--;
          setCountdown(c);
          if (c <= 0) clearInterval(countdownRef.current);
        }, 1000);

        // Enable skip after 3s
        skipTimerRef.current = setTimeout(() => setCanSkip(true), SKIP_DELAY_MS);

        // Auto-dismiss after 15s
        dismissTimerRef.current = setTimeout(() => {
          handleDismiss();
        }, AUTO_DISMISS_MS);
      } else {
        onAdComplete();
      }
    });

    return () => {
      clearTimeout(skipTimerRef.current);
      clearTimeout(dismissTimerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [songPlayCount, interval, isPro, fetchRandomAd, onAdComplete]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    clearTimeout(skipTimerRef.current);
    clearTimeout(dismissTimerRef.current);
    clearInterval(countdownRef.current);
    setTimeout(() => {
      setAd(null);
      onAdComplete();
    }, 300);
  }, [onAdComplete]);

  const handleCta = useCallback(async () => {
    if (!ad) return;
    // Track click
    await (supabase as any).rpc("increment_boost_clicks", { boost_id: ad.id }).catch(() => {});
    navigate(ad.cta_path);
    handleDismiss();
  }, [ad, navigate, handleDismiss]);

  if (!ad || !visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 30 }}
          className="w-full max-w-sm rounded-2xl bg-card border border-border overflow-hidden shadow-2xl"
        >
          {/* Sponsored label + skip */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-primary/10 border-b border-border">
            <div className="flex items-center gap-1.5">
              <Eye className="w-3 h-3 text-primary" />
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Sponsored</span>
            </div>
            {canSkip ? (
              <button onClick={handleDismiss} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium">Skip</span>
              </button>
            ) : (
              <span className="text-[10px] text-muted-foreground font-medium">Skip in {countdown}s</span>
            )}
          </div>

          {/* Ad content */}
          {ad.cover_url ? (
            <div className="aspect-video w-full overflow-hidden">
              <img src={ad.cover_url} alt={ad.title} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="aspect-video w-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Volume2 className="w-12 h-12 text-primary/40" />
            </div>
          )}

          {/* Info */}
          <div className="p-4">
            <p className="text-sm font-bold text-foreground truncate">{ad.title}</p>
            <p className="text-xs text-muted-foreground truncate">{ad.artist_name}</p>
            <p className="text-[9px] text-muted-foreground/60 mt-0.5 capitalize">{ad.content_type.replace("_", " ")}</p>
          </div>

          {/* CTA */}
          <div className="px-4 pb-4">
            <button
              onClick={handleCta}
              className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 glow-primary"
            >
              <ExternalLink className="w-4 h-4" />
              {ad.cta_label}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BoostAdOverlay;
