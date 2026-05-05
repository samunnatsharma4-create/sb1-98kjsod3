-- ============================================================================
-- Chat RLS fix (no recursion) — paste in Supabase SQL Editor if migrations
-- weren’t pushed. Same as migrations/20260502210600_chat_rls_no_recursion.sql
-- Prerequisites: NepLink conversations / conversation_participants / messages /
-- typing_indicators tables already exist from base schema migration.
-- ============================================================================
-- Fixes infinite recursion from conversation_participants SELECT policy querying
-- conversation_participants inside its own USING clause.
-- Uses SECURITY DEFINER helpers so membership checks bypass RLS for the inner read.

CREATE OR REPLACE FUNCTION public.is_member_of_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.conversation_participant_count_under_cap(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    SELECT count(*) FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
  ) < 2;
$$;

REVOKE ALL ON FUNCTION public.is_member_of_conversation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_member_of_conversation(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.conversation_participant_count_under_cap(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.conversation_participant_count_under_cap(uuid) TO authenticated;

-- conversation_participants
DROP POLICY IF EXISTS "Users can view their conversation participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can join conversations" ON conversation_participants;

CREATE POLICY "Users can view their conversation participants"
  ON conversation_participants FOR SELECT TO authenticated
  USING (public.is_member_of_conversation(conversation_id));

CREATE POLICY "Users can join conversations"
  ON conversation_participants FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.conversation_participant_count_under_cap(conversation_id)
  );

-- conversations
DROP POLICY IF EXISTS "Conversation participants can view conversations" ON conversations;
DROP POLICY IF EXISTS "Participants can update conversations" ON conversations;

CREATE POLICY "Conversation participants can view conversations"
  ON conversations FOR SELECT TO authenticated
  USING (public.is_member_of_conversation(id));

CREATE POLICY "Participants can update conversations"
  ON conversations FOR UPDATE TO authenticated
  USING (public.is_member_of_conversation(id))
  WITH CHECK (true);

-- messages
DROP POLICY IF EXISTS "Conversation participants can view messages" ON messages;
DROP POLICY IF EXISTS "Participants can send messages" ON messages;
DROP POLICY IF EXISTS "Recipients can mark messages as read" ON messages;

CREATE POLICY "Conversation participants can view messages"
  ON messages FOR SELECT TO authenticated
  USING (public.is_member_of_conversation(conversation_id));

CREATE POLICY "Participants can send messages"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_member_of_conversation(conversation_id)
  );

CREATE POLICY "Recipients can mark messages as read"
  ON messages FOR UPDATE TO authenticated
  USING (public.is_member_of_conversation(conversation_id))
  WITH CHECK (true);

-- typing_indicators
DROP POLICY IF EXISTS "Participants can view typing indicators" ON typing_indicators;
DROP POLICY IF EXISTS "Users can insert own typing indicators" ON typing_indicators;
DROP POLICY IF EXISTS "Users can update own typing indicators" ON typing_indicators;

CREATE POLICY "Participants can view typing indicators"
  ON typing_indicators FOR SELECT TO authenticated
  USING (public.is_member_of_conversation(conversation_id));

CREATE POLICY "Users can insert own typing indicators"
  ON typing_indicators FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_member_of_conversation(conversation_id)
  );

CREATE POLICY "Users can update own typing indicators"
  ON typing_indicators FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND public.is_member_of_conversation(conversation_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_member_of_conversation(conversation_id)
  );
