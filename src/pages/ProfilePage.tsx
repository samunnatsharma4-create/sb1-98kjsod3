import { useState, useEffect } from 'react';
import { useParams, useRouter } from '@tanstack/react-router';
import { Camera, CreditCard as Edit3, Check, X, MessageCircle, LayoutGrid, Info, Users as UsersIcon, Trash2, Sparkles, Calendar, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { uploadImageToStorage, AVATARS_BUCKET, POSTS_BUCKET } from '../lib/storage';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';
import FriendButton from '../components/FriendButton';
import FriendList from '../components/FriendList';
import PostCard from '../components/PostCard';
import Spinner from '../components/Spinner';
import type { Profile, PostWithProfile } from '../lib/database.types';
import { formatLastSeen } from '../lib/dateUtils';
import { getOrCreateDmConversation } from '../lib/messaging';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';

export default function ProfilePage() {
  const { username } = useParams({ strict: false }) as { username: string };
  const { profile: currentProfile, refreshProfile } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [friendsCount, setFriendsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'about' | 'friends'>('posts');
  const [editForm, setEditForm] = useState({ full_name: '', bio: '', avatar_url: '', cover_url: '', username: '', privacy_settings: { public_profile: true } });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [openingChat, setOpeningChat] = useState(false);
  const [usernameError, setUsernameError] = useState('');

  const avatarLocalPreview = useObjectUrl(avatarFile);
  const avatarPreviewSrc = avatarLocalPreview || editForm.avatar_url || null;

  useEffect(() => {
    if (!editing) {
      setAvatarFile(null);
      setCoverFile(null);
      setUsernameError('');
    }
  }, [editing]);

  const validateUsername = async (val: string) => {
    setEditForm(p => ({ ...p, username: val }));
    if (val === profile?.username) {
      setUsernameError('');
      return;
    }
    if (val.length < 3) {
      setUsernameError('Too short');
      return;
    }
    const { data } = await supabase.from('profiles').select('id').eq('username', val).maybeSingle();
    if (data) setUsernameError('Already taken');
    else setUsernameError('');
  };

  const isOwnProfile = currentProfile?.username === username;

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle();
    if (error || !data) {
      setProfile(null);
      setPosts([]);
      setFriendsCount(0);
      setEditForm({ full_name: '', bio: '', avatar_url: '', cover_url: '', privacy_settings: { public_profile: true }, username: '' });
      setLoading(false);
      return;
    }
    setProfile(data);
    setEditForm({
      full_name: data.full_name,
      bio: data.bio,
      avatar_url: data.avatar_url,
      cover_url: data.cover_url,
      privacy_settings: data.privacy_settings || { public_profile: true },
      username: data.username
    });

    const [postsRes, friendsRes] = await Promise.all([
      supabase
        .from('posts')
        .select('*, profiles(*), likes(*), comments(*)')
        .eq('user_id', data.id)
        .is('group_id', null)
        .is('page_id', null)
        .order('created_at', { ascending: false }),
      supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('status', 'accepted')
        .or(`requester_id.eq.${data.id},addressee_id.eq.${data.id}`),
    ]);
    if (postsRes.error) {
      toast.error('Could not load posts');
      setPosts([]);
    } else {
      setPosts((postsRes.data as PostWithProfile[]) ?? []);
    }
    setFriendsCount(friendsRes.count ?? 0);
    setLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!currentProfile || usernameError) return;

    setSavingProfile(true);
    try {
      let avatarUrl = editForm.avatar_url;
      if (avatarFile) {
        avatarUrl = await uploadImageToStorage(avatarFile, AVATARS_BUCKET, currentProfile.id);
      }

      let coverUrl = editForm.cover_url;
      if (coverFile) {
        coverUrl = await uploadImageToStorage(coverFile, POSTS_BUCKET, `covers/${currentProfile.id}`);
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name.trim(),
          bio: editForm.bio.trim(),
          username: editForm.username.toLowerCase().trim(),
          avatar_url: avatarUrl,
          cover_url: coverUrl,
          privacy_settings: editForm.privacy_settings,
        })
        .eq('id', currentProfile.id);

      if (error) {
        console.error('Profile update failed:', error);
        toast.error(error.message || 'Failed to update profile');
        return;
      }

      toast.success('Profile updated!');
      setAvatarFile(null);
      setEditing(false);
      if (editForm.username !== profile?.username) {
        await router.navigate({ to: '/profile/$username', params: { username: editForm.username } });
      }
      await refreshProfile();
      fetchProfile();
    } catch (err) {
      console.error('Profile save failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to upload or update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleMessageClick = async () => {
    if (!profile || !currentProfile) {
      toast.error('You need to sign in to message.');
      return;
    }

    if (openingChat) return;

    setOpeningChat(true);
    try {
      const result = await getOrCreateDmConversation(currentProfile.id, profile.id);
      if ('error' in result) {
        toast.error(result.error);
        return;
      }

      await router.navigate({
        to: '/messages/$conversationId',
        params: { conversationId: result.conversationId },
      });
    } catch (e) {
      console.error('[NepLink/Message] unexpected', e);
      toast.error('Something went wrong opening chat.');
    } finally {
      setOpeningChat(false);
    }
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

  if (loading) return <div className="flex justify-center items-center py-24"><Spinner size="lg" /></div>;
  if (!profile) return (
    <div className="text-center py-24">
      <Card className="max-w-md mx-auto p-12 bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border-none">
        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-8 text-slate-300">
          <X size={40} />
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest">User not found</h2>
        <p className="text-xs mt-4 font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
          The ripple you are looking for does not exist or has been removed.
        </p>
        <Button variant="primary" className="mt-10" onClick={() => router.navigate({ to: '/' })}>
          Back to Feed
        </Button>
      </Card>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Profile Header */}
      <Card className="overflow-hidden border-none shadow-2xl shadow-slate-200/50 dark:shadow-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl">
        {/* Cover Section */}
        <div className="relative h-72 bg-slate-200 dark:bg-slate-800">
          {profile.cover_url ? (
            <img src={profile.cover_url} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" alt="Cover" />
          ) : (
            <div className="w-full h-full premium-gradient opacity-90" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
          
          {isOwnProfile && editing && (
            <div className="absolute bottom-6 right-6 flex gap-3 animate-fade-in">
              {editForm.cover_url && (
                <Button
                  variant="danger"
                  size="icon"
                  onClick={() => setEditForm(p => ({ ...p, cover_url: '' }))}
                  className="rounded-2xl h-12 w-12"
                  title="Remove cover"
                >
                  <Trash2 size={20} />
                </Button>
              )}
              <label
                htmlFor="profile-cover-upload"
                className="glass-card px-6 h-12 rounded-2xl text-sm font-black uppercase tracking-widest cursor-pointer hover:scale-105 active:scale-95 transition-all flex items-center gap-3 text-white border-none bg-white/10 backdrop-blur-md"
              >
                <Camera size={18} />
                Change Cover
                <input
                  id="profile-cover-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          )}
        </div>

        {/* Info Section */}
        <div className="px-10 pb-10">
          <div className="flex flex-col md:flex-row items-center md:items-end justify-between -mt-24 gap-8">
            <div className="relative group">
              <div className="relative rounded-full p-2 bg-white/10 backdrop-blur-xl ring-4 ring-white dark:ring-slate-900 shadow-2xl transition-transform duration-500 group-hover:scale-[1.02]">
                <Avatar
                  src={avatarPreviewSrc || profile.avatar_url}
                  name={profile.full_name || profile.username}
                  size="xl"
                  isOnline={profile.is_online}
                  className="w-40 h-40 md:w-48 md:h-48 rounded-full object-cover border-none"
                />
              </div>
              
              {isOwnProfile && editing && (
                <div className="absolute bottom-4 right-4 flex gap-2.5 animate-fade-in">
                  {editForm.avatar_url && (
                    <Button
                      variant="danger"
                      size="icon"
                      onClick={() => setEditForm(p => ({ ...p, avatar_url: '' }))}
                      className="w-11 h-11 rounded-2xl ring-4 ring-white dark:ring-slate-900 shadow-2xl"
                      title="Remove avatar"
                    >
                      <Trash2 size={18} />
                    </Button>
                  )}
                  <label
                    htmlFor="profile-avatar-upload"
                    className="w-11 h-11 premium-gradient rounded-2xl flex items-center justify-center shadow-2xl cursor-pointer hover:scale-110 active:scale-90 transition-all ring-4 ring-white dark:ring-slate-900"
                    title="Change photo"
                  >
                    <Camera size={20} className="text-white" />
                    <input
                      id="profile-avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="flex-1 text-center md:text-left md:ml-2 mt-4 md:mt-0">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-5">
                <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white">
                  {profile.full_name || profile.username}
                </h1>
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <Badge variant="primary" className="px-4 py-1.5 rounded-xl">
                    @{profile.username}
                  </Badge>
                  {!profile.is_online && (
                    <span className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400 bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-lg">
                      {formatLastSeen(profile.last_seen)}
                    </span>
                  )}
                </div>
              </div>
              {!editing && profile.bio && (
                <p className="mt-5 text-slate-600 dark:text-slate-300 text-base max-w-2xl leading-relaxed font-medium tracking-tight italic">
                  &ldquo;{profile.bio}&rdquo;
                </p>
              )}
            </div>

            <div className="flex items-center gap-4">
              {!isOwnProfile && (
                <>
                  <FriendButton targetUserId={profile.id} className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-xs" />
                  <Button
                    variant="glass"
                    onClick={() => void handleMessageClick()}
                    disabled={openingChat}
                    className="h-14 gap-3 px-8"
                  >
                    <MessageCircle size={20} className="text-blue-500" />
                    <span className="font-black uppercase tracking-widest text-xs">{openingChat ? 'Opening…' : 'Message'}</span>
                  </Button>
                </>
              )}
              {isOwnProfile && !editing && (
                <Button
                  variant="glass"
                  onClick={() => setEditing(true)}
                  className="h-14 gap-3 px-8"
                >
                  <Edit3 size={20} className="text-indigo-500" />
                  <span className="font-black uppercase tracking-widest text-xs">Edit Profile</span>
                </Button>
              )}
              {isOwnProfile && editing && (
                <div className="flex gap-4 animate-fade-in">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    isLoading={savingProfile}
                    className="h-14 px-10"
                  >
                    <Check size={20} className="mr-2" />
                    <span className="font-black uppercase tracking-widest text-xs">Save Ripples</span>
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setEditing(false)} 
                    className="h-14 px-8 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <X size={20} className="mr-2" />
                    <span className="font-black uppercase tracking-widest text-xs">Cancel</span>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {editing && (
            <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8 p-8 rounded-[2.5rem] bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-white/5 animate-fade-in">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Premium Alias</label>
                  <div className="relative group">
                    <Input
                      type="text"
                      value={editForm.username}
                      onChange={(e) => void validateUsername(e.target.value)}
                      className={cn("h-14 text-base", usernameError && "border-red-500 focus:ring-red-500")}
                      placeholder="username"
                    />
                    {usernameError && <p className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black text-red-500 uppercase tracking-widest">{usernameError}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Full Identity</label>
                  <Input
                    type="text"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
                    className="h-14 text-base"
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Personal Mantra</label>
                  <Textarea
                    value={editForm.bio}
                    onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
                    className="min-h-[140px] text-base leading-relaxed"
                    placeholder="Tell your story..."
                  />
                </div>
              </div>
              
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 flex items-center gap-2">
                    <Shield size={12} className="text-blue-500" />
                    Privacy Protocols
                  </label>
                  <Card className="p-6 border-none bg-white dark:bg-slate-900/50 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Public Ripples</p>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Allow others to view your profile</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditForm(p => ({
                          ...p,
                          privacy_settings: { ...p.privacy_settings, public_profile: !p.privacy_settings.public_profile }
                        }))}
                        className={cn(
                          "relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300",
                          editForm.privacy_settings.public_profile ? 'premium-gradient' : 'bg-slate-300 dark:bg-slate-700'
                        )}
                      >
                        <span className={cn(
                          "inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-sm",
                          editForm.privacy_settings.public_profile ? 'translate-x-6' : 'translate-x-1'
                        )} />
                      </button>
                    </div>
                  </Card>
                </div>
                
                <div className="p-8 rounded-[2rem] bg-blue-500/5 border border-blue-500/10 flex items-start gap-4">
                  <Sparkles size={24} className="text-blue-500 shrink-0" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">Pro Tip</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed font-medium tracking-tight">
                      A premium alias and high-quality cover photo significantly increase your ripple engagement.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        {!editing && (
          <div className="px-10 flex items-center gap-2 border-t border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-white/5">
            {[
              { id: 'posts', icon: LayoutGrid, label: 'Feed', count: posts.length },
              { id: 'friends', icon: UsersIcon, label: 'Friends', count: friendsCount },
              { id: 'about', icon: Info, label: 'Protocols' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-3 px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative group",
                  activeTab === tab.id 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                )}
              >
                <tab.icon size={18} strokeWidth={activeTab === tab.id ? 2.5 : 2} className="group-hover:scale-110 transition-transform" />
                {tab.label}
                {tab.count !== undefined && <span className="text-[9px] opacity-60 ml-1">({tab.count})</span>}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 premium-gradient rounded-t-full shadow-[0_-2px_8px_rgba(59,130,246,0.5)]" />
                )}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {activeTab === 'posts' && (
            <div className="space-y-8 animate-fade-in">
              {posts.length === 0 ? (
                <Card className="p-24 text-center border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
                  <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-8 text-slate-300 dark:text-slate-700">
                    <LayoutGrid size={48} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest">No ripples yet</h3>
                  <p className="text-xs mt-4 font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
                    {isOwnProfile ? "You haven't shared any moments. Your premium thread starts with your first ripple." : "This user hasn't shared any ripples yet."}
                  </p>
                </Card>
              ) : (
                posts.map((post) => (
                  <PostCard key={post.id} post={post} onDelete={handleDeletePost} onLikeToggle={handleLikeToggle} />
                ))
              )}
            </div>
          )}

          {activeTab === 'friends' && (
            <div className="animate-fade-in">
              <FriendList profileUserId={profile.id} />
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-8 animate-fade-in">
              <Card className="p-10 border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl space-y-12">
                <section>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-500 mb-8 flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                    Personal Mantra
                  </h3>
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-xl font-medium tracking-tight italic">
                    {profile.bio ? `“${profile.bio}”` : "The ripples of this user's story are yet to be written."}
                  </p>
                </section>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-slate-100 dark:border-white/5">
                  <section className="space-y-4">
                    <div className="flex items-center gap-3 text-indigo-500">
                      <Calendar size={20} />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Established</h3>
                    </div>
                    <p className="text-slate-900 dark:text-white font-black text-2xl tracking-tighter">
                      {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </p>
                  </section>
                  <section className="space-y-4">
                    <div className="flex items-center gap-3 text-emerald-500">
                      <Sparkles size={20} />
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Current Status</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={cn("w-3.5 h-3.5 rounded-full shadow-lg", profile.is_online ? 'bg-emerald-500 shadow-emerald-500/50 animate-pulse' : 'bg-slate-300')} />
                      <p className="text-slate-900 dark:text-white font-black text-2xl tracking-tighter">
                        {profile.is_online ? 'Active Now' : 'Offline'}
                      </p>
                    </div>
                  </section>
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          <Card className="p-8 border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
              <Shield size={14} className="text-blue-500" />
              Vital Stats
            </h3>
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-white dark:bg-slate-950/50 rounded-2xl p-6 shadow-sm flex items-center justify-between group hover:scale-[1.02] transition-transform duration-300">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Ripples</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{posts.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors duration-300">
                  <LayoutGrid size={20} />
                </div>
              </div>
              <div className="bg-white dark:bg-slate-950/50 rounded-2xl p-6 shadow-sm flex items-center justify-between group hover:scale-[1.02] transition-transform duration-300">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Network Size</p>
                  <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{friendsCount}</p>
                </div>
                <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors duration-300">
                  <UsersIcon size={20} />
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-8 border-none bg-gradient-to-br from-blue-600/10 to-indigo-600/10 backdrop-blur-xl border border-blue-500/10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 mb-4">Premium Profile</h3>
            <p className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-relaxed uppercase tracking-widest">
              This identity is verified and protected on the NepLink premium network.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
