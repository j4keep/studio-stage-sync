import { ArrowLeft, BarChart3, TrendingUp, Users, Music, Eye, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";

const stats = [
  { label: "Total Plays", value: "48.2K", change: "+12%", icon: Play },
  { label: "Followers", value: "1,247", change: "+8%", icon: Users },
  { label: "Profile Views", value: "3.4K", change: "+22%", icon: Eye },
  { label: "Songs", value: "12", change: "+2", icon: Music },
];

const topSongs = [
  { title: "Rise Above", plays: "15.7K", trend: "+3.2K" },
  { title: "Midnight Flow", plays: "12.4K", trend: "+1.8K" },
  { title: "City Lights", plays: "8.1K", trend: "+900" },
  { title: "Echoes", plays: "5.3K", trend: "+450" },
  { title: "Golden Hour", plays: "3.9K", trend: "+620" },
];

const AnalyticsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="px-4 pt-4 pb-4">
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate("/profile")} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <h1 className="text-lg font-display font-bold text-foreground">Analytics</h1>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-5">
        {stats.map(s => (
          <div key={s.label} className="p-3 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className="w-4 h-4 text-primary" />
              <span className="text-[10px] text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-lg font-display font-bold text-foreground">{s.value}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span className="text-[10px] text-green-500 font-medium">{s.change} this month</span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Top Performing Songs</p>
      <div className="flex flex-col gap-2">
        {topSongs.map((s, i) => (
          <div key={s.title} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
            <span className="text-sm font-bold text-primary w-5 text-center">{i + 1}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{s.title}</p>
              <p className="text-[10px] text-muted-foreground">{s.plays} plays</p>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span className="text-[10px] text-green-500">{s.trend}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnalyticsPage;
