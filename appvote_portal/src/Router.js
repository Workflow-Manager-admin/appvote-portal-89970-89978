import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import AddApp from './pages/AddApp';
import AdminDashboard from './pages/AdminDashboard';
import DebugPage from './pages/DebugPage';

const Router = () => {
  const { user, loading, isAdmin, userRole } = useAuth();

  // Protected route component - only shows loading state on initial auth check, not during navigation
  const ProtectedRoute = ({ children }) => {
    // Initial auth check is still needed to prevent flashes of protected content
    if (loading && !user) {
      return (
        <div className="loading-container">
          <div className="loading">Loading your session...</div>
        </div>
      );
    }
    if (!user) return <Navigate to="/login" />;
    return children;
  };

  // Admin route component - only shows loading state on initial auth check
  const AdminRoute = ({ children }) => {
    // Only show loading if we don't know if the user is an admin yet
    if (loading && (!user || userRole === null)) {
      return (
        <div className="loading-container">
          <div className="loading">Loading your session...</div>
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
          <Route path="/debug" element={
            <ProtectedRoute>
              <DebugPage />
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
