import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import PostCard from '../components/PostCard';
import CreatePostCard from '../components/CreatePostCard';
import Spinner from '../components/Spinner';
import type { PostWithProfile } from '../lib/database.types';

export default function FeedPage() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<PostWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPosts();
    const sub = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => fetchPosts())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from('posts')
      .select('*, profiles(*), likes(*), comments(*)')
      .order('created_at', { ascending: false })
      .limit(50);
    setPosts((data as PostWithProfile[]) ?? []);
    setLoading(false);
  };

  const handlePostCreated = (post: PostWithProfile) => {
    setPosts((prev) => [post, ...prev]);
  };

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleLikeToggle = (postId: string, liked: boolean) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const likes = liked
          ? [...p.likes, { id: 'temp', post_id: postId, user_id: profile!.id, created_at: new Date().toISOString() }]
          : p.likes.filter((l) => l.user_id !== profile?.id);
        return { ...p, likes };
      })
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <CreatePostCard onPostCreated={handlePostCreated} />

      {posts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg font-medium">No posts yet</p>
          <p className="text-sm mt-1">Be the first to share something!</p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onDelete={handleDeletePost}
            onLikeToggle={handleLikeToggle}
          />
        ))
      )}
    </div>
  );
}
