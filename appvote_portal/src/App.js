import React, { useEffect, useState, useRef } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ContestProvider } from './contexts/ContestContext';
import Router from './Router';
import { initializeStorage } from './config/supabaseClient';
import applyContestSchema from './utils/applyContestSchema';
import { validateContestSchema } from './utils/validateContestSchema';
import './App.css';

// PUBLIC_INTERFACE
/**
 * DeferredInitialization handles application pre-initialization logic (storage & schema) that must run
 * only after user authentication is complete/restored. Spinner is strictly tied to the completion of
 * session restoration and initialization, so perpetual loading is avoided.
 */
function DeferredInitialization({ children }) {
  const { user, loading } = require('./contexts/AuthContext').useAuth();
  const [initState, setInitState] = useState({ started: false, done: false, error: null });
  const initStartedRef = useRef(false);

  useEffect(() => {
    // Ensure initialization is attempted only ONCE per authenticated session
    if (user && !initState.done && !initStartedRef.current) {
      initStartedRef.current = true;
      (async () => {
        try {
          await initializeStorage();
          try {
            const validationResults = await validateContestSchema();
            if (validationResults.success) {
              console.log('Contest schema valid, proceeding...');
            }
          } catch (e) {
            console.error('Schema validation error:', e);
          }
          await applyContestSchema();
          setInitState({ started: true, done: true, error: null });
          console.log('App initialization complete');
        } catch (err) {
          setInitState({ started: true, done: false, error: err });
          console.error('App initialization failed:', err);
        }
      })();
    }
    // If user logs out or session ends, reset initialization state
    if (!user && (initStartedRef.current || initState.done)) {
      setInitState({ started: false, done: false, error: null });
      initStartedRef.current = false;
    }
    // eslint-disable-next-line
  }, [user, initState.done]);

  // Strict spinner: only block UI (show spinner) while restoring from auth or while initializing after login
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <div>Loading user session...</div>
        </div>
      </div>
    );
  }

  // Show spinner only if authenticated, and initialization is required
  if (user && !initState.done) {
    return (
      <div className="loading-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <div>Initializing application...</div>
        </div>
      </div>
    );
  }

  // If initialization error occurs, show error explicitly (can be expanded with retry)
  if (initState.error) {
    return (
      <div className="loading-container">
        <div className="loading error">
          <div className="loading-spinner"></div>
          <div>
            <strong>Error during initialization:</strong><br/>
            {String(initState.error)}
          </div>
        </div>
      </div>
    );
  }

  // Unauthenticated: render all children (e.g. login/signup routes)
  // Authenticated & initialized: render children (e.g. routers)
  return children;
}

// PUBLIC_INTERFACE
/**
 * Main application component. Wraps router and context providers, robustly handling
 * authentication/session restoration and spinner display.
 */
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
