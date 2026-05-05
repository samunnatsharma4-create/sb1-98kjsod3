import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { subscribeSafe, removeChannelSafe } from '../lib/realtime';
import toast from 'react-hot-toast';
import type { Profile, ConversationWithDetails } from '../lib/database.types';

export function useConversations(profileId: string | undefined) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    if (!profileId) return;
    setError(null);

    const { data: participantRows, error: partErr } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', profileId);

    if (partErr) {
      console.error('useConversations participants:', partErr);
      setError(partErr.message);
      toast.error('Could not load conversations');
      setConversations([]);
      setLoading(false);
      return;
    }

    // Get blocked users
    const { data: blockedData } = await supabase
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'blocked')
      .or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`);
    
    const blockedIds = new Set(blockedData?.flatMap(f => [f.requester_id, f.addressee_id]) ?? []);
    blockedIds.delete(profileId!);

    if (!participantRows?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convIds = participantRows.map((p) => p.conversation_id).filter(Boolean);
    const results: ConversationWithDetails[] = [];

    for (const convId of convIds) {
      try {
        const [{ data: otherParticipants }, { data: lastMessages }, { count: unreadCount }] =
          await Promise.all([
            supabase
              .from('conversation_participants')
              .select('user_id, profiles(*)')
              .eq('conversation_id', convId)
              .neq('user_id', profileId),
            supabase
              .from('messages')
              .select('*')
              .eq('conversation_id', convId)
              .order('created_at', { ascending: false })
              .limit(1),
            supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', convId)
              .eq('is_read', false)
              .neq('sender_id', profileId),
          ]);

        const otherRow = otherParticipants?.[0] as { user_id: string; profiles?: Profile } | undefined;
        const otherUser = otherRow?.profiles;
        if (!otherUser || blockedIds.has(otherRow.user_id)) continue;

        const { data: convRow } = await supabase.from('conversations').select('*').eq('id', convId).single();

        if (!convRow) continue;

        results.push({
          ...(convRow as ConversationWithDetails),
          other_user: otherUser,
          last_message: lastMessages?.[0] ?? null,
          unread_count: unreadCount ?? 0,
        });
      } catch (e) {
        console.warn('conversation row fetch skipped', convId, e);
      }
    }

    results.sort((a, b) => {
      const ta = a.last_message?.created_at ?? a.created_at;
      const tb = b.last_message?.created_at ?? b.created_at;
      return new Date(tb).getTime() - new Date(ta).getTime();
    });

    setConversations(results);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    setLoading(true);
    void fetchConversations();

    const onSync = () => void fetchConversations();

    const ch = subscribeSafe(
      supabase
        .channel('conversations-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, onSync)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${profileId}` }, onSync),
      { name: 'conversations-sync' },
    );

    return () => removeChannelSafe(supabase, ch);
  }, [profileId, fetchConversations]);

  return { conversations, loading, error, refresh: fetchConversations };
}
