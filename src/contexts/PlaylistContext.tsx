import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import album1 from "@/assets/album-1.jpg";
import album2 from "@/assets/album-2.jpg";
import album3 from "@/assets/album-3.jpg";
import album4 from "@/assets/album-4.jpg";
import podcast1 from "@/assets/podcast-1.jpg";
import musicvideo1 from "@/assets/musicvideo-1.jpg";
import musicvideo2 from "@/assets/musicvideo-2.jpg";

export type PlaylistItem = {
  id: string;
  title: string;
  artist: string;
  type: "song" | "video" | "podcast";
  image: string;
  duration: string;
  audioUrl?: string;
};

export type Playlist = {
  id: string;
  name: string;
  items: PlaylistItem[];
};

const sampleLibrary: PlaylistItem[] = [
  { id: "s1", title: "Midnight Flow", artist: "Vega Luxe", type: "song", image: album1, duration: "3:42" },
  { id: "s2", title: "City Lights", artist: "K. Nova", type: "song", image: album2, duration: "4:15" },
  { id: "s3", title: "Rise Above", artist: "DAX Beats", type: "song", image: album3, duration: "3:28" },
  { id: "s4", title: "Echoes", artist: "Luna Wave", type: "song", image: album4, duration: "4:01" },
  { id: "v1", title: "Behind The Scenes", artist: "Vega Luxe", type: "video", image: musicvideo1, duration: "12:30" },
  { id: "v2", title: "Live Session", artist: "K. Nova", type: "video", image: musicvideo2, duration: "8:45" },
  { id: "p1", title: "The Artist Journey Ep.5", artist: "WHEUAT Radio", type: "podcast", image: podcast1, duration: "32:00" },
];

interface PlaylistContextType {
  playlists: Playlist[];
  setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>>;
  sampleLibrary: PlaylistItem[];
  addItemToPlaylist: (playlistId: string, item: PlaylistItem) => void;
  removeItemFromPlaylist: (playlistId: string, itemId: string) => void;
  createPlaylist: (name: string) => Playlist;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, newName: string) => void;
  loading: boolean;
}

const PlaylistContext = createContext<PlaylistContextType | null>(null);

export const usePlaylists = () => {
  const ctx = useContext(PlaylistContext);
  if (!ctx) throw new Error("usePlaylists must be used within PlaylistProvider");
  return ctx;
};

export const PlaylistProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch playlists from database
  useEffect(() => {
    if (!user) {
      setPlaylists([]);
      setLoading(false);
      return;
    }

    const fetchPlaylists = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("playlists")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching playlists:", error);
        setLoading(false);
        return;
      }

      if (data) {
        setPlaylists(
          data.map((row: any) => ({
            id: row.id,
            name: row.name,
            items: (row.items as PlaylistItem[]) || [],
          }))
        );
      }
      setLoading(false);
    };

    fetchPlaylists();
  }, [user]);

  const syncToDb = useCallback(async (playlistId: string, updates: { name?: string; items?: PlaylistItem[] }) => {
    if (!user) return;
    await supabase
      .from("playlists")
      .update(updates)
      .eq("id", playlistId)
      .eq("user_id", user.id);
  }, [user]);

  const addItemToPlaylist = useCallback((playlistId: string, item: PlaylistItem) => {
    setPlaylists(prev => {
      const updated = prev.map(p => {
        if (p.id !== playlistId) return p;
        if (p.items.some(i => i.id === item.id)) return p;
        const newItems = [...p.items, item];
        syncToDb(playlistId, { items: newItems as any });
        return { ...p, items: newItems };
      });
      return updated;
    });
  }, [syncToDb]);

  const removeItemFromPlaylist = useCallback((playlistId: string, itemId: string) => {
    setPlaylists(prev => {
      const updated = prev.map(p => {
        if (p.id !== playlistId) return p;
        const newItems = p.items.filter(i => i.id !== itemId);
        syncToDb(playlistId, { items: newItems as any });
        return { ...p, items: newItems };
      });
      return updated;
    });
  }, [syncToDb]);

  const createPlaylist = useCallback((name: string): Playlist => {
    const tempId = `pl-${Date.now()}`;
    const pl: Playlist = { id: tempId, name, items: [] };
    setPlaylists(prev => [pl, ...prev]);

    if (user) {
      supabase
        .from("playlists")
        .insert({ user_id: user.id, name, items: [] as any })
        .select()
        .single()
        .then(({ data }) => {
          if (data) {
            setPlaylists(prev => prev.map(p => p.id === tempId ? { ...p, id: data.id } : p));
          }
        });
    }

    return pl;
  }, [user]);

  const deletePlaylist = useCallback((id: string) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
    if (user) {
      supabase.from("playlists").delete().eq("id", id).eq("user_id", user.id);
    }
  }, [user]);

  const renamePlaylist = useCallback((id: string, newName: string) => {
    setPlaylists(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
    syncToDb(id, { name: newName });
  }, [syncToDb]);

  return (
    <PlaylistContext.Provider value={{ playlists, setPlaylists, sampleLibrary, addItemToPlaylist, removeItemFromPlaylist, createPlaylist, deletePlaylist, renamePlaylist, loading }}>
      {children}
    </PlaylistContext.Provider>
  );
};
