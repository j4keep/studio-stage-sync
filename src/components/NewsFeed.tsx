import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { getR2DownloadUrl } from "@/lib/r2-storage";

interface NewsArticle {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  cover_url: string | null;
  published_at: string | null;
  author_name?: string;
}

// Convert raw R2 bucket URLs to proxied download URLs
const resolveImageUrl = (url: string | null): string | null => {
  if (!url) return null;
  // If it's a raw R2 bucket URL, proxy it through the download edge function
  if (url.includes('.r2.cloudflarestorage.com/')) {
    const match = url.match(/r2\.cloudflarestorage\.com\/[^/]+\/(.+)$/);
    if (match) return getR2DownloadUrl(match[1]);
  }
  return url;
};

const fetchPublishedArticles = async (): Promise<NewsArticle[]> => {
  const { data, error } = await (supabase as any)
    .from("news_articles")
    .select("id, title, description, category, cover_url, published_at, author_id")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(20);

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
};

// Group articles by category
const groupByCategory = (articles: NewsArticle[]) => {
  const groups: Record<string, NewsArticle[]> = {};
  articles.forEach((a) => {
    const cat = a.category || "Featured";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(a);
  });
  return groups;
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

const NewsFeed = () => {
  const navigate = useNavigate();
  const { data: articles = [] } = useQuery({
    queryKey: ["news-feed"],
    queryFn: fetchPublishedArticles,
    staleTime: 60_000,
  });

  if (articles.length === 0) return null;

  // WHEUAT articles first, then group the rest by category
  const wheuatArticles = articles.filter(a => a.category === "Featured" || a.category === "New Music" || a.category === "Upcoming Artist" || a.category === "Behind The Scenes" || a.category === "Interview" || a.category === "Trending");
  const otherArticles = articles.filter(a => !wheuatArticles.includes(a));
  
  const wheuatGrouped = groupByCategory(wheuatArticles);
  const otherGrouped = groupByCategory(otherArticles);

  const renderArticle = (article: NewsArticle) => (
    <button
      key={article.id}
      onClick={() => navigate(`/article/${article.id}`)}
      className="flex items-start gap-3 py-4 text-left w-full hover:opacity-80 transition-opacity"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
          {article.author_name}
        </p>
        <p className="text-[15px] font-bold text-foreground leading-snug line-clamp-3">
          {article.title}
        </p>
        {article.description && (
          <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2">
            {article.description}
          </p>
        )}
      </div>
      {article.cover_url && (
        <img
          src={article.cover_url}
          alt={article.title}
          className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
        />
      )}
    </button>
  );

  const renderCategory = (category: string, items: NewsArticle[]) => (
    <div key={category} className="px-4">
      <button
        onClick={() => navigate(`/news/${encodeURIComponent(category)}`)}
        className="flex items-center justify-between w-full mb-1"
      >
        <h3 className={`text-lg font-display font-bold ${CATEGORY_COLORS[category] || "text-primary"}`}>
          {category}
        </h3>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>
      <div className="divide-y divide-border">
        {items.slice(0, 5).map(renderArticle)}
      </div>
    </div>
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="mb-8 -mx-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wide">
            WHEUAT News
          </h2>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden py-2">
        {/* Top Stories - WHEUAT first */}
        {Object.entries(wheuatGrouped).map(([cat, items]) =>
          renderCategory(cat, items)
        )}

        {/* Separator if both exist */}
        {Object.keys(wheuatGrouped).length > 0 && Object.keys(otherGrouped).length > 0 && (
          <div className="my-2 border-t border-border" />
        )}

        {/* Other categories */}
        {Object.entries(otherGrouped).map(([cat, items]) =>
          renderCategory(cat, items)
        )}
      </div>
    </motion.section>
  );
};

export default NewsFeed;
