import { createRouter, createRoute, createRootRoute, Outlet, redirect } from '@tanstack/react-router';
import { supabase } from './lib/supabase';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import FeedPage from './pages/FeedPage';
import ProfilePage from './pages/ProfilePage';
import MessagesLayout from './pages/messages/MessagesLayout';
import MessagesIndexPage from './pages/messages/MessagesIndexPage';
import ChatPage from './pages/messages/ChatPage';
import NotificationsPage from './pages/NotificationsPage';
import SearchPage from './pages/SearchPage';
import SettingsPage from './pages/SettingsPage';
import GroupsPage from './pages/GroupsPage';
import GroupDetailPage from './pages/GroupDetailPage';
import CommunityPagesPage from './pages/CommunityPagesPage';
import CommunityPageDetailPage from './pages/CommunityPageDetailPage';

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

const messagesLayoutRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/messages',
  component: MessagesLayout,
});

const messagesIndexRoute = createRoute({
  getParentRoute: () => messagesLayoutRoute,
  path: '/',
  component: MessagesIndexPage,
});

const messagesChatRoute = createRoute({
  getParentRoute: () => messagesLayoutRoute,
  path: '$conversationId',
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

const settingsRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/settings',
  component: SettingsPage,
});

const groupsRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/groups',
  component: GroupsPage,
});

const groupDetailRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/groups/$groupId',
  component: GroupDetailPage,
});

const communityPagesRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/pages',
  component: CommunityPagesPage,
});

const communityPageDetailRoute = createRoute({
  getParentRoute: () => authLayoutRoute,
  path: '/pages/$slug',
  component: CommunityPageDetailPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  registerRoute,
  authLayoutRoute.addChildren([
    feedRoute,
    profileRoute,
    messagesLayoutRoute.addChildren([messagesIndexRoute, messagesChatRoute]),
    notificationsRoute,
    searchRoute,
    settingsRoute,
    groupsRoute,
    groupDetailRoute,
    communityPagesRoute,
    communityPageDetailRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
