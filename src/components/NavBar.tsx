import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import PasswordModal from './PasswordModal';
import logoImage from '../assets/Kwiksilver Laundry house Logo.png';

// Helper function to get initial theme from localStorage or system preference
const getInitialTheme = (): boolean => {
  if (typeof window === 'undefined') return false;
  const storedTheme = window.localStorage.getItem('kwik-theme');
  if (storedTheme) {
    return storedTheme === 'dark';
  }
  // Only use system preference if no stored preference exists
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  // Store the initial preference
  window.localStorage.setItem('kwik-theme', prefersDark ? 'dark' : 'light');
  return prefersDark;
};

export default function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(getInitialTheme);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Apply theme immediately on mount (before React hydration)
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const initialTheme = getInitialTheme();
    root.classList.toggle('dark-mode', initialTheme);
    root.style.setProperty('color-scheme', initialTheme ? 'dark' : 'light');
    setIsDarkMode(initialTheme);
  }, []);

  // Update theme when isDarkMode changes
  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    root.classList.toggle('dark-mode', isDarkMode);
    root.style.setProperty('color-scheme', isDarkMode ? 'dark' : 'light');

    // Always save to localStorage when theme changes
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('kwik-theme', isDarkMode ? 'dark' : 'light');
    }
  }, [isDarkMode]);

  const onAdminClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const authed = localStorage.getItem('adminAuthed') === 'true';
    if (authed) {
      navigate('/admin');
    } else {
      setShowModal(true);
    }
  };

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const handleLinkClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="nav-content">
        <Link to="/" className="brand">
          <img src={logoImage} alt="Kwiksilver Laundry" className="brand-logo" />
          <span>Kwiksilver Laundry</span>
        </Link>
        <div className="nav-right">
          <button
            type="button"
            className={`nav-theme-toggle nav-theme-toggle-mobile ${isDarkMode ? 'active' : ''}`}
            onClick={toggleTheme}
            aria-label="Toggle night mode"
            aria-pressed={isDarkMode}
            title="Toggle night mode"
          >
            <span className="sr-only">Toggle night mode</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>
          <button
            type="button"
            className="hamburger-menu"
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {isMobileMenuOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </>
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </>
              )}
            </svg>
          </button>
        </div>
        <div className={`nav-links ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
          <button
            type="button"
            className={`nav-theme-toggle nav-theme-toggle-desktop ${isDarkMode ? 'active' : ''}`}
            onClick={toggleTheme}
            aria-label="Toggle night mode"
            aria-pressed={isDarkMode}
            title="Toggle night mode"
          >
            <span className="sr-only">Toggle night mode</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </button>
          <Link to="/" className={location.pathname === '/' ? 'active' : ''} onClick={handleLinkClick}>Search</Link>
          <a href="/admin" onClick={(e) => { handleLinkClick(); onAdminClick(e); }} className={location.pathname === '/admin' ? 'active' : ''}>Admin</a>
        </div>
      </div>
      {showModal && <PasswordModal onClose={() => setShowModal(false)} />}
    </nav>
  );
}


