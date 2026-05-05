import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useRouter } from '@tanstack/react-router';
import { ArrowLeft, Trash2, Shield, Edit3, Users as UsersIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { subscribeSafe, removeChannelSafe } from '../lib/realtime';
import { useAuth } from '../contexts/AuthContext';
import Spinner from '../components/Spinner';
import CreatePostCard from '../components/CreatePostCard';
import PostCard from '../components/PostCard';
import type { Group, PostWithProfile } from '../lib/database.types';

export default function GroupDetailPage() {
  const router = useRouter();
  const { groupId } = useParams({ strict: false }) as { groupId: string };
  const { profile } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'member' | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const isOwner = group?.created_by === profile?.id;

  const deleteGroup = async () => {
    if (!group || !groupId || !isOwner) return;
    if (!confirm('Are you sure you want to delete this group? All posts and memberships will be removed.')) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase.from('groups').delete().eq('id', groupId);
      if (error) toast.error(error.message);
      else {
        toast.success('Group deleted');
        await router.navigate({ to: '/groups' });
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!group || !groupId || !isOwner) return;
    if (!editForm.name.trim()) return toast.error('Name is required');

    setSaving(true);
    try {
      const { error } = await supabase
        .from('groups')
        .update({ name: editForm.name.trim(), description: editForm.description.trim() })
        .eq('id', groupId);
      
      if (error) toast.error(error.message);
      else {
        toast.success('Group updated');
        setIsEditing(false);
        await reload();
      }
    } finally {
      setSaving(false);
    }
  };

  const reload = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);

    const { data: g, error: ge } = await supabase.from('groups').select('*').eq('id', groupId).maybeSingle();
    if (ge || !g) {
      setGroup(null);
      setPosts([]);
      setIsMember(false);
      setUserRole(null);
      setLoading(false);
      return;
    }
    setGroup(g as Group);
    setEditForm({ name: g.name, description: g.description || '' });

    let member = false;
    let role: 'admin' | 'member' | null = null;
    if (profile?.id) {
      const { data: m } = await supabase.from('group_members').select('role').eq('group_id', groupId).eq('user_id', profile.id).maybeSingle();
      member = !!m;
      role = m?.role as 'admin' | 'member' | null;
    }
    setIsMember(member);
    setUserRole(role);

    const { data: pData } = await supabase
      .from('posts')
      .select('*, profiles(*), likes(*), comments(*)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(50);
    setPosts((pData as PostWithProfile[]) ?? []);
    setLoading(false);
  }, [groupId, profile?.id]);

  useEffect(() => {
    void reload();

    if (!groupId) return;

    const channel = subscribeSafe(
      supabase
        .channel(`group-posts-${groupId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'posts', filter: `group_id=eq.${groupId}` },
          async (payload) => {
            const { data, error } = await supabase
              .from('posts')
              .select('*, profiles(*), likes(*), comments(*)')
              .eq('id', payload.new.id)
              .single();
            
            if (data && !error) {
              setPosts((prev) => [data as PostWithProfile, ...prev]);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'posts', filter: `group_id=eq.${groupId}` },
          (payload) => {
            setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
          }
        ),
      { name: `group-${groupId}-posts` }
    );

    return () => {
      removeChannelSafe(supabase, channel);
    };
  }, [reload, groupId]);

  const joinLeave = async () => {
    if (!profile?.id || !groupId) return;
    setJoining(true);
    try {
      if (isMember) {
        const { error } = await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', profile.id);
        if (error) toast.error(error.message);
        else {
          toast.success('Left group');
          await reload();
        }
      } else {
        const { error } = await supabase.from('group_members').insert({ group_id: groupId, user_id: profile.id });
        if (error) toast.error(error.message);
        else {
          toast.success('Joined group');
          await reload();
        }
      }
    } finally {
      setJoining(false);
    }
  };

  const handleLikeToggle = (postId: string, liked: boolean) => {
    setPosts((prev) =>
      prev.map((row) => {
        if (!profile || row.id !== postId) return row;
        const likes = liked
          ? [...row.likes, { id: 'temp', post_id: postId, user_id: profile.id, created_at: new Date().toISOString() }]
          : row.likes.filter((l) => l.user_id !== profile.id);
        return { ...row, likes };
      }),
    );
  };

  const handleDelete = (postId: string) => setPosts((prev) => prev.filter((p) => p.id !== postId));

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-24 text-slate-500 dark:text-slate-400">
        <p className="font-medium text-slate-800 dark:text-slate-50">Group not found</p>
        <Link to="/groups" className="text-sm text-blue-600 dark:text-blue-400 mt-2 inline-block hover:underline">
          Browse groups
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 animate-fade-in">
      {/* Group Header Card */}
      <div className="glass-card rounded-3xl overflow-hidden border-none shadow-2xl">
        {/* Cover Section */}
        <div className="relative h-48 bg-slate-200 dark:bg-slate-800">
          {group.cover_url ? (
            <img src={group.cover_url} className="w-full h-full object-cover" alt="Cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 opacity-80" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          <Link 
            to="/groups" 
            className="absolute top-6 left-6 p-2.5 glass-card rounded-2xl text-white hover:scale-110 active:scale-90 transition-all border-none"
          >
            <ArrowLeft size={20} />
          </Link>
        </div>

        {/* Info Section */}
        <div className="px-8 pb-8">
          <div className="flex flex-col md:flex-row items-center md:items-end justify-between -mt-10 gap-6">
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                <div className="p-1.5 glass-card rounded-xl border-none text-emerald-500">
                  <Shield size={16} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">NepLink hub</span>
                {userRole === 'admin' && (
                  <span className="px-2 py-0.5 premium-gradient text-white rounded-md text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20">Admin</span>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-4 mt-4 animate-fade-in">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full glass-input rounded-2xl px-5 py-3 text-lg font-bold"
                    placeholder="Hub name"
                  />
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm(p => ({ ...p, description: e.target.value }))}
                    className="w-full glass-input rounded-2xl px-5 py-3 text-sm resize-none"
                    placeholder="What is this hub about?"
                    rows={3}
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={handleUpdateGroup}
                      disabled={saving}
                      className="px-6 py-2.5 premium-gradient text-white text-xs font-black uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50"
                    >
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      disabled={saving}
                      className="px-6 py-2.5 glass-card text-slate-500 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-500 transition-all border-none"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="animate-fade-in">
                  <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{group.name}</h1>
                  {group.description && (
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2 leading-relaxed italic">
                      &ldquo;{group.description}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {isOwner && !isEditing && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="p-3 glass-card rounded-2xl text-slate-500 hover:text-blue-500 hover:scale-110 active:scale-90 transition-all border-none"
                    title="Edit hub"
                  >
                    <Edit3 size={20} />
                  </button>
                  <button
                    type="button"
                    onClick={deleteGroup}
                    disabled={deleting}
                    className="p-3 glass-card rounded-2xl text-slate-400 hover:text-red-500 hover:scale-110 active:scale-90 transition-all border-none"
                    title="Delete hub"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              )}
              {!isOwner && (
                <button
                  type="button"
                  onClick={() => void joinLeave()}
                  disabled={joining}
                  className={`h-12 px-8 rounded-2xl text-sm font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl ${
                    isMember
                      ? 'glass-card border-none text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
                      : 'premium-gradient text-white shadow-blue-500/20'
                  } disabled:opacity-50`}
                >
                  {joining ? '…' : isMember ? 'Leave Hub' : 'Join Hub'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {!isMember && (
          <div className="glass-card rounded-3xl p-6 border-none flex items-center gap-4 animate-fade-in bg-amber-500/5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
              <Shield size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Protected Hub</p>
              <p className="text-xs font-medium text-slate-500 mt-0.5">Join this hub to start sharing ripples and see the community feed.</p>
            </div>
          </div>
        )}

        {isMember && profile && (
          <CreatePostCard scope={{ kind: 'group', groupId }} composerTitle={`Share inside ${group.name}…`} onPostCreated={(p) => setPosts((prev) => [p, ...prev])} />
        )}

        {posts.length === 0 ? (
          <div className="glass-card rounded-3xl p-20 text-center border-none animate-fade-in">
            <div className="w-20 h-20 glass-card rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
              <UsersIcon size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">The hub is pristine</h3>
            <p className="text-sm text-slate-500 mt-2 font-medium">Say hello and start the first ripple!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} onDelete={handleDelete} onLikeToggle={handleLikeToggle} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
