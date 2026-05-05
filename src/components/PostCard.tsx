import { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { Heart, MessageCircle, Send, Trash2, MoreHorizontal, Share2, Edit2, X, Bookmark } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';
import type { PostWithProfile, CommentWithProfile } from '../lib/database.types';
import { formatDistanceToNow } from '../lib/dateUtils';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Card, CardHeader, CardContent, CardFooter } from './ui/Card';
import { Badge } from './ui/Badge';
import { Textarea, Input } from './ui/Input';

interface PostCardProps {
  post: PostWithProfile;
  onDelete?: (postId: string) => void;
  onLikeToggle?: (postId: string, liked: boolean) => void;
  onUpdate?: (post: PostWithProfile) => void;
}

type CommentWithReplies = CommentWithProfile & { replies?: CommentWithProfile[] };

export default function PostCard({ post, onDelete, onLikeToggle, onUpdate }: PostCardProps) {
  const { profile } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentWithReplies[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [originalPost, setOriginalPost] = useState<PostWithProfile | null>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    if (profile) {
      void (async () => {
        const { data } = await supabase
          .from('bookmarks')
          .select('id')
          .eq('post_id', post.id)
          .eq('user_id', profile.id)
          .maybeSingle();
        setIsBookmarked(!!data);
      })();
    }
  }, [post.id, profile?.id]);

  useEffect(() => {
    const originalPostId = post.original_post_id;
    if (originalPostId) {
      void (async () => {
        const { data } = await supabase
          .from('posts')
          .select('*, profiles(*), likes(*), comments(*)')
          .eq('id', originalPostId)
          .single();
        if (data) setOriginalPost(data as PostWithProfile);
      })();
    } else {
      setOriginalPost(null);
    }
  }, [post.original_post_id]);

  const likesArr = post.likes ?? [];
  const commentsArr = post.comments ?? [];
  const isLiked = likesArr.some((l) => l.user_id === profile?.id);
  const likesCount = likesArr.length;
  const commentsCount = commentsArr.length;

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
    
    if (data) {
      const allComments = data as CommentWithProfile[];
      const mainComments = allComments.filter(c => !c.parent_id);
      const replies = allComments.filter(c => c.parent_id);
      
      const commentsWithReplies = mainComments.map(c => ({
        ...c,
        replies: replies.filter(r => r.parent_id === c.id)
      }));
      
      setComments(commentsWithReplies);
    }
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
      .insert({ 
        post_id: post.id, 
        user_id: profile.id, 
        content: commentText.trim(),
        parent_id: replyTo 
      })
      .select('*, profiles(*)')
      .single();
    
    if (data) {
      if (replyTo) {
        setComments(prev => prev.map(c => 
          c.id === replyTo ? { ...c, replies: [...(c.replies || []), data as CommentWithProfile] } : c
        ));
      } else {
        setComments((prev) => [...prev, { ...(data as CommentWithProfile), replies: [] }]);
      }
      setCommentText('');
      setReplyTo(null);
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

  const handleBookmark = async () => {
    if (!profile) return;
    try {
      if (isBookmarked) {
        await supabase.from('bookmarks').delete().eq('post_id', post.id).eq('user_id', profile.id);
        setIsBookmarked(false);
        toast.success('Removed from bookmarks');
      } else {
        await supabase.from('bookmarks').insert({ post_id: post.id, user_id: profile.id });
        setIsBookmarked(true);
        toast.success('Saved to bookmarks');
      }
    } catch {
      toast.error('Could not save post');
    }
  };

  const handleEdit = async () => {
    if (!profile || profile.id !== post.user_id) return;
    const { data, error } = await supabase
      .from('posts')
      .update({ content: editContent.trim() })
      .eq('id', post.id)
      .select('*, profiles(*), likes(*), comments(*)')
      .single();
    
    if (!error && data) {
      toast.success('Post updated');
      onUpdate?.(data as PostWithProfile);
      setIsEditing(false);
    } else {
      toast.error(error?.message || 'Could not update post');
    }
    setShowMenu(false);
  };

  const handleShare = async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: profile.id,
        content: post.content,
        image_url: post.image_url,
        original_post_id: post.id
      })
      .select('*, profiles(*), likes(*), comments(*)')
      .single();
    
    if (!error && data) {
      await supabase.rpc('increment_share_count', { post_id: post.id });
      toast.success('Post shared to your timeline');
    } else {
      toast.error(error?.message || 'Could not share post');
    }
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

  if (!post.profiles) {
    return null;
  }

  return (
    <Card className="group/card border-none shadow-xl shadow-slate-200/50 dark:shadow-none hover:shadow-2xl hover:shadow-blue-500/5 duration-500 overflow-visible">
      {post.group_id && (
        <div className="px-6 pt-5">
          <Link
            to="/groups/$groupId"
            params={{ groupId: post.group_id }}
            className="group/tag"
          >
            <Badge variant="emerald" className="group-hover/tag:bg-emerald-500 group-hover/tag:text-white transition-all duration-300 px-3 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 group-hover/tag:bg-white animate-pulse" />
              Group ripple
            </Badge>
          </Link>
        </div>
      )}

      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <Link to="/profile/$username" params={{ username: post.profiles.username }} className="flex items-center gap-4 group/user">
          <div className="relative rounded-full p-0.5 glass-card border-none ring-2 ring-transparent group-hover/user:ring-blue-500/20 transition-all duration-300">
            <Avatar
              src={post.profiles.avatar_url}
              name={post.profiles.full_name || post.profiles.username}
              size="md"
              isOnline={post.profiles.is_online}
              className="w-12 h-12"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-black text-slate-900 dark:text-white text-[15px] group-hover/user:text-blue-500 transition-colors tracking-tight">
                {post.profiles.full_name || post.profiles.username}
              </p>
              {post.original_post_id && (
                <Badge variant="primary" className="px-1.5 py-0">Shared</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">@{post.profiles.username}</p>
              <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-tighter">{formatDistanceToNow(post.created_at)}</p>
            </div>
          </div>
        </Link>
        {profile?.id === post.user_id && (
          <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setShowMenu(!showMenu)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <MoreHorizontal size={20} />
            </Button>
            {showMenu && (
              <Card className="absolute right-0 top-12 shadow-2xl z-20 w-48 p-1.5 border-none animate-fade-in">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setIsEditing(true); setShowMenu(false); }}
                  className="w-full justify-start gap-3 px-4 h-11 text-slate-700 dark:text-slate-200 hover:bg-blue-500 hover:text-white"
                >
                  <Edit2 size={14} />
                  Edit ripple
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="w-full justify-start gap-3 px-4 h-11 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white mt-1"
                >
                  <Trash2 size={14} />
                  Delete ripple
                </Button>
              </Card>
            )}
          </div>
        )}
      </CardHeader>

      {/* Content */}
      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="space-y-4 animate-fade-in">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[120px]"
              placeholder="Edit your ripple..."
            />
            <div className="flex justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleEdit}>
                Save Changes
              </Button>
            </div>
          </div>
        ) : (
          post.content && (
            <p className="text-slate-800 dark:text-slate-200 text-[16px] leading-[1.6] whitespace-pre-wrap font-medium tracking-tight">{post.content}</p>
          )
        )}

        {post.image_url && (
          <div className="rounded-3xl overflow-hidden border border-slate-100 dark:border-white/5 shadow-inner bg-slate-100 dark:bg-slate-900">
            <img 
              src={post.image_url} 
              alt="Ripple" 
              className="w-full object-cover max-h-[600px] hover:scale-[1.01] transition-transform duration-700 ease-out" 
            />
          </div>
        )}

        {/* Original Post (Shared) */}
        {originalPost && originalPost.profiles && (
          <Card className="bg-slate-500/5 dark:bg-white/5 border-none hover:bg-slate-500/10 dark:hover:bg-white/10 transition-colors duration-300">
            <div className="flex items-center gap-3 p-4 border-b border-slate-500/10">
              <Avatar src={originalPost.profiles.avatar_url} name={originalPost.profiles.full_name || originalPost.profiles.username} size="xs" />
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-800 dark:text-white truncate">
                  {originalPost.profiles.full_name || originalPost.profiles.username}
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{formatDistanceToNow(originalPost.created_at)}</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {originalPost.content && <p className="text-[14px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed tracking-tight">{originalPost.content}</p>}
              {originalPost.image_url && (
                <div className="rounded-2xl overflow-hidden">
                  <img src={originalPost.image_url} alt="Shared" className="w-full object-cover max-h-80 shadow-sm" />
                </div>
              )}
            </div>
          </Card>
        )}
      </CardContent>

      {/* Actions */}
      <CardFooter className="flex items-center gap-8 py-5 border-t border-slate-100 dark:border-white/5">
        <button
          type="button"
          onClick={handleLike}
          className={`flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
            isLiked ? 'text-red-500' : 'text-slate-400 hover:text-red-500 hover:scale-110'
          }`}
        >
          <div className={cn("p-2 rounded-xl transition-all", isLiked ? "bg-red-500/10" : "bg-transparent group-hover/card:bg-slate-100 dark:group-hover/card:bg-white/5")}>
            <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} className={isLiked ? 'animate-bounce' : ''} />
          </div>
          <span>{likesCount}</span>
        </button>

        <button
          type="button"
          onClick={toggleComments}
          className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-500 hover:scale-110 transition-all duration-300"
        >
          <div className="p-2 rounded-xl bg-transparent group-hover/card:bg-slate-100 dark:group-hover/card:bg-white/5 transition-all">
            <MessageCircle size={20} />
          </div>
          <span>{commentsCount}</span>
        </button>

        <button
          type="button"
          onClick={handleShare}
          className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-500 hover:scale-110 transition-all duration-300"
        >
          <div className="p-2 rounded-xl bg-transparent group-hover/card:bg-slate-100 dark:group-hover/card:bg-white/5 transition-all">
            <Share2 size={20} />
          </div>
          <span>{post.share_count || 0}</span>
        </button>

        <button
          type="button"
          onClick={handleBookmark}
          className={`flex items-center gap-2 text-[11px] font-black uppercase tracking-widest transition-all duration-300 ml-auto ${
            isBookmarked ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500 hover:scale-110'
          }`}
          title={isBookmarked ? 'Remove bookmark' : 'Save post'}
        >
          <div className={cn("p-2 rounded-xl transition-all", isBookmarked ? "bg-amber-500/10" : "bg-transparent group-hover/card:bg-slate-100 dark:group-hover/card:bg-white/5")}>
            <Bookmark size={20} fill={isBookmarked ? 'currentColor' : 'none'} />
          </div>
        </button>
      </CardFooter>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 p-6 animate-fade-in">
          {loadingComments ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6 mb-8">
              {comments.map((comment) => (
                <div key={comment.id} className="space-y-4 group/comment">
                  <div className="flex items-start gap-4">
                    <Link to="/profile/$username" params={{ username: comment.profiles.username }} className="shrink-0">
                      <Avatar src={comment.profiles.avatar_url} name={comment.profiles.full_name || comment.profiles.username} size="xs" className="w-9 h-9" />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Card className="px-5 py-4 bg-white dark:bg-slate-900 shadow-sm group-hover/comment:shadow-md transition-all duration-300">
                        <div className="flex items-center justify-between mb-2">
                          <Link
                            to="/profile/$username"
                            params={{ username: comment.profiles.username }}
                            className="text-[13px] font-black text-slate-900 dark:text-white hover:text-blue-500 transition-colors tracking-tight"
                          >
                            {comment.profiles.full_name || comment.profiles.username}
                          </Link>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{formatDistanceToNow(comment.created_at)}</span>
                            {profile?.id === comment.user_id && (
                              <button type="button" onClick={() => handleDeleteComment(comment.id)} className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover/comment:opacity-100">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[14px] font-medium text-slate-700 dark:text-slate-300 leading-relaxed tracking-tight">{comment.content}</p>
                      </Card>
                      <div className="flex items-center gap-4 mt-2 ml-4">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(comment.id);
                            setCommentText(`@${comment.profiles.username} `);
                          }}
                          className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-500 transition-colors"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Nested Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="ml-12 space-y-5 border-l-2 border-slate-200 dark:border-white/10 pl-6">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="flex items-start gap-4 group/reply">
                          <Link to="/profile/$username" params={{ username: reply.profiles.username }} className="shrink-0">
                            <Avatar src={reply.profiles.avatar_url} name={reply.profiles.full_name || reply.profiles.username} size="xs" className="w-8 h-8" />
                          </Link>
                          <div className="flex-1 min-w-0">
                            <Card className="px-5 py-3 bg-white/60 dark:bg-slate-900/40 shadow-sm group-hover/reply:shadow-md transition-all duration-300">
                              <div className="flex items-center justify-between mb-1.5">
                                <Link
                                  to="/profile/$username"
                                  params={{ username: reply.profiles.username }}
                                  className="text-[12px] font-black text-slate-900 dark:text-white hover:text-blue-500 transition-colors tracking-tight"
                                >
                                  {reply.profiles.full_name || reply.profiles.username}
                                </Link>
                                {profile?.id === reply.user_id && (
                                  <button type="button" onClick={() => handleDeleteComment(reply.id)} className="text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover/reply:opacity-100">
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                              <p className="text-[13px] font-medium text-slate-700 dark:text-slate-300 leading-relaxed tracking-tight">{reply.content}</p>
                            </Card>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {comments.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">No ripples in the comments yet</p>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleComment} className="flex items-start gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
            <div className="shrink-0 pt-1">
              <Avatar src={profile?.avatar_url} name={profile?.full_name || profile?.username || ''} size="xs" className="w-9 h-9" />
            </div>
            <div className="flex-1 space-y-3">
              {replyTo && (
                <div className="flex items-center justify-between px-4 py-2 bg-blue-500/10 rounded-2xl animate-fade-in border border-blue-500/20">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-[0.15em]">Replying to ripple…</span>
                  <button type="button" onClick={() => { setReplyTo(null); setCommentText(''); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="relative group/input">
                <Input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add your ripple..."
                  className="pr-14 h-12"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="icon"
                  disabled={!commentText.trim() || submittingComment}
                  className="absolute right-1.5 top-1.5 h-9 w-9"
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </Card>
  );
}
