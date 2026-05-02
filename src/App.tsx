import { RouterProvider } from '@tanstack/react-router';
import { AuthProvider } from './contexts/AuthContext';
import ToastProvider from './components/Toast';
import { router } from './router';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider />
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
