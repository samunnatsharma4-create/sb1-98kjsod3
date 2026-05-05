import { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { Heart, MessageCircle, UserPlus, UserCheck, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';
import Spinner from '../components/Spinner';
import type { Profile, Notification } from '../lib/database.types';
import { formatDistanceToNow } from '../lib/dateUtils';

type NotifWithActor = Notification & { actor: Profile | null };

const notifConfig = {
  like: { icon: Heart, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-950/40', label: 'liked your post' },
  comment: { icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/35', label: 'commented on your post' },
  friend_request: { icon: UserPlus, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/35', label: 'sent you a friend request' },
  friend_accepted: { icon: UserCheck, color: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-950/35', label: 'accepted your friend request' },
  message: { icon: MessageSquare, color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-950/35', label: 'sent you a message' },
};

const fallbackNotif = { icon: MessageSquare, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800', label: 'sent a notification' };

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
          try {
            const { data, error } = await supabase
              .from('notifications')
              .select('*, actor:profiles!notifications_actor_id_fkey(*)')
              .eq('id', (payload.new as { id: string }).id)
              .single();
            if (!error && data) setNotifications((prev) => [data as unknown as NotifWithActor, ...prev]);
          } catch (e) {
            console.error('Notification realtime merge', e);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [profile]);

  const fetchNotifications = async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(*)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('Notifications fetch', error);
      toast.error('Could not load notifications');
      setNotifications([]);
    } else {
      setNotifications((data as unknown as NotifWithActor[]) ?? []);
    }
    setLoading(false);
  };

  const markAllRead = async () => {
    if (!profile) return;
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
    if (!error) setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const clearAll = async () => {
    if (!profile) return;
    if (!confirm('Clear all notifications? This cannot be undone.')) return;
    const { error } = await supabase.from('notifications').delete().eq('user_id', profile.id);
    if (!error) {
      setNotifications([]);
      toast.success('Notifications cleared');
    }
  };

  const markRead = async (id: string) => {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) {
      console.error('markRead', error);
      toast.error('Could not update notification');
      return;
    }
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const getLink = (notif: NotifWithActor) => {
    if (notif.type === 'message' && notif.conversation_id) return `/messages/${notif.conversation_id}`;
    if (notif.post_id) return `/`;
    if (notif.actor?.username) return `/profile/${notif.actor.username}`;
    return '/notifications';
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notifications</h1>
        <div className="flex gap-2">
          {notifications.length > 0 && (
            <>
              <button
                onClick={markAllRead}
                className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30"
              >
                Mark all read
              </button>
              <button
                onClick={clearAll}
                className="text-sm font-semibold text-slate-500 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Clear all
              </button>
            </>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800">
          <p className="font-medium">All caught up!</p>
          <p className="text-sm mt-1">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((notif) => {
            const config = notif.type in notifConfig ? notifConfig[notif.type as keyof typeof notifConfig] : fallbackNotif;
            const Icon = config.icon;
            const actor = notif.actor;
            const displayName = actor?.full_name || actor?.username || 'Someone';
            return (
              <Link
                key={notif.id}
                to={getLink(notif)}
                onClick={() => !notif.is_read && markRead(notif.id)}
                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all hover:shadow-md ${
                  notif.is_read
                    ? 'bg-white dark:bg-slate-950 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                    : 'bg-blue-50/50 dark:bg-blue-950/25 border-blue-100 dark:border-blue-900/60 hover:border-blue-200 dark:hover:border-blue-800'
                }`}
              >
                <div className="relative flex-shrink-0">
                  <Avatar src={actor?.avatar_url} name={displayName} size="sm" />
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 ${config.bg} rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-950`}>
                    <Icon size={10} className={config.color} fill={notif.type === 'like' ? 'currentColor' : 'none'} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 dark:text-slate-100">
                    <span className="font-semibold">{displayName}</span>
                    {' '}{config.label}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{formatDistanceToNow(notif.created_at)}</p>
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
