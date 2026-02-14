import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, Play, Pause, Plus, ShoppingCart,
  X, Heart, Share2, MoreVertical, Music, Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/contexts/CartContext";
import { toast } from "@/hooks/use-toast";
import { GENRES, BEAT_SUB_GENRES } from "@/lib/genres";

import genreCountry from "@/assets/genre-country.jpg";
import genreRnb from "@/assets/genre-rnb.jpg";
import genreRock from "@/assets/genre-rock.jpg";
import genreFuturepop from "@/assets/genre-futurepop.jpg";
import genreHiphop from "@/assets/genre-hiphop.jpg";
import genreReggaeton from "@/assets/genre-reggaeton.jpg";
import genreHaitian from "@/assets/genre-haitian.jpg";
import genreAfrobeat from "@/assets/genre-afrobeat.jpg";
import genreLatin from "@/assets/genre-latin.jpg";
import genreBeats from "@/assets/genre-beats.jpg";

const GENRE_IMAGES: Record<string, string> = {
  "Beats": genreBeats,
  "Country": genreCountry,
  "R&B & Soul": genreRnb,
  "Rock": genreRock,
  "Future Pop": genreFuturepop,
  "Hip Hop/Rap": genreHiphop,
  "Reggaeton": genreReggaeton,
  "Haitian": genreHaitian,
  "Afrobeat": genreAfrobeat,
  "Latin Music": genreLatin,
};

interface Product {
  id: string;
  title: string;
  type: string;
  price: number;
  cover_url: string | null;
  tags: string[] | null;
  preview_url: string | null;
  artist_name: string | null;
  sales: number;
}

const StorePage = () => {
  const navigate = useNavigate();
  const { addItem, isInCart, count, total } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [sheetProduct, setSheetProduct] = useState<Product | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [selectedBeatSubGenre, setSelectedBeatSubGenre] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("store_products")
        .select("id, title, type, price, cover_url, tags, preview_url, artist_name, sales, user_id")
        .order("created_at", { ascending: false });
      if (!error && data) {
        // Resolve artist names from profiles for any products missing artist_name
        const missingIds = [...new Set(data.filter((p: any) => !p.artist_name).map((p: any) => p.user_id).filter(Boolean))];
        let profileMap: Record<string, string> = {};
        if (missingIds.length > 0) {
          const { data: profiles } = await (supabase as any).from("profiles").select("user_id, display_name").in("user_id", missingIds);
          (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p.display_name || ""; });
        }
        setProducts(data.map((p: any) => ({
          ...p,
          artist_name: p.artist_name || profileMap[p.user_id] || "Artist",
        })));
      }
      setLoading(false);
    };
    fetchProducts();
  }, []);

  const filtered = products.filter((p) => {
    let matchesGenre = false;
    if (!selectedGenre || selectedGenre === "All Music") {
      matchesGenre = true;
    } else if (selectedGenre === "Beats") {
      // Show all beat types, optionally filtered by sub-genre
      matchesGenre = !selectedBeatSubGenre || p.type === selectedBeatSubGenre;
    } else {
      matchesGenre = p.type === selectedGenre;
    }
    const matchesSearch =
      !searchQuery ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.artist_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesGenre && matchesSearch;
  });

  const togglePlay = (product: Product) => {
    if (playingId === product.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else if (product.preview_url) {
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(product.preview_url);
      audio.play();
      audio.onended = () => setPlayingId(null);
      audioRef.current = audio;
      setPlayingId(product.id);
    } else {
      toast({ title: "No preview available", description: "This product doesn't have an audio preview yet." });
    }
  };

  const handleAddToCart = (p: Product) => {
    if (isInCart(p.id)) {
      toast({ title: "Already in cart" });
      return;
    }
    addItem({ id: p.id, title: p.title, artist_name: p.artist_name, price: p.price, cover_url: p.cover_url, type: p.type });
    toast({ title: "Added to cart", description: `${p.title} — $${p.price.toFixed(2)}` });
  };

  // Genre grid view (landing)
  if (!selectedGenre) {
    return (
      <div className="px-4 pt-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1">
            <h1 className="text-xl font-display font-bold text-foreground">Featured Genres</h1>
          </div>
          <button onClick={() => setShowSearch(!showSearch)} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
            <Search className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={() => setShowCart(true)} className="relative w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                {count}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <AnimatePresence>
          {showSearch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-4">
              <input
                autoFocus
                placeholder="Search for an artist…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    setSelectedGenre("All Music");
                  }
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground"
              />
              {searchQuery.trim() && (
                <button
                  onClick={() => setSelectedGenre("All Music")}
                  className="mt-2 w-full py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold"
                >
                  Search "{searchQuery}"
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Genre grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Beats hero card at top */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setSelectedGenre("Beats")}
            className="col-span-2 aspect-[3/1] relative overflow-hidden rounded-xl"
          >
            <img src={GENRE_IMAGES["Beats"]} alt="Beats" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40" />
            <span className="absolute inset-0 flex items-center justify-center text-white font-display font-bold text-sm tracking-widest uppercase">
              Beats
            </span>
          </motion.button>

          {GENRES.filter(g => g !== "All Music" && g !== "Beats").map((genre, i) => {
            const isWide = genre === "Haitian" || genre === "Afrobeat" || genre === "Latin Music";
            return (
              <motion.button
                key={genre}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (i + 1) * 0.04 }}
                onClick={() => setSelectedGenre(genre)}
                className={`relative overflow-hidden rounded-xl ${isWide ? "col-span-2 aspect-[2.5/1]" : "aspect-square"}`}
              >
                <img
                  src={GENRE_IMAGES[genre]}
                  alt={genre}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40" />
                <span className="absolute inset-0 flex items-center justify-center text-white font-display font-bold text-sm tracking-widest uppercase">
                  {genre}
                </span>
              </motion.button>
            );
          })}

          {/* All Music button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: GENRES.length * 0.04 }}
            onClick={() => setSelectedGenre("All Music")}
            className="col-span-2 aspect-[3/1] rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center"
          >
            <Music className="w-5 h-5 text-primary mr-2" />
            <span className="text-primary font-display font-bold text-sm tracking-widest uppercase">All Music</span>
          </motion.button>
        </div>

        {/* Cart drawer */}
        <CartDrawer showCart={showCart} setShowCart={setShowCart} count={count} total={total} />
      </div>
    );
  }

  // Products list view (after selecting a genre)
  return (
    <div className="px-4 pt-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => { setSelectedGenre(null); setSearchQuery(""); setSelectedBeatSubGenre(null); }} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-display font-bold text-foreground">{selectedGenre}</h1>
          <p className="text-[10px] text-muted-foreground">{filtered.length} products</p>
        </div>
        <button onClick={() => setShowSearch(!showSearch)} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <Search className="w-4 h-4 text-muted-foreground" />
        </button>
        <button onClick={() => setShowCart(true)} className="relative w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <ShoppingCart className="w-4 h-4 text-muted-foreground" />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
              {count}
            </span>
          )}
        </button>
      </div>

      {/* Beat sub-genre chips */}
      {selectedGenre === "Beats" && (
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedBeatSubGenre(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              !selectedBeatSubGenre ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
            }`}
          >
            All Beats
          </button>
          {BEAT_SUB_GENRES.map((sub) => (
            <button
              key={sub}
              onClick={() => setSelectedBeatSubGenre(selectedBeatSubGenre === sub ? null : sub)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedBeatSubGenre === sub ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      )}

      {/* Search bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-3">
            <input
              autoFocus
              placeholder="Search beats, artists…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="py-16 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Product listings */}
      {!loading && (
        <div className="flex flex-col gap-1">
          {filtered.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="py-3 border-b border-border/50 last:border-b-0"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => togglePlay(p)}
                  className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center flex-shrink-0 hover:border-primary/50 transition-colors"
                >
                  {playingId === p.id ? (
                    <Pause className="w-4 h-4 text-primary" />
                  ) : (
                    <Play className="w-4 h-4 text-muted-foreground ml-0.5" />
                  )}
                </button>
                <div className="flex-1 min-w-0" onClick={() => setSheetProduct(p)}>
                  <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                  <p className="text-xs text-primary truncate">{p.artist_name || "Artist"}</p>
                </div>
                <span className="text-xs font-bold text-foreground mr-1">${p.price.toFixed(2)}</span>
                <button
                  onClick={() => handleAddToCart(p)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                    isInCart(p.id) ? "bg-primary/20 text-primary" : "bg-card border border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setSheetProduct(p)}
                  className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>
              {p.tags && p.tags.length > 0 && (
                <div className="flex gap-1.5 mt-2 ml-[52px] flex-wrap">
                  {p.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full bg-secondary text-[10px] text-secondary-foreground font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="py-16 text-center">
          <Music className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No products found</p>
        </div>
      )}

      {/* Product detail sheet */}
      <AnimatePresence>
        {sheetProduct && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50" onClick={() => setSheetProduct(null)} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-2xl p-5 pb-8 max-w-lg mx-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm font-semibold text-foreground">{sheetProduct.title}</p>
                <button onClick={() => setSheetProduct(null)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <button onClick={() => { handleAddToCart(sheetProduct); setSheetProduct(null); }} className="flex items-center justify-between py-3">
                  <span className="text-sm text-foreground">Add to Cart — ${sheetProduct.price.toFixed(2)}</span>
                  <ShoppingCart className="w-4 h-4 text-primary" />
                </button>
                <button className="flex items-center justify-between py-3">
                  <span className="text-sm text-foreground">Favorite</span>
                  <Heart className="w-4 h-4 text-primary" />
                </button>
                <button className="flex items-center justify-between py-3">
                  <span className="text-sm text-foreground">Share</span>
                  <Share2 className="w-4 h-4 text-primary" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Cart drawer */}
      <CartDrawer showCart={showCart} setShowCart={setShowCart} count={count} total={total} />
    </div>
  );
};

const CartDrawer = ({ showCart, setShowCart, count, total }: { showCart: boolean; setShowCart: (v: boolean) => void; count: number; total: number }) => (
  <AnimatePresence>
    {showCart && (
      <>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 z-50" onClick={() => setShowCart(false)} />
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed top-0 right-0 bottom-0 z-50 w-[85%] max-w-sm bg-card border-l border-border p-5 overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-display font-bold text-foreground">Cart ({count})</h2>
            <button onClick={() => setShowCart(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <CartItems />
          {count > 0 && (
            <div className="mt-6 pt-4 border-t border-border">
              <div className="flex justify-between mb-4">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-base font-bold text-foreground">${total.toFixed(2)}</span>
              </div>
              <button className="w-full py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold glow-primary">
                Checkout
              </button>
            </div>
          )}
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

const CartItems = () => {
  const { items, removeItem } = useCart();
  if (items.length === 0) {
    return (
      <div className="py-12 text-center">
        <ShoppingCart className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">Your cart is empty</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg bg-background">
          {item.cover_url ? (
            <img src={item.cover_url} alt={item.title} className="w-10 h-10 rounded-lg object-contain bg-muted" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <Music className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
            <p className="text-[10px] text-muted-foreground">{item.artist_name || "Unknown"}</p>
          </div>
          <span className="text-xs font-semibold text-foreground">${item.price.toFixed(2)}</span>
          <button onClick={() => removeItem(item.id)} className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center">
            <X className="w-3 h-3 text-destructive" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default StorePage;
