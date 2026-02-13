// Session-level media cache that persists across page navigations
// Maps item IDs to blob URLs so media stays playable during the session

const mediaCache = new Map<string, string>();

export const cacheMediaUrl = (id: string, blobUrl: string) => {
  mediaCache.set(id, blobUrl);
};

export const getCachedMediaUrl = (id: string): string | null => {
  return mediaCache.get(id) || null;
};

export const removeCachedMedia = (id: string) => {
  const url = mediaCache.get(id);
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
  mediaCache.delete(id);
};
