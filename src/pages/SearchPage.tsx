import { useState, useEffect, useRef } from 'react';
import { Link, useRouter } from '@tanstack/react-router';
import { MessageCircle, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getOrCreateDmConversation } from '../lib/messaging';
import Avatar from '../components/Avatar';
import FriendButton from '../components/FriendButton';
import Spinner from '../components/Spinner';
import type { Profile } from '../lib/database.types';

export default function SearchPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [messagingUserId, setMessagingUserId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  /** Characters that break `.or(username.ilike.x,full_name.ilike.x)` parsing */
  const safeIlikeFrag = (s: string) => s.replace(/[%,)(\n\r]/g, '').trim().slice(0, 48);

  const search = async (q: string) => {
    setLoading(true);
    try {
      const frag = safeIlikeFrag(q);
      if (!frag.length) {
        setResults([]);
        setSearched(true);
        setLoading(false);
        return;
      }
      let qb = supabase.from('profiles').select('*').or(`username.ilike.%${frag}%,full_name.ilike.%${frag}%`);
      if (profile?.id) qb = qb.neq('id', profile.id);
      const { data, error } = await qb.limit(20);
      if (error) {
        toast.error('Search failed');
        setResults([]);
      } else {
        setResults((data as Profile[]) ?? []);
      }
    } finally {
      setSearched(true);
      setLoading(false);
    }
  };

  const openDm = async (otherUserId: string) => {
    if (!profile) {
      toast.error('Sign in to message.');
      return;
    }
    if (messagingUserId) return;
    setMessagingUserId(otherUserId);
    try {
      const result = await getOrCreateDmConversation(profile.id, otherUserId);
      if ('error' in result) {
        toast.error(result.error);
        return;
      }
      await router.navigate({ to: '/messages/$conversationId', params: { conversationId: result.conversationId } });
    } catch {
      toast.error('Could not open chat.');
    } finally {
      setMessagingUserId(null);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Search</h1>
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or username..."
          className="w-full bg-white border border-slate-200 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm transition-all"
          autoFocus
        />
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100">
          <p className="font-medium">No users found</p>
          <p className="text-sm mt-1">Try a different search term</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          {results.map((userRow) => (
            <div
              key={userRow.id}
              className="flex items-center justify-between gap-3 p-4 bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-blue-200 dark:hover:border-blue-700 hover:shadow-md transition-all"
            >
              <Link
                to="/profile/$username"
                params={{ username: userRow.username }}
                className="flex items-center gap-3 flex-1 min-w-0 group"
              >
                <Avatar src={userRow.avatar_url} name={userRow.full_name || userRow.username} size="md" isOnline={userRow.is_online} />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                    {userRow.full_name || userRow.username}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">@{userRow.username}</p>
                  {userRow.bio && <p className="text-xs text-slate-400 mt-0.5 truncate">{userRow.bio}</p>}
                </div>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void openDm(userRow.id)}
                  disabled={!!messagingUserId}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                  title="Message"
                >
                  <MessageCircle size={14} />
                  {messagingUserId === userRow.id ? '…' : 'Message'}
                </button>
                <FriendButton targetUserId={userRow.id} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!query && (
        <div className="text-center py-16 text-slate-400">
          <Search size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Discover people</p>
          <p className="text-sm mt-1">Search by name or username</p>
        </div>
      )}
    </div>
  );
}
