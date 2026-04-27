// 全域 Auth Context（Task 005 / 007）
//
// 監聽 Firebase Auth 狀態變化，並從 users collection 撈出 UserDoc。
// 任何頁面 / Guard 都透過 useAuth() 取得目前使用者與載入狀態。

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';

import { auth } from '../services/firebase';
import { fetchUserDoc } from '../services/users';
import type { UserDoc } from '../types/user';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  user: UserDoc | null;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      setError(null);
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const doc = await fetchUserDoc(fbUser.uid);
        if (!doc) {
          setError('帳號尚未在 users 集合建立角色資料，請聯絡管理員');
          setUser(null);
        } else if (!doc.active) {
          setError('帳號已停用');
          setUser(null);
        } else {
          setUser(doc);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '讀取使用者資料失敗');
        setUser(null);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      user,
      loading,
      error,
      logout: () => signOut(auth),
    }),
    [firebaseUser, user, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() 必須在 <AuthProvider> 內使用');
  }
  return ctx;
}
