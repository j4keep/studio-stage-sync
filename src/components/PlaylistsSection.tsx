import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Music, Video, Mic2, Play, Trash2, Edit3, X,
  ListMusic, ChevronRight, ChevronDown
} from "lucide-react";
import { usePlaylists, PlaylistItem } from "@/contexts/PlaylistContext";
import PlaylistPlayerSheet from "@/components/PlaylistPlayerSheet";

const typeIcon = (type: PlaylistItem["type"]) => {
  switch (type) {
    case "song": return <Music className="w-3 h-3" />;
    case "video": return <Video className="w-3 h-3" />;
    case "podcast": return <Mic2 className="w-3 h-3" />;
  }
};

const PlaylistsSection = () => {
  const { playlists, sampleLibrary, addItemToPlaylist, removeItemFromPlaylist, createPlaylist, deletePlaylist, renamePlaylist } = usePlaylists();

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [showAddItems, setShowAddItems] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Full-screen player state
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerItems, setPlayerItems] = useState<PlaylistItem[]>([]);
  const [playerStartIndex, setPlayerStartIndex] = useState(0);

  const handlePlayItem = (playlist: { items: PlaylistItem[] }, itemIndex: number) => {
    setPlayerItems(playlist.items);
    setPlayerStartIndex(itemIndex);
    setPlayerOpen(true);
  };

  const handleCreate = () => {
    if (!newName.trim()) return;
    const pl = createPlaylist(newName.trim());
    setNewName("");
    setShowCreate(false);
    setExpandedId(pl.id);
  };

  const handleRename = (id: string) => {
    if (!editName.trim()) return;
    renamePlaylist(id, editName.trim());
    setEditingId(null);
    setEditName("");
  };

  const availableItems = (playlistId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return sampleLibrary;
    return sampleLibrary.filter(item => !playlist.items.some(i => i.id === item.id));
  };

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListMusic className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Playlists</h3>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg gradient-primary text-primary-foreground text-[10px] font-semibold glow-primary">
          <Plus className="w-3 h-3" /> New Playlist
        </button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-3">
            <div className="p-3 rounded-xl bg-card border border-primary/30 flex gap-2">
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} placeholder="Playlist name (e.g. 🎵 My Jams)" className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" autoFocus />
              <button onClick={handleCreate} className="px-3 py-1.5 rounded-lg gradient-primary text-primary-foreground text-[10px] font-semibold">Create</button>
              <button onClick={() => setShowCreate(false)} className="text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col gap-2">
        {playlists.map(playlist => {
          const isExpanded = expandedId === playlist.id;
          const isEditing = editingId === playlist.id;
          return (
            <motion.div key={playlist.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-card border border-border overflow-hidden">
              <button onClick={() => setExpandedId(isExpanded ? null : playlist.id)} className="flex items-center gap-3 p-3.5 w-full text-left hover:bg-primary/5 transition-all">
                <div className="w-11 h-11 rounded-lg overflow-hidden bg-primary/10 flex-shrink-0 grid grid-cols-2 grid-rows-2 gap-px">
                  {playlist.items.slice(0, 4).map((item, i) => (<img key={i} src={item.image} alt="" className="w-full h-full object-cover" />))}
                  {Array.from({ length: Math.max(0, 4 - playlist.items.length) }).map((_, i) => (
                    <div key={`empty-${i}`} className="w-full h-full bg-primary/10 flex items-center justify-center"><Music className="w-2 h-2 text-primary/30" /></div>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleRename(playlist.id)} className="flex-1 bg-transparent text-sm font-medium text-foreground outline-none border-b border-primary" autoFocus />
                      <button onClick={() => handleRename(playlist.id)} className="text-[10px] text-primary font-semibold">Save</button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground truncate">{playlist.name}</p>
                      <p className="text-[10px] text-muted-foreground">{playlist.items.length} {playlist.items.length === 1 ? "item" : "items"}</p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setEditingId(playlist.id); setEditName(playlist.name); }} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground transition-colors"><Edit3 className="w-3 h-3" /></button>
                  <button onClick={() => deletePlaylist(playlist.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><Trash2 className="w-3 h-3" /></button>
                </div>
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="border-t border-border px-3 pb-3">
                      {playlist.items.length > 0 ? (
                        <div className="flex flex-col gap-1 mt-2">
                          {playlist.items.map((item, i) => (
                            <div key={item.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-primary/5 transition-all group cursor-pointer"
                              onClick={() => handlePlayItem(playlist, i)}
                            >
                              <span className="text-[10px] text-muted-foreground w-4 text-right">{i + 1}</span>
                              <div className="relative w-8 h-8 rounded-md overflow-hidden flex-shrink-0">
                                <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-3 h-3 text-white fill-white" /></div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">{typeIcon(item.type)}<span>{item.artist} · {item.duration}</span></div>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); removeItemFromPlaylist(playlist.id, item.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"><X className="w-3 h-3" /></button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-4 text-center">
                          <ListMusic className="w-6 h-6 text-muted-foreground/40 mx-auto mb-1" />
                          <p className="text-[11px] text-muted-foreground">No items yet — add songs, videos, or podcasts</p>
                        </div>
                      )}
                      <button onClick={() => setShowAddItems(showAddItems === playlist.id ? null : playlist.id)} className="mt-2 w-full py-2 rounded-lg border border-dashed border-primary/30 text-primary text-[11px] font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/5 transition-all">
                        <Plus className="w-3 h-3" /> Add to Playlist
                      </button>
                      <AnimatePresence>
                        {showAddItems === playlist.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Available to add</p>
                              {availableItems(playlist.id).length > 0 ? (
                                <div className="flex flex-col gap-1">
                                  {availableItems(playlist.id).map(item => (
                                    <button key={item.id} onClick={() => addItemToPlaylist(playlist.id, item)} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-card transition-all w-full text-left">
                                      <img src={item.image} alt={item.title} className="w-7 h-7 rounded object-cover flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <p className="text-[11px] font-medium text-foreground truncate">{item.title}</p>
                                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">{typeIcon(item.type)}<span>{item.artist}</span></div>
                                      </div>
                                      <Plus className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                    </button>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-muted-foreground text-center py-2">All items already added!</p>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {playlists.length === 0 && (
        <div className="p-6 rounded-xl bg-card border border-border text-center">
          <ListMusic className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No playlists yet</p>
          <p className="text-[10px] text-muted-foreground mt-1">Create one to save your favorite songs, videos, and podcasts</p>
        </div>
      )}

      {/* Full-screen playlist player */}
      <PlaylistPlayerSheet
        open={playerOpen}
        onOpenChange={setPlayerOpen}
        items={playerItems}
        startIndex={playerStartIndex}
      />
    </div>
  );
};

export default PlaylistsSection;
