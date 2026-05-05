import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { useParams, useRouter, Link } from '@tanstack/react-router';
import { Send, ArrowLeft, MoreVertical, Check, CheckCheck, PanelLeft, Phone, Video, User, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { subscribeSafe, removeChannelSafe } from '../../lib/realtime';
import { useAuth } from '../../contexts/AuthContext';
import { useMessagesShell } from '../../contexts/MessagesShellContext';
import { useCall } from '../../contexts/CallContext';
import Avatar from '../../components/Avatar';
import Spinner from '../../components/Spinner';
import type { Profile, Message } from '../../lib/database.types';
import { formatTime } from '../../lib/dateUtils';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Input';
import { cn } from '../../lib/utils';

type MsgRow = Message & { profiles?: Profile | null };

export default function ChatPage() {
  const { conversationId } = useParams({ strict: false }) as { conversationId: string };
  const { profile } = useAuth();
  const router = useRouter();
  const { openSidebarMobile } = useMessagesShell();
  const { startCall } = useCall();

  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [realtimeOk, setRealtimeOk] = useState(true);
  const [chatMenuOpen, setChatMenuOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (chatMenuRef.current && !chatMenuRef.current.contains(e.target as Node)) setChatMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [chatMenuOpen]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useLayoutEffect(() => {
    scrollToBottom(messages.length < 2 ? 'auto' : 'smooth');
  }, [messages, otherTyping, scrollToBottom]);

  useEffect(() => {
    if (!profile || !conversationId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data: parts, error: pErr } = await supabase
          .from('conversation_participants')
          .select('user_id, profiles(*)')
          .eq('conversation_id', conversationId)
          .neq('user_id', profile.id);
        if (pErr) throw pErr;
        const other = (parts?.[0] as unknown as { profiles?: Profile | null })?.profiles ?? null;
        if (!cancelled) setOtherUser(other);

        const { data: msgs, error: mErr } = await supabase
          .from('messages')
          .select('*, profiles(*)')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true });
        if (mErr) throw mErr;
        if (!cancelled) setMessages((msgs as MsgRow[]) ?? []);
        void markRead();
      } catch (e) {
        console.error('Chat load', e);
        if (!cancelled) toast.error('Could not load messages');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    const msgSub = subscribeSafe(
      supabase
        .channel(`chat-${conversationId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          async (payload) => {
            try {
              const { data } = await supabase.from('messages').select('*, profiles(*)').eq('id', payload.new.id).single();
              const row = data as MsgRow | null;
              if (row?.id && !cancelled) {
                setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
                if (row.sender_id !== profile.id) void markRead();
              }
            } catch (e) {
              console.error('Realtime message merge', e);
            }
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const updated = payload.new as Message;
            setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles' },
          (payload) => {
            const updated = payload.new as Profile;
            setOtherUser((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
          },
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'typing_indicators', filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const row = payload.new as { user_id: string; is_typing?: boolean };
            if (row?.user_id && row.user_id !== profile.id) setOtherTyping(!!row.is_typing);
          },
        ),
      {
        name: `chat-${conversationId}`,
        onError: (msg) => {
          console.error(msg);
          setRealtimeOk(false);
          toast.error('Chat sync interrupted. Sending still works.', { duration: 4000 });
        },
      },
    );

    return () => {
      cancelled = true;
      removeChannelSafe(supabase, msgSub);
    };
  }, [profile, conversationId]);

  const markRead = async () => {
    if (!profile) return;
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', profile.id)
        .eq('is_read', false);
    } catch (e) {
      console.warn('markRead', e);
    }
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!profile || !messageText.trim()) return;
    const content = messageText.trim();
    setMessageText('');
    await stopTyping();

    try {
      const { error: insErr } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: profile.id,
        content,
      });
      if (insErr) throw insErr;

      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);

      if (otherUser) {
        await supabase.from('notifications').insert({
          user_id: otherUser.id,
          actor_id: profile.id,
          type: 'message',
          conversation_id: conversationId,
        });
      }
    } catch (err) {
      console.error('sendMessage', err);
      toast.error('Message failed to send');
      setMessageText(content);
    }
  };

  const stopTyping = useCallback(async () => {
    if (!profile) return;
    setIsTyping(false);
    try {
      await supabase
        .from('typing_indicators')
        .upsert(
          { conversation_id: conversationId, user_id: profile.id, is_typing: false, updated_at: new Date().toISOString() },
          { onConflict: 'conversation_id,user_id' },
        );
    } catch (e) {
      console.warn('typing stop', e);
    }
  }, [profile, conversationId]);

  const handleTyping = useCallback(
    async (value: string) => {
      setMessageText(value);
      if (!profile) return;
      if (!isTyping) {
        setIsTyping(true);
        try {
          await supabase
            .from('typing_indicators')
            .upsert(
              { conversation_id: conversationId, user_id: profile.id, is_typing: true, updated_at: new Date().toISOString() },
              { onConflict: 'conversation_id,user_id' },
            );
        } catch (e) {
          console.warn('typing upsert', e);
        }
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => void stopTyping(), 2000);
    },
    [profile, conversationId, isTyping, stopTyping],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const placeCall = async (media: 'audio' | 'video') => {
    if (!otherUser) return toast.error('No participant');
    try {
      await startCall({
        calleeId: otherUser.id,
        calleeName: otherUser.full_name || otherUser.username,
        calleeAvatar: otherUser.avatar_url,
        conversationId,
        media,
      });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[320px]">
        <Spinner size="lg" className="border-slate-300 border-t-blue-500 dark:border-slate-600 dark:border-t-blue-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 min-w-0 h-[calc(100dvh-7.25rem)] lg:h-[min(100dvh-3.5rem,900px)] overflow-hidden animate-fade-in bg-slate-50 dark:bg-slate-950 rounded-[2.5rem] border border-white/20 dark:border-white/5 shadow-2xl">
      {!realtimeOk && (
        <div className="px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.2em] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-b border-amber-500/20 backdrop-blur-md">
          Reconnecting live updates…
        </div>
      )}

      <header className="flex items-center gap-3 px-6 py-5 border-b border-white/10 glass-card rounded-none border-t-0 border-x-0 bg-white/90 dark:bg-slate-950/80 backdrop-blur-2xl flex-shrink-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openSidebarMobile()}
          className="lg:hidden"
          aria-label="Conversations"
        >
          <PanelLeft size={21} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.navigate({ to: '/messages' })}
          className="hidden lg:inline-flex"
          aria-label="Back to inbox"
        >
          <ArrowLeft size={20} />
        </Button>

        {otherUser && (
          <Link to="/profile/$username" params={{ username: otherUser.username }} className="flex items-center gap-4 flex-1 min-w-0 group ml-1">
            <div className="relative p-0.5 glass-card border-none ring-2 ring-transparent group-hover:ring-blue-500/20 transition-all duration-300">
              <Avatar src={otherUser.avatar_url} name={otherUser.full_name || otherUser.username} size="sm" isOnline={otherUser.is_online} className="w-11 h-11" />
            </div>
            <div className="min-w-0">
              <p className="font-black text-slate-900 dark:text-white text-[15px] truncate group-hover:text-blue-500 transition-colors tracking-tight">
                {otherUser.full_name || otherUser.username}
              </p>
              <div className="flex items-center gap-2">
                {otherUser.is_online ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Active Now</span>
                  </div>
                ) : (
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    @{otherUser.username}
                  </span>
                )}
              </div>
            </div>
          </Link>
        )}

        <div ref={chatMenuRef} className="relative flex items-center gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void placeCall('audio')}
            className="text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            title="Voice call"
          >
            <Phone size={20} strokeWidth={2.5} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void placeCall('video')}
            className="text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
            title="Video call"
          >
            <Video size={22} strokeWidth={2.5} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-expanded={chatMenuOpen}
            aria-haspopup="menu"
            onClick={(e) => {
              e.stopPropagation();
              setChatMenuOpen((o) => !o);
            }}
            title="More"
          >
            <MoreVertical size={20} />
          </Button>
          {chatMenuOpen && otherUser && (
            <Card
              role="menu"
              className="absolute right-0 top-full mt-3 w-56 shadow-2xl z-50 p-1.5 border-none animate-fade-in"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <Link
                to="/profile/$username"
                params={{ username: otherUser.username }}
                onClick={() => setChatMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-blue-500 hover:text-white rounded-xl transition-all"
              >
                <User size={14} /> View profile
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void (async () => {
                    try {
                      const url = `${window.location.origin}/messages/${conversationId}`;
                      await navigator.clipboard.writeText(url);
                      toast.success('Chat link copied');
                    } catch {
                      toast.error('Could not copy link');
                    }
                    setChatMenuOpen(false);
                  })();
                }}
                className="w-full justify-start gap-3 px-4 h-11 text-slate-700 dark:text-slate-200 hover:bg-blue-500 hover:text-white mt-1"
              >
                Copy chat link
              </Button>
            </Card>
          )}
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-6 sm:px-8 py-8 space-y-6 bg-slate-50/50 dark:bg-slate-950/50 custom-scrollbar"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 px-8 text-center animate-fade-in">
            <div className="w-24 h-24 glass-card rounded-full flex items-center justify-center mb-8 text-blue-500/20">
              <MessageCircle size={48} className="text-blue-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase tracking-[0.1em]">Start a ripple</h3>
            <p className="text-xs mt-3 font-bold text-slate-400 uppercase tracking-[0.2em] max-w-[240px] leading-relaxed">
              Your premium thread begins here.
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isOwn = msg.sender_id === profile?.id;
          const prof = msg.profiles ?? null;
          const showAvatar = !isOwn && !!prof && (i === 0 || messages[i - 1]?.sender_id !== msg.sender_id);
          const isLastOwn = isOwn && (i === messages.length - 1 || messages[i + 1]?.sender_id !== msg.sender_id);

          return (
            <div
              key={msg.id}
              className={cn("flex items-end gap-4 group/msg", isOwn ? 'flex-row-reverse' : 'flex-row')}
            >
              <div className="w-9 flex-shrink-0">
                {!isOwn && showAvatar && prof && (
                  <div className="p-0.5 glass-card border-none rounded-full">
                    <Avatar src={prof.avatar_url} name={prof.full_name || prof.username || ''} size="xs" className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className={cn("max-w-[75%] flex flex-col gap-2", isOwn ? 'items-end' : 'items-start')}>
                <div
                  className={cn(
                    "px-6 py-4 rounded-[2rem] text-[15px] leading-[1.6] font-medium shadow-sm transition-all duration-300",
                    isOwn
                      ? 'premium-gradient text-white rounded-br-none shadow-blue-500/20'
                      : 'glass-card border-none bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-bl-none'
                  )}
                >
                  {msg.content}
                </div>
                <div className={cn("flex items-center gap-2.5 px-2 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200", isOwn ? 'flex-row-reverse' : 'flex-row')}>
                  <time className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatTime(msg.created_at)}</time>
                  {isOwn && isLastOwn && (
                    <span className={cn("transition-colors duration-300", msg.is_read ? 'text-blue-500' : 'text-slate-300')}>
                      {msg.is_read ? <CheckCheck size={14} strokeWidth={3} /> : <Check size={14} strokeWidth={3} />}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {otherTyping && otherUser && (
          <div className="flex items-end gap-4 animate-fade-in">
            <div className="p-0.5 glass-card border-none rounded-full">
              <Avatar src={otherUser.avatar_url} name={otherUser.full_name || otherUser.username} size="xs" className="w-8 h-8" />
            </div>
            <div className="glass-card border-none rounded-[2rem] rounded-bl-none px-6 py-4 bg-white dark:bg-slate-900">
              <div className="flex gap-2 items-center">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      <footer className="px-6 py-6 border-t border-white/10 glass-card rounded-none border-b-0 border-x-0 bg-white/90 dark:bg-slate-950/80 backdrop-blur-2xl flex-shrink-0">
        <form onSubmit={sendMessage} className="flex items-end gap-4 max-w-5xl mx-auto">
          <div className="flex-1 relative group/input">
            <Textarea
              value={messageText}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Send a ripple…"
              rows={1}
              className="pr-14 min-h-[56px] max-h-40 leading-relaxed py-4 px-6 rounded-[1.75rem]"
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
              }}
            />
            <div className="absolute right-4 bottom-4">
               {/* Optional attachment button here */}
            </div>
          </div>
          <Button
            type="submit"
            disabled={!messageText.trim()}
            size="icon"
            className="w-14 h-14 rounded-2xl flex-shrink-0 shadow-2xl shadow-blue-500/30"
          >
            <Send size={22} className="translate-x-0.5" />
          </Button>
        </form>
      </footer>
    </div>
  );
}
