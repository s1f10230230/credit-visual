import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { 
  User as FirebaseUser, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
      const result = await signInWithPopup(auth, provider);
      await createOrUpdateUser(result.user);
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
    const userDoc = doc(db, 'users', firebaseUser.uid);
    const userSnap = await getDoc(userDoc);

    let userData: User;

    if (!userSnap.exists()) {
      // 新規ユーザー
      userData = {
        uid: firebaseUser.uid,
        email: firebaseUser.email!,
        displayName: firebaseUser.displayName || undefined,
        photoURL: firebaseUser.photoURL || undefined,
        planType: 'free',
        createdAt: new Date(),
        lastLoginAt: new Date(),
        gmailConnected: false,
        preferences: {
          notifications: true,
          reminderDays: 3,
          currency: 'JPY'
        }
      };

      await setDoc(userDoc, {
        ...userData,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      });
    } else {
      // 既存ユーザーのログイン日時更新
      userData = userSnap.data() as User;
      await setDoc(userDoc, {
        lastLoginAt: serverTimestamp()
      }, { merge: true });
    }

    setUserData(userData);
  };

  const refreshUserData = async () => {
    if (!currentUser) return;

    const userDoc = doc(db, 'users', currentUser.uid);
    const userSnap = await getDoc(userDoc);
    
    if (userSnap.exists()) {
      setUserData(userSnap.data() as User);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        await createOrUpdateUser(user);
      } else {
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