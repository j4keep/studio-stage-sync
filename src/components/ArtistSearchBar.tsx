import { useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

interface ArtistSearchBarProps {
  onSelectArtist?: (artist: { user_id: string; display_name: string; avatar_url: string | null }) => void;
}

const ArtistSearchBar = ({ onSelectArtist }: ArtistSearchBarProps) => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: results = [] } = useQuery({
    queryKey: ["artist-search", search],
    queryFn: async () => {
      if (search.trim().length < 2) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url")
        .neq("user_id", user?.id || "")
        .ilike("display_name", `%${search.trim()}%`)
        .limit(8);
      return data || [];
    },
    enabled: search.trim().length >= 2,
  });

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        placeholder="Search artists..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-10 pr-9 bg-card border-border"
      />
      {search && (
        <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      )}
      {results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto">
          {results.map((p: any) => (
            <button
              key={p.user_id}
              onClick={() => {
                onSelectArtist?.(p);
                setSearch("");
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-full bg-muted overflow-hidden flex-shrink-0">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {(p.display_name || "?")[0]}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{p.display_name}</p>
                <p className="text-[10px] text-muted-foreground">@{(p.display_name || "").toLowerCase().replace(/\s+/g, "")}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArtistSearchBar;
