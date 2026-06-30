import { useCallback, useRef, useState } from "react";
import { releaseCameraStream, warmCameraStream } from "@/lib/create-camera";

/** Opens create sheet with camera stream acquired in the same user gesture (iOS-safe). */
export function useCreatePostSheet() {
  const [open, setOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const releaseCamera = useCallback(() => {
    releaseCameraStream(streamRef.current);
    streamRef.current = null;
    setCameraStream(null);
  }, []);

  const openCreate = useCallback(async (options?: { waveMs?: number }) => {
    releaseCameraStream(streamRef.current);
    streamRef.current = null;
    setCameraStream(null);

    const streamPromise = warmCameraStream("user");
    const waveMs = options?.waveMs ?? 0;
    const [, stream] = await Promise.all([
      waveMs > 0 ? new Promise<void>((resolve) => window.setTimeout(resolve, waveMs)) : Promise.resolve(),
      streamPromise,
    ]);
    streamRef.current = stream;
    setCameraStream(stream);
    setOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    releaseCamera();
    setOpen(false);
  }, [releaseCamera]);

  return { open, cameraStream, openCreate, closeCreate, releaseCamera };
}
