import { Outlet } from '@tanstack/react-router';
import { MessagesShellProvider } from '../../contexts/MessagesShellContext';
import { useAuth } from '../../contexts/AuthContext';
import { useConversations } from '../../hooks/useConversations';
import ConversationsSidebar from './ConversationsSidebar';

export default function MessagesLayout() {
  const { profile } = useAuth();
  const { conversations, loading } = useConversations(profile?.id);

  return (
    <MessagesShellProvider>
      <div className="flex rounded-3xl border border-slate-200/85 dark:border-slate-800/92 bg-white/95 dark:bg-slate-950/92 backdrop-blur-sm overflow-hidden shadow-[0_20px_50px_-20px_rgb(30_41_59/0.38)] dark:shadow-[0_28px_64px_-24px_rgb(0_0_0/0.55)] -mx-4 min-h-[calc(100dvh-5.5rem)] lg:mx-auto lg:w-full lg:max-w-[1200px] xl:max-w-[1280px] lg:-mt-0 transition-shadow duration-300">
        <ConversationsSidebar conversations={conversations} loading={loading} />
        <section className="flex-1 flex flex-col min-w-0 min-h-0 bg-gradient-to-br from-slate-50 via-white to-blue-50/33 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <Outlet />
        </section>
      </div>
    </MessagesShellProvider>
  );
}
