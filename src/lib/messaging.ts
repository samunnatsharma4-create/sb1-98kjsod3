import { supabase } from './supabase';

/**
 * Create or get 1:1 conversation between two users
 */
export async function getOrCreateDmConversation(
  currentUserId: string,
  otherUserId: string
): Promise<{ conversationId: string } | { error: string }> {
  try {
    if (!currentUserId || !otherUserId) {
      return { error: 'Missing user IDs' };
    }

    if (currentUserId === otherUserId) {
      return { error: 'You cannot message yourself' };
    }

    const users = [currentUserId, otherUserId].sort();

    // =========================
    // 1. CHECK EXISTING CHAT
    // =========================
    // We must check using currentUserId because RLS only allows us to see our own rows
    // in conversation_participants unless we are already in the conversation.
    const { data: myParticipants, error: findError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', currentUserId);

    if (findError) {
      console.error('Find error:', findError);
      return { error: findError.message };
    }

    if (myParticipants && myParticipants.length > 0) {
      const convIds = myParticipants.map(p => p.conversation_id);
      
      // Now check if otherUserId is in any of these conversations
      const { data: match, error: matchError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', otherUserId)
        .in('conversation_id', convIds)
        .maybeSingle();

      if (matchError) {
        console.error('Match error:', matchError);
      } else if (match) {
        return { conversationId: match.conversation_id };
      }
    }

    // =========================
    // 2. CREATE CONVERSATION
    // =========================
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .insert({
        created_by: currentUserId
      })
      .select('id')
      .single();

    if (convError || !conv) {
      console.error('Conversation error:', convError);
      return { error: convError?.message || 'Failed to create conversation' };
    }

    // =========================
    // 3. ADD PARTICIPANTS
    // =========================
    const { error: partError } = await supabase
      .from('conversation_participants')
      .insert([
        {
          conversation_id: conv.id,
          user_id: users[0]
        },
        {
          conversation_id: conv.id,
          user_id: users[1]
        }
      ]);

    if (partError) {
      console.error('Participants error:', partError);
      return { error: partError.message };
    }

    return { conversationId: conv.id };

  } catch (err: any) {
    console.error('Unexpected error:', err);
    return { error: err.message || 'Something went wrong' };
  }
}


/**
 * Send a message
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  content: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    if (!conversationId || !senderId || !content) {
      return { error: 'Missing fields' };
    }

    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content
      });

    if (error) {
      console.error('Send message error:', error);
      return { error: error.message };
    }

    return { success: true };

  } catch (err: any) {
    console.error('Unexpected error:', err);
    return { error: err.message };
  }
}