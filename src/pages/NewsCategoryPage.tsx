import { ArrowLeft, Newspaper } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getR2DownloadUrl } from "@/lib/r2-storage";
import { format } from "date-fns";
import { motion } from "framer-motion";

interface NewsArticle {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  cover_url: string | null;
  published_at: string | null;
  author_name: string;
}

const resolveImageUrl = (url: string | null): string | null => {
  if (!url) return null;
  if (url.includes('.r2.cloudflarestorage.com/')) {
    const match = url.match(/r2\.cloudflarestorage\.com\/[^/]+\/(.+)$/);
    if (match) return getR2DownloadUrl(match[1]);
  }
  return url;
};

const CATEGORY_COLORS: Record<string, string> = {
  "Featured": "text-orange-400",
  "New Music": "text-pink-400",
  "Upcoming Artist": "text-purple-400",
  "Trending": "text-red-400",
  "Interview": "text-blue-400",
  "Behind The Scenes": "text-emerald-400",
  "Crypto": "text-yellow-400",
  "Sports": "text-green-400",
  "Finance": "text-cyan-400",
  "Breaking": "text-red-500",
};

const NewsCategoryPage = () => {
  const navigate = useNavigate();
  const { category } = useParams<{ category: string }>();
  const decodedCategory = decodeURIComponent(category || "Featured");

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["news-category", decodedCategory],
    queryFn: async (): Promise<NewsArticle[]> => {
      const { data, error } = await (supabase as any)
        .from("news_articles")
        .select("id, title, description, category, cover_url, published_at, author_id")
        .eq("status", "published")
        .eq("category", decodedCategory)
        .order("published_at", { ascending: false })
        .limit(50);

      if (error || !data) return [];

      const authorIds = [...new Set(data.map((a: any) => a.author_id))];
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", authorIds);

      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { nameMap[p.user_id] = p.display_name || "WHEUAT"; });

      return data.map((a: any) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        category: a.category,
        cover_url: resolveImageUrl(a.cover_url),
        published_at: a.published_at,
        author_name: nameMap[a.author_id] || "WHEUAT",
      }));
    },
  });

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
        <h1 className={`text-xl font-display font-bold ${CATEGORY_COLORS[decodedCategory] || "text-foreground"}`}>
          {decodedCategory}
        </h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : articles.length === 0 ? (
        <div className="text-center py-10">
          <Newspaper className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No articles in this category yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {articles.map((article, i) => (
            <motion.button
              key={article.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => navigate(`/article/${article.id}`)}
              className="w-full flex items-start gap-3 p-3 rounded-xl bg-card border border-border text-left hover:border-primary/30 transition-all"
            >
              {article.cover_url && (
                <img
                  src={article.cover_url}
                  alt={article.title}
                  className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">
                  {article.author_name}
                </p>
                <p className="text-sm font-bold text-foreground leading-snug line-clamp-2">
                  {article.title}
                </p>
                {article.description && (
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {article.description}
                  </p>
                )}
                {article.published_at && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {format(new Date(article.published_at), "MMM d, yyyy")}
                  </p>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};

export default NewsCategoryPage;
