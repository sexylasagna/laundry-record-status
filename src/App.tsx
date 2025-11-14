import { Route, Routes, Navigate } from 'react-router-dom';
import SearchPage from './pages/SearchPage';
import AdminPage from './pages/AdminPage';
import OverridePage from './pages/OverridePage';
import OverrideReportPage from './pages/OverrideReportPage';
import UpdateBackendDataPage from './pages/UpdateBackendDataPage';
import MyDayPage from './pages/MyDayPage';
import NavBar from './components/NavBar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';

function RequireAuth({ children }: { children: JSX.Element }) {
  const authed = typeof window !== 'undefined' && localStorage.getItem('adminAuthed') === 'true';
  if (!authed) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function RequireOverrideAuth({ children }: { children: JSX.Element }) {
  const authed = typeof window !== 'undefined' && localStorage.getItem('overrideAuthed') === 'true';
  if (!authed) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <div className="app-container">
      <NavBar />
      <div className="page-container">
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminPage />
              </RequireAuth>
            }
          />
          <Route
            path="/override"
            element={
              <RequireOverrideAuth>
                <OverridePage />
              </RequireOverrideAuth>
            }
          />
          <Route
            path="/override/report"
            element={
              <RequireOverrideAuth>
                <OverrideReportPage />
              </RequireOverrideAuth>
            }
          />
          <Route
            path="/override/update-backend-data"
            element={
              <RequireOverrideAuth>
                <UpdateBackendDataPage />
              </RequireOverrideAuth>
            }
          />
          <Route
            path="/myday"
            element={
              <RequireAuth>
                <MyDayPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <Footer />
        <ScrollToTop />
      </div>
    );
  }


