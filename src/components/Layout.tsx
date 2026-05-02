import { Link, useRouter } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  Home, MessageCircle, Bell, Search, User, LogOut, Menu, X, Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Avatar from './Avatar';
import { supabase } from '../lib/supabase';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!profile) return;
    fetchUnreadCounts();
    const notifSub = supabase
      .channel('notif-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => fetchUnreadCounts())
      .subscribe();
    const msgSub = supabase
      .channel('msg-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchUnreadCounts())
      .subscribe();
    return () => {
      supabase.removeChannel(notifSub);
      supabase.removeChannel(msgSub);
    };
  }, [profile]);

  const fetchUnreadCounts = async () => {
    if (!profile) return;
    const [{ count: nc }, { count: mc }] = await Promise.all([
      supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', profile.id).eq('is_read', false),
      supabase.from('messages').select('*', { count: 'exact', head: true }).eq('is_read', false).neq('sender_id', profile.id)
        .in('conversation_id',
          (await supabase.from('conversation_participants').select('conversation_id').eq('user_id', profile.id))
            .data?.map(p => p.conversation_id) ?? []
        ),
    ]);
    setUnreadNotifs(nc ?? 0);
    setUnreadMessages(mc ?? 0);
  };

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: '/login' });
  };

  const navLinks = [
    { to: '/', icon: Home, label: 'Feed' },
    { to: '/search', icon: Search, label: 'Search' },
    { to: '/messages', icon: MessageCircle, label: 'Messages', badge: unreadMessages },
    { to: '/notifications', icon: Bell, label: 'Notifications', badge: unreadNotifs },
    { to: `/profile/${profile?.username}`, icon: User, label: 'Profile' },
  ];

  const currentPath = router.state.location.pathname;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 z-40">
        <div className="p-6 border-b border-slate-100">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Users size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">NepLink</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navLinks.map(({ to, icon: Icon, label, badge }) => {
            const isActive = currentPath === to || (to !== '/' && currentPath.startsWith(to));
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all group relative ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="relative">
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                  {badge !== undefined && badge > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100">
          {profile && (
            <div className="flex items-center gap-3 mb-4 px-2">
              <Avatar src={profile.avatar_url} name={profile.full_name || profile.username} size="sm" isOnline={profile.is_online} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{profile.full_name || profile.username}</p>
                <p className="text-xs text-slate-500 truncate">@{profile.username}</p>
              </div>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all font-medium"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-slate-200 z-40 h-14 flex items-center px-4 justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Users size={15} className="text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900">NepLink</span>
        </Link>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-slate-600">
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-xl flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <span className="text-lg font-bold text-slate-900">NepLink</span>
              <button onClick={() => setMobileMenuOpen(false)}><X size={20} className="text-slate-500" /></button>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {navLinks.map(({ to, icon: Icon, label, badge }) => {
                const isActive = currentPath === to || (to !== '/' && currentPath.startsWith(to));
                return (
                  <Link key={to} to={to} onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all relative ${
                      isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <div className="relative">
                      <Icon size={20} />
                      {badge !== undefined && badge > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {badge > 9 ? '9+' : badge}
                        </span>
                      )}
                    </div>
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-100">
              <button onClick={handleSignOut} className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-600 hover:bg-red-50 transition-all font-medium">
                <LogOut size={20} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 flex">
        {navLinks.map(({ to, icon: Icon, badge }) => {
          const isActive = currentPath === to || (to !== '/' && currentPath.startsWith(to));
          return (
            <Link key={to} to={to} className={`flex-1 flex flex-col items-center py-2.5 relative ${isActive ? 'text-blue-600' : 'text-slate-500'}`}>
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {badge !== undefined && badge > 0 && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="lg:pl-64 pt-14 lg:pt-0 pb-16 lg:pb-0 min-h-screen">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
