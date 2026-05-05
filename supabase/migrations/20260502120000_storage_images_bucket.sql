/*
  NepLink — public bucket for user-uploaded images (posts, avatars).
  Bucket name must match src/lib/storage.ts IMAGES_BUCKET.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'images',
  'images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "images_select_public" ON storage.objects;
DROP POLICY IF EXISTS "images_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "images_update_own" ON storage.objects;
DROP POLICY IF EXISTS "images_delete_own" ON storage.objects;

CREATE POLICY "images_select_public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'images');

CREATE POLICY "images_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'images');

CREATE POLICY "images_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'images');

CREATE POLICY "images_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'images');
