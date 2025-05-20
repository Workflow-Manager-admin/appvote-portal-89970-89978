import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import { ToastContainer } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import 'react-toastify/dist/ReactToastify.css';

const Layout = () => {
  const { loading, user } = useAuth();

  // Only show loading indicator when we don't know if user is authenticated yet
  // This prevents showing loading screen during regular navigation
  if (loading && user === null) {
    return (
      <div className="loading-container">
        <div className="loading">Loading your session...</div>
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
