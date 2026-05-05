import { useState, useEffect } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { uploadImageToStorage, AVATARS_BUCKET } from '../lib/storage';
import { useObjectUrl } from '../hooks/useObjectUrl';
import toast from 'react-hot-toast';
import Avatar from '../components/Avatar';
import ImageFileUpload from '../components/ImageFileUpload';
import { User, Shield, Palette, Mail, Check, Moon, Sun, Bell, Lock, Trash2, Sparkles, Camera } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input, Textarea } from '../components/ui/Input';
import { cn } from '../lib/utils';

type SettingsTab = 'profile' | 'privacy' | 'appearance' | 'account' | 'notifications';

export default function SettingsPage() {
  const router = useRouter();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [form, setForm] = useState({ 
    full_name: '', 
    bio: '', 
    avatar_url: '',
    privacy_settings: { public_profile: true },
    notification_settings: { likes: true, comments: true, friends: true, messages: true }
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const preview = useObjectUrl(avatarFile) || form.avatar_url || null;

  useEffect(() => {
    if (!profile) return;
    setForm({
      full_name: profile.full_name ?? '',
      bio: profile.bio ?? '',
      avatar_url: profile.avatar_url ?? '',
      privacy_settings: profile.privacy_settings || { public_profile: true },
      notification_settings: (profile as any).notification_settings || { likes: true, comments: true, friends: true, messages: true }
    });
  }, [profile]);

  const saveProfile = async () => {
    if (!profile) return toast.error('Not signed in');
    setSaving(true);
    try {
      let avatarUrl = form.avatar_url;
      if (avatarFile) {
        avatarUrl = await uploadImageToStorage(avatarFile, AVATARS_BUCKET, profile.id);
      }
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name.trim(),
          bio: form.bio.trim(),
          avatar_url: avatarUrl,
          privacy_settings: form.privacy_settings,
          notification_settings: form.notification_settings as any
        })
        .eq('id', profile.id);

      if (error) {
        toast.error(error.message || 'Could not save');
        return;
      }
      toast.success('Settings updated');
      setAvatarFile(null);
      await refreshProfile();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async () => {
    if (!user || !profile) return;
    if (!confirm('WARNING: This will permanently delete your account and all your data. This action CANNOT be undone. Are you absolutely sure?')) return;
    
    setDeleting(true);
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', user.id);
      if (error) throw error;
      
      toast.success('Account deleted successfully');
      await signOut();
      await router.navigate({ to: '/register' });
    } catch (e) {
      toast.error('Could not delete account. Please contact support.');
    } finally {
      setDeleting(false);
    }
  };

  const sendPasswordHint = async () => {
    if (!user?.email) return toast.error('No email on session');
    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}`,
      });
      if (error) toast.error(error.message);
      else toast.success('Check your inbox for reset instructions.');
    } catch {
      toast.error('Could not start reset');
    } finally {
      setSendingReset(false);
    }
  };

  if (!profile) {
    return (
      <div className="flex justify-center items-center py-24 animate-fade-in">
        <Card className="px-10 py-6 border-none bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl">
          <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs">
            Sign in to open settings
          </p>
        </Card>
      </div>
    );
  }

  const tabs: { id: SettingsTab; label: string; icon: any; desc: string }[] = [
    { id: 'profile', label: 'Profile', icon: User, desc: 'Public identity' },
    { id: 'appearance', label: 'Aesthetic', icon: Palette, desc: 'Visual themes' },
    { id: 'privacy', label: 'Safety', icon: Shield, desc: 'Visibility rules' },
    { id: 'notifications', label: 'Alerts', icon: Bell, desc: 'Real-time sync' },
    { id: 'account', label: 'Account', icon: Lock, desc: 'Security protocols' },
  ];

  return (
    <div className="max-w-6xl mx-auto pb-24 animate-fade-in px-4">
      <div className="mb-12 flex items-center gap-4">
        <div className="w-14 h-14 premium-gradient rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20">
          <Palette size={28} className="text-white" />
        </div>
        <div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase tracking-[0.05em]">Settings</h1>
          <p className="text-[10px] mt-1 font-black text-blue-500 uppercase tracking-[0.3em]">Premium configuration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-4 space-y-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-5 p-5 rounded-[2rem] transition-all duration-300 group relative",
                activeTab === tab.id
                  ? 'bg-white dark:bg-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none'
                  : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400'
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300",
                activeTab === tab.id 
                  ? 'premium-gradient text-white shadow-lg shadow-blue-500/20 scale-110' 
                  : 'bg-slate-100 dark:bg-white/5 text-slate-400'
              )}>
                <tab.icon size={22} strokeWidth={2.5} />
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className={cn(
                  "font-black text-sm uppercase tracking-[0.15em] transition-colors",
                  activeTab === tab.id ? 'text-slate-900 dark:text-white' : 'text-slate-500'
                )}>
                  {tab.label}
                </p>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter truncate">{tab.desc}</p>
              </div>
              {activeTab === tab.id && (
                <div className="absolute right-6 w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-8">
          <Card className="rounded-[3rem] p-10 md:p-12 border-none shadow-2xl shadow-slate-200/50 dark:shadow-none bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl overflow-visible">
            {activeTab === 'profile' && (
              <div className="space-y-10 animate-fade-in">
                <div className="flex flex-col md:flex-row items-center gap-10 border-b border-slate-100 dark:border-white/5 pb-10">
                  <div className="relative group">
                    <div className="p-1.5 bg-white/10 backdrop-blur-xl rounded-full ring-4 ring-white dark:ring-slate-800 shadow-2xl transition-transform duration-500 group-hover:scale-105">
                      <Avatar src={preview ?? undefined} name={profile.full_name || profile.username} size="xl" className="w-36 h-36 border-none" />
                    </div>
                    <label
                      htmlFor="settings-avatar-upload"
                      className="absolute bottom-2 right-2 w-12 h-12 premium-gradient rounded-2xl flex items-center justify-center shadow-2xl cursor-pointer hover:scale-110 active:scale-90 transition-all ring-4 ring-white dark:ring-slate-800"
                    >
                      <Camera size={22} className="text-white" />
                      <input
                        id="settings-avatar-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                  <div className="flex-1 text-center md:text-left space-y-3">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Identity Avatar</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
                      Your premium visual footprint. <br />
                      JPG, GIF or PNG. Max size 2MB.
                    </p>
                    <div className="mt-4">
                      <ImageFileUpload
                        inputId="settings-avatar-upload-alt"
                        variant="stacked"
                        previewSrc={null}
                        onFileChange={setAvatarFile}
                        uploading={saving && !!avatarFile}
                        disabled={saving}
                        chooseButtonText="Pick another ripple"
                        className="hidden"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 ml-4">Display Identity</label>
                      <Input
                        type="text"
                        value={form.full_name}
                        onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                        className="h-14 text-base"
                        placeholder="Premium user"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 ml-4">Premium Alias</label>
                      <div className="w-full glass-card border-none bg-slate-100/50 dark:bg-white/5 rounded-2xl px-6 h-14 flex items-center text-base font-black text-slate-400 uppercase tracking-widest">
                        @{profile.username}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 ml-4">Personal Mantra</label>
                    <Textarea
                      value={form.bio}
                      onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                      className="min-h-[160px] text-base leading-relaxed"
                      placeholder="Share your thread with the world..."
                    />
                  </div>
                </div>

                <div className="pt-6">
                  <Button
                    onClick={() => void saveProfile()}
                    disabled={saving}
                    isLoading={saving}
                    className="w-full h-16 text-sm"
                  >
                    <span className="font-black uppercase tracking-[0.3em]">Update Identity</span>
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-10 animate-fade-in">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase tracking-[0.05em]">Interface Aura</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Choose your visual aesthetic</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <button
                    onClick={() => setTheme('light')}
                    className={cn(
                      "p-8 rounded-[2.5rem] border-4 transition-all duration-500 text-left relative overflow-hidden group",
                      theme === 'light' 
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/10' 
                        : 'border-transparent bg-slate-50/50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10'
                    )}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500",
                        theme === 'light' ? 'bg-blue-500 text-white shadow-xl shadow-blue-500/20' : 'bg-white dark:bg-slate-800 text-slate-400 shadow-sm'
                      )}>
                        <Sun size={28} strokeWidth={2.5} />
                      </div>
                      {theme === 'light' && <Check size={24} className="text-blue-500 animate-fade-in" />}
                    </div>
                    <p className={cn(
                      "font-black text-lg uppercase tracking-[0.2em] transition-colors",
                      theme === 'light' ? 'text-blue-600' : 'text-slate-400'
                    )}>Light Aura</p>
                    <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">Clean and minimal</p>
                  </button>

                  <button
                    onClick={() => setTheme('dark')}
                    className={cn(
                      "p-8 rounded-[2.5rem] border-4 transition-all duration-500 text-left relative overflow-hidden group",
                      theme === 'dark' 
                        ? 'border-blue-400 bg-slate-950 shadow-2xl shadow-blue-900/20' 
                        : 'border-transparent bg-slate-50/50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10'
                    )}
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500",
                        theme === 'dark' ? 'premium-gradient text-white shadow-xl shadow-blue-500/20' : 'bg-white dark:bg-slate-800 text-slate-400 shadow-sm'
                      )}>
                        <Moon size={28} strokeWidth={2.5} />
                      </div>
                      {theme === 'dark' && <Check size={24} className="text-blue-400 animate-fade-in" />}
                    </div>
                    <p className={cn(
                      "font-black text-lg uppercase tracking-[0.2em] transition-colors",
                      theme === 'dark' ? 'text-white' : 'text-slate-400'
                    )}>OLED Night</p>
                    <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">Deep blacks & glass</p>
                  </button>
                </div>

                <div className="p-8 rounded-[2rem] bg-blue-500/5 border border-blue-500/10 flex items-start gap-5">
                  <Sparkles size={28} className="text-blue-500 shrink-0 mt-1" />
                  <div>
                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Pro Aesthetic</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed font-medium tracking-tight">
                      NepLink adaptively synchronizes with your device preferences. You can force a specific aura here.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="space-y-10 animate-fade-in">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase tracking-[0.05em]">Safety Protocols</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Control your premium presence</p>
                </div>

                <div className="space-y-6">
                  <Card className="p-8 border-none bg-slate-50/50 dark:bg-white/5 flex items-center justify-between group hover:bg-blue-500/5 transition-all duration-500 rounded-[2rem]">
                    <div className="flex items-center gap-6">
                      <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center text-blue-500 shadow-sm group-hover:scale-110 transition-transform duration-500">
                        <User size={24} strokeWidth={2.5} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">Public Ripples</p>
                        <p className="text-[11px] font-bold text-slate-500 mt-1.5 uppercase tracking-tighter">Allow anyone to view your profile and thread history</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        privacy_settings: { ...f.privacy_settings, public_profile: !f.privacy_settings.public_profile }
                      }))}
                      className={cn(
                        "relative inline-flex h-9 w-16 items-center rounded-full transition-all duration-500",
                        form.privacy_settings.public_profile ? 'premium-gradient shadow-lg shadow-blue-500/30' : 'bg-slate-200 dark:bg-slate-800'
                      )}
                    >
                      <span className={cn(
                        "inline-block h-7 w-7 transform rounded-full bg-white transition-transform duration-500 shadow-md",
                        form.privacy_settings.public_profile ? 'translate-x-8' : 'translate-x-1'
                      )} />
                    </button>
                  </Card>
                </div>

                <div className="pt-6">
                  <Button
                    onClick={() => void saveProfile()}
                    disabled={saving}
                    isLoading={saving}
                    className="w-full h-16 text-sm"
                  >
                    <span className="font-black uppercase tracking-[0.3em]">Save Privacy protocols</span>
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-10 animate-fade-in">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase tracking-[0.05em]">Sync alerts</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Configure your real-time notifications</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {[
                    { key: 'likes', label: 'Ripples & Likes', desc: 'When your thread receives engagement' },
                    { key: 'comments', label: 'Conversations', desc: 'When others reply to your ripples' },
                    { key: 'friends', label: 'Network', desc: 'New connections and requests' },
                    { key: 'messages', label: 'Direct Sync', desc: 'Incoming private transmissions' },
                  ].map((item) => (
                    <Card key={item.key} className="p-8 border-none bg-slate-50/50 dark:bg-white/5 flex items-center justify-between group hover:bg-blue-500/5 transition-all duration-500 rounded-[2rem]">
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">{item.label}</p>
                        <p className="text-[11px] font-bold text-slate-500 mt-1.5 uppercase tracking-tighter">{item.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          notification_settings: { 
                            ...f.notification_settings, 
                            [item.key]: !((f.notification_settings as any)[item.key]) 
                          }
                        }))}
                        className={cn(
                          "relative inline-flex h-9 w-16 items-center rounded-full transition-all duration-500",
                          (form.notification_settings as any)[item.key] ? 'premium-gradient shadow-lg shadow-blue-500/30' : 'bg-slate-200 dark:bg-slate-800'
                        )}
                      >
                        <span className={cn(
                          "inline-block h-7 w-7 transform rounded-full bg-white transition-transform duration-500 shadow-md",
                          (form.notification_settings as any)[item.key] ? 'translate-x-8' : 'translate-x-1'
                        )} />
                      </button>
                    </Card>
                  ))}
                </div>

                <div className="pt-6">
                  <Button
                    onClick={() => void saveProfile()}
                    disabled={saving}
                    isLoading={saving}
                    className="w-full h-16 text-sm"
                  >
                    <span className="font-black uppercase tracking-[0.3em]">Update sync alerts</span>
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'account' && (
              <div className="space-y-12 animate-fade-in">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase tracking-[0.05em]">Security Core</h2>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Manage your authentication credentials</p>
                </div>

                <Card className="rounded-[2.5rem] p-10 border-none bg-slate-50/50 dark:bg-white/5 space-y-8">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 rounded-2xl premium-gradient flex items-center justify-center text-white shadow-2xl shadow-blue-500/30">
                      <Mail size={32} strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Authenticated via</p>
                      <p className="text-lg font-black text-slate-900 dark:text-white tracking-tight mt-1">{user?.email}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-6 pt-8 border-t border-slate-200 dark:border-white/5">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed italic">
                      Security protocol: Updating your password requires a verified secure link sent to your registered email address.
                    </p>
                    <Button
                      variant="glass"
                      disabled={sendingReset || !user?.email}
                      onClick={() => void sendPasswordHint()}
                      className="h-14 px-10 gap-3"
                    >
                      {sendingReset ? 'Generating Sync Link…' : 'Request Password Reset'}
                    </Button>
                  </div>
                </Card>

                <div className="pt-12">
                  <Card className="p-10 rounded-[2.5rem] border-2 border-red-500/20 bg-red-500/5 space-y-6">
                    <div className="flex items-center gap-3 text-red-500">
                      <Trash2 size={24} />
                      <h3 className="text-xl font-black uppercase tracking-[0.2em]">Danger Zone</h3>
                    </div>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                      Termination is absolute. Deleting your account will permanently erase all ripples, transmissions, and network connections. This protocol cannot be reversed.
                    </p>
                    <Button
                      variant="danger"
                      disabled={deleting}
                      onClick={() => void deleteAccount()}
                      className="h-14 px-10"
                    >
                      <span className="font-black uppercase tracking-[0.2em]">{deleting ? 'Terminating Account...' : 'Delete My Account'}</span>
                    </Button>
                  </Card>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
