import { Route, Routes, Navigate } from 'react-router-dom';
import SearchPage from './pages/SearchPage';
import AdminPage from './pages/AdminPage';
import OverridePage from './pages/OverridePage';
import OverrideReportPage from './pages/OverrideReportPage';
import UpdateBackendDataPage from './pages/UpdateBackendDataPage';
import AddEditEmployeePage from './pages/AddEditEmployeePage';
import MyDayPage from './pages/MyDayPage';
import PortalPage from './pages/PortalPage';
import QuickNotesPage from './pages/QuickNotesPage';
import TemporaryPayslipPage from './pages/TemporaryPayslipPage';
import CalloutBoardPage from './pages/CalloutBoardPage';
import NavBar from './components/NavBar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthed } = useAdminAuth();
  if (!isAuthed) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function RequireOverrideAuth({ children }: { children: JSX.Element }) {
  const { isAuthed, user } = useAdminAuth();
  const isOverrideAllowed = isAuthed && user?.isAdmin;
  if (!isOverrideAllowed) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AdminAuthProvider>
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
              path="/override/add-edit-employee"
              element={
                <RequireOverrideAuth>
                  <AddEditEmployeePage />
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
            <Route
              path="/portal"
              element={
                <RequireAuth>
                  <PortalPage />
                </RequireAuth>
              }
            />
            <Route
              path="/portal/quick-notes"
              element={
                <RequireAuth>
                  <QuickNotesPage />
                </RequireAuth>
              }
            />
            <Route
              path="/portal/temporary-payslip"
              element={
                <RequireAuth>
                  <TemporaryPayslipPage />
                </RequireAuth>
              }
            />
            <Route
              path="/portal/callout-board"
              element={
                <RequireAuth>
                  <CalloutBoardPage />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <Footer />
        <ScrollToTop />
      </div>
    </AdminAuthProvider>
  );
}


