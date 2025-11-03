import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import PasswordModal from './PasswordModal';
import logoImage from '../assets/Kwiksilver Laundry house Logo.png';

export default function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const onAdminClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const authed = localStorage.getItem('adminAuthed') === 'true';
    if (authed) {
      navigate('/admin');
    } else {
      setShowModal(true);
    }
  };

  return (
    <nav className="navbar">
      <div className="nav-content">
        <Link to="/" className="brand">
          <img src={logoImage} alt="Kwiksilver Laundry" className="brand-logo" />
          <span>Kwiksilver Laundry</span>
        </Link>
        <div className="nav-links">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Search</Link>
          <a href="/admin" onClick={onAdminClick} className={location.pathname === '/admin' ? 'active' : ''}>Admin</a>
        </div>
      </div>
      {showModal && <PasswordModal onClose={() => setShowModal(false)} />}
    </nav>
  );
}


