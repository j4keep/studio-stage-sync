import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, Music, FolderHeart, Building2, Heart, Download, Upload, DollarSign,
  Settings, Shield, BarChart3, HelpCircle, Play, Video, Mic2, ShoppingBag,
  CheckCircle, UserPlus, Share2, MoreHorizontal, ChevronRight, Library, Edit3
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import profileBanner from "@/assets/profile-banner.jpg";
import profileAvatar from "@/assets/profile-avatar.jpg";
import album1 from "@/assets/album-1.jpg";
import album2 from "@/assets/album-2.jpg";
import album3 from "@/assets/album-3.jpg";
import album4 from "@/assets/album-4.jpg";
import podcast1 from "@/assets/podcast-1.jpg";
import musicvideo1 from "@/assets/musicvideo-1.jpg";
import EditProfileSheet from "@/components/EditProfileSheet";

const ProfilePage = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<"artist" | "fan">("artist");

  return (
    <div className="pb-4">
      {/* Role Toggle + Settings */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="w-8" />
        <div className="flex gap-1 p-1 rounded-full bg-card border border-border">
          {(["artist", "fan"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`px-5 py-1.5 rounded-full text-[11px] font-semibold transition-all capitalize ${
                role === r
                  ? "gradient-primary text-primary-foreground glow-primary"
                  : "text-muted-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <button onClick={() => navigate("/settings")} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {role === "artist" ? (
          <motion.div key="artist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ArtistProfile />
          </motion.div>
        ) : (
          <motion.div key="fan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <FanProfile />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ArtistProfile = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("songs");
  const [showEditProfile, setShowEditProfile] = useState(false);

  const tabs = [
    { id: "songs", label: "Songs", icon: Music },
    { id: "videos", label: "Videos", icon: Video },
    { id: "podcasts", label: "Podcasts", icon: Mic2 },
    { id: "projects", label: "Projects", icon: FolderHeart },
    { id: "store", label: "Store", icon: ShoppingBag },
  ];

  const songs = [
    { title: "Midnight Flow", plays: "12.4K", duration: "3:42", img: album1 },
    { title: "City Lights", plays: "8.1K", duration: "4:15", img: album2 },
    { title: "Rise Above", plays: "15.7K", duration: "3:28", img: album3 },
    { title: "Echoes", plays: "5.3K", duration: "4:01", img: album4 },
  ];

  return (
    <>
      {/* Banner */}
      <div className="relative h-44 overflow-hidden">
        <img src={profileBanner} alt="Banner" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
      </div>

      {/* Avatar & Info overlapping banner */}
      <div className="px-4 -mt-12 relative z-10">
        <div className="flex items-end gap-3">
          <img
            src={profileAvatar}
            alt="Profile"
            className="w-20 h-20 rounded-full border-[3px] border-background object-cover"
          />
          <div className="flex-1 pb-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-display font-bold text-foreground">WHEUAT Artist</h2>
              <CheckCircle className="w-4 h-4 text-primary fill-primary/20" />
            </div>
            <p className="text-xs text-muted-foreground">@wheuatartist · Independent</p>
          </div>
        </div>

        {/* Edit Profile Button */}
        <button
          onClick={() => setShowEditProfile(true)}
          className="w-full mt-3 py-2.5 rounded-xl bg-card border border-border text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-primary/30 transition-all"
        >
          <Edit3 className="w-3.5 h-3.5" /> Edit Profile
        </button>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-3">
          <button className="flex-1 py-2.5 rounded-xl gradient-primary text-primary-foreground text-xs font-semibold glow-primary flex items-center justify-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Follow
          </button>
          <button className="flex-1 py-2.5 rounded-xl bg-card border border-border text-foreground text-xs font-semibold flex items-center justify-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Contribute
          </button>
          <button className="w-10 py-2.5 rounded-xl bg-card border border-border text-muted-foreground flex items-center justify-center">
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { label: "Songs", value: "12" },
            { label: "Followers", value: "1.2K" },
            { label: "Plays", value: "48K" },
            { label: "Earnings", value: "$1.2K" },
          ].map((s) => (
            <div key={s.label} className="p-2.5 rounded-xl bg-card border border-border text-center">
              <p className="text-base font-display font-bold text-primary">{s.value}</p>
              <p className="text-[9px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* PRO Badge */}
        <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center glow-primary">
            <Shield className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Pro Artist</p>
            <p className="text-[10px] text-muted-foreground">Legal Vault · Analytics · Verified Badge</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>

      {/* Content Tabs */}
      <div className="mt-5 border-t border-border">
        <div className="flex overflow-x-auto scrollbar-hide px-4 gap-1 pt-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "gradient-primary text-primary-foreground glow-primary"
                  : "text-muted-foreground bg-card border border-border"
              }`}
            >
              <tab.icon className="w-3 h-3" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="px-4 mt-3">
          {activeTab === "songs" && (
            <div className="flex flex-col gap-2">
              {songs.map((song, i) => (
                <motion.div
                  key={song.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
                >
                  <div className="relative w-11 h-11 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={song.img} alt={song.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <Play className="w-4 h-4 text-white fill-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
                    <p className="text-[10px] text-muted-foreground">{song.plays} plays · {song.duration}</p>
                  </div>
                  <button className="text-muted-foreground">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
          {activeTab === "videos" && (
            <div className="grid grid-cols-2 gap-2">
              {[musicvideo1, album1].map((img, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden aspect-video bg-card border border-border">
                  <img src={img} alt="Video" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Play className="w-6 h-6 text-white fill-white" />
                  </div>
                  <div className="absolute bottom-2 left-2 text-[10px] text-white font-medium">
                    {i === 0 ? "Behind The Scenes" : "Live Session"}
                  </div>
                </div>
              ))}
            </div>
          )}
          {activeTab === "podcasts" && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                <img src={podcast1} alt="Podcast" className="w-11 h-11 rounded-lg object-cover" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">The Artist Journey</p>
                  <p className="text-[10px] text-muted-foreground">Episode 5 · 32 min</p>
                </div>
                <Play className="w-4 h-4 text-primary" />
              </div>
            </div>
          )}
          {activeTab === "projects" && (
            <div className="p-4 rounded-xl bg-card border border-border text-center">
              <FolderHeart className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">2 active projects</p>
              <button onClick={() => navigate("/projects")} className="mt-2 text-xs text-primary font-semibold">View Projects →</button>
            </div>
          )}
          {activeTab === "store" && (
            <div className="p-4 rounded-xl bg-card border border-border text-center">
              <ShoppingBag className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Digital downloads coming soon</p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mt-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Quick Actions</p>
        <div className="flex flex-col gap-1.5">
          {[
            { icon: Library, label: "Library", sub: "3 playlists", action: () => navigate("/library") },
            { icon: Upload, label: "Upload Songs", sub: "12 tracks", action: () => {} },
            { icon: Building2, label: "My Studios", sub: "1 listing", action: () => {} },
            { icon: BarChart3, label: "Analytics", sub: "View insights", action: () => {} },
            { icon: DollarSign, label: "Earnings", sub: "$1,247.00", action: () => {} },
            { icon: Shield, label: "Legal Vault", sub: "PRO", action: () => navigate("/legal-vault") },
            { icon: HelpCircle, label: "Help & Support", sub: "", action: () => navigate("/help") },
          ].map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <item.icon className="w-4 h-4 text-primary" />
              </div>
              <span className="flex-1 text-sm font-medium text-foreground text-left">{item.label}</span>
              {item.sub && <span className="text-[11px] text-muted-foreground">{item.sub}</span>}
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      {/* Edit Profile Sheet */}
      <EditProfileSheet
        open={showEditProfile}
        onClose={() => setShowEditProfile(false)}
        profileData={{
          name: "WHEUAT Artist",
          email: "artist@wheuat.com",
          avatarUrl: profileAvatar,
          bannerUrl: profileBanner,
        }}
        onSave={(data) => {
          console.log("Profile updated:", data);
        }}
      />
    </>
  );
};

const FanProfile = () => {
  const navigate = useNavigate();

  return (
    <div className="px-4">
      {/* Fan Avatar */}
      <div className="flex flex-col items-center mb-6 mt-2">
        <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-display font-bold text-2xl glow-primary mb-3">
          WU
        </div>
        <h2 className="text-lg font-display font-bold text-foreground">WHEUAT Fan</h2>
        <p className="text-xs text-muted-foreground">Fan Account</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
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

      {/* Menu */}
      <div className="flex flex-col gap-1.5">
        {[
          { icon: Library, label: "Library", count: "3 playlists", action: () => navigate("/library") },
          { icon: Heart, label: "Followed Artists", count: "8", action: () => {} },
          { icon: FolderHeart, label: "Contributions", count: "$340", action: () => {} },
          { icon: Building2, label: "Saved Studios", count: "3", action: () => {} },
          { icon: Download, label: "Purchases", count: "5 songs", action: () => {} },
          { icon: HelpCircle, label: "Help & Support", count: "", action: () => navigate("/help") },
        ].map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <item.icon className="w-4 h-4 text-primary" />
            </div>
            <span className="flex-1 text-sm font-medium text-foreground text-left">{item.label}</span>
            {item.count && <span className="text-[11px] text-muted-foreground">{item.count}</span>}
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default ProfilePage;
