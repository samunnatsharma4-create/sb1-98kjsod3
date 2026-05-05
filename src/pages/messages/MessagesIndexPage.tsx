import { Link } from '@tanstack/react-router';
import { MessageCircle, PanelLeftOpen } from 'lucide-react';
import { useMessagesShell } from '../../contexts/MessagesShellContext';

export default function MessagesIndexPage() {
  const { openSidebarMobile } = useMessagesShell();

  return (
    <>
      <div className="flex-1 flex lg:hidden flex-col items-center justify-center p-8 text-center min-h-[calc(100dvh-13rem)] text-slate-600 dark:text-slate-400">
        <PanelLeftOpen className="w-12 h-12 mb-3 text-blue-500/52 dark:text-blue-400/43" strokeWidth={1.2} />
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Your inbox</p>
        <p className="text-sm mt-2 max-w-[280px] leading-relaxed opacity-94">Open conversations or start one from Search or a profile.</p>
        <button
          type="button"
          onClick={() => openSidebarMobile()}
          className="mt-7 inline-flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold bg-blue-600 text-white shadow-lg shadow-blue-600/38 hover:bg-blue-500 active:scale-[0.97] transition-transform"
        >
          <PanelLeftOpen size={18} strokeWidth={2} /> Show conversations
        </button>
        <Link to="/search" className="mt-4 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
          Find people
        </Link>
      </div>

      <div className="flex-1 hidden lg:flex flex-col items-center justify-center p-12 text-center min-h-[min(540px,70vh)] text-slate-500 dark:text-slate-400 border-l border-transparent">
        <MessageCircle className="w-16 h-16 mb-5 text-blue-500/41 dark:text-blue-400/32" strokeWidth={1.2} />
        <p className="text-xl font-semibold text-slate-800 dark:text-slate-50 tracking-tight">NepLink Messages</p>
        <p className="text-sm mt-2 max-w-sm leading-relaxed">
          Pick a conversation on the left — or drop by someone&apos;s profile to say hi.
        </p>
        <Link
          to="/search"
          className="mt-9 inline-flex px-7 py-3 rounded-full text-sm font-semibold bg-blue-600 text-white shadow-lg shadow-blue-600/40 hover:bg-blue-500 hover:shadow-xl transition-[box-shadow] active:scale-[0.97]"
        >
          Discover people
        </Link>
      </div>
    </>
  );
}
