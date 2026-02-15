import { ArrowLeft, DollarSign, TrendingUp, Download, Building2, Heart, Music, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface EarningTransaction {
  type: string;
  item: string;
  amount: number;
  date: string;
  icon: typeof Download;
}

const EarningsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch purchases where user is the seller (their products were bought)
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ["earnings-sales", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // Get user's products first
      const { data: products } = await supabase
        .from("store_products")
        .select("id, title, type")
        .eq("user_id", user.id);
      if (!products || products.length === 0) return [];

      const productIds = products.map((p) => p.id);
      const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

      const { data: purchases } = await supabase
        .from("purchases")
        .select("*")
        .in("product_id", productIds)
        .order("created_at", { ascending: false });

      return (purchases || []).map((p) => ({
        type: "Digital Download",
        item: productMap[p.product_id]?.title || "Unknown Product",
        amount: p.amount,
        date: new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        icon: Download,
      }));
    },
    enabled: !!user?.id,
  });

  // Fetch studio bookings where user owns the studio
  const { data: bookingData, isLoading: bookingsLoading } = useQuery({
    queryKey: ["earnings-bookings", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data: studios } = await supabase
        .from("studios")
        .select("id, name")
        .eq("user_id", user.id);
      if (!studios || studios.length === 0) return [];

      const studioIds = studios.map((s) => s.id);
      const studioMap = Object.fromEntries(studios.map((s) => [s.id, s]));

      const { data: bookings } = await supabase
        .from("studio_bookings")
        .select("*")
        .in("studio_id", studioIds)
        .eq("status", "confirmed")
        .order("created_at", { ascending: false });

      return (bookings || []).map((b) => ({
        type: "Studio Booking",
        item: `${studioMap[b.studio_id]?.name || "Studio"} - ${b.hours}hrs`,
        amount: b.total_amount,
        date: new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        icon: Building2,
      }));
    },
    enabled: !!user?.id,
  });

  const isLoading = salesLoading || bookingsLoading;
  const allTransactions: EarningTransaction[] = [
    ...(salesData || []),
    ...(bookingData || []),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const downloadTotal = (salesData || []).reduce((sum, e) => sum + e.amount, 0);
  const bookingTotal = (bookingData || []).reduce((sum, e) => sum + e.amount, 0);
  const totalEarnings = downloadTotal + bookingTotal;

  const breakdown = [
    { label: "Downloads", amount: downloadTotal, icon: Download },
    { label: "Studio Bookings", amount: bookingTotal, icon: Building2 },
    { label: "Tips", amount: 0, icon: Heart },
    { label: "Streaming", amount: 0, icon: Music },
  ];

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/profile")} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-lg font-display font-bold text-foreground">Earnings</h1>
      </div>

      {/* Total */}
      <div className="p-5 rounded-2xl bg-card border border-border mb-5 text-center">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Earnings</p>
        {isLoading ? (
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto my-2" />
        ) : (
          <p className="text-3xl font-display font-bold text-primary">${totalEarnings.toFixed(2)}</p>
        )}
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        {breakdown.map((b) => (
          <div key={b.label} className="p-3 rounded-xl bg-card border border-border">
            <b.icon className="w-4 h-4 text-primary mb-1" />
            <p className="text-sm font-semibold text-foreground">
              {isLoading ? "—" : `$${b.amount.toFixed(2)}`}
            </p>
            <p className="text-[10px] text-muted-foreground">{b.label}</p>
          </div>
        ))}
      </div>

      {/* Transactions */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Transactions</p>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : allTransactions.length === 0 ? (
        <div className="text-center py-10">
          <DollarSign className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No earnings yet</p>
          <p className="text-[10px] text-muted-foreground mt-1">Your income from sales, bookings, and tips will appear here</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {allTransactions.map((e, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <e.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{e.item}</p>
                <p className="text-[10px] text-muted-foreground">{e.type} · {e.date}</p>
              </div>
              <span className="text-sm font-semibold text-primary">+${e.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EarningsPage;
