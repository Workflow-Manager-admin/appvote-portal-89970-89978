import React, { useEffect, useState } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ContestProvider } from './contexts/ContestContext';
import Router from './Router';
import { initializeStorage } from './config/supabaseClient';
import applyContestSchema from './utils/applyContestSchema';
import { validateContestSchema } from './utils/validateContestSchema';
import './App.css';

function App() {
  const [schemaChecked, setSchemaChecked] = useState(false);

  // Initialize Supabase storage buckets and contest schema when the app starts
  useEffect(() => {
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
  }, []);

  if (!schemaChecked) {
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
      <ContestProvider>
        <Router />
      </ContestProvider>
    </AuthProvider>
  );
}

export default App;
