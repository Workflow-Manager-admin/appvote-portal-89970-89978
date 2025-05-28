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
 * Main app router.
 * Handles protected routing and implements post-login contest page redirect logic.
 */
const Router = () => {
  const { user, loading, isAdmin, userRole } = useAuth();
  const { isReady: contestReady, currentWeek } = useContest();
  const navigate = useNavigate ? useNavigate() : null; // In component scope, will be re-used

  // Track whether the user session was just established via login (not reload)
  const wasLoggedIn = useRef(!!user); // Save initial state on first mount
  const hasRedirected = useRef(false);

  // Detect true post-login (not reload) and redirect once Auth and Contest context are ready
  useEffect(() => {
    // Only proceed if both contexts are ready and user is present
    if (!user || loading || !contestReady) return;
    // If already redirected this login, do nothing
    if (hasRedirected.current) return;

    // Only trigger when 'wasLoggedIn' is false and 'user' is now truthy and not reloading
    if (!wasLoggedIn.current && user) {
      // If there is an active contest week, redirect to its page;
      // Assume contest route is `/contest/${currentWeek.id}` (adjust as needed)
      if (currentWeek && currentWeek.id) {
        navigate(`/contest/${currentWeek.id}`, { replace: true });
        hasRedirected.current = true;
      } else {
        // No active contest week, route to home
        navigate('/', { replace: true });
        hasRedirected.current = true;
      }
    }
    // Update login tracker for next run
    if (user) wasLoggedIn.current = true;
    else wasLoggedIn.current = false;
  }, [user, loading, contestReady, currentWeek, navigate]);

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
