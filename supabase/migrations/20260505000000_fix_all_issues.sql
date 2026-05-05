-- Fix Database Schema and RLS policies

-- 1. Update conversations table
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- 2. Update conversations RLS
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;
CREATE POLICY "Authenticated users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by OR created_by IS NULL); -- Allow setting created_by to self or null (null for legacy)

DROP POLICY IF EXISTS "Participants can update conversations" ON conversations;
CREATE POLICY "Participants can update conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (public.is_member_of_conversation(id))
  WITH CHECK (true);

-- 3. Update conversation_participants RLS
-- We need to allow the creator of the conversation to add participants
DROP POLICY IF EXISTS "Users can join conversations" ON conversation_participants;
CREATE POLICY "Users can join conversations"
  ON conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id -- Can add self
    OR 
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id AND c.created_by = auth.uid()
    ) -- Can add others if you are the creator of the conversation
  );

-- 4. Fix friendships RLS (ensure consistency)
DROP POLICY IF EXISTS "Friendships are viewable by involved users" ON friendships;
CREATE POLICY "Friendships are viewable by involved users"
  ON friendships FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- 5. Fix messages RLS
DROP POLICY IF EXISTS "Participants can send messages" ON messages;
CREATE POLICY "Participants can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_member_of_conversation(conversation_id)
  );

-- 6. Fix typing_indicators RLS
DROP POLICY IF EXISTS "Users can insert own typing indicators" ON typing_indicators;
CREATE POLICY "Users can insert own typing indicators"
  ON typing_indicators FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_member_of_conversation(conversation_id)
  );

-- 7. Fix profiles RLS (ensure users can update their own profile)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 8. Fix notifications RLS
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
CREATE POLICY "Authenticated users can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id OR actor_id IS NULL);
