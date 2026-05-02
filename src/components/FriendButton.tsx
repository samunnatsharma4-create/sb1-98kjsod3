import { useState, useEffect } from 'react';
import { UserPlus, UserCheck, UserX, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Friendship } from '../lib/database.types';

interface FriendButtonProps {
  targetUserId: string;
  className?: string;
}

type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends';

export default function FriendButton({ targetUserId, className = '' }: FriendButtonProps) {
  const { profile } = useAuth();
  const [status, setStatus] = useState<FriendStatus>('none');
  const [friendship, setFriendship] = useState<Friendship | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || profile.id === targetUserId) return;
    fetchFriendship();
  }, [profile, targetUserId]);

  const fetchFriendship = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(requester_id.eq.${profile.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${profile.id})`)
      .maybeSingle();
    setFriendship(data);
    if (!data) setStatus('none');
    else if (data.status === 'accepted') setStatus('friends');
    else if (data.status === 'pending' && data.requester_id === profile.id) setStatus('pending_sent');
    else if (data.status === 'pending' && data.addressee_id === profile.id) setStatus('pending_received');
    setLoading(false);
  };

  const sendRequest = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('friendships')
      .insert({ requester_id: profile.id, addressee_id: targetUserId })
      .select()
      .single();
    if (!error) {
      setFriendship(data);
      setStatus('pending_sent');
      await supabase.from('notifications').insert({
        user_id: targetUserId,
        actor_id: profile.id,
        type: 'friend_request',
      });
      toast.success('Friend request sent!');
    }
    setLoading(false);
  };

  const acceptRequest = async () => {
    if (!friendship || !profile) return;
    setLoading(true);
    await supabase.from('friendships').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', friendship.id);
    setStatus('friends');
    await supabase.from('notifications').insert({
      user_id: targetUserId,
      actor_id: profile.id,
      type: 'friend_accepted',
    });
    toast.success('Friend request accepted!');
    setLoading(false);
  };

  const rejectRequest = async () => {
    if (!friendship) return;
    setLoading(true);
    await supabase.from('friendships').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', friendship.id);
    setStatus('none');
    setFriendship(null);
    setLoading(false);
  };

  const removeFriend = async () => {
    if (!friendship) return;
    setLoading(true);
    await supabase.from('friendships').delete().eq('id', friendship.id);
    setStatus('none');
    setFriendship(null);
    toast.success('Friend removed');
    setLoading(false);
  };

  if (!profile || profile.id === targetUserId) return null;
  if (loading) return <div className={`h-9 w-28 rounded-xl bg-slate-100 animate-pulse ${className}`} />;

  if (status === 'none') {
    return (
      <button onClick={sendRequest} className={`flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all ${className}`}>
        <UserPlus size={15} />
        Add Friend
      </button>
    );
  }

  if (status === 'pending_sent') {
    return (
      <button onClick={removeFriend} className={`flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold rounded-xl transition-all ${className}`}>
        <Clock size={15} />
        Pending
      </button>
    );
  }

  if (status === 'pending_received') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button onClick={acceptRequest} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all">
          <UserCheck size={15} />
          Accept
        </button>
        <button onClick={rejectRequest} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold rounded-xl transition-all">
          <UserX size={15} />
          Decline
        </button>
      </div>
    );
  }

  return (
    <button onClick={removeFriend} className={`flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-red-50 text-emerald-600 hover:text-red-600 text-sm font-semibold rounded-xl transition-all ${className}`}>
      <UserCheck size={15} />
      Friends
    </button>
  );
}
