import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { authenticateEmployee, type LaundryEmployee } from '../services/firestoreService';

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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { authenticate } = useAdminAuth();
  const navigate = useNavigate();
  
  const getTitle = () => {
    if (title) return title;
    if (passwordType === 'override') return 'Enter Override Credentials';
    return 'Enter Admin Credentials';
  };
  
  const getRedirectPath = () => {
    if (redirectTo) return redirectTo;
    if (passwordType === 'override') return '/override';
    return '/admin';
  };
  
  const getStorageKey = () => {
    if (localStorageKey) return localStorageKey;
    if (passwordType === 'override') return 'overrideAuthed';
    return 'adminAuthedv3';
  };

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setError('Please enter username and password.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const employee: LaundryEmployee = await authenticateEmployee(trimmedUsername, trimmedPassword);

      if (passwordType === 'override' && !employee.isAdmin) {
        setError('You are not allowed to access override controls.');
        setIsSubmitting(false);
        return;
      }

      authenticate({
        id: employee.id,
        username: employee.username,
        name: employee.name,
        isAdmin: employee.isAdmin,
      });

      onClose();
      navigate(getRedirectPath());
    } catch (err: any) {
      console.error('Employee authentication failed:', err);
      setError(err?.message || 'Invalid username or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{getTitle()}</h3>
        <form onSubmit={submit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (error) setError('');
            }}
            autoFocus
            disabled={isSubmitting}
            style={{ marginBottom: '12px' }}
          />
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
            disabled={isSubmitting}
          />
          {error && <div className="error-text">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


