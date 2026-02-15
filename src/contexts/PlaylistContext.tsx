import { createContext, useContext, useState, ReactNode } from "react";
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

const defaultPlaylists: Playlist[] = [
  { id: "pl1", name: "🔥 My Rap Favorites", items: [sampleLibrary[0], sampleLibrary[2]] },
  { id: "pl2", name: "🎧 Chill Vibes", items: [sampleLibrary[1], sampleLibrary[3]] },
  { id: "pl3", name: "🎙️ Podcasts", items: [sampleLibrary[6]] },
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
}

const PlaylistContext = createContext<PlaylistContextType | null>(null);

export const usePlaylists = () => {
  const ctx = useContext(PlaylistContext);
  if (!ctx) throw new Error("usePlaylists must be used within PlaylistProvider");
  return ctx;
};

export const PlaylistProvider = ({ children }: { children: ReactNode }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>(defaultPlaylists);

  const addItemToPlaylist = (playlistId: string, item: PlaylistItem) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id !== playlistId) return p;
      if (p.items.some(i => i.id === item.id)) return p;
      return { ...p, items: [...p.items, item] };
    }));
  };

  const removeItemFromPlaylist = (playlistId: string, itemId: string) => {
    setPlaylists(prev => prev.map(p =>
      p.id === playlistId ? { ...p, items: p.items.filter(i => i.id !== itemId) } : p
    ));
  };

  const createPlaylist = (name: string): Playlist => {
    const pl: Playlist = { id: `pl-${Date.now()}`, name, items: [] };
    setPlaylists(prev => [pl, ...prev]);
    return pl;
  };

  const deletePlaylist = (id: string) => {
    setPlaylists(prev => prev.filter(p => p.id !== id));
  };

  const renamePlaylist = (id: string, newName: string) => {
    setPlaylists(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
  };

  return (
    <PlaylistContext.Provider value={{ playlists, setPlaylists, sampleLibrary, addItemToPlaylist, removeItemFromPlaylist, createPlaylist, deletePlaylist, renamePlaylist }}>
      {children}
    </PlaylistContext.Provider>
  );
};
