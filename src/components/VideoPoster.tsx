import { forwardRef, useEffect, useState } from "react";
import type { VideoHTMLAttributes } from "react";
import { Film, Loader2 } from "lucide-react";
import { captureVideoPoster } from "@/lib/video-preview";

const posterCache = new Map<string, string | null>();
const posterInflight = new Map<string, Promise<string | null>>();
const posterQueue: Array<() => void> = [];
let activePosterJobs = 0;
const MAX_POSTER_JOBS = 1;

function runNextPosterJob() {
  if (activePosterJobs >= MAX_POSTER_JOBS) return;
  const next = posterQueue.shift();
  if (!next) return;
  activePosterJobs += 1;
  next();
}

function getPosterFrame(src: string) {
  if (posterCache.has(src)) return Promise.resolve(posterCache.get(src) ?? null);
  const current = posterInflight.get(src);
  if (current) return current;

  const job = new Promise<string | null>((resolve) => {
    posterQueue.push(() => {
      captureVideoPoster(src)
        .then((frame) => {
          posterCache.set(src, frame);
          resolve(frame);
        })
        .catch(() => {
          posterCache.set(src, null);
          resolve(null);
        })
        .finally(() => {
          posterInflight.delete(src);
          activePosterJobs = Math.max(0, activePosterJobs - 1);
          runNextPosterJob();
        });
    });
    runNextPosterJob();
  });

  posterInflight.set(src, job);
  return job;
}

type VideoPosterProps = {
  src: string;
  poster?: string | null;
  alt?: string;
  className?: string;
  generatePoster?: boolean;
};

export function VideoPoster({ src, poster, alt = "Video preview", className = "", generatePoster = false }: VideoPosterProps) {
  const [generatedPoster, setGeneratedPoster] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    if (poster || !src || !generatePoster) {
      setGeneratedPoster(null);
      setLoading(false);
      return;
    }
    let active = true;
    setGeneratedPoster(posterCache.get(src) ?? null);
    setLoading(true);
    getPosterFrame(src)
      .then((frame) => { if (active) setGeneratedPoster(frame); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [poster, src]);

  const image = poster || generatedPoster;
  if (image) {
    return <img src={image} alt={alt} className={className} loading="lazy" />;
  }

  return (
    <div className={`relative overflow-hidden bg-muted text-muted-foreground ${className}`} aria-label={alt}>
      {src && (
        <video
          src={`${src}#t=0.2`}
          muted
          playsInline
          preload="metadata"
          aria-label={alt}
          className="absolute inset-0 h-full w-full object-cover"
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => setVideoReady(true)}
          onError={() => setLoading(false)}
        />
      )}
      <div className={`absolute inset-0 grid place-items-center bg-muted transition-opacity duration-200 ${videoReady ? "opacity-0" : "opacity-100"}`}>
        {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Film className="h-7 w-7" />}
      </div>
    </div>
  );
}

type VideoWithPosterProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "poster" | "src"> & {
  src: string;
  poster?: string | null;
};

export const VideoWithPoster = forwardRef<HTMLVideoElement, VideoWithPosterProps>(function VideoWithPoster(
  { src, poster, preload, ...props },
  ref,
) {
  const [generatedPoster, setGeneratedPoster] = useState<string | null>(null);

  useEffect(() => {
    if (poster || !src) {
      setGeneratedPoster(null);
      return;
    }
    let active = true;
    setGeneratedPoster(posterCache.get(src) ?? null);
    getPosterFrame(src).then((frame) => {
      if (active) setGeneratedPoster(frame);
    });
    return () => { active = false; };
  }, [poster, src]);

  return (
    <video
      {...props}
      ref={ref}
      src={src}
      poster={poster || generatedPoster || undefined}
      preload={preload || "metadata"}
    />
  );
});