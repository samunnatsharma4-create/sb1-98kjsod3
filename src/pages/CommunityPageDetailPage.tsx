import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from '@tanstack/react-router';
import { ArrowLeft, UserMinus, UserPlus, Trash2, LayoutGrid } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from '@tanstack/react-router';
import Spinner from '../components/Spinner';
import Avatar from '../components/Avatar';
import CreatePostCard from '../components/CreatePostCard';
import PostCard from '../components/PostCard';
import type { CommunityPage, PostWithProfile } from '../lib/database.types';

export default function CommunityPageDetailPage() {
  const router = useRouter();
  const { slug } = useParams({ strict: false }) as { slug: string };
  const { profile } = useAuth();
  const [page, setPage] = useState<CommunityPage | null>(null);
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deletePage = async () => {
    if (!page || !isOwner) return;
    if (!confirm('Are you sure you want to delete this page? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('community_pages').delete().eq('id', page.id);
      if (error) toast.error(error.message);
      else {
        toast.success('Page deleted');
        await router.navigate({ to: '/pages' });
      }
    } finally {
      setDeleting(false);
    }
  };

  const reload = useCallback(async () => {
    if (!slug) return;
    setLoading(true);

    const { data: pg, error } = await supabase.from('community_pages').select('*').eq('slug', slug).maybeSingle();

    if (error || !pg) {
      setPage(null);
      setPosts([]);
      setFollowing(false);
      setLoading(false);
      return;
    }

    setPage(pg as CommunityPage);

    // Fetch follower count
    const { count } = await supabase
      .from('page_followers')
      .select('*', { count: 'exact', head: true })
      .eq('page_id', pg.id);
    setFollowerCount(count || 0);

    let isFollower = false;
    if (profile?.id && profile.id !== pg.owner_id) {
      const { data: row } = await supabase
        .from('page_followers')
        .select('page_id')
        .eq('page_id', pg.id)
        .eq('follower_id', profile.id)
        .maybeSingle();
      isFollower = !!row;
    }
    setFollowing(isFollower);

    const { data: pData } = await supabase
      .from('posts')
      .select('*, profiles(*), likes(*), comments(*)')
      .eq('page_id', pg.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setPosts((pData as PostWithProfile[]) ?? []);
    setLoading(false);
  }, [slug, profile?.id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleFollow = async () => {
    if (!profile?.id || !page || profile.id === page.owner_id) return;
    setFollowBusy(true);
    try {
      if (following) {
        const { error } = await supabase.from('page_followers').delete().eq('page_id', page.id).eq('follower_id', profile.id);
        if (error) toast.error(error.message);
        else {
          setFollowing(false);
          setFollowerCount((prev) => Math.max(0, prev - 1));
          toast.success('Unfollowed');
        }
      } else {
        const { error } = await supabase.from('page_followers').insert({ page_id: page.id, follower_id: profile.id });
        if (error) toast.error(error.message);
        else {
          setFollowing(true);
          setFollowerCount((prev) => prev + 1);
          toast.success('Following');
        }
      }
    } finally {
      setFollowBusy(false);
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

  const handleUpdate = (updatedPost: PostWithProfile) => {
    setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? updatedPost : p)));
  };

  const isOwner = profile?.id === page?.owner_id;

  if (loading) return <Spinner />;

  if (!page) {
    return (
      <div className="text-center py-24 space-y-4">
        <p className="text-slate-600 dark:text-slate-400 font-medium">This page isn’t here.</p>
        <Link to="/pages" className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-semibold inline-flex items-center gap-2">
          <ArrowLeft size={16} /> Back to pages
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-24 animate-fade-in">
      {/* Page Header Card */}
      <div className="glass-card rounded-3xl overflow-hidden border-none shadow-2xl">
        {/* Cover Section */}
        <div className="relative h-48 bg-slate-200 dark:bg-slate-800">
          <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-indigo-500 to-purple-600 opacity-80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          <Link 
            to="/pages" 
            className="absolute top-6 left-6 p-2.5 glass-card rounded-2xl text-white hover:scale-110 active:scale-90 transition-all border-none z-10"
          >
            <ArrowLeft size={20} />
          </Link>

          {/* Page Avatar */}
          <div className="absolute -bottom-10 left-8">
            <div className="p-1.5 glass-card rounded-[2rem] border-none shadow-2xl">
              <Avatar
                src={page.avatar_url}
                name={page.title}
                size="lg"
                className="w-24 h-24 md:w-32 md:h-32 rounded-[1.75rem] object-cover"
              />
            </div>
          </div>
        </div>

        {/* Info Section */}
        <div className="px-8 pb-8 pt-12 md:pt-4">
          <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-6">
            <div className="flex-1 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                <div className="p-1.5 glass-card rounded-xl border-none text-indigo-500">
                  <LayoutGrid size={16} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">Official Page</span>
                {isOwner && (
                  <span className="px-2 py-0.5 premium-gradient text-white rounded-md text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20">Owner</span>
                )}
              </div>

              <div className="animate-fade-in">
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{page.title}</h1>
                <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                  <span className="text-xs font-bold text-slate-400 tracking-tight">@{page.slug}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="text-xs font-bold text-indigo-500 tracking-tight">{followerCount} {followerCount === 1 ? 'Follower' : 'Followers'}</span>
                </div>
                {page.description && (
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-3 leading-relaxed italic">
                    &ldquo;{page.description}&rdquo;
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isOwner && (
                <button
                  type="button"
                  onClick={() => void deletePage()}
                  disabled={deleting}
                  className="p-3 glass-card rounded-2xl text-slate-400 hover:text-red-500 hover:scale-110 active:scale-90 transition-all border-none"
                  title="Delete page"
                >
                  <Trash2 size={20} />
                </button>
              )}
              {profile?.id && !isOwner && (
                <button
                  type="button"
                  disabled={followBusy}
                  onClick={() => void toggleFollow()}
                  className={`h-12 px-8 rounded-2xl text-sm font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl ${
                    following
                      ? 'glass-card border-none text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
                      : 'premium-gradient text-white shadow-indigo-500/20'
                  } disabled:opacity-60`}
                >
                  {followBusy ? '…' : following ? (
                    <div className="flex items-center gap-2">
                      <UserMinus size={18} />
                      Unfollow
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <UserPlus size={18} />
                      Follow Page
                    </div>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {isOwner && profile && (
          <CreatePostCard onPostCreated={(p) => setPosts((prev) => [p, ...prev])} scope={{ kind: 'page', pageId: page.id }} composerTitle="Publish to your page..." />
        )}

        {posts.length === 0 ? (
          <div className="glass-card rounded-3xl p-20 text-center border-none animate-fade-in">
            <div className="w-20 h-20 glass-card rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
              <LayoutGrid size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">The page is pristine</h3>
            <p className="text-sm text-slate-500 mt-2 font-medium">Say hello and start the first ripple!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <PostCard 
                key={post.id} 
                post={post} 
                onDelete={handleDelete} 
                onLikeToggle={handleLikeToggle}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
