import { useState, useRef, useEffect } from "react";
import { X, Camera, Trash2, Clock, CalendarDays, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface EditStudioSheetProps {
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
  studio: {
    id: string;
    name: string;
    location: string;
    description?: string | null;
    hourly_rate: number;
    daily_rate: number | null;
    equipment: string[];
    engineer_available: boolean;
  } | null;
}

const EditStudioSheet = ({ open, onClose, onUpdated, studio }: EditStudioSheetProps) => {
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
  const [existingPhotos, setExistingPhotos] = useState<{ id: string; photo_url: string }[]>([]);
  const [newPhotoUrls, setNewPhotoUrls] = useState<string[]>([]);
  const [deletedPhotoIds, setDeletedPhotoIds] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_PHOTOS = 4;

  useEffect(() => {
    if (studio && open) {
      setName(studio.name);
      setLocation(studio.location);
      setDescription(studio.description ?? "");
      setHourlyRate(studio.hourly_rate.toString());
      setDailyRate(studio.daily_rate?.toString() ?? "");
      setEquipment(studio.equipment);
      setEngineerAvailable(studio.engineer_available);
      setNewPhotoUrls([]);
      setDeletedPhotoIds([]);
      fetchPhotos(studio.id);
    }
  }, [studio, open]);

  const fetchPhotos = async (studioId: string) => {
    const { data } = await (supabase as any)
      .from("studio_photos")
      .select("id, photo_url")
      .eq("studio_id", studioId)
      .order("display_order", { ascending: true });
    setExistingPhotos(data ?? []);
  };

  const totalPhotos = existingPhotos.filter((p) => !deletedPhotoIds.includes(p.id)).length + newPhotoUrls.length;

  const addEquipment = () => {
    const trimmed = equipmentInput.trim();
    if (trimmed && equipment.length < 10) {
      setEquipment([...equipment, trimmed]);
      setEquipmentInput("");
    }
  };

  const compressImage = (file: File, maxWidth = 800, quality = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const scale = Math.min(1, maxWidth / img.width);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = ev.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const remaining = MAX_PHOTOS - totalPhotos;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) return;

    setUploadingPhoto(true);
    try {
      const urls: string[] = [];
      for (const file of toUpload) {
        urls.push(await compressImage(file));
      }
      setNewPhotoUrls((prev) => [...prev, ...urls]);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!user || !studio) return;
    if (!name.trim() || !location.trim()) {
      toast({ title: "Missing fields", description: "Name and location are required", variant: "destructive" });
      return;
    }
    const hr = parseFloat(hourlyRate);
    if (!hr || hr <= 0) {
      toast({ title: "Invalid rate", description: "Set a valid hourly rate", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const dr = parseFloat(dailyRate);
      const { error } = await (supabase as any)
        .from("studios")
        .update({
          name: name.trim(),
          location: location.trim(),
          description: description.trim() || null,
          hourly_rate: hr,
          daily_rate: dr > 0 ? dr : null,
          equipment,
          engineer_available: engineerAvailable,
        })
        .eq("id", studio.id);

      if (error) throw error;

      // Delete removed photos
      if (deletedPhotoIds.length > 0) {
        await (supabase as any).from("studio_photos").delete().in("id", deletedPhotoIds);
      }

      // Insert new photos
      if (newPhotoUrls.length > 0) {
        const keptCount = existingPhotos.filter((p) => !deletedPhotoIds.includes(p.id)).length;
        const rows = newPhotoUrls.map((url, i) => ({
          studio_id: studio.id,
          photo_url: url,
          display_order: keptCount + i,
        }));
        await (supabase as any).from("studio_photos").insert(rows);
      }

      toast({ title: "Studio updated!" });
      onUpdated();
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
          <SheetTitle className="text-foreground font-display">Edit Studio</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-5 py-5">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Studio Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full mt-1.5 px-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Location *</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)}
              className="w-full mt-1.5 px-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
              className="w-full mt-1.5 px-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none" />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Hourly Rate</span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)}
                  className="w-full pl-7 pr-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:border-primary/50" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-1">
                <CalendarDays className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">Daily Rate</span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <input type="number" value={dailyRate} onChange={(e) => setDailyRate(e.target.value)} placeholder="Optional"
                  className="w-full pl-7 pr-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm focus:outline-none focus:border-primary/50" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Equipment</label>
            <div className="flex gap-2 mt-1.5">
              <input value={equipmentInput} onChange={(e) => setEquipmentInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addEquipment())}
                placeholder="e.g. Neumann U87"
                className="flex-1 px-4 py-3 rounded-xl bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />
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
              Photos ({totalPhotos}/{MAX_PHOTOS})
            </label>
            <input ref={fileInputRef} type="file" accept="image/jpeg,.jpg,.png,.webp,image/*" multiple className="hidden"
              onChange={handlePhotoUpload} />
            <button onClick={() => fileInputRef.current?.click()} disabled={totalPhotos >= MAX_PHOTOS || uploadingPhoto}
              className="w-full mt-1.5 py-3 rounded-xl border border-dashed border-border bg-card text-sm text-muted-foreground flex items-center justify-center gap-2 hover:border-primary/50 transition-all disabled:opacity-50">
              {uploadingPhoto ? (
                <><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Uploading...</>
              ) : (
                <><Camera className="w-4 h-4" /> Tap to upload photos</>
              )}
            </button>
            {(existingPhotos.length > 0 || newPhotoUrls.length > 0) && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {existingPhotos
                  .filter((p) => !deletedPhotoIds.includes(p.id))
                  .map((p) => (
                    <div key={p.id} className="relative aspect-video rounded-lg overflow-hidden border border-border">
                      <img src={p.photo_url} alt="Studio" className="w-full h-full object-cover" />
                      <button onClick={() => setDeletedPhotoIds([...deletedPhotoIds, p.id])}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center">
                        <Trash2 className="w-3 h-3 text-destructive-foreground" />
                      </button>
                    </div>
                  ))}
                {newPhotoUrls.map((url, i) => (
                  <div key={`new-${i}`} className="relative aspect-video rounded-lg overflow-hidden border border-border">
                    <img src={url} alt={`New ${i + 1}`} className="w-full h-full object-cover" />
                    <button onClick={() => setNewPhotoUrls(newPhotoUrls.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive flex items-center justify-center">
                      <Trash2 className="w-3 h-3 text-destructive-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleSubmit} disabled={loading}
            className="w-full py-3.5 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm glow-primary disabled:opacity-50">
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EditStudioSheet;
