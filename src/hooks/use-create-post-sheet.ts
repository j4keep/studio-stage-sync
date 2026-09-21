import { useCallback, useRef, useState } from "react";
import { releaseCameraStream, warmCameraStream } from "@/lib/create-camera";

/** Opens create sheet with camera stream acquired in the same user gesture (iOS-safe). */
export function useCreatePostSheet() {
  const [open, setOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const openCreate = useCallback(async (_options?: { waveMs?: number }) => {
    releaseCameraStream(streamRef.current);
    streamRef.current = null;
    setCameraStream(null);

    // Start getUserMedia directly from the user's Create tap. This is more reliable on
    // iPhone/Safari than waiting for the camera screen's mount effect to request access.
    // Even if permission fails, still open the create screen so it can show its normal
    // permission/retry state.
    const warmed = await warmCameraStream("user", { withAudio: true }).catch(() => null);
    streamRef.current = warmed;
    setCameraStream(warmed);
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
