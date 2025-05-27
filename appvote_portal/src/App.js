import React, { useEffect, useState, useRef } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ContestProvider } from './contexts/ContestContext';
import Router from './Router';
import './App.css';

// PUBLIC_INTERFACE
/**
 * Main application component.
 * Now ContestProvider (and all contest context state/fetching) wraps the entire Router/App,
 * ensuring that all contest-related context logic re-initializes and runs its effects on every refresh.
 * Any effect in ContestProvider using useEffect with [] or [user] as deps will re-trigger on mount/refresh.
 */
function App() {
  return (
    <AuthProvider>
      <ContestProvider>
        <Router />
      </ContestProvider>
    </AuthProvider>
  );
}

export default App;
