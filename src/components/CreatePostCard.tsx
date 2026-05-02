import { useState, useRef } from 'react';
import { Image, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';
import type { PostWithProfile } from '../lib/database.types';

interface CreatePostCardProps {
  onPostCreated: (post: PostWithProfile) => void;
}

export default function CreatePostCard({ onPostCreated }: CreatePostCardProps) {
  const { profile } = useAuth();
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || (!content.trim() && !imageUrl.trim())) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('posts')
      .insert({ user_id: profile.id, content: content.trim(), image_url: imageUrl.trim() })
      .select('*, profiles(*), likes(*), comments(*)')
      .single();
    setLoading(false);
    if (error) {
      toast.error('Failed to create post');
    } else {
      onPostCreated(data as PostWithProfile);
      setContent('');
      setImageUrl('');
      setShowImageInput(false);
      toast.success('Post created!');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e as unknown as React.FormEvent);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
      <div className="flex gap-3">
        <Avatar src={profile?.avatar_url} name={profile?.full_name || profile?.username || ''} size="sm" />
        <div className="flex-1">
          <textarea
            ref={textRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`What's on your mind, ${profile?.full_name?.split(' ')[0] || profile?.username}?`}
            className="w-full text-slate-800 placeholder-slate-400 text-sm resize-none focus:outline-none min-h-[72px] leading-relaxed"
            rows={3}
          />

          {showImageInput && (
            <div className="flex items-center gap-2 mt-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
              <Image size={16} className="text-slate-400 flex-shrink-0" />
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Paste image URL..."
                className="flex-1 text-sm bg-transparent text-slate-700 placeholder-slate-400 focus:outline-none"
              />
              <button onClick={() => { setShowImageInput(false); setImageUrl(''); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={14} />
              </button>
            </div>
          )}

          {imageUrl && (
            <div className="mt-2 relative">
              <img src={imageUrl} alt="Preview" className="w-full rounded-xl object-cover max-h-48" onError={() => setImageUrl('')} />
              <button
                onClick={() => setImageUrl('')}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowImageInput(!showImageInput)}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-500 transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50"
            >
              <Image size={16} />
              Photo
            </button>

            <button
              onClick={handleSubmit}
              disabled={loading || (!content.trim() && !imageUrl.trim())}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2 rounded-xl transition-all"
            >
              {loading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
