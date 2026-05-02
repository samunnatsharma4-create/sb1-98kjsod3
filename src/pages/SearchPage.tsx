import { useState, useEffect, useRef } from 'react';
import { Link } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import Avatar from '../components/Avatar';
import FriendButton from '../components/FriendButton';
import Spinner from '../components/Spinner';
import type { Profile } from '../lib/database.types';

export default function SearchPage() {
  const { profile } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSearched(false); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const search = async (q: string) => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
      .neq('id', profile?.id ?? '')
      .limit(20);
    setResults(data ?? []);
    setSearched(true);
    setLoading(false);
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
          {results.map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all">
              <Link to={`/profile/${user.username}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                <Avatar src={user.avatar_url} name={user.full_name || user.username} size="md" isOnline={user.is_online} />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors truncate">
                    {user.full_name || user.username}
                  </p>
                  <p className="text-xs text-slate-500 truncate">@{user.username}</p>
                  {user.bio && <p className="text-xs text-slate-400 mt-0.5 truncate">{user.bio}</p>}
                </div>
              </Link>
              <FriendButton targetUserId={user.id} />
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
