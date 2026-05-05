import { useEffect, useState } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { FileText, Plus, ChevronRight, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { slugify } from '../lib/slug';
import Spinner from '../components/Spinner';
import Avatar from '../components/Avatar';
import type { CommunityPage } from '../lib/database.types';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';

export default function CommunityPagesPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [pages, setPages] = useState<CommunityPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: '', description: '' });

  useEffect(() => {
    let c = false;
    (async () => {
      const { data, error } = await supabase.from('community_pages').select('*').order('created_at', { ascending: false });
      if (!c) {
        if (error) {
          toast.error('Could not load pages');
          setPages([]);
        } else setPages((data as CommunityPage[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const createPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    const title = draft.title.trim();
    if (title.length < 2) return toast.error('Title too short');
    setCreating(true);
    let slugTry = slugify(title);
    let createdSlug: string | null = null;
    try {
      const { data: row, error } = await supabase
        .from('community_pages')
        .insert({
          slug: slugTry.toLowerCase().trim(),
          title: title.trim(),
          description: draft.description.trim(),
          owner_id: profile.id,
        })
        .select()
        .single();
      if (error) {
        if (error.code === '23505') {
          slugTry = slugify(`${title}-${Math.random().toString(36).slice(2, 7)}`);
          const retry = await supabase
            .from('community_pages')
            .insert({ slug: slugTry, title, description: draft.description.trim(), owner_id: profile.id })
            .select()
            .single();
          if (retry.error || !retry.data) {
            toast.error(retry.error?.message ?? 'Slug taken');
            setCreating(false);
            return;
          }
          const pg = retry.data as CommunityPage;
          createdSlug = pg.slug;
          setPages((p) => [pg, ...p]);
        } else {
          toast.error(error.message);
          setCreating(false);
          return;
        }
      } else if (row) {
        const pg = row as CommunityPage;
        createdSlug = pg.slug;
        setPages((p) => [pg, ...p]);
      }
      setDraft({ title: '', description: '' });
      setShowForm(false);
      toast.success('Page created');
      if (createdSlug) {
        await router.navigate({ to: '/pages/$slug', params: { slug: createdSlug } });
      }
    } catch {
      toast.error('Failed');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-10 animate-fade-in pb-20">
      <div className="flex items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 premium-gradient rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <FileText size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase tracking-[0.05em]">Pages</h1>
            <p className="text-[10px] mt-1 font-black text-indigo-500 uppercase tracking-[0.3em]">Premium Identity</p>
          </div>
        </div>
        <Button
          onClick={() => setShowForm((s) => !s)}
          className="gap-2.5 h-12 px-6"
        >
          <Plus size={20} />
          <span className="font-black uppercase tracking-widest text-xs">New Page</span>
        </Button>
      </div>

      {showForm && (
        <Card className="p-8 border-none shadow-2xl shadow-slate-200/50 dark:shadow-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl animate-fade-in overflow-visible">
          <form onSubmit={createPage} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Page Title</label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Photography, Tech Blog, My Portfolio..."
                required
                minLength={2}
                className="h-14 text-base"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Page Bio</label>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="What is this presence about?"
                className="min-h-[100px] text-base leading-relaxed"
              />
            </div>
            <div className="flex gap-4 justify-end pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForm(false)}
                className="px-8 h-12 text-slate-500 hover:text-red-500 font-black uppercase tracking-widest text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                isLoading={creating}
                className="px-10 h-12"
              >
                <span className="font-black uppercase tracking-widest text-xs">Publish Page</span>
              </Button>
            </div>
          </form>
        </Card>
      )}

      {pages.length === 0 ? (
        <Card className="text-center py-32 px-10 border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
          <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-8 text-slate-300 dark:text-slate-700">
            <FileText size={48} />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest">No pages published</h2>
          <p className="text-xs mt-4 font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
            Lightweight spaces for ideas—spin up a micro presence for your passion.
          </p>
          <Button 
            variant="primary" 
            className="mt-10 px-10"
            onClick={() => setShowForm(true)}
          >
            Create first page
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 px-2">
          {pages.map((pg) => (
            <Link
              key={pg.id}
              to="/pages/$slug"
              params={{ slug: pg.slug }}
              className="group"
            >
              <Card className="flex items-center gap-6 p-6 border-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-xl shadow-slate-200/50 dark:shadow-none hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/5 duration-300 transition-all overflow-visible">
                <div className="relative p-0.5 glass-card border-none rounded-2xl group-hover:scale-110 transition-transform duration-500">
                  <Avatar src={pg.avatar_url || undefined} name={pg.title} size="md" className="w-16 h-16 rounded-2xl object-cover border-none shadow-xl" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="font-black text-lg text-slate-900 dark:text-white truncate tracking-tight">{pg.title}</p>
                    <Badge variant="teal" className="px-2 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">Official</Badge>
                  </div>
                  <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mt-1">@{pg.slug}</p>
                  {pg.description && (
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 truncate leading-relaxed">{pg.description}</p>
                  )}
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-white/5 text-slate-400 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                  <ChevronRight size={20} strokeWidth={3} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="px-6 py-8 rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-6">
        <Sparkles size={32} className="text-indigo-500 shrink-0 mt-1" />
        <div>
          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">Micro Presence</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed font-medium tracking-tight">
            Pages are for public ideas and professional identities. They resonate beyond your immediate network.
          </p>
        </div>
      </div>
    </div>
  );
}
