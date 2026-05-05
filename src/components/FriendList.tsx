import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Avatar from './Avatar';
import Spinner from './Spinner';
import type { Profile } from '../lib/database.types';

type Props = {
  profileUserId: string;
  maxShown?: number;
};

export default function FriendList({ profileUserId, maxShown = 12 }: Props) {
  const [friends, setFriends] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const { data: rows, error } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${profileUserId},addressee_id.eq.${profileUserId}`);
      if (error || cancel) {
        setLoading(false);
        return;
      }

      const friendIds = [...new Set((rows ?? []).map((r) => (r.requester_id === profileUserId ? r.addressee_id : r.requester_id)))].filter(
        Boolean,
      ) as string[];
      if (friendIds.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }

      const { data: profs } = await supabase.from('profiles').select('*').in('id', friendIds);
      if (!cancel) setFriends((profs as Profile[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [profileUserId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 p-8 flex justify-center">
        <Spinner size="sm" />
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/60 p-6 text-center">
        <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" strokeWidth={1.2} />
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No friends to show yet</p>
      </div>
    );
  }

  const slice = friends.slice(0, maxShown);

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 shadow-sm transition-colors">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 px-1">Friends</p>
      <div className="flex flex-wrap gap-3 justify-center sm:justify-start">
        {slice.map((f) => (
          <Link
            key={f.id}
            to="/profile/$username"
            params={{ username: f.username }}
            className="flex flex-col items-center gap-1.5 w-[72px] group"
          >
            <Avatar src={f.avatar_url} name={f.full_name || f.username} size="md" className="ring-2 ring-transparent group-hover:ring-blue-400/55 transition-[ring] duration-180" />
            <span className="text-[11px] text-center leading-tight text-slate-600 dark:text-slate-300 truncate w-full group-hover:text-blue-600 dark:group-hover:text-blue-400">
              {f.full_name?.split(' ')[0] || f.username}
            </span>
          </Link>
        ))}
      </div>
      {friends.length > maxShown && (
        <p className="text-center text-[11px] text-slate-400 mt-3">+ {friends.length - maxShown} more</p>
      )}
    </div>
  );
}
