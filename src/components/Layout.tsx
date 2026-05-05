import { Link, useRouter } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  Home,
  MessageCircle,
  Bell,
  Search,
  User,
  LogOut,
  Menu,
  X,
  Users,
  Sparkles,
  Sun,
  Moon,
  UsersRound,
  FileText,
  Settings,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import Avatar from './Avatar';
import { supabase } from '../lib/supabase';
import { subscribeSafe, removeChannelSafe } from '../lib/realtime';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';

interface LayoutProps {
  children: React.ReactNode;
}

/** Active when pathname matches route or nested detail (does not collide across /profile/usernames because `to` is full path). */
function linkIsActive(pathname: string, to: string) {
  if (to === '/') return pathname === '/';
  return pathname === to || pathname.startsWith(`${to}/`);
}

type NavEntry = {
  to: string;
  icon: typeof Home;
  label: string;
  bottomNav?: boolean;
  badge?: number;
};

function FeedRightPanel() {
  return (
    <aside className="hidden xl:flex flex-col w-[280px] shrink-0 pl-6 pr-2 py-8 border-l border-slate-200/60 dark:border-slate-800/60 sticky top-0 h-screen">
      <Card className="p-7 bg-gradient-to-br from-blue-600 to-indigo-800 text-white shadow-2xl shadow-blue-900/40 border-none">
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
          <Sparkles size={24} strokeWidth={1.5} className="text-white" />
        </div>
        <p className="text-xl font-black tracking-tight uppercase tracking-[0.05em]">Spotlight</p>
        <p className="mt-4 text-sm text-blue-100/90 leading-relaxed font-medium">
          A calmer feed: real-time updates, crisp cards, and messaging that stays out of your way.
        </p>
        <div className="mt-8 pt-6 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-indigo-700 bg-indigo-500 flex items-center justify-center text-[10px] font-bold">
                  {i}
                </div>
              ))}
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-200">3 new ripples</p>
          </div>
        </div>
      </Card>
    </aside>
  );
}

export default function Layout({ children }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const currentPath = router.state.location.pathname;
  const isMessages = currentPath.startsWith('/messages');
  const showFeedAside = currentPath === '/';

  useEffect(() => {
    if (!profile) return;
    void fetchUnreadCounts();
    const notifSub = subscribeSafe(
      supabase
        .channel('notif-badge')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => fetchUnreadCounts()),
      { name: 'notif-badge' },
    );
    const msgSub = subscribeSafe(
      supabase.channel('msg-badge').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchUnreadCounts()),
      { name: 'msg-badge' },
    );
    return () => {
      removeChannelSafe(supabase, notifSub);
      removeChannelSafe(supabase, msgSub);
    };
  }, [profile]);

  const fetchUnreadCounts = async () => {
    if (!profile) return;
    try {
      const [{ count: nc }, convIdsRes] = await Promise.all([
        supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', profile.id).eq('is_read', false),
        supabase.from('conversation_participants').select('conversation_id').eq('user_id', profile.id),
      ]);

      const convIds = convIdsRes.data?.map((p) => p.conversation_id).filter(Boolean) ?? [];
      let mc = 0;
      if (convIds.length) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false)
          .neq('sender_id', profile.id)
          .in('conversation_id', convIds);
        mc = count ?? 0;
      }

      setUnreadNotifs(nc ?? 0);
      setUnreadMessages(mc);
    } catch (e) {
      console.error('Unread counts:', e);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: '/login' });
  };

  const navEntries: NavEntry[] = profile?.username
    ? [
        { to: '/', icon: Home, label: 'Feed', bottomNav: true },
        { to: '/groups', icon: UsersRound, label: 'Groups', bottomNav: true },
        { to: '/pages', icon: FileText, label: 'Pages', bottomNav: false },
        { to: '/search', icon: Search, label: 'Search', bottomNav: false },
        { to: '/messages', icon: MessageCircle, label: 'Messages', bottomNav: true, badge: unreadMessages },
        { to: '/notifications', icon: Bell, label: 'Notifications', bottomNav: true, badge: unreadNotifs },
        { to: `/profile/${profile.username}`, icon: User, label: 'Profile', bottomNav: true },
        { to: '/settings', icon: Settings, label: 'Settings', bottomNav: false },
      ]
    : [];

  const bottomNavEntries = navEntries.filter((e) => e.bottomNav !== false);

  const renderNavLink = (entries: NavEntry[], onNavigate?: () => void) =>
    entries.map(({ to, icon: Icon, label, badge }) => {
      const isActive = linkIsActive(currentPath, to);
      return (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          className={`flex items-center gap-3.5 px-5 py-3.5 rounded-2xl font-bold transition-all duration-200 relative group ${
            isActive
              ? 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-slate-100'
          }`}
        >
          <div className={`relative transition-transform duration-200 group-hover:scale-110 ${isActive ? 'scale-110' : ''}`}>
            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            {badge !== undefined && badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-0.5 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-950">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </div>
          <span className="text-sm tracking-tight">{label}</span>
          {isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full shadow-[2px_0_8px_rgba(59,130,246,0.5)]" />
          )}
        </Link>
      );
    });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-72 bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl border-r border-slate-200/60 dark:border-slate-800/60 z-40">
        <div className="p-8">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 premium-gradient rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30 group-hover:scale-110 transition-transform duration-300">
              <Users size={22} className="text-white" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">NepLink</span>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500 mt-0.5">Premium</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto custom-scrollbar">{renderNavLink(navEntries)}</nav>

        <div className="p-6 border-t border-slate-200/60 dark:border-slate-800/60 space-y-4">
          <Button
            variant="ghost"
            size="md"
            onClick={toggleTheme}
            className="w-full justify-start gap-4 px-5 h-14"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            <span className="text-sm font-bold tracking-tight">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </Button>

          {profile && (
            <Link 
              to={`/profile/${profile.username}`}
              className="flex items-center gap-3.5 p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all group"
            >
              <div className="relative p-0.5 glass-card border-none ring-2 ring-transparent group-hover:ring-blue-500/20 transition-all">
                <Avatar src={profile.avatar_url} name={profile.full_name || profile.username} size="sm" isOnline={profile.is_online} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-500 transition-colors">{profile.full_name || profile.username}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter truncate">@{profile.username}</p>
              </div>
            </Link>
          )}

          <Button
            variant="ghost"
            size="md"
            onClick={handleSignOut}
            className="w-full justify-start gap-4 px-5 h-14 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <LogOut size={20} />
            <span className="text-sm font-bold tracking-tight">Sign out</span>
          </Button>
        </div>
      </aside>

      <header className="lg:hidden fixed top-0 left-0 right-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/60 z-40 h-16 flex items-center px-6 justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 premium-gradient rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Users size={18} className="text-white" />
          </div>
          <span className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">NepLink</span>
        </Link>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleTheme} className="p-2.5 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2.5 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-fade-in" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-80 bg-white dark:bg-slate-950 shadow-2xl flex flex-col border-r border-slate-200/60 dark:border-slate-800/60 animate-fade-in transition-transform">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2.5">
                <div className="w-9 h-9 premium-gradient rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Users size={18} className="text-white" />
                </div>
                <span className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">NepLink</span>
              </Link>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5">
                <X size={20} className="text-slate-500" />
              </button>
            </div>
            <nav className="flex-1 p-5 space-y-1.5 overflow-y-auto">{renderNavLink(navEntries, () => setMobileMenuOpen(false))}</nav>
            <div className="p-6 border-t border-slate-100 dark:border-slate-800/60">
              <Button
                variant="ghost"
                className="w-full justify-start gap-4 px-5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => void handleSignOut()}
              >
                <LogOut size={20} />
                <span className="font-bold">Sign out</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/60 z-40 flex pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
        {bottomNavEntries.map(({ to, icon: Icon, badge }) => {
          const isActive = linkIsActive(currentPath, to);
          return (
            <Link key={to} to={to} className={`flex-1 flex flex-col items-center py-4 relative transition-all duration-300 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
              <div className={`relative transition-transform duration-300 ${isActive ? 'scale-110 -translate-y-0.5' : ''}`}>
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                {badge !== undefined && badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-4 h-4 px-0.5 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-950">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-500 rounded-b-full shadow-[0_2px_8px_rgba(59,130,246,0.5)]" />
              )}
            </Link>
          );
        })}
      </nav>

      <main className="lg:pl-72 pt-16 lg:pt-0 pb-20 lg:pb-0 min-h-screen">
        <div
          className={`mx-auto w-full flex flex-col xl:flex-row xl:justify-center gap-8 ${isMessages ? 'max-w-[1440px] px-4 sm:px-6 xl:px-10' : 'max-w-[1360px] px-4 sm:px-8'} py-10`}
        >
          <div className={`w-full ${isMessages ? 'min-w-0 flex-1' : 'max-w-2xl mx-auto xl:mx-0 flex-1'}`}>{children}</div>
          {showFeedAside && !isMessages && <FeedRightPanel />}
        </div>
      </main>
    </div>
  );
}
