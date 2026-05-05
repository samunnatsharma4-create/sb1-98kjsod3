import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type MessagesShellContextValue = {
  sidebarOpenMobile: boolean;
  setSidebarOpenMobile: (v: boolean) => void;
  openSidebarMobile: () => void;
  closeSidebarMobile: () => void;
};

const MessagesShellContext = createContext<MessagesShellContextValue | null>(null);

export function MessagesShellProvider({ children }: { children: ReactNode }) {
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);

  const openSidebarMobile = useCallback(() => setSidebarOpenMobile(true), []);
  const closeSidebarMobile = useCallback(() => setSidebarOpenMobile(false), []);

  return (
    <MessagesShellContext.Provider
      value={{ sidebarOpenMobile, setSidebarOpenMobile, openSidebarMobile, closeSidebarMobile }}
    >
      {children}
    </MessagesShellContext.Provider>
  );
}

export function useMessagesShell() {
  const ctx = useContext(MessagesShellContext);
  if (!ctx) throw new Error('useMessagesShell outside provider');
  return ctx;
}
