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
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search people on YAJ"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-11 rounded-2xl border-border/80 bg-muted/55 pl-10 pr-10 text-[14px] font-medium shadow-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/15"
      />
      {search && (
        <button
          type="button"
          onClick={() => setSearch("")}
          className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-muted-foreground transition active:scale-95"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-border/80 bg-card p-1.5 shadow-xl">
          {results.map((p: any) => (
            <button
              key={p.user_id}
              type="button"
              onClick={() => {
                onSelectArtist?.(p);
                setSearch("");
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60 active:bg-muted"
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border/70">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm font-bold text-muted-foreground">
                    {(p.display_name || "?")[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-foreground">{p.display_name}</p>
                <p className="truncate text-[11px] font-medium text-muted-foreground">
                  @{(p.display_name || "").toLowerCase().replace(/\s+/g, "")}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArtistSearchBar;
