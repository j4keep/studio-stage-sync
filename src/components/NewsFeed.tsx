import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper } from "lucide-react";
import { motion } from "framer-motion";

interface NewsArticle {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  cover_url: string | null;
  published_at: string | null;
  author_name?: string;
}

const fetchPublishedArticles = async (): Promise<NewsArticle[]> => {
  const { data, error } = await (supabase as any)
    .from("news_articles")
    .select("id, title, description, category, cover_url, published_at, author_id")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(10);

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
    cover_url: a.cover_url,
    published_at: a.published_at,
    author_name: nameMap[a.author_id] || "WHEUAT",
  }));
};

const NewsFeed = () => {
  const { data: articles = [] } = useQuery({
    queryKey: ["news-feed"],
    queryFn: fetchPublishedArticles,
    staleTime: 60_000,
  });

  if (articles.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="mb-8"
    >
      <div className="flex items-center gap-2 mb-4">
        <Newspaper className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-display font-bold text-foreground uppercase tracking-wide">
          WHEUAT News
        </h2>
      </div>

      <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
        {articles.map((article) => (
          <div key={article.id} className="flex items-start gap-3 p-3.5 hover:bg-primary/5 transition-all">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[9px] font-bold text-primary uppercase tracking-wider">
                  {article.category || "Featured"}
                </span>
                <span className="text-[9px] text-muted-foreground">•</span>
                <span className="text-[9px] text-muted-foreground">{article.author_name}</span>
              </div>
              <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2">
                {article.title}
              </p>
              {article.description && (
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  {article.description}
                </p>
              )}
            </div>
            {article.cover_url && (
              <img
                src={article.cover_url}
                alt={article.title}
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              />
            )}
          </div>
        ))}
      </div>
    </motion.section>
  );
};

export default NewsFeed;
