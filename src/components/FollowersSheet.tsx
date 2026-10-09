import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { UserMinus } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  isOwner: boolean;
  mode?: "followers" | "following";
}

interface Follower {
  id: string;
  follower_id: string;
  display_name: string;
  avatar_url: string | null;
}

const FollowersSheet = ({ open, onClose, userId, isOwner, mode = "followers" }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      const showingFollowers = mode === "followers";
      const { data: followRows } = await (supabase as any)
        .from("follows")
        .select("id, follower_id, following_id")
        .eq(showingFollowers ? "following_id" : "follower_id", userId);

      if (!followRows || followRows.length === 0) {
        setFollowers([]);
        setLoading(false);
        return;
      }

      const ids = followRows.map((f: any) => showingFollowers ? f.follower_id : f.following_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .in("user_id", ids);

      const merged = followRows.map((f: any) => {
        const personId = showingFollowers ? f.follower_id : f.following_id;
        const p = profiles?.find((pr) => pr.user_id === personId);
        return {
          id: f.id,
          follower_id: personId,
          display_name: p?.display_name || "Artist",
          avatar_url: p?.avatar_url || null,
        };
      });
      setFollowers(merged);
      setLoading(false);
    };
    load();
  }, [open, userId, mode]);

  const handleRemoveFollower = async (followId: string, followerId: string) => {
    await (supabase as any).from("follows").delete().eq("id", followId);
    setFollowers((prev) => prev.filter((f) => f.id !== followId));
    toast.success("Follower removed");
  };

  const handleTapFollower = (followerId: string) => {
    onClose();
    if (user && followerId === user.id) {
      navigate("/profile");
    } else {
      navigate(`/artist/${followerId}`);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl bg-background">
        <SheetHeader>
          <SheetTitle className="text-foreground">{mode === "followers" ? "Followers" : "Following"}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2 overflow-y-auto max-h-[calc(70vh-80px)]">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : followers.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-10">
              {mode === "followers" ? "No followers yet" : "Not following anyone yet"}
            </p>
          ) : (
            followers.map((f) => (
              <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
                <button onClick={() => handleTapFollower(f.follower_id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <div className="w-10 h-10 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                    {f.avatar_url ? (
                      <img src={f.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                        {f.display_name[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{f.display_name}</p>
                </button>
                {isOwner && mode === "followers" && (
                  <button
                    onClick={() => handleRemoveFollower(f.id, f.follower_id)}
                    className="px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold flex items-center gap-1"
                  >
                    <UserMinus className="w-3.5 h-3.5" /> Remove
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FollowersSheet;
