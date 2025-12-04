import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { subscribeToForceLogout } from '../services/firestoreService';

interface AdminAuthContextValue {
  isAuthed: boolean;
  user: AdminUser | null;
  authenticate: (user: AdminUser) => void;
  logout: () => void;
}

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  isAdmin: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'adminAuthedv3';

function getTodayDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, '0');
  const day = `${today.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readStoredAuth(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return false;

  try {
    const parsed = JSON.parse(stored) as { date?: string; authed?: boolean };
    if (parsed.authed && parsed.date === getTodayDate()) {
      return true;
    }
  } catch (error) {
    console.warn('Failed to parse stored admin auth:', error);
  }

  window.localStorage.removeItem(STORAGE_KEY);
  return false;
}

function persistAuthForToday(user: AdminUser) {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify({ authed: true, date: getTodayDate(), user });
  window.localStorage.setItem(STORAGE_KEY, payload);
}

function clearStoredAuth() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState<boolean>(() => readStoredAuth());
  const [user, setUser] = useState<AdminUser | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    try {
      const parsed = JSON.parse(stored) as { date?: string; authed?: boolean; user?: AdminUser };
      if (parsed.authed && parsed.date === getTodayDate() && parsed.user) {
        return parsed.user;
      }
    } catch {
      // ignore
    }
    return null;
  });

  const authenticate = useCallback((nextUser: AdminUser) => {
    setUser(nextUser);
    setIsAuthed(true);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setIsAuthed(false);
    clearStoredAuth();
  }, []);

  useEffect(() => {
    if (isAuthed) {
      if (user) {
        persistAuthForToday(user);
      }
    } else {
      clearStoredAuth();
    }
  }, [isAuthed, user]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isAuthed) return;

    const interval = window.setInterval(() => {
      if (!readStoredAuth()) {
        setIsAuthed(false);
      }
    }, 60 * 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isAuthed]);

  // Subscribe to force logout from Firestore
  useEffect(() => {
    if (typeof window === 'undefined' || !isAuthed) return;

    const unsubscribe = subscribeToForceLogout((payload) => {
      if (payload && payload.triggered) {
        console.log('🔒 Force logout triggered by:', payload.triggeredBy);
        logout();
        // Clear the force logout flag after triggering
        // This allows it to be triggered again in the future
        setTimeout(() => {
          import('../services/firestoreService').then(({ clearForceLogout }) => {
            clearForceLogout().catch(console.error);
          });
        }, 1000);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isAuthed, logout]);

  return (
    <AdminAuthContext.Provider value={{ isAuthed, user, authenticate, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}

