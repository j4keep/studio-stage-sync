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
};

const PROXY_UPLOAD_THRESHOLD = 5 * 1024 * 1024; // 5MB

/**
 * Upload a file to R2 storage.
 * Files under 5MB use multipart form-data via edge function.
 * Files over 5MB stream the raw body through the edge function with custom headers.
 */
export async function uploadToR2(
  file: File,
  options: UploadOptions = {}
): Promise<R2Response<UploadResult>> {
  const key = options.folder
    ? `${options.folder}/${options.fileName || file.name}`
    : options.fileName || file.name;

  if (file.size > PROXY_UPLOAD_THRESHOLD) {
    return uploadStreamingToR2(file, key, options);
  }
  return uploadViaFormData(file, options);
}

/** Small file upload via multipart form-data */
async function uploadViaFormData(
  file: File,
  options: UploadOptions
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

    if (error) return { success: false, error: error.message };
    if (!data?.success) return { success: false, error: data?.error || 'Upload failed' };

    return { success: true, data: { key: data.key, url: data.url, size: data.size } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Upload failed' };
  }
}

/** Large file upload: stream raw body through the edge function proxy */
async function uploadStreamingToR2(
  file: File,
  key: string,
  options: UploadOptions
): Promise<R2Response<UploadResult>> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const url = `${supabaseUrl}/functions/v1/r2-upload`;

    // Get the user's auth token if available
    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token || anonKey;

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('apikey', anonKey);
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      xhr.setRequestHeader('x-upload-key', key);
      xhr.setRequestHeader('x-upload-content-type', options.mimeType || file.type || 'application/octet-stream');

      if (options.onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            options.onProgress!(Math.round((e.loaded / e.total) * 100));
          }
        };
      }

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && data.success) {
            resolve({ success: true, data: { key: data.key, url: data.url, size: data.size || file.size } });
          } else {
            resolve({ success: false, error: data.error || `Upload failed: ${xhr.status}` });
          }
        } catch {
          resolve({ success: false, error: `Upload failed: ${xhr.status}` });
        }
      };

      xhr.onerror = () => resolve({ success: false, error: 'Network error during upload' });
      xhr.ontimeout = () => resolve({ success: false, error: 'Upload timed out' });
      xhr.timeout = 600000; // 10 min timeout

      xhr.send(file);
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Upload failed' };
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
