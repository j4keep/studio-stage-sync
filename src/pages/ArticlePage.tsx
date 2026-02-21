import { ArrowLeft, Clock, User } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { getR2DownloadUrl } from "@/lib/r2-storage";

const resolveImageUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (url.includes('.r2.cloudflarestorage.com/')) {
    const match = url.match(/r2\.cloudflarestorage\.com\/[^/]+\/(.+)$/);
    if (match) return getR2DownloadUrl(match[1]);
  }
  return url;
};

interface FullArticle {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  cover_url: string | null;
  published_at: string | null;
  author_name: string;
}

const ArticlePage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: article, isLoading } = useQuery({
    queryKey: ["article", id],
    queryFn: async (): Promise<FullArticle | null> => {
      if (!id) return null;
      const { data, error } = await (supabase as any)
        .from("news_articles")
        .select("id, title, description, category, cover_url, published_at, author_id")
        .eq("id", id)
        .single();
      if (error || !data) return null;

      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("display_name")
        .eq("user_id", data.author_id)
        .maybeSingle();

      return {
        ...data,
        cover_url: resolveImageUrl(data.cover_url),
        author_name: profile?.display_name || "WHEUAT",
      };
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="px-4 pt-6 pb-24 text-center">
        <p className="text-muted-foreground">Article not found.</p>
        <button onClick={() => navigate(-1)} className="text-primary mt-4 text-sm font-medium">Go back</button>
      </div>
    );
  }

  return (
    <div className="pb-24">
      {/* Cover Image */}
      {article.cover_url && (
        <div className="relative w-full aspect-video">
          <img src={article.cover_url} alt={article.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-background/80 backdrop-blur flex items-center justify-center text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {!article.cover_url && (
        <div className="px-4 pt-6">
          <button
            onClick={() => navigate(-1)}
            className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="px-4 -mt-8 relative z-10">
        {/* Category badge */}
        <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider mb-3">
          {article.category || "Featured"}
        </span>

        {/* Title */}
        <h1 className="text-2xl font-display font-bold text-foreground leading-tight mb-3">
          {article.title}
        </h1>

        {/* Meta */}
        <div className="flex items-center gap-3 mb-6 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            <span>{article.author_name}</span>
          </div>
          {article.published_at && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{format(new Date(article.published_at), "MMM d, yyyy")}</span>
            </div>
          )}
        </div>

        {/* Content */}
        {article.description && (
          <div className="prose prose-sm max-w-none">
            <p className="text-[15px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
              {article.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArticlePage;
