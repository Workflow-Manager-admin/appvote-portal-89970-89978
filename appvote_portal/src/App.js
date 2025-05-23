import React, { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ContestProvider } from './contexts/ContestContext';
import Router from './Router';
import { initializeStorage } from './config/supabaseClient';
import applyContestSchema from './utils/applyContestSchema';
import './App.css';

function App() {
  // Initialize Supabase storage buckets and contest schema when the app starts
  useEffect(() => {
    initializeStorage();
    applyContestSchema();
  }, []);

  return (
    <AuthProvider>
      <ContestProvider>
        <Router />
      </ContestProvider>
    </AuthProvider>
  );
}

export default App;
