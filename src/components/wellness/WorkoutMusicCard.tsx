import { useEffect, useRef, useState } from "react";
import { Dumbbell, ListMusic, Pause, Play, SkipForward } from "lucide-react";
import { usePlaylists } from "@/contexts/PlaylistContext";
import {
  getWorkoutPlaylistId,
  workoutMusic,
  WORKOUT_PLAYLIST_EVENT,
  type WorkoutMusicState,
} from "@/lib/workout-music";
import WorkoutPlaylistSheet from "./WorkoutPlaylistSheet";

/**
 * Workout playlist control for the Move page.
 * Songs are picked from YAJ Radio right here; music auto-lowers when the coach talks.
 */
export default function WorkoutMusicCard() {
  const { playlists, loadPlaylists } = usePlaylists();
  const [playlistId, setPlaylistId] = useState<string | null>(() => getWorkoutPlaylistId());
  const [music, setMusic] = useState<WorkoutMusicState>(() => workoutMusic.state);
  const [pickerOpen, setPickerOpen] = useState(false);
  const queuedFor = useRef<string | null>(null);


  useEffect(() => {
    void loadPlaylists();
  }, [loadPlaylists]);

  useEffect(() => {
    const off = workoutMusic.subscribe(setMusic);
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    const sync = () => setPlaylistId(getWorkoutPlaylistId());
    window.addEventListener(WORKOUT_PLAYLIST_EVENT, sync);
    return () => window.removeEventListener(WORKOUT_PLAYLIST_EVENT, sync);
  }, []);

  const playlist = playlists.find((p) => p.id === playlistId) || null;
  const playable = playlist?.items.filter((i) => i.audioUrl) ?? [];

  const start = () => {
    if (!playlist) return nav("/radio");
    if (music.playing) {
      workoutMusic.pause();
      return;
    }
    if (queuedFor.current !== playlist.id || music.queueLength === 0) {
      workoutMusic.setQueue(
        playlist.items.map((i) => ({
          id: i.id,
          title: i.title,
          artist: i.artist,
          image: i.image,
          audioUrl: i.audioUrl,
        })),
      );
      queuedFor.current = playlist.id;
    }
    void workoutMusic.play();
  };

  return (
    <section className="rounded-[1.5rem] border border-teal-900/10 bg-white/90 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-teal-50 text-teal-700">
          {music.track?.image || playlist?.items[0]?.image ? (
            <img
              src={music.track?.image || playlist?.items[0]?.image}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <Dumbbell className="h-5 w-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700/80">
            Workout music
          </p>
          {playlist ? (
            <>
              <p className="truncate text-sm font-black text-stone-900">
                {music.track ? `${music.track.title} · ${music.track.artist}` : playlist.name}
              </p>
              <p className="text-[11px] text-stone-500">
                {playable.length} song{playable.length === 1 ? "" : "s"} · shuffle · lowers when the
                coach talks
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-black text-stone-900">No workout playlist yet</p>
              <p className="text-[11px] text-stone-500">
                Build one in Radio, then tap the dumbbell on it.
              </p>
            </>
          )}
        </div>
        {playlist && playable.length > 0 ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={start}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600 text-white shadow-sm"
              aria-label={music.playing ? "Pause workout music" : "Play workout music"}
            >
              {music.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => void workoutMusic.next()}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-stone-50"
              aria-label="Next song"
            >
              <SkipForward className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => nav("/radio")}
            className="flex items-center gap-1.5 rounded-full bg-teal-600 px-3 py-2 text-[11px] font-bold text-white"
          >
            <Music2 className="h-3.5 w-3.5" /> Pick songs
          </button>
        )}
      </div>
    </section>
  );
}
