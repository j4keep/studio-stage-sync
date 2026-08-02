import { supabase } from '@/integrations/supabase/client';

type R2Response<T = any> = {
  success: boolean;
  error?: string;
  data?: T;
};

type UploadResult = {
  key: string;
  url: string;
  size: number;
};

type UploadOptions = {
  folder?: string;
  fileName?: string;
  mimeType?: string;
  onProgress?: (progress: number) => void;
  /** Prefer edge proxy even for larger files (battle replays). */
  preferProxy?: boolean;
};

/** Edge function body limits are tight — keep proxy uploads under this. */
const PROXY_UPLOAD_THRESHOLD = 4 * 1024 * 1024; // 4MB
const REPLAY_PROXY_THRESHOLD = 18 * 1024 * 1024; // ~18MB for debate replays
const PROXY_TIMEOUT_MS = 40_000;
const REPLAY_PROXY_TIMEOUT_MS = 180_000;
const PRESIGN_TIMEOUT_MS = 20_000;
const PUT_TIMEOUT_MS = 45_000;
const REPLAY_PUT_TIMEOUT_MS = 180_000;

function supabaseFunctionsBase(): { url: string; anonKey: string } {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  return { url, anonKey };
}

async function authHeaders(): Promise<Record<string, string>> {
  const { anonKey } = supabaseFunctionsBase();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || anonKey;
  return {
    Authorization: `Bearer ${token}`,
    apikey: anonKey,
  };
}

/** Compress images client-side so battle covers upload reliably on mobile. */
export async function compressImageForUpload(
  file: File,
  maxEdge = 1400,
  quality = 0.8,
): Promise<File> {
  const type = (file.type || "").toLowerCase();
  const looksImage =
    type.startsWith("image/") ||
    /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if (!looksImage || type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    const base = file.name.replace(/\.[^/.]+$/, "") || "cover";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/**
 * Upload a file to R2 storage.
 * Prefer edge-function proxy (no browser→R2 CORS). Fall back to presigned PUT.
 */
export async function uploadToR2(
  file: File,
  options: UploadOptions = {}
): Promise<R2Response<UploadResult>> {
  let uploadFile = file;
  const mime = (options.mimeType || file.type || "").toLowerCase();
  const looksImage =
    mime.startsWith("image/") ||
    (!mime && /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name));
  if (looksImage) {
    // Keep covers small enough for the edge proxy (avoids browser→R2 CORS hangs).
    uploadFile = await compressImageForUpload(file, 1400, 0.8);
    if (uploadFile.size > PROXY_UPLOAD_THRESHOLD) {
      uploadFile = await compressImageForUpload(uploadFile, 1100, 0.72);
    }
    if (uploadFile.size > PROXY_UPLOAD_THRESHOLD) {
      uploadFile = await compressImageForUpload(uploadFile, 900, 0.62);
    }
  }

  let safeName = options.fileName || uploadFile.name;
  if (uploadFile.type === "image/jpeg") {
    safeName = safeName.replace(/\.[^/.]+$/, ".jpg");
  }

  const key = options.folder ? `${options.folder}/${safeName}` : safeName;
  const contentType =
    uploadFile.type || options.mimeType || "application/octet-stream";

  const isReplay =
    !!options.preferProxy ||
    (options.folder || "").includes("replays") ||
    contentType.includes("webm");
  const proxyLimit = isReplay ? REPLAY_PROXY_THRESHOLD : PROXY_UPLOAD_THRESHOLD;
  const proxyTimeout = isReplay ? REPLAY_PROXY_TIMEOUT_MS : PROXY_TIMEOUT_MS;

  console.log(
    `[R2 Upload] Starting: ${uploadFile.name}, size=${uploadFile.size}, key=${key}, type=${contentType}`,
  );

  // 1) Edge proxy (works for covers/photos/replays without browser→R2 CORS)
  if (uploadFile.size <= proxyLimit) {
    const proxied = await uploadViaEdgeStream(uploadFile, key, contentType, options, proxyTimeout);
    if (proxied.success) return proxied;
    console.warn("[R2 Upload] Edge proxy failed:", proxied.error);
  }

  // 2) Presigned PUT fallback
  return uploadViaPresignedPut(
    uploadFile,
    key,
    contentType,
    options,
    isReplay ? REPLAY_PUT_TIMEOUT_MS : PUT_TIMEOUT_MS,
  );
}

/** Streaming body through r2-upload (same path as podcast upload). */
async function uploadViaEdgeStream(
  file: File,
  key: string,
  contentType: string,
  options: UploadOptions,
  timeoutMs = PROXY_TIMEOUT_MS,
): Promise<R2Response<UploadResult>> {
  const { url } = supabaseFunctionsBase();
  const headers = await authHeaders();
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log("[R2 Upload] Edge stream POST…");
    const response = await fetch(`${url}/functions/v1/r2-upload`, {
      method: "POST",
      headers: {
        ...headers,
        "x-upload-key": key,
        "x-upload-content-type": contentType,
        "Content-Type": contentType,
      },
      body: file,
      signal: controller.signal,
    });

    const data = await response.json().catch(() => null);
    console.log("[R2 Upload] Edge stream response:", response.status, data);

    if (!response.ok || !data?.success) {
      return {
        success: false,
        error: data?.error || `Upload failed (${response.status})`,
      };
    }

    options.onProgress?.(100);
    return {
      success: true,
      data: {
        key: typeof data.key === "string" ? data.key : key,
        url: typeof data.url === "string" ? data.url : "",
        size: typeof data.size === "number" ? data.size : file.size,
      },
    };
  } catch (err) {
    console.error("[R2 Upload] Edge stream error:", err);
    if (err instanceof DOMException && err.name === "AbortError") {
      return { success: false, error: "Upload timed out — check your connection and try again" };
    }
    return { success: false, error: err instanceof Error ? err.message : "Upload failed" };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function uploadViaPresignedPut(
  file: File,
  key: string,
  contentType: string,
  options: UploadOptions,
  putTimeoutMs = PUT_TIMEOUT_MS,
): Promise<R2Response<UploadResult>> {
  try {
    console.log("[R2 Upload] Requesting presigned URL…");
    const { url } = supabaseFunctionsBase();
    const headers = await authHeaders();
    const presignController = new AbortController();
    const presignTimer = window.setTimeout(() => presignController.abort(), PRESIGN_TIMEOUT_MS);

    let presignData: { success?: boolean; url?: string; error?: string } | null = null;
    try {
      const presignRes = await fetch(`${url}/functions/v1/r2-presign`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key, contentType }),
        signal: presignController.signal,
      });
      presignData = await presignRes.json().catch(() => null);
      if (!presignRes.ok || !presignData?.success || !presignData.url) {
        return {
          success: false,
          error: presignData?.error || `Failed to get upload URL (${presignRes.status})`,
        };
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { success: false, error: "Upload timed out getting upload URL" };
      }
      // Last resort: supabase invoke
      const { data, error } = await supabase.functions.invoke("r2-presign", {
        body: { key, contentType },
      });
      if (error || !data?.success || !data?.url) {
        return {
          success: false,
          error: data?.error || error?.message || "Failed to get upload URL",
        };
      }
      presignData = data;
    } finally {
      window.clearTimeout(presignTimer);
    }

    const presignedUrl = presignData!.url!;
    const publicUrl = presignedUrl.split("?")[0];
    console.log("[R2 Upload] Direct PUT to R2…");

    const putController = new AbortController();
    const putTimer = window.setTimeout(() => putController.abort(), putTimeoutMs);
    try {
      const response = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
        signal: putController.signal,
      });
      if (!response.ok) {
        return { success: false, error: `Upload failed: ${response.status}` };
      }
      options.onProgress?.(100);
      return { success: true, data: { key, url: publicUrl, size: file.size } };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { success: false, error: "Upload timed out — try a smaller image" };
      }
      return {
        success: false,
        error: err instanceof Error ? err.message : "Network error during upload",
      };
    } finally {
      window.clearTimeout(putTimer);
    }
  } catch (err) {
    console.error("[R2 Upload] Presigned upload error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Upload failed" };
  }
}

/**
 * Get a download URL for a file stored in R2.
 */
export function getR2DownloadUrl(key: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${supabaseUrl}/functions/v1/r2-download?key=${encodeURIComponent(key)}`;
}

/**
 * Download a file from R2 as a blob.
 */
export async function downloadFromR2(key: string): Promise<R2Response<Blob>> {
  try {
    const url = getR2DownloadUrl(key);
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(url, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Download failed' }));
      return { success: false, error: errorData.error || `Download failed: ${response.status}` };
    }

    const blob = await response.blob();
    return { success: true, data: blob };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Download failed' };
  }
}

/**
 * Delete a file from R2 storage.
 */
export async function deleteFromR2(key: string): Promise<R2Response> {
  try {
    const { data, error } = await supabase.functions.invoke('r2-delete', {
      body: { key },
    });

    if (error) return { success: false, error: error.message };
    if (!data?.success) return { success: false, error: data?.error || 'Delete failed' };

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Delete failed' };
  }
}

/**
 * Helper to generate a unique file key with user ID prefix.
 */
export function generateR2Key(
  userId: string,
  folder: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${userId}/${folder}/${timestamp}-${sanitized}`;
}
