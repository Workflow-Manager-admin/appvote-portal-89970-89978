import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { useContest } from './contexts/ContestContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import AddApp from './pages/AddApp';
import AdminDashboard from './pages/AdminDashboard';
import ContestWinners from './pages/ContestWinners';
import DebugPage from './pages/DebugPage';
import { useEffect, useRef } from 'react';

/**
 * Component responsible for redirecting the user after first-time login, once all contexts are ready.
 */
function RouterRedirector() {
  const { user, loading, isReady: authReady } = useAuth();
  const { isReady: contestReady, currentWeek } = useContest();
  const navigate = useNavigate();

  const wasLoggedIn = useRef(!!user);
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only proceed if both contexts are ready and user is present
    if (!authReady || !contestReady) return;
    if (!user || loading) return;
    if (hasRedirected.current) return;
    if (!wasLoggedIn.current && user) {
      if (currentWeek && currentWeek.id) {
        navigate(`/contest/${currentWeek.id}`, { replace: true });
        hasRedirected.current = true;
      } else {
        navigate('/', { replace: true });
        hasRedirected.current = true;
      }
    }
    wasLoggedIn.current = !!user;
  }, [user, loading, authReady, contestReady, currentWeek, navigate]);

  return null; // This component does not render anything
}

/**
 * Main app router.
 * Handles protected routing and implements post-login contest page redirect logic via RouterRedirector.
 */
const Router = () => {
  const { user, loading, isAdmin, userRole } = useAuth();

  // Protected route component - only shows loading state on initial auth check, not during navigation
  const ProtectedRoute = ({ children }) => {
    if (loading && !user) {
      return (
        <div className="loading-container">
          <div className="loading">
            <div className="loading-spinner"></div>
            <div>Loading your session...</div>
          </div>
        </div>
      );
    }
    if (!user) return <Navigate to="/login" />;
    return children;
  };

  // Admin route component - only shows loading state on initial auth check
  const AdminRoute = ({ children }) => {
    if (loading && (!user || userRole === null)) {
      return (
        <div className="loading-container">
          <div className="loading">
            <div className="loading-spinner"></div>
            <div>Loading your session...</div>
          </div>
        </div>
      );
    }
    if (!user) return <Navigate to="/login" />;
    if (!userRole || !isAdmin()) return <Navigate to="/" />;
    return children;
  };

  return (
    <BrowserRouter>
      <RouterRedirector />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route path="/" element={<Layout />}>
          <Route index element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } />
          <Route path="/add-app" element={
            <ProtectedRoute>
              <AddApp />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          } />
          <Route path="/contest-winners" element={
            <ProtectedRoute>
              <ContestWinners />
            </ProtectedRoute>
          } />
          <Route path="/debug" element={
            <ProtectedRoute>
              <DebugPage />
            </ProtectedRoute>
          } />
          {/* Inferred contest week route for redirect */}
          <Route path="/contest/:weekId" element={
            <ProtectedRoute>
              {/* Ideally an imported ContestPage component */}
              <Home /> 
            </ProtectedRoute>
          } />
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default Router;
