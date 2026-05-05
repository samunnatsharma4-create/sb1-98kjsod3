import { useEffect, useState } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { Users, Plus, ChevronRight, Sparkles, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Spinner from '../components/Spinner';
import type { Group } from '../lib/database.types';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardContent } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';

export default function GroupsPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '' });

  useEffect(() => {
    let c = false;
    (async () => {
      const { data, error } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
      if (!c) {
        if (error) {
          toast.error('Could not load groups');
          setGroups([]);
        } else setGroups((data as Group[]) ?? []);
        setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    const name = draft.name.trim();
    if (name.length < 2) return toast.error('Name at least 2 characters');
    setCreating(true);
    try {
      const { data: g, error: ge } = await supabase
        .from('groups')
        .insert({
          name,
          description: draft.description.trim(),
          created_by: profile.id,
        })
        .select()
        .single();
      if (ge || !g) {
        toast.error(ge?.message ?? 'Could not create');
        return;
      }
      const { error: memErr } = await supabase.from('group_members').insert({ group_id: g.id, user_id: profile.id, role: 'admin' });
      if (memErr) {
        toast.error(memErr.message || 'Group created—but could not join. Open the hub and tap Join.');
        setGroups((prev) => [g as Group, ...prev]);
        setDraft({ name: '', description: '' });
        setShowForm(false);
        await router.navigate({ to: '/groups/$groupId', params: { groupId: g.id } });
        return;
      }
      setGroups((prev) => [g as Group, ...prev]);
      setDraft({ name: '', description: '' });
      setShowForm(false);
      toast.success('Group created');
      await router.navigate({ to: '/groups/$groupId', params: { groupId: g.id } });
    } catch {
      toast.error('Create failed');
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
          <div className="w-14 h-14 premium-gradient rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20">
            <Users size={28} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase tracking-[0.05em]">Groups</h1>
            <p className="text-[10px] mt-1 font-black text-blue-500 uppercase tracking-[0.3em]">Premium Hubs</p>
          </div>
        </div>
        <Button
          onClick={() => setShowForm((x) => !x)}
          className="gap-2.5 h-12 px-6"
        >
          <Plus size={20} />
          <span className="font-black uppercase tracking-widest text-xs">New Hub</span>
        </Button>
      </div>

      {showForm && (
        <Card className="p-8 border-none shadow-2xl shadow-slate-200/50 dark:shadow-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl animate-fade-in overflow-visible">
          <form onSubmit={createGroup} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Hub Identity</label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Design crew, hikers, ..."
                required
                minLength={2}
                className="h-14 text-base"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4">Hub Mission</label>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="What is this space about?"
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
                <span className="font-black uppercase tracking-widest text-xs">Launch Hub</span>
              </Button>
            </div>
          </form>
        </Card>
      )}

      {groups.length === 0 ? (
        <Card className="text-center py-32 px-10 border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
          <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-8 text-slate-300 dark:text-slate-700">
            <Users size={48} />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-widest">No hubs launched</h2>
          <p className="text-xs mt-4 font-bold text-slate-400 uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
            Small spaces for tighter circles—invite members and post ripples together.
          </p>
          <Button 
            variant="primary" 
            className="mt-10 px-10"
            onClick={() => setShowForm(true)}
          >
            Create first hub
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 px-2">
          {groups.map((g) => (
            <Link
              key={g.id}
              to="/groups/$groupId"
              params={{ groupId: g.id }}
              className="group"
            >
              <Card className="flex items-center gap-6 p-6 border-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-xl shadow-slate-200/50 dark:shadow-none hover:scale-[1.02] hover:shadow-2xl hover:shadow-blue-500/5 duration-300 transition-all overflow-visible">
                <div className="w-16 h-16 rounded-2xl premium-gradient flex items-center justify-center text-white shrink-0 shadow-xl shadow-blue-500/20 group-hover:scale-110 transition-transform duration-500">
                  <Users size={28} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="font-black text-lg text-slate-900 dark:text-white truncate tracking-tight">{g.name}</p>
                    <Badge variant="emerald" className="px-2 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">Active Hub</Badge>
                  </div>
                  {g.description?.trim() ? (
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 truncate leading-relaxed">{g.description}</p>
                  ) : (
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Premium circle</p>
                  )}
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-white/5 text-slate-400 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                  <ChevronRight size={20} strokeWidth={3} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <div className="px-6 py-8 rounded-[2.5rem] bg-blue-500/5 border border-blue-500/10 flex items-start gap-6">
        <Sparkles size={32} className="text-blue-500 shrink-0 mt-1" />
        <div>
          <h4 className="text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Network Insight</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed font-medium tracking-tight">
            Groups are independent threads where your identity remains constant but your audience is curated. Perfect for tight-knit communities.
          </p>
        </div>
      </div>
    </div>
  );
}
