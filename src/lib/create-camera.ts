/** Acquire camera during a user tap gesture (required for iOS Safari). */
export async function warmCameraStream(
  facing: "user" | "environment" = "user",
): Promise<MediaStream | null> {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: facing,
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: true,
    });
  } catch {
    return null;
  }
}

export function releaseCameraStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}
