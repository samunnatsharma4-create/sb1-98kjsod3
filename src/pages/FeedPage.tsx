import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { subscribeSafe, removeChannelSafe } from '../lib/realtime';
import { useAuth } from '../contexts/AuthContext';
import PostCard from '../components/PostCard';
import CreatePostCard from '../components/CreatePostCard';
import { FeedPostSkeleton } from '../components/FeedPostSkeleton';
import toast from 'react-hot-toast';
import type { PostWithProfile } from '../lib/database.types';
import { Card } from '../components/ui/Card';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function FeedPage() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeOk, setRealtimeOk] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPosts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profiles(*), likes(*), comments(*)')
        .is('group_id', null)
        .is('page_id', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Feed fetch:', error);
        toast.error('Could not refresh feed');
        setPosts([]);
        return;
      }
      setPosts((data as PostWithProfile[]) ?? []);
    } catch (e) {
      console.error('Feed fetch exception:', e);
      toast.error('Network error loading feed');
      setPosts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchPosts();

    const sub = subscribeSafe(
      supabase
        .channel('feed-realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => void fetchPosts())
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, () => void fetchPosts())
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, () => void fetchPosts())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => void fetchPosts())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => void fetchPosts()),
      {
        name: 'feed-realtime',
        onError: (msg) => {
          console.error(msg);
          setRealtimeOk(false);
        },
      },
    );

    return () => removeChannelSafe(supabase, sub);
  }, [fetchPosts]);

  const handlePostCreated = (post: PostWithProfile) => {
    setPosts((prev) => [post, ...prev]);
  };

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleLikeToggle = (postId: string, liked: boolean) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId || !profile) return p;
        const likes = liked
          ? [...p.likes, { id: 'temp', post_id: postId, user_id: profile.id, created_at: new Date().toISOString() }]
          : p.likes.filter((l) => l.user_id !== profile.id);
        return { ...p, likes };
      }),
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in pb-12">
      {!realtimeOk && (
        <Card className="p-4 bg-amber-500/10 border-amber-500/20 text-center animate-fade-in">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
            Live updates paused — feed still works.
          </p>
        </Card>
      )}

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Sparkles size={22} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Your Feed</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mt-0.5">Premium Ripples</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void fetchPosts(true)}
          disabled={refreshing}
          className={refreshing ? 'animate-spin' : ''}
        >
          <RefreshCw size={20} />
        </Button>
      </div>

      <CreatePostCard onPostCreated={handlePostCreated} />

      {loading ? (
        <div className="space-y-8">
          <FeedPostSkeleton />
          <FeedPostSkeleton />
          <FeedPostSkeleton />
        </div>
      ) : posts.length === 0 ? (
        <Card className="text-center py-32 px-10 border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
          <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-8 text-slate-300 dark:text-slate-600">
            <Sparkles size={40} />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase tracking-widest">Your feed is quiet</h2>
          <p className="text-xs mt-4 max-w-xs mx-auto leading-relaxed font-bold text-slate-400 uppercase tracking-widest">
            Share a thought or photo — your premium ripple starts here.
          </p>
          <Button 
            variant="primary" 
            className="mt-10 px-8"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Create your first ripple
          </Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onDelete={handleDeletePost} onLikeToggle={handleLikeToggle} />
          ))}
        </div>
      )}
    </div>
  );
}
