import React, { useEffect, useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import Router from './Router';
import { useLocation } from 'react-router-dom';
import { initializeStorage } from './config/supabaseClient';
import applyContestSchema from './utils/applyContestSchema';
import { validateContestSchema } from './utils/validateContestSchema';
import './App.css';

/**
 * Top-level App component initializes storage and schema, provides Auth context, and renders routes.
 * ContestProvider is now delegated to be injected only around protected (authenticated) routes inside Router.js
 * 
 * The application now initializes only authentication-related features
 * until the user has successfully logged in. While on the login or signup
 * pages, all other API calls (storage, schema, data fetching, etc.) are restricted.
 */
function App() {
  const [canInitApp, setCanInitApp] = useState(false);
  const [schemaChecked, setSchemaChecked] = useState(false);

  // Helper to determine if current path is auth-related route
  function isAuthRoute() {
    const hash = window.location.hash || "";
    return (
      hash.includes("#/login") ||
      hash.includes("#/register") ||
      hash === "" ||
      hash === "#" // before any navigation
    );
  }

  // Checks authentication status from localStorage/session (quick heuristic for earliest block)
  function isProbablyLoggedIn() {
    // Supabase usually stores a session token in localStorage or sessionStorage under "supabase.auth"
    // This is a heuristic; true login is ensured by AuthContext.
    // If you want to use current session from supabase-js client, adjust here.
    try {
      const supabaseSession = localStorage.getItem('supabase.auth.token');
      if (supabaseSession) {
        const s = JSON.parse(supabaseSession);
        // If user or access_token exists, assume authenticated
        return Boolean(s.currentSession?.user || s.currentSession?.access_token);
      }
    } catch {
      // Ignore errors and default to not-logged-in
    }
    return false;
  }

  // Only initialize storage/schema _after_ user is authenticated and not on auth routes
  useEffect(() => {
    // Only allow initialization on non-auth routes and when logged in
    const shouldInit =
      !isAuthRoute() && isProbablyLoggedIn();

    setCanInitApp(shouldInit);

    if (shouldInit) {
      const initializeApp = async () => {
        console.log('Initializing Kavia AI App Contest...');
        // Initialize storage first
        await initializeStorage();

        // Try validating the schema to see if it exists properly
        try {
          const validationResults = await validateContestSchema();
          console.log('Schema validation results:', validationResults);

          if (validationResults.success) {
            console.log('Contest schema is valid, proceeding with initialization');
          }
        } catch (validationError) {
          console.error('Error validating schema:', validationError);
        }

        // Always try to apply schema (this handles the case where it doesn't exist)
        await applyContestSchema();

        setSchemaChecked(true);
        console.log('App initialization complete');
      };

      initializeApp();
    } else {
      setSchemaChecked(false);
    }
  }, [window.location.hash]);

  // Show loading only when attempting initialization and not completed
  if (canInitApp && !schemaChecked) {
    return (
      <div className="loading-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <div>Initializing application...</div>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      {/* ContestProvider must only be present in authenticated routes! */}
      <Router />
    </AuthProvider>
  );
}

export default App;
