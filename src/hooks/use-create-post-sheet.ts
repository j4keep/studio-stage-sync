import { useCallback, useRef, useState } from "react";
import { releaseCameraStream } from "@/lib/create-camera";

/** Opens create sheet with camera stream acquired in the same user gesture (iOS-safe). */
export function useCreatePostSheet() {
  const [open, setOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const openCreate = useCallback(async (_options?: { waveMs?: number }) => {
    releaseCameraStream(streamRef.current);
    streamRef.current = null;
    setCameraStream(null);
    setOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    releaseCameraStream(streamRef.current);
    streamRef.current = null;
    setCameraStream(null);
    setOpen(false);
  }, []);

  return { open, cameraStream, openCreate, closeCreate };
}
