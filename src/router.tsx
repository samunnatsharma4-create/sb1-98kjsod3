import { createRouter, createRoute, createRootRoute, Outlet, redirect } from '@tanstack/react-router';
import { supabase } from './lib/supabase';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FeedPage from './pages/FeedPage';
import ProfilePage from './pages/ProfilePage';
import { ConversationsListPage, ChatPage } from './pages/MessagesPage';
import NotificationsPage from './pages/NotificationsPage';
import SearchPage from './pages/SearchPage';

async function requireAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw redirect({ to: '/login' });
}

async function requireGuest() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) throw redirect({ to: '/' });
}

const rootRoute = createRootRoute({ component: Outlet });

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: requireGuest,
  component: LoginPage,
});

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/register',
  beforeLoad: requireGuest,
  component: RegisterPage,
});

const authLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  beforeLoad: requireAuth,
  component: () => <Layout><Outlet /></Layout>,
});

const feedRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/',
  component: FeedPage,
});

const profileRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/profile/$username',
  component: ProfilePage,
});

const messagesRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/messages',
  component: ConversationsListPage,
});

const chatRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/messages/$conversationId',
  component: ChatPage,
});

const notificationsRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/notifications',
  component: NotificationsPage,
});

const searchRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/search',
  component: SearchPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  authLayoutRoute.addChildren([
    feedRoute,
    profileRoute,
    messagesRoute,
    chatRoute,
    notificationsRoute,
    searchRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
