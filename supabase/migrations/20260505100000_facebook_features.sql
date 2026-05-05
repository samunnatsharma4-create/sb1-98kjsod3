-- Facebook-level Feature Enhancements

-- 1. Profiles: add cover_url and privacy_settings
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS privacy_settings jsonb DEFAULT '{"public_profile": true}'::jsonb;

-- 2. Friendships: update status to include 'blocked'
-- Since it's a CHECK constraint, we need to drop and recreate it
ALTER TABLE friendships DROP CONSTRAINT IF EXISTS friendships_status_check;
ALTER TABLE friendships ADD CONSTRAINT friendships_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked'));

-- 3. Group Members: add role
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS role text DEFAULT 'member' CHECK (role IN ('admin', 'member'));

-- 4. Comments: add parent_id for nested replies
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES comments(id) ON DELETE CASCADE;

-- 5. Posts: add share_count and original_post_id for sharing
ALTER TABLE posts ADD COLUMN IF NOT EXISTS share_count int DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS original_post_id uuid REFERENCES posts(id) ON DELETE SET NULL;

-- 6. Update RLS for privacy_settings
-- Profiles: only show if public_profile is true, or if it's own profile, or if friends
CREATE OR REPLACE FUNCTION public.can_view_profile(target_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = target_id
      AND (
        (p.privacy_settings->>'public_profile')::boolean = true
        OR auth.uid() = target_id
        OR EXISTS (
          SELECT 1 FROM friendships f
          WHERE f.status = 'accepted'
            AND (
              (f.requester_id = auth.uid() AND f.addressee_id = target_id)
              OR (f.requester_id = target_id AND f.addressee_id = auth.uid())
            )
        )
      )
  );
$$;

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
CREATE POLICY "Profiles are viewable by authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (public.can_view_profile(id));

-- 7. Blocked users should not be able to interact
-- We can add a function to check if blocked
CREATE OR REPLACE FUNCTION public.is_blocked(user_a uuid, user_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'blocked'
      AND (
        (f.requester_id = user_a AND f.addressee_id = user_b)
        OR (f.requester_id = user_b AND f.addressee_id = user_a)
      )
  );
$$;

-- Update friendships RLS to handle blocked
DROP POLICY IF EXISTS "Friendships are viewable by involved users" ON friendships;
CREATE POLICY "Friendships are viewable by involved users"
  ON friendships FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- 8. Messaging: prevent messaging if blocked
DROP POLICY IF EXISTS "Participants can send messages" ON messages;
CREATE POLICY "Participants can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_member_of_conversation(conversation_id)
    AND NOT EXISTS (
      SELECT 1 FROM conversation_participants cp
      JOIN friendships f ON (
        (f.requester_id = auth.uid() AND f.addressee_id = cp.user_id)
        OR (f.requester_id = cp.user_id AND f.addressee_id = auth.uid())
      )
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id != auth.uid()
        AND f.status = 'blocked'
    )
  );

-- 9. Increment share count function
CREATE OR REPLACE FUNCTION public.increment_share_count(post_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.posts
  SET share_count = share_count + 1
  WHERE id = post_id;
END;
$$;

