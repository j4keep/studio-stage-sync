import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, User, Mail, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface EditProfileSheetProps {
  open: boolean;
  onClose: () => void;
  profileData: {
    name: string;
    email: string;
    avatarUrl: string;
    bannerUrl: string;
  };
  onSave: (data: {
    name: string;
    email: string;
    avatarFile?: File;
    bannerFile?: File;
  }) => void;
}

const EditProfileSheet = ({ open, onClose, profileData, onSave }: EditProfileSheetProps) => {
  const { user } = useAuth();
  const [name, setName] = useState(profileData.name);
  const [email, setEmail] = useState(profileData.email);
  const [avatarPreview, setAvatarPreview] = useState(profileData.avatarUrl);
  const [bannerPreview, setBannerPreview] = useState(profileData.bannerUrl);
  const [avatarFile, setAvatarFile] = useState<File | undefined>();
  const [bannerFile, setBannerFile] = useState<File | undefined>();
  const [nameError, setNameError] = useState("");
  const [passwordResetSent, setPasswordResetSent] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setName(profileData.name);
    setEmail(profileData.email || user?.email || "");
    setAvatarPreview(profileData.avatarUrl);
    setBannerPreview(profileData.bannerUrl);
    setAvatarFile(undefined);
    setBannerFile(undefined);
    setNameError("");
    setPasswordResetSent(false);
  }, [open, profileData, user?.email]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setBannerFile(file);
      setBannerPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError("Name is required");
      return;
    }

    const { data: existing } = await supabase
      .from("profiles")
      .select("user_id")
      .ilike("display_name", name.trim())
      .neq("user_id", user?.id || "")
      .limit(1);

    if (existing && existing.length > 0) {
      setNameError("This display name is already in use. Choose another one.");
      return;
    }

    setNameError("");
    onSave({ name: name.trim(), email, avatarFile, bannerFile });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-[90] mx-auto flex max-h-[calc(100dvh-5.25rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] max-w-lg flex-col rounded-2xl border border-border bg-background shadow-2xl lg:bottom-4"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-muted" />
            </div>

            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-lg font-display font-bold text-foreground">Edit Profile</h2>
              <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5">
              <div className="flex flex-col gap-5 pb-6">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Background Picture</Label>
                  <button
                    onClick={() => bannerInputRef.current?.click()}
                    className="relative w-full h-32 rounded-xl overflow-hidden border-2 border-dashed border-border hover:border-primary/40 transition-all group"
                  >
                    <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center gap-2 text-white text-xs font-semibold">
                        <Camera className="w-4 h-4" /> Change Banner
                      </div>
                    </div>
                  </button>
                  <input ref={bannerInputRef} type="file" accept="image/*" onChange={handleBannerChange} className="hidden" />
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Profile Picture</Label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => avatarInputRef.current?.click()}
                      className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-border hover:border-primary/40 transition-all group flex-shrink-0"
                    >
                      <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                    </button>
                    <p className="text-[11px] text-muted-foreground">Tap to upload a new profile picture. Use a square image for best results.</p>
                  </div>
                  <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                </div>

                <div>
                  <Label htmlFor="edit-name" className="text-xs text-muted-foreground mb-1.5 block">Display name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="edit-name"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setNameError("");
                      }}
                      className={`pl-10 bg-card ${nameError ? "border-destructive" : "border-border"}`}
                      placeholder="Your display name"
                    />
                    {nameError && <p className="text-[10px] text-destructive mt-1">{nameError}</p>}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={email}
                      readOnly
                      className="pl-10 bg-muted/50 border-border text-muted-foreground cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Email is linked to your account and cannot be changed here.</p>
                </div>

                <div className="pt-2 border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Change Password</p>
                  <p className="text-[11px] text-muted-foreground mb-3">
                    We'll send a password reset link to your email address to verify it's you.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      setPasswordResetSent(true);
                      const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/settings`,
                      });
                      if (error) {
                        setPasswordResetSent(false);
                        toast.error(error.message || "Could not send password reset email");
                      } else {
                        toast.success("Password reset email sent");
                      }
                    }}
                    disabled={passwordResetSent || !email}
                    className="w-full py-2.5 rounded-xl bg-card border border-border text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-primary/30 transition-all disabled:opacity-50"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    {passwordResetSent ? "Reset Link Sent! Check your email" : "Send Password Reset Email"}
                  </button>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
              <button
                onClick={handleSave}
                className="w-full rounded-xl gradient-primary py-3 text-sm font-semibold text-primary-foreground glow-primary"
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default EditProfileSheet;

