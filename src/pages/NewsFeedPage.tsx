import { useState, useRef } from "react";
import { ArrowLeft, Newspaper, Plus, Trash2, Check, Clock, X, ImagePlus, Pencil, Link2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { uploadToR2 } from "@/lib/r2-storage";

interface NewsArticle {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  cover_url: string | null;
  status: string;
  is_free: boolean;
  created_at: string;
  author_id: string;
}

const CATEGORIES = ["Featured", "New Music", "Upcoming Artist", "Trending", "Interview", "Behind The Scenes"];

const NewsFeedPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Featured");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverUrlInput, setCoverUrlInput] = useState("");
  const [useUrlMode, setUseUrlMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: articles = [] } = useQuery({
    queryKey: ["manage-news", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("news_articles")
        .select("*")
        .eq("author_id", user.id)
        .order("created_at", { ascending: false });
      return (data || []) as NewsArticle[];
    },
    enabled: !!user,
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setTitle("");
    setDescription("");
    setCategory("Featured");
    setCoverFile(null);
    setCoverPreview(null);
    setCoverUrlInput("");
    setUseUrlMode(false);
  };

  const startEdit = (article: NewsArticle) => {
    setEditingId(article.id);
    setTitle(article.title);
    setDescription(article.description || "");
    setCategory(article.category || "Featured");
    setCoverPreview(article.cover_url);
    setCoverFile(null);
    setCoverUrlInput(article.cover_url || "");
    setUseUrlMode(!!article.cover_url && !article.cover_url.startsWith("blob:"));
    setShowForm(true);
  };

  const uploadCover = async (): Promise<string | null> => {
    if (!coverFile || !user) return null;
    setUploading(true);
    const result = await uploadToR2(coverFile, { folder: "news-covers", fileName: `${Date.now()}-${coverFile.name}` });
    setUploading(false);
    if (!result.success) throw new Error(result.error || "Cover upload failed");
    return result.data?.url || null;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      let coverUrl: string | null = null;
      if (useUrlMode && coverUrlInput.trim()) {
        coverUrl = coverUrlInput.trim();
      } else if (coverFile) {
        coverUrl = await uploadCover();
      } else {
        coverUrl = coverPreview || null;
      }

      if (editingId) {
        const { error } = await (supabase as any).from("news_articles").update({
          title,
          description: description || null,
          category,
          cover_url: coverUrl,
        }).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("news_articles").insert({
          author_id: user.id,
          title,
          description: description || null,
          category,
          cover_url: coverUrl,
          status: "published",
          published_at: new Date().toISOString(),
          is_free: true,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manage-news"] });
      queryClient.invalidateQueries({ queryKey: ["news-feed"] });
      toast.success(editingId ? "Article updated!" : "Article submitted for review!");
      resetForm();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save article"),
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("news_articles")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manage-news"] });
      queryClient.invalidateQueries({ queryKey: ["news-feed"] });
      toast.success("Article published!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("news_articles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manage-news"] });
      queryClient.invalidateQueries({ queryKey: ["news-feed"] });
      toast.success("Article deleted");
    },
  });

  const statusIcon = (status: string) => {
    if (status === "published") return <Check className="w-3 h-3 text-green-500" />;
    if (status === "pending") return <Clock className="w-3 h-3 text-yellow-500" />;
    return <X className="w-3 h-3 text-destructive" />;
  };

  return (
    <div className="px-4 pt-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Newspaper className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-display font-bold text-foreground">News Feed</h1>
      </div>

      {/* Submit / Edit Form Toggle */}
      <button
        onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
        className="w-full flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all mb-3"
      >
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          <Plus className="w-4 h-4" />
        </div>
        <span className="flex-1 text-sm font-medium text-left text-foreground">
          {showForm ? (editingId ? "Cancel Editing" : "Cancel") : "Submit News Article"}
        </span>
      </button>

      {/* Form */}
      {showForm && (
        <div className="p-4 rounded-xl bg-card border border-border space-y-3 mb-4">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">
            {editingId ? "Edit Article" : "New Article"}
          </p>
          <Input placeholder="Article title *" value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
          <Textarea placeholder="Description / story..." value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm min-h-[80px]" />

          {/* Cover image mode toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setUseUrlMode(false); setCoverUrlInput(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-semibold transition-all ${!useUrlMode ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}
            >
              <ImagePlus className="w-3.5 h-3.5" />
              Upload Image
            </button>
            <button
              type="button"
              onClick={() => { setUseUrlMode(true); setCoverFile(null); setCoverPreview(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-semibold transition-all ${useUrlMode ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}
            >
              <Link2 className="w-3.5 h-3.5" />
              Paste URL
            </button>
          </div>

          {useUrlMode ? (
            <div className="space-y-2">
              <Input
                placeholder="Paste image URL (e.g. from Google Images)"
                value={coverUrlInput}
                onChange={(e) => setCoverUrlInput(e.target.value)}
                className="text-sm"
              />
              {coverUrlInput.trim() && (
                <img src={coverUrlInput} alt="Preview" className="w-full h-32 rounded-lg object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setCoverFile(file);
                    setCoverPreview(URL.createObjectURL(file));
                  }
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-border hover:border-primary/40 transition-all bg-secondary/30"
              >
                {coverPreview ? (
                  <img src={coverPreview} alt="Cover" className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <ImagePlus className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1 text-left">
                  <p className="text-xs font-medium text-foreground">{coverFile ? coverFile.name : "Add Cover Image"}</p>
                  <p className="text-[10px] text-muted-foreground">{coverFile ? `${(coverFile.size / 1024).toFixed(0)} KB` : "Tap to upload a photo"}</p>
                </div>
              </button>
            </>
          )}

          {/* Categories */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                  category === c ? "gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!title.trim() || saveMutation.isPending || uploading}
            className="w-full"
            size="sm"
          >
            {uploading ? "Uploading cover..." : saveMutation.isPending ? "Saving..." : editingId ? "Update Article" : "Submit Article"}
          </Button>
        </div>
      )}

      {/* Articles List */}
      {articles.length > 0 ? (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Your Articles</p>
          <div className="rounded-xl bg-card border border-border overflow-hidden divide-y divide-border">
            {articles.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 text-left">
                {a.cover_url && <img src={a.cover_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-foreground truncate">{a.title}</p>
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    {statusIcon(a.status)}
                    <span className="capitalize">{a.status}</span>
                    <span>• {a.category}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => startEdit(a)}
                    className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {a.status === "pending" && (
                    <button onClick={() => publishMutation.mutate(a.id)} className="w-7 h-7 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500 hover:bg-green-500/20">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => deleteMutation.mutate(a.id)} className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-10">
          <Newspaper className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No articles yet. Submit your first one!</p>
        </div>
      )}
    </div>
  );
};

export default NewsFeedPage;
