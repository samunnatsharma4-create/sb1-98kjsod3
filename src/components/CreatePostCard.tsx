import { useState, useRef } from 'react';
import { Image as ImageIcon, Send, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { uploadImageToStorage, POSTS_BUCKET } from '../lib/storage';
import { useObjectUrl } from '../hooks/useObjectUrl';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';
import ImageFileUpload from './ImageFileUpload';
import type { PostWithProfile } from '../lib/database.types';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Textarea } from './ui/Input';

export type CreatePostScope =
  | { kind: 'timeline' }
  | { kind: 'group'; groupId: string }
  | { kind: 'page'; pageId: string };

interface CreatePostCardProps {
  onPostCreated: (post: PostWithProfile) => void;
  scope?: CreatePostScope;
  composerTitle?: string;
}

export default function CreatePostCard({ onPostCreated, scope = { kind: 'timeline' }, composerTitle }: CreatePostCardProps) {
  const { profile } = useAuth();
  const [content, setContent] = useState('');
  const [postImageFile, setPostImageFile] = useState<File | null>(null);
  const [showImageInput, setShowImageInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const postImagePreviewSrc = useObjectUrl(postImageFile);

  const closeImageSection = () => {
    setShowImageInput(false);
    setPostImageFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || (!content.trim() && !postImageFile)) return;

    setLoading(true);
    try {
      let imageUrl = '';
      if (postImageFile) {
        imageUrl = await uploadImageToStorage(postImageFile, POSTS_BUCKET, profile.id);
      }

      const insertRow =
        scope.kind === 'timeline'
          ? { user_id: profile.id, content: content.trim(), image_url: imageUrl }
          : scope.kind === 'group'
            ? {
                user_id: profile.id,
                content: content.trim(),
                image_url: imageUrl,
                group_id: scope.groupId,
                page_id: null,
              }
            : {
                user_id: profile.id,
                content: content.trim(),
                image_url: imageUrl,
                page_id: scope.pageId,
                group_id: null,
              };

      const { data, error } = await supabase
        .from('posts')
        .insert(insertRow)
        .select('*, profiles(*), likes(*), comments(*)')
        .single();

      if (error) {
        console.error('Create post insert failed:', error);
        toast.error(error.message || 'Failed to create post');
        return;
      }

      onPostCreated(data as PostWithProfile);
      setContent('');
      setPostImageFile(null);
      setShowImageInput(false);
      toast.success('Post created!');
    } catch (err) {
      console.error('Create post failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to upload or create post');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent);
  };

  const hasImage = !!postImageFile;

  return (
    <Card className="p-6 border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
      <form onSubmit={handleSubmit} className="flex gap-5">
        <div className="shrink-0 pt-1">
          <Avatar src={profile?.avatar_url} name={profile?.full_name || profile?.username || ''} size="md" className="w-12 h-12 shadow-md ring-2 ring-white dark:ring-slate-800" />
        </div>
        <div className="flex-1 min-w-0 space-y-4">
          <div className="relative group">
            <Textarea
              ref={textRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                composerTitle ||
                `What's on your mind, ${profile?.full_name?.split(' ')[0] || profile?.username}?`
              }
              className="min-h-[100px] text-base font-medium tracking-tight bg-transparent border-none shadow-none px-0 py-1 focus:ring-0 placeholder-slate-400 dark:placeholder-slate-500"
            />
            {content.length === 0 && (
              <div className="absolute top-1 right-0 text-slate-300 dark:text-slate-700 pointer-events-none group-hover:scale-110 transition-transform">
                <Sparkles size={20} />
              </div>
            )}
          </div>

          {showImageInput && (
            <div className="animate-fade-in">
              <ImageFileUpload
                inputId="create-post-image"
                variant="compact"
                previewSrc={postImagePreviewSrc}
                onFileChange={setPostImageFile}
                uploading={loading && !!postImageFile}
                disabled={loading}
                chooseButtonText="Upload from device"
                onCloseSection={closeImageSection}
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (showImageInput) closeImageSection();
                else setShowImageInput(true);
              }}
              className="gap-2.5 px-4 h-10 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400"
            >
              <ImageIcon size={18} />
              <span className="font-bold tracking-tight">Add Photo</span>
            </Button>

            <Button
              type="submit"
              disabled={loading || (!content.trim() && !hasImage)}
              isLoading={loading}
              className="gap-2.5 px-6"
            >
              <span className="font-bold">Post Ripple</span>
              <Send size={16} />
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}
