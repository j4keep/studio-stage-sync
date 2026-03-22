import { useState, useEffect } from "react";
import { ArrowLeft, Moon, Sun, Bell, BellOff, Globe, Lock, Eye, Trash2, LogOut, Info, ChevronRight, Smartphone, Palette, Crown, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import ThemePickerSheet from "@/components/ThemePickerSheet";
import ProGateModal from "@/components/ProGateModal";
import { useProGate } from "@/hooks/use-pro-gate";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const SettingsPage = () => {
  const navigate = useNavigate();
  const [showThemePicker, setShowThemePicker] = useState(false);
  const { isPro, showProModal, gatedFeature, requirePro, closeProModal } = useProGate();

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("wheuat_theme") !== "light");
  const [notifications, setNotifications] = useState(() => localStorage.getItem("wheuat_notifications") !== "false");
  const [newReleaseAlerts, setNewReleaseAlerts] = useState(() => localStorage.getItem("wheuat_release_alerts") !== "false");
  const [autoplay, setAutoplay] = useState(() => localStorage.getItem("wheuat_autoplay") !== "false");
  const [streamingQuality, setStreamingQuality] = useState(() => localStorage.getItem("wheuat_quality") || "high");
  const [privateProfile, setPrivateProfile] = useState(() => localStorage.getItem("wheuat_private") === "true");
  const [showActivity, setShowActivity] = useState(() => localStorage.getItem("wheuat_show_activity") !== "false");

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) { root.classList.remove("light"); root.classList.add("dark"); localStorage.setItem("wheuat_theme", "dark"); }
    else { root.classList.remove("dark"); root.classList.add("light"); localStorage.setItem("wheuat_theme", "light"); }
  }, [darkMode]);

  useEffect(() => { localStorage.setItem("wheuat_notifications", String(notifications)); }, [notifications]);
  useEffect(() => { localStorage.setItem("wheuat_release_alerts", String(newReleaseAlerts)); }, [newReleaseAlerts]);
  useEffect(() => { localStorage.setItem("wheuat_autoplay", String(autoplay)); }, [autoplay]);
  useEffect(() => { localStorage.setItem("wheuat_quality", streamingQuality); }, [streamingQuality]);
  useEffect(() => { localStorage.setItem("wheuat_private", String(privateProfile)); }, [privateProfile]);
  useEffect(() => { localStorage.setItem("wheuat_show_activity", String(showActivity)); }, [showActivity]);

  return (
    <div className="px-4 pt-6 pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-display font-bold text-foreground">Settings</h1>
      </div>

      {/* PRO Upgrade Banner */}
      {!isPro && (
        <button onClick={() => requirePro("PRO Subscription")} className="w-full mb-5 p-3.5 rounded-xl gradient-primary flex items-center gap-3 glow-primary">
          <Crown className="w-5 h-5 text-primary-foreground" />
          <div className="flex-1 text-left">
            <p className="text-sm font-bold text-primary-foreground">Upgrade to PRO</p>
            <p className="text-[10px] text-primary-foreground/80">Unlock all features · $10/mo</p>
          </div>
          <ChevronRight className="w-4 h-4 text-primary-foreground" />
        </button>
      )}

      {/* Appearance */}
      <Section title="Appearance">
        <SettingRow icon={darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />} label="Dark Mode" description="Switch between dark and light theme">
          <Switch checked={darkMode} onCheckedChange={setDarkMode} />
        </SettingRow>
        <ActionRow icon={<Palette className="w-4 h-4" />} label="Theme & Colors" onClick={() => setShowThemePicker(!showThemePicker)} />
        {showThemePicker && (
          <div className="mt-1.5 p-4 rounded-xl bg-card border border-border">
            <ThemePickerSheet onComplete={() => setShowThemePicker(false)} />
          </div>
        )}
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <SettingRow icon={notifications ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />} label="Push Notifications" description="Get notified about new content">
          <Switch checked={notifications} onCheckedChange={setNotifications} />
        </SettingRow>
        <SettingRow icon={<Bell className="w-4 h-4" />} label="New Release Alerts" description="Get alerts when artists drop new music">
          <Switch checked={newReleaseAlerts} onCheckedChange={setNewReleaseAlerts} />
        </SettingRow>
      </Section>

      {/* Playback */}
      <Section title="Playback">
        <SettingRow icon={<Smartphone className="w-4 h-4" />} label="Autoplay" description="Automatically play next track">
          <Switch checked={autoplay} onCheckedChange={setAutoplay} />
        </SettingRow>
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><Globe className="w-4 h-4" /></div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">Streaming Quality</p>
            <p className="text-[10px] text-muted-foreground">Affects data usage</p>
          </div>
          <div className="flex gap-1">
            {(["low", "medium", "high"] as const).map((q) => (
              <button key={q} onClick={() => setStreamingQuality(q)} className={`px-3 py-1 rounded-lg text-[10px] font-semibold capitalize transition-all ${streamingQuality === q ? "gradient-primary text-primary-foreground glow-primary" : "bg-secondary text-muted-foreground"}`}>
                {q}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Privacy */}
      <Section title="Privacy & Security">
        <SettingRow icon={<Lock className="w-4 h-4" />} label="Private Profile" description="Only followers can see your content">
          <Switch checked={privateProfile} onCheckedChange={setPrivateProfile} />
        </SettingRow>
        <SettingRow icon={<Eye className="w-4 h-4" />} label="Show Activity Status" description="Let others see when you're online">
          <Switch checked={showActivity} onCheckedChange={setShowActivity} />
        </SettingRow>
      </Section>

      {/* PRO Features Section */}
      <Section title="PRO Features">
        <ProActionRow isPro={isPro} icon={<Crown className="w-4 h-4" />} label="Earnings Dashboard" onClick={() => isPro ? navigate("/earnings") : requirePro("Earnings")} />
        <ProActionRow isPro={isPro} icon={<Crown className="w-4 h-4" />} label="Analytics" onClick={() => isPro ? navigate("/analytics") : requirePro("Analytics")} />
        <ProActionRow isPro={isPro} icon={<Crown className="w-4 h-4" />} label="Legal Vault" onClick={() => isPro ? navigate("/legal-vault") : requirePro("Legal Vault")} />
        <ProActionRow isPro={isPro} icon={<Crown className="w-4 h-4" />} label="News Feed Publishing" onClick={() => isPro ? navigate("/news-feed") : requirePro("News Feed")} />
        <ProActionRow isPro={isPro} icon={<Crown className="w-4 h-4" />} label="Messenger" onClick={() => isPro ? navigate("/messages") : requirePro("Messenger")} />
        <ProActionRow isPro={isPro} icon={<Crown className="w-4 h-4" />} label="Studio Listings" onClick={() => isPro ? navigate("/my-studios") : requirePro("Studio Listings")} />
        <ActionRow icon={<Crown className="w-4 h-4" />} label="My Songs" onClick={() => navigate("/my-songs")} />
        <ProActionRow isPro={isPro} icon={<Crown className="w-4 h-4" />} label="Upload Videos" onClick={() => isPro ? navigate("/my-videos") : requirePro("Upload Videos")} />
        <ProActionRow isPro={isPro} icon={<Crown className="w-4 h-4" />} label="Store Management" onClick={() => isPro ? navigate("/my-store") : requirePro("Store")} />
      </Section>

      {/* About */}
      <Section title="About">
        <ActionRow icon={<Info className="w-4 h-4" />} label="Terms & Conditions" onClick={() => navigate("/terms")} />
        <ActionRow icon={<Info className="w-4 h-4" />} label="Help & Support" onClick={() => navigate("/help")} />
        <ActionRow icon={<LogOut className="w-4 h-4" />} label="Log Out" destructive />
        <ActionRow icon={<Trash2 className="w-4 h-4" />} label="Delete Account" destructive />
      </Section>

      <p className="text-center text-[10px] text-muted-foreground mt-6">WHEUAT v1.0.0</p>

      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} />
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-5">
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
    <div className="flex flex-col gap-1.5">{children}</div>
  </div>
);

const SettingRow = ({ icon, label, description, children }: { icon: React.ReactNode; label: string; description: string; children: React.ReactNode }) => (
  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border">
    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">{icon}</div>
    <div className="flex-1">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground">{description}</p>
    </div>
    {children}
  </div>
);

const ActionRow = ({ icon, label, onClick, destructive }: { icon: React.ReactNode; label: string; onClick?: () => void; destructive?: boolean }) => (
  <button onClick={onClick} className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all">
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${destructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{icon}</div>
    <span className={`flex-1 text-sm font-medium text-left ${destructive ? "text-destructive" : "text-foreground"}`}>{label}</span>
    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
  </button>
);

const ProActionRow = ({ isPro, icon, label, onClick }: { isPro: boolean; icon: React.ReactNode; label: string; onClick: () => void }) => (
  <button onClick={onClick} className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all">
    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">{icon}</div>
    <span className="flex-1 text-sm font-medium text-left text-foreground">{label}</span>
    {!isPro && <span className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">PRO</span>}
    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
  </button>
);

export default SettingsPage;
