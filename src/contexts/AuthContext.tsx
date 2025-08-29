import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User as FirebaseUser, 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { apiService } from '../services/apiService';
import { User } from '../types/user';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  isPremium: boolean;
  refreshUserData: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/gmail.readonly');
    
    try {
      // Try popup first, fallback to redirect
      try {
        const result = await signInWithPopup(auth, provider);
        await createOrUpdateUser(result.user);
      } catch (popupError: any) {
        console.log('Popup failed, trying redirect...', popupError);
        if (popupError.code === 'auth/popup-blocked' || 
            popupError.code === 'auth/popup-closed-by-user' ||
            popupError.message?.includes('Cross-Origin-Opener-Policy')) {
          await signInWithRedirect(auth, provider);
        } else {
          throw popupError;
        }
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUserData(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const createOrUpdateUser = async (firebaseUser: FirebaseUser) => {
    try {
      // Firebase ID Tokenを取得
      const idToken = await firebaseUser.getIdToken();
      apiService.setAuthToken(idToken);

      try {
        // バックエンドでユーザー認証・作成
        const { user } = await apiService.verifyAuth(idToken);
        setUserData(user);
      } catch (apiError) {
        console.log('API server not available, using mock data:', apiError);
        // API サーバーが利用できない場合はモックデータを使用
        setUserData({
          uid: firebaseUser.uid,
          email: firebaseUser.email!,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          planType: 'free',
          gmailConnected: false,
          preferences: {
            notifications: true,
            reminderDays: 3,
            currency: 'JPY'
          }
        });
      }
    } catch (error) {
      console.error('Failed to create/update user:', error);
      throw error;
    }
  };

  const refreshUserData = async () => {
    if (!currentUser) return;

    try {
      const idToken = await currentUser.getIdToken(true); // forceRefresh
      apiService.setAuthToken(idToken);
      const user = await apiService.getUserProfile();
      setUserData(user);
    } catch (error) {
      console.error('Failed to refresh user data:', error);
    }
  };

  useEffect(() => {
    let redirectHandled = false;

    // Handle redirect result first
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          redirectHandled = true;
          await createOrUpdateUser(result.user);
        }
      } catch (error) {
        console.error('Redirect result error:', error);
      }
    };

    handleRedirectResult();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user && !redirectHandled) {
        await createOrUpdateUser(user);
      } else if (!user) {
        setUserData(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const isPremium = userData?.planType === 'premium' && 
    (!userData.subscriptionEnd || userData.subscriptionEnd > new Date());

  const value: AuthContextType = {
    currentUser,
    userData,
    loading,
    signInWithGoogle,
    signOut,
    isPremium,
    refreshUserData
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}