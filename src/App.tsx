import { RouterProvider } from '@tanstack/react-router';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { CallProvider } from './contexts/CallContext';
import ToastProvider from './components/Toast';
import { router } from './router';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <CallProvider>
          <ToastProvider />
          <RouterProvider router={router} />
        </CallProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
