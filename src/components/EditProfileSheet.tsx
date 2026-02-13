import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, User, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [name, setName] = useState(profileData.name);
  const [email, setEmail] = useState(profileData.email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(profileData.avatarUrl);
  const [bannerPreview, setBannerPreview] = useState(profileData.bannerUrl);
  const [avatarFile, setAvatarFile] = useState<File | undefined>();
  const [bannerFile, setBannerFile] = useState<File | undefined>();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

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

  const handleSave = () => {
    onSave({ name, email, avatarFile, bannerFile });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto bg-background rounded-t-2xl border-t border-border max-h-[90vh] overflow-y-auto"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-lg font-display font-bold text-foreground">Edit Profile</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-4 py-5 flex flex-col gap-5">
              {/* Banner Upload */}
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

              {/* Avatar Upload */}
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

              {/* Name */}
              <div>
                <Label htmlFor="edit-name" className="text-xs text-muted-foreground mb-1.5 block">Artist Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="edit-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 bg-card border-border"
                    placeholder="Your display name"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <Label htmlFor="edit-email" className="text-xs text-muted-foreground mb-1.5 block">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="edit-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-card border-border"
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              {/* Password Section */}
              <div className="pt-2 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Change Password</p>
                <div className="flex flex-col gap-3">
                  <div>
                    <Label htmlFor="current-pw" className="text-xs text-muted-foreground mb-1.5 block">Current Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="current-pw"
                        type={showPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="pl-10 pr-10 bg-card border-border"
                        placeholder="Current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="new-pw" className="text-xs text-muted-foreground mb-1.5 block">New Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="new-pw"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-10 bg-card border-border"
                        placeholder="New password"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                className="w-full py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold glow-primary mt-2"
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
