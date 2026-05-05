import { Link, useParams, useRouter } from '@tanstack/react-router';
import { MessageSquare, ChevronRight, X } from 'lucide-react';
import Avatar from '../../components/Avatar';
import Skeleton from '../../components/Skeleton';
import type { ConversationWithDetails } from '../../lib/database.types';
import { formatDistanceToNow } from '../../lib/dateUtils';
import { useMessagesShell } from '../../contexts/MessagesShellContext';

type Props = {
  conversations: ConversationWithDetails[];
  loading: boolean;
  className?: string;
};

export default function ConversationsSidebar({ conversations, loading, className = '' }: Props) {
  const params = useParams({ strict: false }) as { conversationId?: string };
  const router = useRouter();
  const { sidebarOpenMobile, closeSidebarMobile } = useMessagesShell();
  const activeId = params.conversationId;

  const content = loading ? (
    <div className="p-3 space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-3 p-3 rounded-2xl">
          <Skeleton className="w-11 h-11 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-3 w-2/5 rounded-lg" />
            <Skeleton className="h-2.5 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  ) : conversations.length === 0 ? (
    <div className="flex flex-col items-center justify-center flex-1 p-8 text-center text-slate-500 dark:text-slate-400">
      <MessageSquare className="w-12 h-12 mb-3 opacity-40" strokeWidth={1.25} />
      <p className="font-medium text-slate-700 dark:text-slate-300">No conversations</p>
      <p className="text-xs mt-1 max-w-[220px] leading-relaxed opacity-95">Visit a profile and use Message to start a chat.</p>
    </div>
  ) : (
    <nav className="p-2 space-y-0.5 flex-1 overflow-y-auto overscroll-contain">
      {conversations.map((conv, idx) => {
        const isActive = activeId === conv.id;
        const other = conv.other_user;
        const preview = conv.last_message?.content ?? 'Say hello!';
        const name = other?.full_name || other?.username || 'User';

        return (
          <Link
            key={conv.id}
            to="/messages/$conversationId"
            params={{ conversationId: conv.id }}
            style={{ animationDelay: `${Math.min(idx, 16) * 24}ms` }}
            className={`group flex items-center gap-3 px-3 py-2.5 rounded-2xl border transition-[transform,background-color,border-color,box-shadow] duration-200 motion-safe:animate-[nl-fade-slide_0.35s_ease-out_both] ${
              isActive
                ? 'bg-blue-500/14 dark:bg-blue-400/17 border-blue-400/40 shadow-[0_4px_20px_-8px_rgba(59,130,246,0.48)] ring-1 ring-blue-400/35'
                : 'border-transparent bg-transparent hover:bg-slate-100/90 hover:translate-x-px dark:hover:bg-slate-800/80'
            }`}
            onClick={() => closeSidebarMobile()}
          >
            <Avatar src={other?.avatar_url} name={name} size="md" isOnline={other?.is_online} />
            <div className="flex-1 min-w-0 text-left">
              <div className="flex justify-between gap-2 items-center">
                <span
                  className={`text-sm font-semibold truncate transition-colors ${isActive ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-slate-50'}`}
                >
                  {name}
                </span>
                {conv.last_message && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                    {formatDistanceToNow(conv.last_message.created_at)}
                  </span>
                )}
              </div>
              <p className="text-[13px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{preview}</p>
            </div>
            {conv.unread_count > 0 && (
              <span className="min-w-[1.25rem] h-5 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm shadow-blue-600/35">
                {conv.unread_count > 99 ? '99+' : conv.unread_count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const header = (
    <div className="flex-shrink-0 h-14 px-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-white/92 dark:bg-slate-950/92 backdrop-blur-lg">
      <button
        type="button"
        onClick={() => router.navigate({ to: '/' })}
        className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors active:scale-95"
        aria-label="Back to feed"
      >
        <ChevronRight size={20} className="rotate-180" />
      </button>
      <h2 className="flex-1 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400 text-center lg:pl-0">
        Conversations
      </h2>
      <button
        type="button"
        className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
        onClick={() => closeSidebarMobile()}
        aria-label="Close list"
      >
        <X size={20} />
      </button>
      <span className="hidden lg:inline-flex w-[36px]" aria-hidden />
    </div>
  );

  return (
    <div className={`relative shrink-0 ${className}`}>
      {/* Desktop column */}
      <aside className="hidden lg:flex flex-col w-[min(344px,100%)] xl:w-[392px] h-full min-h-0 border-r border-slate-100 dark:border-slate-800 bg-white/93 dark:bg-slate-950/93 backdrop-blur-xl">
        {header}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">{content}</div>
      </aside>

      {/* Mobile backdrop + drawer */}
      <div
        className={`lg:hidden fixed inset-0 z-50 bg-slate-900/52 backdrop-blur-[2px] transition-opacity duration-200 ${
          sidebarOpenMobile ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => closeSidebarMobile()}
        aria-hidden={!sidebarOpenMobile}
      />
      <aside
        className={`lg:hidden fixed left-0 top-0 bottom-0 z-[55] flex flex-col w-[min(100vw-40px,360px)] max-w-[94vw] rounded-r-3xl border-r border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          sidebarOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {header}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">{content}</div>
      </aside>
    </div>
  );
}
