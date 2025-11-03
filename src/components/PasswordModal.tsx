import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  
  const getExpectedPassword = () => {
    if (passwordType === 'override') {
      return (import.meta.env.VITE_OVERRIDE_PASSWORD as string) || 'override123';
    }
    return (import.meta.env.VITE_ADMIN_PASSWORD as string) || 'kwikadmin2';
  };
  
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
    return 'adminAuthed';
  };
  
  const expected = getExpectedPassword();

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
    if (password === expected) {
      localStorage.setItem(getStorageKey(), 'true');
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
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <div className="error-text">{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn primary">Continue</button>
          </div>
        </form>
      </div>
    </div>
  );
}


