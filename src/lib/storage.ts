import { supabase } from './supabase';

export const AVATARS_BUCKET = 'avatars';
export const POSTS_BUCKET = 'posts';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

function extensionForMime(mime: string): string {
  return MIME_TO_EXT[mime.toLowerCase()] ?? 'img';
}

/** Path under the bucket, e.g. <userId>/<uuid>.jpg */
export function buildUniqueStoragePath(folder: string, mimeType: string): string {
  const safeFolder = folder.replace(/^\/+|\/+$/g, '');
  const ext = extensionForMime(mimeType);
  const id = crypto.randomUUID();
  return `${safeFolder}/${id}.${ext}`;
}

/**
 * Upload an image file to Supabase Storage and return its public URL.
 */
export async function uploadImageToStorage(file: File, bucket: string, folder: string): Promise<string> {
  const path = buildUniqueStoragePath(folder, file.type || 'image/jpeg');
  console.log(`[Storage] Uploading to ${bucket}/${path}...`);
  
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'application/octet-stream',
  });
  
  if (error) {
    console.error(`[Storage] Upload error:`, error);
    throw error;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  console.log(`[Storage] Public URL:`, data.publicUrl);
  return data.publicUrl;
}
