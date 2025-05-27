import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useContest } from '../contexts/ContestContext';
import { toast } from 'react-toastify';
import { useState, useEffect } from 'react';

/**
 * PUBLIC_INTERFACE
 * Navbar component renders the main navigation bar featuring navigation links.
 * The active nav-link is highlighted based on the current route using NavLink from React Router.
 * Menu updates reactively on auth/admin/login/logout due to userRole & loading dependencies.
 */
const Navbar = () => {
  const { user, userRole, loading, logout, isAdmin } = useAuth();
  const { hasValidContestStructure } = useContest();
  const navigate = useNavigate();

  // Force re-render when loading or userRole changes (fixes delayed admin menu)
  const [_, setInstantUpdate] = useState(0);
  useEffect(() => {
    setInstantUpdate((n) => n + 1); // trigger re-render
  }, [userRole, loading]);

  const handleLogout = async () => {
    const { error } = await logout();

    if (error) {
      toast.error('Failed to log out. Please try again.');
    } else {
      navigate('/login');
    }
  };

  return (
    <nav className="navbar">
      <div className="container">
        <div className="navbar-content">
          <NavLink to="/" className="logo">
            <span className="logo-symbol">*</span> Kavia AI App Contest
          </NavLink>
          {user && (
            <div className="nav-links">
              <NavLink
                to="/"
                end
                className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
              >
                Home
              </NavLink>
              <NavLink
                to="/add-app"
                className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
              >
                Add Your App
              </NavLink>
              {hasValidContestStructure && (
                <NavLink
                  to="/contest-winners"
                  className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
                >
                  Contest Winners
                </NavLink>
              )}
              {isAdmin() && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) => 'nav-link admin-link' + (isActive ? ' active' : '')}
                >
                  Admin Dashboard
                </NavLink>
              )}
              <button onClick={handleLogout} className="btn btn-logout">Logout</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
