import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FolderHeart, Music, Video, Mic, ImageIcon, Swords } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
}

interface ProjectItem {
  id: string;
  type: "song" | "video" | "podcast" | "post" | "battle";
  title: string;
  cover_url: string | null;
  created_at: string;
}

const typeIcons = {
  song: Music,
  video: Video,
  podcast: Mic,
  post: ImageIcon,
  battle: Swords,
};

const typeLabels = {
  song: "Song",
  video: "Video",
  podcast: "Podcast",
  post: "Post",
  battle: "Battle",
};

const UserProjectsSheet = ({ open, onClose, userId }: Props) => {
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);

    const fetchAll = async () => {
      const [songs, videos, podcasts, posts, battles] = await Promise.all([
        (supabase as any).from("songs").select("id, title, cover_url, created_at").eq("user_id", userId),
        (supabase as any).from("videos").select("id, title, cover_url, created_at").eq("user_id", userId),
        (supabase as any).from("podcasts").select("id, title, cover_url, created_at").eq("user_id", userId),
        (supabase as any).from("posts").select("id, caption, media_url, created_at").eq("user_id", userId),
        (supabase as any).from("battles").select("id, title, challenger_cover_url, created_at").eq("challenger_id", userId),
      ]);

      const all: ProjectItem[] = [
        ...(songs.data || []).map((s: any) => ({ id: s.id, type: "song" as const, title: s.title, cover_url: s.cover_url, created_at: s.created_at })),
        ...(videos.data || []).map((v: any) => ({ id: v.id, type: "video" as const, title: v.title, cover_url: v.cover_url, created_at: v.created_at })),
        ...(podcasts.data || []).map((p: any) => ({ id: p.id, type: "podcast" as const, title: p.title, cover_url: p.cover_url, created_at: p.created_at })),
        ...(posts.data || []).map((p: any) => ({ id: p.id, type: "post" as const, title: p.caption || "Post", cover_url: p.media_url, created_at: p.created_at })),
        ...(battles.data || []).map((b: any) => ({ id: b.id, type: "battle" as const, title: b.title, cover_url: b.challenger_cover_url, created_at: b.created_at })),
      ];

      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(all);
      setLoading(false);
    };

    fetchAll();
  }, [open, userId]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FolderHeart className="w-5 h-5 text-primary" />
            All Projects ({items.length})
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">No projects yet</p>
          ) : (
            items.map((item) => {
              const Icon = typeIcons[item.type];
              return (
                <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
                    {item.cover_url ? (
                      <img src={item.cover_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Icon className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground">{typeLabels[item.type]} · {new Date(item.created_at).toLocaleDateString()}</p>
                  </div>
                  <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default UserProjectsSheet;
