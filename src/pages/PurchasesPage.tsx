import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShoppingBag, Music, Building2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Purchase {
  id: string;
  amount: number;
  created_at: string;
  product_title?: string;
  product_type?: string;
  cover_url?: string;
}

interface StudioBooking {
  id: string;
  booking_date: string;
  hours: number;
  total_amount: number;
  status: string;
  studio_name?: string;
}

const PurchasesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<"products" | "studios">("products");
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [bookings, setBookings] = useState<StudioBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      // Fetch product purchases
      const { data: pData } = await (supabase as any)
        .from("purchases")
        .select("id, amount, created_at, product_id")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (pData && pData.length > 0) {
        const productIds = pData.map((p: any) => p.product_id);
        const { data: products } = await (supabase as any)
          .from("store_products")
          .select("id, title, type, cover_url")
          .in("id", productIds);
        const prodMap: Record<string, any> = {};
        (products || []).forEach((p: any) => { prodMap[p.id] = p; });
        setPurchases(pData.map((p: any) => ({
          ...p,
          product_title: prodMap[p.product_id]?.title || "Unknown",
          product_type: prodMap[p.product_id]?.type || "",
          cover_url: prodMap[p.product_id]?.cover_url || "",
        })));
      } else {
        setPurchases([]);
      }

      // Fetch studio bookings
      const { data: bData } = await (supabase as any)
        .from("studio_bookings")
        .select("id, booking_date, hours, total_amount, status, studio_id")
        .eq("user_id", user.id)
        .order("booking_date", { ascending: false });

      if (bData && bData.length > 0) {
        const studioIds = [...new Set(bData.map((b: any) => b.studio_id))];
        const { data: studios } = await (supabase as any)
          .from("studios")
          .select("id, name")
          .in("id", studioIds);
        const studioMap: Record<string, string> = {};
        (studios || []).forEach((s: any) => { studioMap[s.id] = s.name; });
        setBookings(bData.map((b: any) => ({
          ...b,
          studio_name: studioMap[b.studio_id] || "Studio",
        })));
      } else {
        setBookings([]);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <ShoppingBag className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-display font-bold text-foreground">Purchases</h1>
      </div>

      <div className="flex gap-2 mb-4">
        {(["products", "studios"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all capitalize ${
              tab === t ? "gradient-primary text-primary-foreground glow-primary" : "bg-card border border-border text-muted-foreground"
            }`}>{t === "products" ? "Songs & Beats" : "Studio Bookings"}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tab === "products" ? (
        purchases.length === 0 ? (
          <div className="text-center py-12">
            <Music className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No purchases yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {purchases.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                {p.cover_url ? (
                  <img src={p.cover_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Music className="w-4 h-4 text-primary" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.product_title}</p>
                  <p className="text-[10px] text-muted-foreground">{p.product_type} · {new Date(p.created_at).toLocaleDateString()}</p>
                </div>
                <span className="text-sm font-bold text-primary">${p.amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )
      ) : (
        bookings.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No studio bookings yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {bookings.map((b) => (
              <div key={b.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{b.studio_name}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(b.booking_date).toLocaleDateString()} · {b.hours}h · {b.status}</p>
                </div>
                <span className="text-sm font-bold text-primary">${b.total_amount.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default PurchasesPage;
