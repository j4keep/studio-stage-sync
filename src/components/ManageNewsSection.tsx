import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Newspaper, Plus, Trash2, Check, Clock, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

const ManageNewsSection = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Featured");
  const [coverUrl, setCoverUrl] = useState("");

  const { data: articles = [], isLoading } = useQuery({
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

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase as any).from("news_articles").insert({
        author_id: user.id,
        title,
        description: description || null,
        category,
        cover_url: coverUrl || null,
        status: "pending",
        is_free: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manage-news"] });
      queryClient.invalidateQueries({ queryKey: ["news-feed"] });
      toast.success("Article submitted for review!");
      setShowForm(false);
      setTitle("");
      setDescription("");
      setCoverUrl("");
    },
    onError: () => toast.error("Failed to submit article"),
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

  const CATEGORIES = ["Featured", "New Music", "Upcoming Artist", "Trending", "Interview", "Behind The Scenes"];

  const statusIcon = (status: string) => {
    if (status === "published") return <Check className="w-3 h-3 text-green-500" />;
    if (status === "pending") return <Clock className="w-3 h-3 text-yellow-500" />;
    return <X className="w-3 h-3 text-destructive" />;
  };

  return (
    <div className="mb-5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">News Feed</p>
      <div className="flex flex-col gap-1.5">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Plus className="w-4 h-4" />
          </div>
          <span className="flex-1 text-sm font-medium text-left text-foreground">Submit News Article</span>
          <Newspaper className="w-3.5 h-3.5 text-muted-foreground" />
        </button>

        {showForm && (
          <div className="p-4 rounded-xl bg-card border border-border space-y-3">
            <Input placeholder="Article title *" value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
            <Textarea placeholder="Description / story..." value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm min-h-[80px]" />
            <Input placeholder="Cover image URL (optional)" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} className="text-sm" />
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
            <Button onClick={() => createMutation.mutate()} disabled={!title.trim() || createMutation.isPending} className="w-full" size="sm">
              {createMutation.isPending ? "Submitting..." : "Submit Article"}
            </Button>
          </div>
        )}

        {articles.length > 0 && (
          <div className="rounded-xl bg-card border border-border overflow-hidden divide-y divide-border mt-1">
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
        )}
      </div>
    </div>
  );
};

export default ManageNewsSection;
