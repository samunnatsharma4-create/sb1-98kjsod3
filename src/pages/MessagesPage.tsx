import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter, Link } from '@tanstack/react-router';
import { Send, ArrowLeft, MoreVertical, Check, CheckCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';
import Spinner from '../components/Spinner';
import type { Profile, Message, ConversationWithDetails } from '../lib/database.types';
import { formatTime, formatDistanceToNow } from '../lib/dateUtils';

export function ConversationsListPage() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    fetchConversations();
    const sub = supabase
      .channel('conversations-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchConversations())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [profile]);

  const fetchConversations = async () => {
    if (!profile) return;
    const { data: participantRows } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', profile.id);

    if (!participantRows?.length) { setConversations([]); setLoading(false); return; }
    const convIds = participantRows.map((p) => p.conversation_id);

    const results: ConversationWithDetails[] = [];
    for (const convId of convIds) {
      const [{ data: otherParticipants }, { data: lastMessages }, { count: unreadCount }] = await Promise.all([
        supabase.from('conversation_participants').select('user_id, profiles(*)').eq('conversation_id', convId).neq('user_id', profile.id),
        supabase.from('messages').select('*').eq('conversation_id', convId).order('created_at', { ascending: false }).limit(1),
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', convId).eq('is_read', false).neq('sender_id', profile.id),
      ]);

      const otherUser = (otherParticipants?.[0] as unknown as { profiles: Profile })?.profiles;
      if (!otherUser) continue;

      const { data: conv } = await supabase.from('conversations').select('*').eq('id', convId).single();
      results.push({
        ...conv!,
        other_user: otherUser,
        last_message: lastMessages?.[0] ?? null,
        unread_count: unreadCount ?? 0,
      });
    }
    results.sort((a, b) => {
      const ta = a.last_message?.created_at ?? a.created_at;
      const tb = b.last_message?.created_at ?? b.created_at;
      return new Date(tb).getTime() - new Date(ta).getTime();
    });
    setConversations(results);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-1">
      <h1 className="text-xl font-bold text-slate-900 mb-4">Messages</h1>
      {conversations.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100">
          <p className="font-medium">No conversations yet</p>
          <p className="text-sm mt-1">Visit a profile to start chatting</p>
        </div>
      ) : (
        conversations.map((conv) => (
          <Link key={conv.id} to={`/messages/${conv.id}`}
            className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all shadow-sm"
          >
            <Avatar src={conv.other_user.avatar_url} name={conv.other_user.full_name || conv.other_user.username} size="md" isOnline={conv.other_user.is_online} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900 text-sm">{conv.other_user.full_name || conv.other_user.username}</p>
                {conv.last_message && (
                  <span className="text-xs text-slate-400">{formatDistanceToNow(conv.last_message.created_at)}</span>
                )}
              </div>
              <p className="text-sm text-slate-500 truncate mt-0.5">
                {conv.last_message ? conv.last_message.content : 'No messages yet'}
              </p>
            </div>
            {conv.unread_count > 0 && (
              <span className="w-5 h-5 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                {conv.unread_count > 9 ? '9+' : conv.unread_count}
              </span>
            )}
          </Link>
        ))
      )}
    </div>
  );
}

export function ChatPage() {
  const { conversationId } = useParams({ strict: false }) as { conversationId: string };
  const { profile } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<(Message & { profiles: Profile })[]>([]);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!profile || !conversationId) return;
    fetchData();

    const msgSub = supabase
      .channel(`chat-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        async (payload) => {
          const { data } = await supabase.from('messages').select('*, profiles(*)').eq('id', payload.new.id).single();
          if (data) {
            setMessages((prev) => [...prev, data as Message & { profiles: Profile }]);
            if (data.sender_id !== profile.id) markRead();
          }
        }
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'typing_indicators', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as { user_id: string; is_typing: boolean };
          if (row.user_id !== profile.id) setOtherTyping(row.is_typing);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(msgSub); };
  }, [profile, conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, otherTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchData = async () => {
    if (!profile) return;
    const { data: parts } = await supabase
      .from('conversation_participants')
      .select('user_id, profiles(*)')
      .eq('conversation_id', conversationId)
      .neq('user_id', profile.id);
    const other = (parts?.[0] as unknown as { profiles: Profile })?.profiles;
    setOtherUser(other ?? null);

    const { data: msgs } = await supabase
      .from('messages')
      .select('*, profiles(*)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages((msgs as (Message & { profiles: Profile })[]) ?? []);
    setLoading(false);
    markRead();
  };

  const markRead = async () => {
    if (!profile) return;
    await supabase.from('messages').update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', profile.id)
      .eq('is_read', false);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !messageText.trim()) return;
    const content = messageText.trim();
    setMessageText('');
    await stopTyping();

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: profile.id,
      content,
    });

    await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);

    if (otherUser) {
      await supabase.from('notifications').insert({
        user_id: otherUser.id,
        actor_id: profile.id,
        type: 'message',
        conversation_id: conversationId,
      });
    }
  };

  const handleTyping = useCallback(async (value: string) => {
    setMessageText(value);
    if (!profile) return;
    if (!isTyping) {
      setIsTyping(true);
      await supabase.from('typing_indicators').upsert({ conversation_id: conversationId, user_id: profile.id, is_typing: true, updated_at: new Date().toISOString() });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 2000);
  }, [profile, conversationId, isTyping]);

  const stopTyping = useCallback(async () => {
    if (!profile) return;
    setIsTyping(false);
    await supabase.from('typing_indicators').upsert({ conversation_id: conversationId, user_id: profile.id, is_typing: false, updated_at: new Date().toISOString() });
  }, [profile, conversationId]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] lg:h-[calc(100vh-3rem)] -mt-6 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-white flex-shrink-0">
        <button onClick={() => router.navigate({ to: '/messages' })} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        {otherUser && (
          <Link to={`/profile/${otherUser.username}`} className="flex items-center gap-3 flex-1 group">
            <Avatar src={otherUser.avatar_url} name={otherUser.full_name || otherUser.username} size="sm" isOnline={otherUser.is_online} />
            <div>
              <p className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                {otherUser.full_name || otherUser.username}
              </p>
              <p className="text-xs text-slate-500">
                {otherUser.is_online ? (
                  <span className="text-emerald-500 font-medium">Online</span>
                ) : (
                  `@${otherUser.username}`
                )}
              </p>
            </div>
          </Link>
        )}
        <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
          <MoreVertical size={18} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/50">
        {messages.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm">Start the conversation!</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isOwn = msg.sender_id === profile?.id;
          const showAvatar = !isOwn && (i === 0 || messages[i - 1]?.sender_id !== msg.sender_id);
          const isLastOwn = isOwn && (i === messages.length - 1 || messages[i + 1]?.sender_id !== msg.sender_id);

          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className="w-7 flex-shrink-0">
                {showAvatar && (
                  <Avatar src={msg.profiles.avatar_url} name={msg.profiles.full_name || msg.profiles.username} size="xs" />
                )}
              </div>
              <div className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  isOwn
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-white text-slate-800 border border-slate-100 rounded-bl-md'
                }`}>
                  {msg.content}
                </div>
                <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                  <span className="text-xs text-slate-400">{formatTime(msg.created_at)}</span>
                  {isOwn && isLastOwn && (
                    <span className={`text-xs ${msg.is_read ? 'text-blue-500' : 'text-slate-400'}`}>
                      {msg.is_read ? <CheckCheck size={13} /> : <Check size={13} />}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {otherTyping && otherUser && (
          <div className="flex items-end gap-2">
            <Avatar src={otherUser.avatar_url} name={otherUser.full_name || otherUser.username} size="xs" />
            <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex items-center gap-3 px-4 py-3 border-t border-slate-100 bg-white flex-shrink-0">
        <div className="flex-1 flex items-center bg-slate-100 rounded-full px-4 py-2.5 gap-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => handleTyping(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 text-sm bg-transparent text-slate-800 placeholder-slate-400 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={!messageText.trim()}
          className="w-10 h-10 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full flex items-center justify-center transition-all flex-shrink-0 shadow-sm"
        >
          <Send size={16} className="translate-x-0.5 -translate-y-0.5" />
        </button>
      </form>
    </div>
  );
}
