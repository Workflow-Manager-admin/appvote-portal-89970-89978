import React, { useEffect, useState, useContext } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ContestProvider } from './contexts/ContestContext';
import Router from './Router';
import { initializeStorage } from './config/supabaseClient';
import applyContestSchema from './utils/applyContestSchema';
import { validateContestSchema } from './utils/validateContestSchema';
import './App.css';

// We need to defer pre-initialization logic (e.g., storage, schema setup) until user is authenticated.
// So we lift this logic into a new component that runs after auth.

function DeferredInitialization({ children }) {
  const { user, loading } = require('./contexts/AuthContext').useAuth();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      // Only initialize when there is a user and initialization hasn't happened yet
      if (user && !initialized) {
        console.log('Initializing Kavia AI App Contest (after auth)...');
        // Initialize storage first
        await initializeStorage();

        try {
          const validationResults = await validateContestSchema();
          console.log('Schema validation results:', validationResults);
          if (validationResults.success) {
            console.log('Contest schema is valid, proceeding with initialization');
          }
        } catch (validationError) {
          console.error('Error validating schema:', validationError);
        }

        // Always try to apply schema (this handles the case where it doesn\'t exist)
        await applyContestSchema();

        setInitialized(true);
        console.log('App initialization complete');
      }
    };
    if (user && !initialized) {
      initializeApp();
    }
    // eslint-disable-next-line
  }, [user, initialized]);

  if (loading) {
    // Auth state is still loading, show blank loading spinner
    return (
      <div className="loading-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <div>Loading user authentication...</div>
        </div>
      </div>
    );
  }

  // If user is logged in but initialization isn't finished, show spinner
  if (user && !initialized) {
    return (
      <div className="loading-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <div>Initializing application...</div>
        </div>
      </div>
    );
  }

  // If not authenticated, skip initialization and just render children (login/signup routes)
  if (!user) {
    return children;
  }

  // User is authenticated & initialized, render application
  return children;
}


function App() {
  return (
    <AuthProvider>
      <DeferredInitialization>
        <ContestProvider>
          <Router />
        </ContestProvider>
      </DeferredInitialization>
    </AuthProvider>
  );
}

export default App;
