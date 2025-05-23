import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useContest } from '../contexts/ContestContext';
import { toast } from 'react-toastify';

const Navbar = () => {
  const { user, logout, isAdmin } = useAuth();
  const { hasValidContestStructure } = useContest();
  const navigate = useNavigate();

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
          <Link to="/" className="logo">
            <span className="logo-symbol">*</span> AppVote Portal
          </Link>
          
          {user && (
            <div className="nav-links">
              <Link to="/" className="nav-link">Home</Link>
              <Link to="/add-app" className="nav-link">Add Your App</Link>
              {hasValidContestStructure && (
                <Link to="/contest-winners" className="nav-link">Contest Winners</Link>
              )}
              {isAdmin() && (
                <Link to="/admin" className="nav-link admin-link">Admin Dashboard</Link>
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
