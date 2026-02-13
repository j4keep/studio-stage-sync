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
};

/**
 * Upload a file to R2 storage via edge function.
 * Supports File objects directly using multipart/form-data.
 */
export async function uploadToR2(
  file: File,
  options: UploadOptions = {}
): Promise<R2Response<UploadResult>> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (options.fileName) formData.append('fileName', options.fileName);
    if (options.folder) formData.append('folder', options.folder);
    if (options.mimeType) formData.append('mimeType', options.mimeType);

    const { data, error } = await supabase.functions.invoke('r2-upload', {
      body: formData,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Upload failed' };
    }

    return { success: true, data: { key: data.key, url: data.url, size: data.size } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed';
    return { success: false, error: msg };
  }
}

/**
 * Get a download URL for a file stored in R2.
 * Returns the edge function URL that proxies the file.
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
    const msg = err instanceof Error ? err.message : 'Download failed';
    return { success: false, error: msg };
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

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Delete failed' };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Delete failed';
    return { success: false, error: msg };
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
