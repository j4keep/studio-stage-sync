import { useState } from "react";
import { motion } from "framer-motion";
import { User, Music, FolderHeart, Building2, Heart, Download, Upload, DollarSign, Settings, Shield, BarChart3, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const ProfilePage = () => {
  const [role, setRole] = useState<"artist" | "fan">("artist");

  return (
    <div className="px-4 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-display font-bold text-foreground">Profile</h1>
        <button className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Avatar & Info */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-display font-bold text-2xl glow-primary mb-3">
          WU
        </div>
        <h2 className="text-lg font-display font-bold text-foreground">WHEUAT User</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground capitalize">{role} Account</span>
          {role === "artist" && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              <Shield className="w-2.5 h-2.5" /> PRO
            </span>
          )}
        </div>
      </div>

      {/* Role Toggle (Demo) */}
      <div className="flex gap-2 mb-8 p-1 rounded-xl bg-card border border-border">
        {(["artist", "fan"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all capitalize ${
              role === r
                ? "gradient-primary text-primary-foreground glow-primary"
                : "text-muted-foreground"
            }`}
          >
            {r} View
          </button>
        ))}
      </div>

      {role === "artist" ? <ArtistProfile /> : <FanProfile />}
    </div>
  );
};

const ArtistProfile = () => {
  const navigate = useNavigate();
  const menuItems = [
    { icon: Upload, label: "Upload Songs", count: "12 tracks", action: () => {} },
    { icon: FolderHeart, label: "My Projects", count: "2 active", action: () => {} },
    { icon: Building2, label: "My Studios", count: "1 listing", action: () => {} },
    { icon: BarChart3, label: "Analytics", count: "", action: () => {} },
    { icon: DollarSign, label: "Earnings", count: "$1,247.00", action: () => {} },
    { icon: Shield, label: "Legal Vault", count: "PRO", action: () => {} },
    { icon: HelpCircle, label: "Help & Support", count: "", action: () => navigate("/help") },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-2 mb-4">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "Songs", value: "12" },
          { label: "Followers", value: "1.2K" },
          { label: "Earnings", value: "$1.2K" },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded-xl bg-card border border-border text-center">
            <p className="text-lg font-display font-bold text-primary">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {menuItems.map((item) => (
        <button
          key={item.label}
          onClick={item.action}
          className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
        >
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <item.icon className="w-4 h-4 text-primary" />
          </div>
          <span className="flex-1 text-sm font-medium text-foreground text-left">{item.label}</span>
          {item.count && <span className="text-xs text-muted-foreground">{item.count}</span>}
        </button>
      ))}
    </motion.div>
  );
};

const FanProfile = () => {
  const navigate = useNavigate();
  const menuItems = [
    { icon: Heart, label: "Followed Artists", count: "8", action: () => {} },
    { icon: FolderHeart, label: "Contributions", count: "$340", action: () => {} },
    { icon: Building2, label: "Saved Studios", count: "3", action: () => {} },
    { icon: Download, label: "Purchases", count: "5 songs", action: () => {} },
    { icon: HelpCircle, label: "Help & Support", count: "", action: () => navigate("/help") },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-2 mb-4">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "Following", value: "8" },
          { label: "Contributed", value: "$340" },
          { label: "Downloads", value: "5" },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded-xl bg-card border border-border text-center">
            <p className="text-lg font-display font-bold text-primary">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {menuItems.map((item) => (
        <button
          key={item.label}
          onClick={item.action}
          className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
        >
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <item.icon className="w-4 h-4 text-primary" />
          </div>
          <span className="flex-1 text-sm font-medium text-foreground text-left">{item.label}</span>
          {item.count && <span className="text-xs text-muted-foreground">{item.count}</span>}
        </button>
      ))}
    </motion.div>
  );
};

export default ProfilePage;
