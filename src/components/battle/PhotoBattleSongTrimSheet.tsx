import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Pause, Play, Scissors } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import {
  PHOTO_BATTLE_SONG_MAX_SEC,
  formatClipTime,
  sliceAudioFile,
} from "@/lib/photo-battle-song";

type Props = {
  open: boolean;
  file: File | null;
  durationSec: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (clipped: File) => void;
};

export function PhotoBattleSongTrimSheet({
  open,
  file,
  durationSec,
  onOpenChange,
  onConfirm,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  const maxStart = Math.max(0, durationSec - PHOTO_BATTLE_SONG_MAX_SEC);
  const [startSec, setStartSec] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!open) {
      setPlaying(false);
      setExporting(false);
      return;
    }
    setStartSec(0);
    setPlaying(false);
  }, [open, file]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !objectUrl) return;
    audio.pause();
    audio.currentTime = startSec;
    setPlaying(false);
  }, [startSec, objectUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => {
      if (audio.currentTime >= startSec + PHOTO_BATTLE_SONG_MAX_SEC) {
        audio.pause();
        audio.currentTime = startSec;
        setPlaying(false);
      }
    };
    const onEnded = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [startSec]);

  const togglePreview = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      audio.currentTime = startSec;
      await audio.play();
      setPlaying(true);
    } catch {
      toast({ title: "Couldn't play preview", variant: "destructive" });
    }
  };

  const handleConfirm = async () => {
    if (!file) return;
    setExporting(true);
    try {
      const clipped = await sliceAudioFile(file, startSec, PHOTO_BATTLE_SONG_MAX_SEC);
      onConfirm(clipped);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Couldn't trim clip",
        description: err instanceof Error ? err.message : "Try another file",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const endSec = Math.min(durationSec, startSec + PHOTO_BATTLE_SONG_MAX_SEC);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-4 w-4 text-primary" />
            Trim to 30 seconds
          </DialogTitle>
          <DialogDescription>
            Photo battles only use a 30s song clip under your photo — pick the best part.
          </DialogDescription>
        </DialogHeader>

        {objectUrl && (
          <audio ref={audioRef} src={objectUrl} preload="auto" className="hidden" />
        )}

        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-3">
            <p className="truncate text-sm font-medium">{file?.name || "Song"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Full track {formatClipTime(durationSec)} · Clip {formatClipTime(startSec)} –{" "}
              {formatClipTime(endSec)}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Clip start</span>
              <span>{formatClipTime(startSec)}</span>
            </div>
            <Slider
              min={0}
              max={maxStart}
              step={0.1}
              value={[startSec]}
              onValueChange={(v) => setStartSec(v[0] ?? 0)}
              disabled={exporting || maxStart <= 0}
            />
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/80"
                style={{
                  marginLeft: `${durationSec > 0 ? (startSec / durationSec) * 100 : 0}%`,
                  width: `${durationSec > 0 ? (PHOTO_BATTLE_SONG_MAX_SEC / durationSec) * 100 : 100}%`,
                }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => void togglePreview()}
              disabled={exporting || !file}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              Preview 30s
            </Button>
            <Button
              type="button"
              className="flex-1 gap-2"
              onClick={() => void handleConfirm()}
              disabled={exporting || !file}
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Scissors className="h-4 w-4" />
              )}
              Use clip
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
