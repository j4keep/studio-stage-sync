import { forwardRef, useEffect, useState } from "react";
import type { VideoHTMLAttributes } from "react";
import { Film, Loader2 } from "lucide-react";
import { captureVideoPoster } from "@/lib/video-preview";

type VideoPosterProps = {
  src: string;
  poster?: string | null;
  alt?: string;
  className?: string;
};

export function VideoPoster({ src, poster, alt = "Video preview", className = "" }: VideoPosterProps) {
  const [generatedPoster, setGeneratedPoster] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (poster || !src) {
      setGeneratedPoster(null);
      return;
    }
    let active = true;
    setGeneratedPoster(null);
    setLoading(true);
    captureVideoPoster(src)
      .then((frame) => { if (active) setGeneratedPoster(frame); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [poster, src]);

  const image = poster || generatedPoster;
  if (image) {
    return <img src={image} alt={alt} className={className} loading="lazy" />;
  }

  return (
    <div className={`grid place-items-center bg-muted text-muted-foreground ${className}`}>
      {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Film className="h-7 w-7" />}
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
    setGeneratedPoster(null);
    captureVideoPoster(src).then((frame) => {
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