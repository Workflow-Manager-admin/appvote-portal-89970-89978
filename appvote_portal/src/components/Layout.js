import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { ToastContainer } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import 'react-toastify/dist/ReactToastify.css';

const Layout = () => {
  const { loading, user } = useAuth();

  // Show loading indicator when authentication is in progress
  // This prevents showing loading screen during regular navigation
  if (loading && user === null) {
    return (
      <div className="loading-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <div>Loading your session...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
      <ToastContainer position="bottom-right" autoClose={3000} />
    </div>
  );
};

export default Layout;
