import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Heart, MessageCircle, Send, Trash2, MoreHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';
import type { PostWithProfile, CommentWithProfile } from '../lib/database.types';
import { formatDistanceToNow } from '../lib/dateUtils';

interface PostCardProps {
  post: PostWithProfile;
  onDelete?: (postId: string) => void;
  onLikeToggle?: (postId: string, liked: boolean) => void;
}

export default function PostCard({ post, onDelete, onLikeToggle }: PostCardProps) {
  const { profile } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentWithProfile[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isLiked = post.likes.some((l) => l.user_id === profile?.id);
  const likesCount = post.likes.length;
  const commentsCount = post.comments.length;

  const handleLike = async () => {
    if (!profile) return;
    if (isLiked) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', profile.id);
      onLikeToggle?.(post.id, false);
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: profile.id });
      onLikeToggle?.(post.id, true);
      if (post.user_id !== profile.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          actor_id: profile.id,
          type: 'like',
          post_id: post.id,
        });
      }
    }
  };

  const fetchComments = async () => {
    setLoadingComments(true);
    const { data } = await supabase
      .from('comments')
      .select('*, profiles(*)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    setComments((data as CommentWithProfile[]) ?? []);
    setLoadingComments(false);
  };

  const toggleComments = () => {
    if (!showComments) fetchComments();
    setShowComments(!showComments);
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !commentText.trim()) return;
    setSubmittingComment(true);
    const { data } = await supabase
      .from('comments')
      .insert({ post_id: post.id, user_id: profile.id, content: commentText.trim() })
      .select('*, profiles(*)')
      .single();
    if (data) {
      setComments((prev) => [...prev, data as CommentWithProfile]);
      setCommentText('');
      if (post.user_id !== profile.id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          actor_id: profile.id,
          type: 'comment',
          post_id: post.id,
        });
      }
    }
    setSubmittingComment(false);
  };

  const handleDelete = async () => {
    if (!profile || profile.id !== post.user_id) return;
    await supabase.from('posts').delete().eq('id', post.id);
    toast.success('Post deleted');
    onDelete?.(post.id);
    setShowMenu(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    await supabase.from('comments').delete().eq('id', commentId);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Link to={`/profile/${post.profiles.username}`} className="flex items-center gap-3 group">
          <Avatar
            src={post.profiles.avatar_url}
            name={post.profiles.full_name || post.profiles.username}
            size="sm"
            isOnline={post.profiles.is_online}
          />
          <div>
            <p className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
              {post.profiles.full_name || post.profiles.username}
            </p>
            <p className="text-xs text-slate-500">@{post.profiles.username} · {formatDistanceToNow(post.created_at)}</p>
          </div>
        </Link>
        {profile?.id === post.user_id && (
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
              <MoreHorizontal size={18} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-slate-100 z-10 overflow-hidden w-36">
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 w-full transition-colors"
                >
                  <Trash2 size={14} />
                  Delete post
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {post.content && (
        <p className="px-4 pb-3 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">{post.content}</p>
      )}

      {post.image_url && (
        <div className="px-4 pb-3">
          <img src={post.image_url} alt="Post" className="w-full rounded-xl object-cover max-h-80" />
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-3 flex items-center gap-4 border-t border-slate-50 pt-3">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-sm font-medium transition-all ${
            isLiked ? 'text-red-500' : 'text-slate-500 hover:text-red-400'
          }`}
        >
          <Heart size={18} fill={isLiked ? 'currentColor' : 'none'} className={isLiked ? 'scale-110 transition-transform' : ''} />
          <span>{likesCount}</span>
        </button>

        <button
          onClick={toggleComments}
          className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-blue-500 transition-colors"
        >
          <MessageCircle size={18} />
          <span>{commentsCount}</span>
        </button>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/50">
          {loadingComments ? (
            <div className="text-center py-3 text-slate-400 text-sm">Loading...</div>
          ) : (
            <div className="space-y-3 mb-3">
              {comments.map((comment) => (
                <div key={comment.id} className="flex items-start gap-2 group">
                  <Link to={`/profile/${comment.profiles.username}`}>
                    <Avatar src={comment.profiles.avatar_url} name={comment.profiles.full_name || comment.profiles.username} size="xs" />
                  </Link>
                  <div className="flex-1 bg-white rounded-xl px-3 py-2 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between">
                      <Link to={`/profile/${comment.profiles.username}`} className="text-xs font-semibold text-slate-800 hover:text-blue-600 transition-colors">
                        {comment.profiles.full_name || comment.profiles.username}
                      </Link>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-slate-400">{formatDistanceToNow(comment.created_at)}</span>
                        {profile?.id === comment.user_id && (
                          <button onClick={() => handleDeleteComment(comment.id)} className="text-slate-400 hover:text-red-500 ml-1 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 mt-0.5">{comment.content}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-2">No comments yet</p>
              )}
            </div>
          )}

          <form onSubmit={handleComment} className="flex items-center gap-2">
            <Avatar src={profile?.avatar_url} name={profile?.full_name || profile?.username || ''} size="xs" />
            <div className="flex-1 flex items-center bg-white border border-slate-200 rounded-full px-4 py-2 gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 text-sm text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || submittingComment}
                className="text-blue-500 disabled:opacity-40 hover:text-blue-600 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
