import { useEffect, useMemo, useState } from "react";
import { Check, Dumbbell, Loader2, Music2, Search, X } from "lucide-react";
import { useRadio } from "@/contexts/RadioContext";
import { usePlaylists, type PlaylistItem } from "@/contexts/PlaylistContext";
import { setWorkoutPlaylistId } from "@/lib/workout-music";
import { toast } from "@/hooks/use-toast";

const WORKOUT_PLAYLIST_NAME = "Workout";

/**
 * Pick songs from YAJ Radio straight into the workout playlist —
 * no need to leave Wellness or use the Radio player.
 */
export default function WorkoutPlaylistSheet({
  open,
  onClose,
  playlistId,
}: {
  open: boolean;
  onClose: () => void;
  playlistId: string | null;
}) {
  const { allTracks, fetchRadioSongs, loading } = useRadio();
  const { playlists, createPlaylist, addItemToPlaylist, removeItemFromPlaylist, loadPlaylists } =
    usePlaylists();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void loadPlaylists();
    if (allTracks.length === 0) void fetchRadioSongs();
  }, [open, allTracks.length, fetchRadioSongs, loadPlaylists]);

  const playlist = playlists.find((p) => p.id === playlistId) || null;
  const selectedIds = useMemo(
    () => new Set((playlist?.items ?? []).map((i) => i.id)),
    [playlist],
  );

  const tracks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allTracks
      .filter((t) => Boolean(t.audio_url))
      .filter(
        (t) =>
          !q || t.title.toLowerCase().includes(q) || t.artist_name.toLowerCase().includes(q),
      );
  }, [allTracks, query]);

  /** Ensure a workout playlist exists, then return its id. */
  const ensurePlaylist = (): string => {
    if (playlist) return playlist.id;
    const existing = playlists.find(
      (p) => p.name.trim().toLowerCase() === WORKOUT_PLAYLIST_NAME.toLowerCase(),
    );
    const target = existing ?? createPlaylist(WORKOUT_PLAYLIST_NAME);
    setWorkoutPlaylistId(target.id);
    return target.id;
  };

  const toggleTrack = (track: (typeof allTracks)[number]) => {
    setBusy(true);
    const id = ensurePlaylist();
    const item: PlaylistItem = {
      id: track.id,
      title: track.title,
      artist: track.artist_name,
      type: track.source === "podcast" ? "podcast" : "song",
      image: track.cover_url,
      duration: "",
      audioUrl: track.audio_url,
    };
    if (selectedIds.has(track.id)) removeItemFromPlaylist(id, track.id);
    else addItemToPlaylist(id, item);
    setBusy(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Dumbbell className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-stone-900">Workout playlist</p>
            <p className="text-[11px] text-stone-500">
              {selectedIds.size} song{selectedIds.size === 1 ? "" : "s"} · tap to add or remove
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-2">
          <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-2">
            <Search className="h-4 w-4 text-stone-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search radio songs…"
              className="w-full bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-400"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
          {loading && tracks.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-stone-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : tracks.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Music2 className="mx-auto mb-2 h-6 w-6 text-stone-300" />
              <p className="text-sm font-semibold text-stone-600">No radio songs found</p>
              <p className="text-[11px] text-stone-400">Try a different search.</p>
            </div>
          ) : (
            tracks.map((t) => {
              const on = selectedIds.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={busy}
                  onClick={() => toggleTrack(t)}
                  className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left active:bg-stone-50"
                >
                  <img
                    src={t.cover_url}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-xl object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-stone-900">{t.title}</p>
                    <p className="truncate text-[11px] text-stone-500">{t.artist_name}</p>
                  </div>
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                      on
                        ? "border-teal-600 bg-teal-600 text-white"
                        : "border-stone-200 bg-white text-stone-400"
                    }`}
                  >
                    <Check className="h-4 w-4" />
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-stone-100 p-3">
          <button
            type="button"
            onClick={() => {
              if (selectedIds.size === 0) {
                toast({ title: "Pick at least one song for your workout playlist" });
                return;
              }
              onClose();
            }}
            className="w-full rounded-full bg-teal-600 py-3 text-sm font-black text-white"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
