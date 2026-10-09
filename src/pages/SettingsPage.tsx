import { useState, useEffect } from "react";
import { ArrowLeft, Moon, Sun, Lock, Trash2, LogOut, Info, ChevronRight, ChevronDown, Palette, Crown, XCircle, Coffee, Ban, UserRound, Shield, Sparkles, HelpCircle, Headphones, Briefcase, ShoppingBag, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import ThemePickerSheet from "@/components/ThemePickerSheet";
import CharacterSkinPickerSheet from "@/components/CharacterSkinPickerSheet";
import ProGateModal from "@/components/ProGateModal";
import { useProGate } from "@/hooks/use-pro-gate";
import { useAuth } from "@/contexts/AuthContext";
import MarketplaceLocationCard from "@/components/marketplace/MarketplaceLocationCard";
import MarketplaceSafetyTips from "@/components/marketplace/MarketplaceSafetyTips";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useSafetyBalance } from "@/hooks/useSafetyBalance";
import { isDetoxActive } from "@/lib/safety-balance";
import {
  HAPPENING_BALLOON_CATEGORIES,
  getHappeningBalloonCategories,
  happeningBalloonsEnabled,
  setHappeningBalloonCategories,
  setHappeningBalloonsEnabled,
} from "@/components/feed/HappeningBalloon";
import type { HappeningKind } from "@/lib/happening-items";
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
  const { user, signOut } = useAuth();
  const { policy, updatePolicy } = useSafetyBalance();
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showSkinPicker, setShowSkinPicker] = useState(false);
  const { isPro, showProModal, gatedFeature, requirePro, closeProModal, deactivatePro } = useProGate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [happeningBalloons, setHappeningBalloons] = useState(happeningBalloonsEnabled);
  const [happeningCategories, setHappeningCategories] = useState<HappeningKind[]>(getHappeningBalloonCategories);
  const [happeningCategoriesOpen, setHappeningCategoriesOpen] = useState(false);

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("wheuat_theme") !== "light");
  const [privateProfile, setPrivateProfile] = useState(() => {
    if (typeof window === "undefined") return false;
    const youthPrivate = localStorage.getItem("wheuat_private") === "true";
    return youthPrivate;
  });

  const detoxOn = policy ? isDetoxActive(policy) : localStorage.getItem("wheuat_take_a_break") === "true";
  const youthLockedPrivate = Boolean(policy?.youth_mode);

  useEffect(() => {
    if (policy?.profile_privacy === "private") setPrivateProfile(true);
    else if (policy && !policy.youth_mode) setPrivateProfile(false);
  }, [policy?.profile_privacy, policy?.youth_mode]);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) { root.classList.remove("light"); root.classList.add("dark"); localStorage.setItem("wheuat_theme", "dark"); }
    else { root.classList.remove("dark"); root.classList.add("light"); localStorage.setItem("wheuat_theme", "light"); }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem("wheuat_private", String(privateProfile || youthLockedPrivate));
  }, [privateProfile, youthLockedPrivate]);

  const onPrivateToggle = (v: boolean) => {
    if (youthLockedPrivate && !v) {
      toast({ title: "Youth accounts stay private", description: "A connected parent can review profile visibility later." });
      return;
    }
    setPrivateProfile(v);
    void updatePolicy({ profile_privacy: v ? "private" : "public" });
  };

  const onDetoxToggle = (v: boolean) => {
    if (v) {
      const until = new Date();
      until.setDate(until.getDate() + 1);
      until.setHours(6, 0, 0, 0);
      void updatePolicy({ detox_until: until.toISOString() });
    } else {
      void updatePolicy({ detox_until: null });
    }
  };

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
        <ActionRow icon={<UserRound className="w-4 h-4" />} label="Character Skin Tone" onClick={() => setShowSkinPicker(!showSkinPicker)} />
        {showSkinPicker && (
          <div className="mt-1.5 p-4 rounded-xl bg-card border border-border">
            <CharacterSkinPickerSheet />
          </div>
        )}
      </Section>

      <Section title="YAJ AI & Support">
        <ActionRow
          icon={<Sparkles className="w-4 h-4" />}
          label="YAJ AI Settings"
          onClick={() => navigate("/ask-yaj/settings")}
        />
        <ActionRow
          icon={<HelpCircle className="w-4 h-4" />}
          label="Help Center"
          onClick={() => navigate("/help")}
        />
        <ActionRow
          icon={<Headphones className="w-4 h-4" />}
          label="Contact Support"
          onClick={() => navigate("/helpdesk")}
        />
      </Section>

      <Section title="Business & Professional Tools">
        <ActionRow
          icon={<Briefcase className="w-4 h-4" />}
          label="Professional Dashboard"
          onClick={() => navigate("/pro")}
        />
        <ActionRow
          icon={<ShoppingBag className="w-4 h-4" />}
          label="Marketplace Seller Dashboard"
          onClick={() => navigate("/marketplace/store-dashboard")}
        />
        <ActionRow
          icon={<Wrench className="w-4 h-4" />}
          label="Local Help Business"
          onClick={() => navigate("/local-help/business")}
        />
      </Section>

      {/* Marketplace location */}
      {user && (
        <Section title="Marketplace location">
          <div className="px-1 pb-1">
            <MarketplaceLocationCard userId={user.id} title="Location for Marketplace" compact />
          </div>
        </Section>
      )}

      <Section title="Feed Preferences">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3 p-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Happening balloons</p>
              <p className="text-[10px] text-muted-foreground">Show useful activity while viewing Feed posts</p>
            </div>
            <Switch
              checked={happeningBalloons}
              onCheckedChange={(enabled) => {
                setHappeningBalloons(enabled);
                setHappeningBalloonsEnabled(enabled);
                if (!enabled) setHappeningCategoriesOpen(false);
              }}
            />
          </div>
          {happeningBalloons && (
            <>
              <button
                type="button"
                onClick={() => setHappeningCategoriesOpen((open) => !open)}
                className="flex w-full items-center justify-between border-t border-border px-3.5 py-3 text-left"
              >
                <div>
                  <p className="text-[12px] font-semibold text-foreground">Happening categories</p>
                  <p className="text-[10px] text-muted-foreground">
                    {happeningCategories.length === HAPPENING_BALLOON_CATEGORIES.length
                      ? "All categories"
                      : happeningCategories.length === 0
                        ? "None selected"
                        : `${happeningCategories.length} selected`}
                  </p>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${happeningCategoriesOpen ? "rotate-180" : ""}`} />
              </button>
              {happeningCategoriesOpen && (
                <div className="grid gap-2 border-t border-border p-3">
                  {HAPPENING_BALLOON_CATEGORIES.map(({ kind, label }) => {
                    const checked = happeningCategories.includes(kind);
                    return (
                      <div key={kind} className="flex items-center justify-between rounded-lg bg-muted/45 px-3 py-2">
                        <span className="text-[12px] font-medium text-foreground">{label}</span>
                        <Switch
                          checked={checked}
                          onCheckedChange={(enabled) => {
                            const next = enabled
                              ? Array.from(new Set([...happeningCategories, kind]))
                              : happeningCategories.filter((value) => value !== kind);
                            setHappeningCategories(next);
                            setHappeningBalloonCategories(next);
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </Section>

      {/* Privacy & Visibility */}
      <Section title="Privacy & Visibility">
        <SettingRow
          icon={<Lock className="w-4 h-4" />}
          label="Private Profile"
          description={youthLockedPrivate ? "Required for YAJ Youth accounts" : "Only followers can see your content"}
        >
          <Switch checked={privateProfile || youthLockedPrivate} onCheckedChange={onPrivateToggle} />
        </SettingRow>
        <ActionRow icon={<Ban className="w-4 h-4" />} label="Blocking" onClick={() => navigate("/settings/blocking")} />
        <div className="px-1 pb-2 pt-1">
          <MarketplaceSafetyTips variant="panel" />
        </div>
      </Section>

      {/* Safety & Balance */}
      <Section title="Safety & Balance">
        <ActionRow
          icon={<Shield className="w-4 h-4" />}
          label="YAJ Safety Center"
          onClick={() => navigate("/safety")}
        />
        <ActionRow
          icon={<Coffee className="w-4 h-4" />}
          label={policy?.youth_mode ? "Youth Balance" : "Digital Balance"}
          onClick={() => navigate("/safety/balance")}
        />
        <SettingRow
          icon={<Coffee className="w-4 h-4" />}
          label="Social Detox"
          description="Pause Feed, Battles & social discovery. Marketplace, Jobs & Profile stay on."
        >
          <Switch checked={detoxOn} onCheckedChange={onDetoxToggle} />
        </SettingRow>
      </Section>

      <Section title="Advanced Tools">
        <ProActionRow isPro={isPro} icon={<Crown className="w-4 h-4" />} label="Analytics" onClick={() => isPro ? navigate("/analytics") : requirePro("Analytics")} />
        <ProActionRow isPro={isPro} icon={<Crown className="w-4 h-4" />} label="Earnings Dashboard" onClick={() => isPro ? navigate("/earnings") : requirePro("Earnings")} />
      </Section>

      {/* Account */}
      <Section title="Account">
        {isPro && (
          <ActionRow icon={<XCircle className="w-4 h-4" />} label="Cancel Subscription" onClick={() => setShowCancelDialog(true)} destructive />
        )}
        <ActionRow icon={<LogOut className="w-4 h-4" />} label="Log Out" onClick={async () => { await signOut(); navigate("/auth"); }} destructive />
        <ActionRow icon={<Trash2 className="w-4 h-4" />} label="Delete Account" onClick={() => setShowDeleteDialog(true)} destructive />
      </Section>

      {/* About */}
      <Section title="About">
        <ActionRow icon={<Info className="w-4 h-4" />} label="Terms & Conditions" onClick={() => navigate("/terms")} />
        <ActionRow icon={<Info className="w-4 h-4" />} label="Help Center" onClick={() => navigate("/help")} />
        <ActionRow icon={<Headphones className="w-4 h-4" />} label="Help Desk" onClick={() => navigate("/helpdesk")} />
      </Section>

      <p className="text-center text-[10px] text-muted-foreground mt-6">YAJ v1.0.0</p>

      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} />

      {/* Cancel Subscription Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>Cancel PRO Subscription?</DialogTitle>
            <DialogDescription>You'll lose access to paid PRO tools such as advanced analytics and earnings features at the end of your current access period.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <button onClick={() => setShowCancelDialog(false)} className="flex-1 py-2.5 rounded-xl bg-card border border-border text-foreground text-sm font-semibold">Keep PRO</button>
            <button onClick={() => { deactivatePro(); setShowCancelDialog(false); toast({ title: "Subscription cancelled" }); }} className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold">Cancel</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>Delete Account?</DialogTitle>
            <DialogDescription>This permanently deletes your YAJ account and account data. This cannot be undone. Type "DELETE" to confirm.</DialogDescription>
          </DialogHeader>
          <input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder='Type "DELETE" to confirm'
            className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-foreground text-sm"
          />
          <DialogFooter className="flex gap-2">
            <button onClick={() => { setShowDeleteDialog(false); setDeleteConfirmText(""); }} className="flex-1 py-2.5 rounded-xl bg-card border border-border text-foreground text-sm font-semibold">Cancel</button>
            <button
              disabled={deleteConfirmText !== "DELETE" || deletingAccount}
              onClick={async () => {
                if (deletingAccount) return;
                setDeletingAccount(true);
                try {
                  const { error } = await supabase.functions.invoke("delete-account", { body: {} });
                  if (error) throw error;
                  toast({ title: "Account deleted", description: "Your YAJ account has been permanently deleted." });
                  await signOut();
                  navigate("/auth", { replace: true });
                } catch (e: any) {
                  toast({
                    title: "Could not delete account",
                    description: e?.message || "Please try again or contact the Help Desk.",
                    variant: "destructive",
                  });
                } finally {
                  setDeletingAccount(false);
                }
              }}
              className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-40"
            >{deletingAccount ? "Deleting…" : "Delete"}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-4">
    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.13em] text-muted-foreground">{title}</p>
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
