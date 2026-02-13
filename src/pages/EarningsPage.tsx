import { ArrowLeft, DollarSign, TrendingUp, Download, Building2, Heart, Music } from "lucide-react";
import { useNavigate } from "react-router-dom";

const earningsData = [
  { type: "Digital Download", item: "Midnight Flow (WAV)", amount: 2.99, date: "Feb 10, 2026", icon: Download },
  { type: "Studio Booking", item: "Sunset Studio - 4hrs", amount: 72.00, date: "Feb 8, 2026", icon: Building2 },
  { type: "Tip", item: "From @musicfan99", amount: 5.00, date: "Feb 7, 2026", icon: Heart },
  { type: "Digital Download", item: "Rise Above (Stems)", amount: 14.99, date: "Feb 5, 2026", icon: Download },
  { type: "Tip", item: "From @beatslover", amount: 10.00, date: "Feb 3, 2026", icon: Heart },
  { type: "Digital Download", item: "Full Album Bundle", amount: 9.99, date: "Feb 1, 2026", icon: Download },
  { type: "Studio Booking", item: "Vibe Room - 2hrs", amount: 40.00, date: "Jan 28, 2026", icon: Building2 },
  { type: "Streaming", item: "WHEUAT Radio plays", amount: 12.50, date: "Jan 25, 2026", icon: Music },
];

const totalEarnings = earningsData.reduce((sum, e) => sum + e.amount, 0);

const EarningsPage = () => {
  const navigate = useNavigate();

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
        <p className="text-3xl font-display font-bold text-primary">${totalEarnings.toFixed(2)}</p>
        <div className="flex items-center justify-center gap-1 mt-1">
          <TrendingUp className="w-3 h-3 text-green-500" />
          <span className="text-[10px] text-green-500 font-medium">+18% this month</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-2 mb-5">
        {[
          { label: "Downloads", amount: "$27.97", icon: Download },
          { label: "Studio Bookings", amount: "$112.00", icon: Building2 },
          { label: "Tips", amount: "$15.00", icon: Heart },
          { label: "Streaming", amount: "$12.50", icon: Music },
        ].map(b => (
          <div key={b.label} className="p-3 rounded-xl bg-card border border-border">
            <b.icon className="w-4 h-4 text-primary mb-1" />
            <p className="text-sm font-semibold text-foreground">{b.amount}</p>
            <p className="text-[10px] text-muted-foreground">{b.label}</p>
          </div>
        ))}
      </div>

      {/* Transactions */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Recent Transactions</p>
      <div className="flex flex-col gap-2">
        {earningsData.map((e, i) => (
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
    </div>
  );
};

export default EarningsPage;
