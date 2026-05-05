import { useState, useEffect, useCallback, useRef } from 'react';
import { UserPlus, UserCheck, UserX, Clock, Ban, MoreVertical, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Friendship } from '../lib/database.types';

interface FriendButtonProps {
  targetUserId: string;
  className?: string;
}

type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends' | 'blocked_by_me' | 'blocked_by_them';

export default function FriendButton({ targetUserId, className = '' }: FriendButtonProps) {
  const { profile } = useAuth();
  const [status, setStatus] = useState<FriendStatus>('none');
  const [friendship, setFriendship] = useState<Friendship | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchFriendship = useCallback(async () => {
    if (!profile || profile.id === targetUserId) return;
    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(requester_id.eq.${profile.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${profile.id})`)
      .maybeSingle();
    setFriendship(data);
    if (!data) setStatus('none');
    else if (data.status === 'blocked') {
      setStatus(data.requester_id === profile.id ? 'blocked_by_me' : 'blocked_by_them');
    }
    else if (data.status === 'accepted') setStatus('friends');
    else if (data.status === 'pending' && data.requester_id === profile.id) setStatus('pending_sent');
    else if (data.status === 'pending' && data.addressee_id === profile.id) setStatus('pending_received');
    setLoading(false);
  }, [profile, targetUserId]);

  useEffect(() => {
    if (!profile || profile.id === targetUserId) {
      setLoading(false);
      setFriendship(null);
      setStatus('none');
      return;
    }
    setLoading(true);
    void fetchFriendship();
  }, [profile, targetUserId, fetchFriendship]);

  const sendRequest = async () => {
    if (!profile) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('friendships')
      .insert({ requester_id: profile.id, addressee_id: targetUserId })
      .select()
      .single();
    if (!error && data) {
      setFriendship(data);
      setStatus('pending_sent');
      await supabase.from('notifications').insert({
        user_id: targetUserId,
        actor_id: profile.id,
        type: 'friend_request',
      });
      toast.success('Friend request sent!');
    } else if (error) {
      toast.error(error.message || 'Could not send request');
    }
    setLoading(false);
  };

  const acceptRequest = async () => {
    if (!friendship || !profile) return;
    setLoading(true);
    await supabase.from('friendships').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', friendship.id);
    setStatus('friends');
    await supabase.from('notifications').insert({
      user_id: friendship.requester_id === profile.id ? friendship.addressee_id : friendship.requester_id,
      actor_id: profile.id,
      type: 'friend_accepted',
    });
    toast.success('Friend request accepted!');
    setLoading(false);
  };

  const rejectRequest = async () => {
    if (!friendship) return;
    setLoading(true);
    await supabase.from('friendships').delete().eq('id', friendship.id);
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

  const blockUser = async () => {
    if (!profile) return;
    setLoading(true);
    if (friendship) {
      await supabase.from('friendships').update({
        status: 'blocked',
        requester_id: profile.id,
        addressee_id: targetUserId,
        updated_at: new Date().toISOString()
      }).eq('id', friendship.id);
    } else {
      await supabase.from('friendships').insert({
        requester_id: profile.id,
        addressee_id: targetUserId,
        status: 'blocked'
      });
    }
    setStatus('blocked_by_me');
    toast.success('User blocked');
    setLoading(false);
    setShowMenu(false);
  };

  const unblockUser = async () => {
    if (!friendship || status !== 'blocked_by_me') return;
    setLoading(true);
    await supabase.from('friendships').delete().eq('id', friendship.id);
    setStatus('none');
    setFriendship(null);
    toast.success('User unblocked');
    setLoading(false);
    setShowMenu(false);
  };

  if (!profile || profile.id === targetUserId) return null;
  if (status === 'blocked_by_them') return null;

  if (loading) return <div className={`h-9 w-28 rounded-xl bg-slate-100 animate-pulse ${className}`} />;

  return (
    <div className="flex items-center gap-2 relative" ref={menuRef}>
      {status === 'none' && (
        <button type="button" onClick={sendRequest} className={`flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all ${className}`}>
          <UserPlus size={15} />
          Add Friend
        </button>
      )}

      {status === 'pending_sent' && (
        <button type="button" onClick={removeFriend} className={`flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl transition-all ${className}`}>
          <Clock size={15} />
          Cancel Request
        </button>
      )}

      {status === 'pending_received' && (
        <div className={`flex items-center gap-2 ${className}`}>
          <button type="button" onClick={acceptRequest} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all">
            <UserCheck size={15} />
            Accept
          </button>
          <button type="button" onClick={rejectRequest} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl transition-all">
            <UserX size={15} />
            Decline
          </button>
        </div>
      )}

      {status === 'friends' && (
        <button type="button" onClick={() => setShowMenu(!showMenu)} className={`flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-sm font-semibold rounded-xl transition-all ${className}`}>
          <UserCheck size={15} />
          Friends
        </button>
      )}

      {status === 'blocked_by_me' && (
        <button type="button" onClick={unblockUser} className={`flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-sm font-semibold rounded-xl transition-all ${className}`}>
          <Ban size={15} />
          Unblock
        </button>
      )}

      {(status === 'none' || status === 'friends' || status === 'pending_sent' || status === 'pending_received') && (
        <button
          type="button"
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
        >
          <MoreVertical size={16} />
        </button>
      )}

      {showMenu && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 z-50 py-1 overflow-hidden">
          {status === 'friends' && (
            <button
              onClick={removeFriend}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Trash2 size={14} /> Unfriend
            </button>
          )}
          {status !== 'blocked_by_me' && (
            <button
              onClick={blockUser}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <Ban size={14} /> Block User
            </button>
          )}
        </div>
      )}
    </div>
  );
}
