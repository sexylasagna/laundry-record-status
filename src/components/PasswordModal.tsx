import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { fetchAdminPasswordFromFirestore } from '../services/firestoreService';

interface Props {
  onClose: () => void;
  passwordType?: 'admin' | 'override';
  title?: string;
  redirectTo?: string;
  localStorageKey?: string;
}

export default function PasswordModal({ 
  onClose, 
  passwordType = 'admin',
  title,
  redirectTo,
  localStorageKey
}: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [expectedPassword, setExpectedPassword] = useState<string | null>(null);
  const [loadingPassword, setLoadingPassword] = useState(passwordType === 'admin');
  const { authenticate } = useAdminAuth();
  const navigate = useNavigate();
  const overridePassword = import.meta.env.VITE_OVERRIDE_PASSWORD as string | undefined;
  
  const getTitle = () => {
    if (title) return title;
    if (passwordType === 'override') return 'Enter Nikka\'s Override Password';
    return 'Enter Admin Password';
  };
  
  const getRedirectPath = () => {
    if (redirectTo) return redirectTo;
    if (passwordType === 'override') return '/override';
    return '/admin';
  };
  
  const getStorageKey = () => {
    if (localStorageKey) return localStorageKey;
    if (passwordType === 'override') return 'overrideAuthed';
    return 'adminAuthedv2';
  };

  useEffect(() => {
    let active = true;
    const loadPassword = async () => {
      if (passwordType === 'admin') {
        setLoadingPassword(true);
        try {
          const fetched = await fetchAdminPasswordFromFirestore();
          if (active) {
            setExpectedPassword(fetched);
            setError('');
          }
        } catch (err) {
          if (active) {
            console.error('Error fetching admin password from Firestore:', err);
            setExpectedPassword(null);
            setError('Admin password not configured. Please contact support.');
          }
        } finally {
          if (active) {
            setLoadingPassword(false);
          }
        }
      } else {
        if (!overridePassword) {
          setExpectedPassword(null);
          setError('Override password not configured. Please set environment variables.');
        } else {
          setExpectedPassword(overridePassword);
          setError('');
        }
        setLoadingPassword(false);
      }
    };

    loadPassword();

    return () => {
      active = false;
    };
  }, [passwordType, overridePassword]);

  useEffect(() => {
    // Blur any active input elements when modal opens
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement.tagName === 'INPUT') {
      activeElement.blur();
    }
    // Add class to body to dim content behind modal
    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loadingPassword) {
      return;
    }
    if (!expectedPassword) {
      setError('Password not configured. Please contact support.');
      return;
    }
    if (password === expectedPassword) {
      if (passwordType === 'override') {
        localStorage.setItem(getStorageKey(), 'true');
      } else {
        authenticate();
      }
      onClose();
      navigate(getRedirectPath());
    } else {
      setError('Invalid password');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{getTitle()}</h3>
        <form onSubmit={submit}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) {
                setError('');
              }
            }}
            autoFocus
            disabled={loadingPassword}
          />
          {error && <div className="error-text">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={loadingPassword}>
              {loadingPassword ? 'Loading...' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


