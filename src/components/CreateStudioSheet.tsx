import { useState, useRef } from "react";
import { X, Plus, Camera, Trash2, Clock, CalendarDays } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface CreateStudioSheetProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CreateStudioSheet = ({ open, onClose, onCreated }: CreateStudioSheetProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [dailyRate, setDailyRate] = useState("");
  const [equipmentInput, setEquipmentInput] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [engineerAvailable, setEngineerAvailable] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pricingType, setPricingType] = useState<"hourly" | "daily" | "both">("hourly");
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [dateInput, setDateInput] = useState("");

  const addEquipment = () => {
    const trimmed = equipmentInput.trim();
    if (trimmed && equipment.length < 10) {
      setEquipment([...equipment, trimmed]);
      setEquipmentInput("");
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;
    const remaining = 6 - photoUrls.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) return;

    setUploadingPhoto(true);
    try {
      const newUrls: string[] = [];
      for (const file of toUpload) {
        const formData = new FormData();
        formData.append("file", file);

        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-studio-photo`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          }
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Upload failed");
        newUrls.push(json.url);
      }
      setPhotoUrls((prev) => [...prev, ...newUrls]);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const addBlockedDate = () => {
    if (dateInput && !blockedDates.includes(dateInput)) {
      setBlockedDates([...blockedDates, dateInput]);
      setDateInput("");
    }
  };

  const resetForm = () => {
    setName(""); setLocation(""); setDescription("");
    setHourlyRate(""); setDailyRate(""); setEquipmentInput("");
    setEquipment([]); setEngineerAvailable(false);
    setPhotoUrls([]);
    setPricingType("hourly"); setBlockedDates([]); setDateInput("");
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (!name.trim() || !location.trim()) {
      toast({ title: "Missing fields", description: "Name and location are required", variant: "destructive" });
      return;
    }
    const hr = parseFloat(hourlyRate);
    const dr = parseFloat(dailyRate);
    if (pricingType !== "daily" && (!hr || hr <= 0)) {
      toast({ title: "Invalid rate", description: "Set a valid hourly rate", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: studio, error } = await (supabase as any)
        .from("studios")
        .insert({
          user_id: user.id,
          name: name.trim(),
          location: location.trim(),
          description: description.trim() || null,
          hourly_rate: pricingType === "daily" ? 0 : hr,
          daily_rate: pricingType === "hourly" ? null : (dr > 0 ? dr : null),
          equipment,
          engineer_available: engineerAvailable,
        })
        .select()
        .single();

      if (error) throw error;

      // Insert photos
      if (photoUrls.length > 0 && studio) {
        const photoRows = photoUrls.map((url, i) => ({
          studio_id: studio.id,
          photo_url: url,
          display_order: i,
        }));
        await (supabase as any).from("studio_photos").insert(photoRows);
      }

      // Insert blocked/booked dates
      if (blockedDates.length > 0 && studio) {
        const dateRows = blockedDates.map((d) => ({
          studio_id: studio.id,
          date: d,
          is_booked: true,
        }));
        await (supabase as any).from("studio_availability").insert(dateRows);
      }

      toast({ title: "Studio created!", description: "Your studio listing is now live" });
      resetForm();
      onCreated();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-[92vh] overflow-y-auto bg-background border-t border-border rounded-t-2xl">
        <SheetHeader className="pb-4 border-b border-border">
          <SheetTitle className="text-foreground font-display">List Your Studio</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 py-5">
          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Studio Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sunset Sound Lab"
              className="w-full mt-1.5 px-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
          </div>

          {/* Location */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Location *</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Los Angeles, CA"
              className="w-full mt-1.5 px-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your studio..."
              rows={3} className="w-full mt-1.5 px-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none" />
          </div>

          {/* Pricing Type */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Pricing</label>
            <div className="flex gap-2 mb-3">
              {(["hourly", "daily", "both"] as const).map((t) => (
                <button key={t} onClick={() => setPricingType(t)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                    pricingType === t ? "gradient-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground"
                  }`}>{t}</button>
              ))}
            </div>
            <div className="flex gap-3">
              {pricingType !== "daily" && (
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Hourly Rate</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="75"
                      className="w-full pl-7 pr-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:border-primary/50" />
                  </div>
                </div>
              )}
              {pricingType !== "hourly" && (
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CalendarDays className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Daily Rate</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <input type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} placeholder="500"
                      className="w-full pl-7 pr-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:border-primary/50" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Equipment */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Equipment</label>
            <div className="flex gap-2 mt-1.5">
              <input value={equipmentInput} onChange={(e) => setEquipmentInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEquipment())}
                placeholder="e.g. Neumann U87" className="flex-1 px-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
              <button onClick={addEquipment} className="px-3 py-3 rounded-xl gradient-primary text-primary-foreground">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {equipment.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {equipment.map((e, i) => (
                  <span key={i} className="text-[10px] px-2.5 py-1 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                    {e}
                    <button onClick={() => setEquipment(equipment.filter((_, j) => j !== i))}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Engineer */}
          <button onClick={() => setEngineerAvailable(!engineerAvailable)}
            className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${
              engineerAvailable ? "bg-primary/10 border-primary/30" : "bg-card border-border"
            }`}>
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              engineerAvailable ? "border-primary bg-primary" : "border-muted-foreground"
            }`}>
              {engineerAvailable && <span className="text-primary-foreground text-xs font-bold">✓</span>}
            </div>
            <span className="text-sm text-foreground">Engineer Available</span>
          </button>

          {/* Photos */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Photos ({photoUrls.length}/6)
            </label>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
              onChange={handlePhotoUpload} />
            <button onClick={() => fileInputRef.current?.click()} disabled={photoUrls.length >= 6 || uploadingPhoto}
              className="w-full mt-1.5 py-3 rounded-xl border border-dashed border-border bg-card text-sm text-muted-foreground flex items-center justify-center gap-2 hover:border-primary/50 transition-all disabled:opacity-50">
              {uploadingPhoto ? (
                <><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Uploading...</>
              ) : (
                <><Camera className="w-4 h-4" /> Tap to upload photos</>
              )}
            </button>
            {photoUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {photoUrls.map((url, i) => (
                  <div key={i} className="relative aspect-video rounded-lg overflow-hidden border border-border">
                    <img src={url} alt={`Studio ${i + 1}`} className="w-full h-full object-cover" />
                    <button onClick={() => setPhotoUrls(photoUrls.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center">
                      <Trash2 className="w-3 h-3 text-destructive-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Blocked Dates */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Blocked Dates</label>
            <div className="flex gap-2 mt-1.5">
              <input type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:border-primary/50" />
              <button onClick={addBlockedDate} className="px-3 py-3 rounded-xl gradient-primary text-primary-foreground">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {blockedDates.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {blockedDates.map((d) => (
                  <span key={d} className="text-[10px] px-2.5 py-1 rounded-full bg-destructive/10 text-destructive flex items-center gap-1">
                    {d}
                    <button onClick={() => setBlockedDates(blockedDates.filter((bd) => bd !== d))}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <button onClick={handleSubmit} disabled={loading}
            className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm glow-primary disabled:opacity-50">
            {loading ? "Creating..." : "List Studio"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CreateStudioSheet;
