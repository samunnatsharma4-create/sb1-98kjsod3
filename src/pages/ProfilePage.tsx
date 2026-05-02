import { useState, useEffect } from 'react';
import { useParams, useRouter } from '@tanstack/react-router';
import { Camera, CreditCard as Edit3, Check, X, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';
import FriendButton from '../components/FriendButton';
import PostCard from '../components/PostCard';
import Spinner from '../components/Spinner';
import type { Profile, PostWithProfile } from '../lib/database.types';
import { formatLastSeen } from '../lib/dateUtils';

export default function ProfilePage() {
  const { username } = useParams({ strict: false }) as { username: string };
  const { profile: currentProfile, refreshProfile } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [friendsCount, setFriendsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ full_name: '', bio: '', avatar_url: '' });

  const isOwnProfile = currentProfile?.username === username;

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle();
    if (!data) { setLoading(false); return; }
    setProfile(data);
    setEditForm({ full_name: data.full_name, bio: data.bio, avatar_url: data.avatar_url });

    const [postsRes, friendsRes] = await Promise.all([
      supabase.from('posts').select('*, profiles(*), likes(*), comments(*)').eq('user_id', data.id).order('created_at', { ascending: false }),
      supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('status', 'accepted')
        .or(`requester_id.eq.${data.id},addressee_id.eq.${data.id}`),
    ]);
    setPosts((postsRes.data as PostWithProfile[]) ?? []);
    setFriendsCount(friendsRes.count ?? 0);
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!currentProfile) return;
    const { error } = await supabase.from('profiles').update({
      full_name: editForm.full_name,
      bio: editForm.bio,
      avatar_url: editForm.avatar_url,
    }).eq('id', currentProfile.id);
    if (error) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile updated!');
      setEditing(false);
      await refreshProfile();
      fetchProfile();
    }
  };

  const handleMessageClick = async () => {
    if (!profile || !currentProfile) return;
    const participants = [currentProfile.id, profile.id].sort();
    const { data: existingParticipants } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', participants[0]);

    let conversationId: string | null = null;
    if (existingParticipants) {
      for (const p of existingParticipants) {
        const { data: check } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('conversation_id', p.conversation_id)
          .eq('user_id', participants[1])
          .maybeSingle();
        if (check) { conversationId = check.conversation_id; break; }
      }
    }

    if (!conversationId) {
      const { data: conv } = await supabase.from('conversations').insert({}).select().single();
      if (conv) {
        conversationId = conv.id;
        await supabase.from('conversation_participants').insert([
          { conversation_id: conv.id, user_id: participants[0] },
          { conversation_id: conv.id, user_id: participants[1] },
        ]);
      }
    }

    if (conversationId) router.navigate({ to: `/messages/${conversationId}` });
  };

  const handleDeletePost = (postId: string) => setPosts((prev) => prev.filter((p) => p.id !== postId));
  const handleLikeToggle = (postId: string, liked: boolean) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const likes = liked
          ? [...p.likes, { id: 'temp', post_id: postId, user_id: currentProfile!.id, created_at: new Date().toISOString() }]
          : p.likes.filter((l) => l.user_id !== currentProfile?.id);
        return { ...p, likes };
      })
    );
  };

  if (loading) return <div className="flex justify-center items-center py-20"><Spinner size="lg" /></div>;
  if (!profile) return <div className="text-center py-20 text-slate-500">User not found</div>;

  return (
    <div className="space-y-4">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Cover */}
        <div className="h-28 bg-gradient-to-r from-blue-500 via-blue-600 to-sky-500" />

        <div className="px-6 pb-6">
          <div className="flex items-end justify-between -mt-12 mb-4">
            <div className="relative">
              <Avatar
                src={profile.avatar_url}
                name={profile.full_name || profile.username}
                size="xl"
                isOnline={profile.is_online}
                className="ring-4 ring-white shadow-lg"
              />
              {isOwnProfile && editing && (
                <button className="absolute bottom-1 right-1 w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
                  <Camera size={13} className="text-white" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 pb-1">
              {!isOwnProfile && (
                <>
                  <FriendButton targetUserId={profile.id} />
                  <button
                    onClick={handleMessageClick}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all"
                  >
                    <MessageCircle size={15} />
                    Message
                  </button>
                </>
              )}
              {isOwnProfile && !editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all"
                >
                  <Edit3 size={15} />
                  Edit Profile
                </button>
              )}
              {isOwnProfile && editing && (
                <div className="flex gap-2">
                  <button onClick={handleSaveProfile} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-all">
                    <Check size={15} />
                    Save
                  </button>
                  <button onClick={() => setEditing(false)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-all">
                    <X size={15} />
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {editing ? (
            <div className="space-y-3">
              <input
                type="text"
                value={editForm.full_name}
                onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="Full name"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="url"
                value={editForm.avatar_url}
                onChange={(e) => setEditForm((p) => ({ ...p, avatar_url: e.target.value }))}
                placeholder="Avatar URL"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={editForm.bio}
                onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Write a bio..."
                rows={3}
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : (
            <>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{profile.full_name || profile.username}</h1>
                <p className="text-slate-500 text-sm">@{profile.username}</p>
              </div>
              {profile.bio && <p className="mt-2 text-slate-700 text-sm leading-relaxed">{profile.bio}</p>}
              <p className="mt-1 text-xs text-slate-400">
                {profile.is_online ? 'Online now' : formatLastSeen(profile.last_seen)}
              </p>
              <div className="flex gap-6 mt-4 pt-4 border-t border-slate-100">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">{posts.length}</p>
                  <p className="text-xs text-slate-500">Posts</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">{friendsCount}</p>
                  <p className="text-xs text-slate-500">Friends</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-slate-100">
          <p className="font-medium">No posts yet</p>
          {isOwnProfile && <p className="text-sm mt-1">Share something with your friends!</p>}
        </div>
      ) : (
        posts.map((post) => (
          <PostCard key={post.id} post={post} onDelete={handleDeletePost} onLikeToggle={handleLikeToggle} />
        ))
      )}
    </div>
  );
}
