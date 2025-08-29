import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AuthenticatedApp from './components/layout/AuthenticatedApp';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
});

// Dummy auth provider for skipauth mode
const DummyAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dummyAuthValue = {
    currentUser: { uid: 'dummy', email: 'test@example.com' } as any,
    userData: { 
      uid: 'dummy', 
      email: 'test@example.com', 
      planType: 'free' as const,
      gmailConnected: false,
      preferences: { notifications: true, reminderDays: 3, currency: 'JPY' as const }
    },
    loading: false,
    signInWithGoogle: async () => {},
    signOut: async () => {},
    isPremium: false,
    refreshUserData: async () => {},
  };
  
  return (
    <AuthContext.Provider value={dummyAuthValue}>
      {children}
    </AuthContext.Provider>
  );
};

const AppWithAuth: React.FC = () => {
  // Temporary: Skip auth for Gmail testing
  const skipAuth = window.location.search.includes('skipauth=true');
  
  if (skipAuth) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <DummyAuthProvider>
          <AuthenticatedApp />
        </DummyAuthProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <ProtectedRoute>
          <AuthenticatedApp />
        </ProtectedRoute>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default AppWithAuth;