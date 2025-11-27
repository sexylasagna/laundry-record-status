import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

interface AdminAuthContextValue {
  isAuthed: boolean;
  authenticate: () => void;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'adminAuthedv2';

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

function persistAuthForToday() {
  if (typeof window === 'undefined') return;
  const payload = JSON.stringify({ authed: true, date: getTodayDate() });
  window.localStorage.setItem(STORAGE_KEY, payload);
}

function clearStoredAuth() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState<boolean>(() => readStoredAuth());

  const authenticate = useCallback(() => {
    setIsAuthed(true);
  }, []);

  const logout = useCallback(() => {
    setIsAuthed(false);
    clearStoredAuth();
  }, []);

  useEffect(() => {
    if (isAuthed) {
      persistAuthForToday();
    } else {
      clearStoredAuth();
    }
  }, [isAuthed]);

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

  return (
    <AdminAuthContext.Provider value={{ isAuthed, authenticate, logout }}>
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

