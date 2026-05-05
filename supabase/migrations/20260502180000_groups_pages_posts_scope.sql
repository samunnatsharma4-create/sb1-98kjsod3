-- Groups, Pages (publisher communities), scoped posts, stricter INSERT RLS.
-- Idempotent: DROP POLICY IF EXISTS before CREATE (safe via Supabase CLI or SQL Editor).
-- Prerequisite: 20260502080003_create_neplink_schema.sql (profiles, posts, …).

-- ---------------------------------------------------------------------------
-- groups
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  cover_url text DEFAULT '',
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT groups_name_trim CHECK (char_length(trim(name)) >= 2)
);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view groups" ON groups;
CREATE POLICY "Authenticated can view groups"
  ON groups FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can create groups" ON groups;
CREATE POLICY "Users can create groups"
  ON groups FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Creators update groups" ON groups;
CREATE POLICY "Creators update groups"
  ON groups FOR UPDATE TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Creators delete groups" ON groups;
CREATE POLICY "Creators delete groups"
  ON groups FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- ---------------------------------------------------------------------------
-- group_members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS group_members (
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members readable" ON group_members;
CREATE POLICY "Group members readable"
  ON group_members FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Join group as self" ON group_members;
CREATE POLICY "Join group as self"
  ON group_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Leave group self or creator clears" ON group_members;
CREATE POLICY "Leave group self or creator clears"
  ON group_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM groups g WHERE g.id = group_members.group_id AND g.created_by = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- community_pages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS community_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  avatar_url text DEFAULT '',
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE community_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pages visible to authenticated" ON community_pages;
CREATE POLICY "Pages visible to authenticated"
  ON community_pages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users create owned pages" ON community_pages;
CREATE POLICY "Users create owned pages"
  ON community_pages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners update pages" ON community_pages;
CREATE POLICY "Owners update pages"
  ON community_pages FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Owners delete pages" ON community_pages;
CREATE POLICY "Owners delete pages"
  ON community_pages FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- page_followers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS page_followers (
  page_id uuid NOT NULL REFERENCES community_pages(id) ON DELETE CASCADE,
  follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (page_id, follower_id)
);

ALTER TABLE page_followers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Page followers readable" ON page_followers;
CREATE POLICY "Page followers readable"
  ON page_followers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Follow pages as self" ON page_followers;
CREATE POLICY "Follow pages as self"
  ON page_followers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Unfollow self" ON page_followers;
CREATE POLICY "Unfollow self"
  ON page_followers FOR DELETE TO authenticated
  USING (follower_id = auth.uid());

-- ---------------------------------------------------------------------------
-- posts: scope columns + single-scope check
-- ---------------------------------------------------------------------------
ALTER TABLE posts ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS page_id uuid REFERENCES community_pages(id) ON DELETE CASCADE;

ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_single_scope_chk;
ALTER TABLE posts ADD CONSTRAINT posts_single_scope_chk CHECK (
  NOT (group_id IS NOT NULL AND page_id IS NOT NULL)
);

-- Replace legacy single INSERT policy with scoped policies
DROP POLICY IF EXISTS "Users can insert own posts" ON posts;
DROP POLICY IF EXISTS "Timeline posts insert" ON posts;
DROP POLICY IF EXISTS "Member group posts insert" ON posts;
DROP POLICY IF EXISTS "Owner page posts insert" ON posts;

CREATE POLICY "Timeline posts insert"
  ON posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND group_id IS NULL AND page_id IS NULL);

CREATE POLICY "Member group posts insert"
  ON posts FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND group_id IS NOT NULL
    AND page_id IS NULL
    AND EXISTS (
      SELECT 1 FROM group_members gm
      WHERE gm.group_id = posts.group_id AND gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Owner page posts insert"
  ON posts FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND page_id IS NOT NULL
    AND group_id IS NULL
    AND EXISTS (
      SELECT 1 FROM community_pages p
      WHERE p.id = posts.page_id AND p.owner_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_posts_group_created ON posts(group_id, created_at DESC) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_page_created ON posts(page_id, created_at DESC) WHERE page_id IS NOT NULL;
