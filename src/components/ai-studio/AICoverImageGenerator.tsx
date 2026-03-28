import { useState } from "react";
import { Sparkles, ImagePlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  onImageGenerated: (url: string) => void;
  placeholder?: string;
  label?: string;
}

const AICoverImageGenerator = ({ onImageGenerated, placeholder, label }: Props) => {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({ title: "Enter a description for your image", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-cover-image", {
        body: { prompt: prompt.trim() },
      });

      if (error) throw error;
      if (!data?.imageUrl) throw new Error("No image returned");

      setPreviewUrl(data.imageUrl);
      onImageGenerated(data.imageUrl);
      toast({ title: "✨ Cover image generated!" });
    } catch (e: any) {
      console.error("Image gen error:", e);
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      {label && <p className="text-xs font-medium text-foreground">{label}</p>}

      {previewUrl && (
        <div className="w-full aspect-square rounded-xl overflow-hidden border border-border mb-2">
          <img src={previewUrl} alt="AI Generated" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder || "Describe your cover image..."}
          className="flex-1 bg-card border-border rounded-xl text-sm"
        />
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="px-3 py-2 rounded-xl gradient-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 shrink-0"
        >
          {isGenerating ? (
            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" /> Generate
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AICoverImageGenerator;
