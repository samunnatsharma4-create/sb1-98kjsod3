import { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { Heart, MessageCircle, UserPlus, UserCheck, MessageSquare, CheckCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';
import Spinner from '../components/Spinner';
import type { Profile, Notification } from '../lib/database.types';
import { formatDistanceToNow } from '../lib/dateUtils';

type NotifWithActor = Notification & { actor: Profile };

const notifConfig = {
  like: { icon: Heart, color: 'text-red-500', bg: 'bg-red-50', label: 'liked your post' },
  comment: { icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-50', label: 'commented on your post' },
  friend_request: { icon: UserPlus, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'sent you a friend request' },
  friend_accepted: { icon: UserCheck, color: 'text-teal-500', bg: 'bg-teal-50', label: 'accepted your friend request' },
  message: { icon: MessageSquare, color: 'text-sky-500', bg: 'bg-sky-50', label: 'sent you a message' },
};

export default function NotificationsPage() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<NotifWithActor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    fetchNotifications();
    const sub = supabase
      .channel('notifications-page')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        async (payload) => {
          const { data } = await supabase.from('notifications').select('*, actor:profiles!notifications_actor_id_fkey(*)').eq('id', payload.new.id).single();
          if (data) setNotifications((prev) => [data as unknown as NotifWithActor, ...prev]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [profile]);

  const fetchNotifications = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(*)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data as unknown as NotifWithActor[]) ?? []);
    setLoading(false);
  };

  const markAllRead = async () => {
    if (!profile) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const getLink = (notif: NotifWithActor) => {
    if (notif.type === 'message' && notif.conversation_id) return `/messages/${notif.conversation_id}`;
    if (notif.post_id) return `/`;
    return `/profile/${notif.actor.username}`;
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-500 font-medium transition-colors"
          >
            <CheckCheck size={16} />
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100">
          <p className="font-medium">All caught up!</p>
          <p className="text-sm mt-1">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((notif) => {
            const config = notifConfig[notif.type];
            const Icon = config.icon;
            return (
              <Link
                key={notif.id}
                to={getLink(notif)}
                onClick={() => !notif.is_read && markRead(notif.id)}
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all hover:shadow-md ${
                  notif.is_read
                    ? 'bg-white border-slate-100 hover:border-slate-200'
                    : 'bg-blue-50/50 border-blue-100 hover:border-blue-200'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <Avatar src={notif.actor.avatar_url} name={notif.actor.full_name || notif.actor.username} size="sm" />
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 ${config.bg} rounded-full flex items-center justify-center ring-2 ring-white`}>
                    <Icon size={10} className={config.color} fill={notif.type === 'like' ? 'currentColor' : 'none'} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800">
                    <span className="font-semibold">{notif.actor.full_name || notif.actor.username}</span>
                    {' '}{config.label}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatDistanceToNow(notif.created_at)}</p>
                </div>
                {!notif.is_read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
