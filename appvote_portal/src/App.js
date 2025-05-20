import React, { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import Router from './Router';
import { initializeStorage } from './config/supabaseClient';
import './App.css';

function App() {
  // Initialize Supabase storage buckets when the app starts
  useEffect(() => {
    initializeStorage();
  }, []);

  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}

export default App;
