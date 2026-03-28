import { useState, useRef } from "react";
import { Plus, Info, Upload } from "lucide-react";
import { useProGate } from "@/hooks/use-pro-gate";
import ProGateModal from "@/components/ProGateModal";
import { toast } from "@/hooks/use-toast";

const AIVideoTab = () => {
  const { isPro, requirePro, showProModal, gatedFeature, closeProModal, activatePro } = useProGate();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please upload an image", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setUploadedImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleContinue = () => {
    if (!isPro) {
      requirePro("AI Video");
      return;
    }
    if (!uploadedImage) {
      toast({ title: "Please upload a photo first", variant: "destructive" });
      return;
    }
    toast({ title: "AI Video generation coming soon!", description: "This feature is under development" });
  };

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Hero section with gradient */}
      <div className="relative rounded-2xl overflow-hidden mb-6 bg-gradient-to-b from-purple-600/30 to-background p-6 pt-10">
        <div className="flex justify-center gap-3 mb-4">
          <div className="w-20 h-24 rounded-xl bg-card/50 border border-border overflow-hidden">
            <div className="w-full h-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <Upload className="w-6 h-6 text-muted-foreground/50" />
            </div>
          </div>
          <div className="flex items-center text-muted-foreground text-lg">+</div>
          <div className="w-20 h-24 rounded-xl bg-card/50 border border-border overflow-hidden">
            <div className="w-full h-full bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
              <Upload className="w-6 h-6 text-muted-foreground/50" />
            </div>
          </div>
        </div>
      </div>

      {/* Step 1 */}
      <div className="mb-4">
        <span className="inline-block px-3 py-1 rounded-full bg-foreground text-background text-xs font-bold mb-2">STEP 1</span>
        <h2 className="text-xl font-display font-bold text-foreground mb-1">Upload your photo</h2>
        <p className="text-sm text-muted-foreground">Upload your photo to generate your music video.</p>
      </div>

      {/* Upload area */}
      <div className="mb-6">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        <button
          onClick={() => fileRef.current?.click()}
          className="w-48 h-48 mx-auto rounded-2xl bg-card border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-primary/40 transition-all"
        >
          {uploadedImage ? (
            <img src={uploadedImage} alt="Uploaded" className="w-full h-full object-cover rounded-2xl" />
          ) : (
            <>
              <Plus className="w-10 h-10 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Tap to upload</span>
            </>
          )}
        </button>
      </div>

      {/* Photo info */}
      <button className="flex items-center gap-2 text-sm text-muted-foreground mx-auto mb-6">
        <Info className="w-4 h-4" /> Photo Info
      </button>

      {/* Continue button */}
      <button
        onClick={handleContinue}
        className="w-full py-3.5 rounded-2xl bg-muted text-foreground font-bold text-base"
      >
        Continue
      </button>

      <ProGateModal open={showProModal} onClose={closeProModal} featureName={gatedFeature} onSubscribe={activatePro} />
    </div>
  );
};

export default AIVideoTab;
