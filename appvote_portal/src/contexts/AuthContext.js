import { createContext, useContext, useState, useEffect, useRef } from 'react';
import supabase from '../config/supabaseClient';

/**
 * Authentication context for managing user sessions throughout the app.
 * Features:
 * - User authentication with Supabase
 * - Session persistence and management
 * - Automatic logout of existing sessions when attempting new sign-ins
 * - Role-based access control
 */
const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

// PUBLIC_INTERFACE
export function AuthProvider({ children }) {
  /**
   * Authentication provider that manages user sessions and provides auth methods throughout the app.
   */
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  // Marks whether initial session restoration completes (true = restoration attempted & ended, even if null user)
  const [authReady, setAuthReady] = useState(false);

  // Use useRef instead of a dependency to avoid infinite loop
  const previousUserRef = useRef(null);

  useEffect(() => {
    /**
     * Ensure session restoration is robust:
     * - Always unwinds loading regardless of outcome or error.
     * - Defensively ends loading even if Supabase breaks or session is lost.
     * - Only blocks with loading spinner for true indeterminate initial load, never on recoverable/null session.
     *
     * Failsafe: If for ANY REASON loading hangs, forcibly clear loading after 7 seconds.
     */
    let isMounted = true;
    let failsafeTimeout = null;

    const clearLoadingFailsafe = () => {
      // Defensive timeout to clear loading in case of all possible failures
      if (isMounted) setLoading(false);
    };

    const getInitialSession = async () => {
      setLoading(true); // always block at start
      setAuthReady(false);

      // Start failsafe: forcibly clear loading in case of deadlock
      failsafeTimeout = setTimeout(clearLoadingFailsafe, 7000);

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Error getting session:", error.message);
        }
        if (isMounted) {
          if (session && session.user) {
            setUser(session.user);
            // Don't await role loading here—UI should unblock on user state, not role
            fetchUserRole(session.user.id);
          } else {
            setUser(null);
            setUserRole(null);
          }
        }
      } catch (error) {
        console.error("Error in getInitialSession:", error.message);
        if (isMounted) {
          setUser(null);
          setUserRole(null);
        }
      } finally {
        // ALWAYS clear loading, no matter what
        if (isMounted) setLoading(false);
        if (isMounted) setAuthReady(true);
        if (failsafeTimeout) clearTimeout(failsafeTimeout);
      }
    };

    getInitialSession();

    // Auth state listener – ALL SUBSEQUENT user transitions (SIGN IN/OUT/REFRESH)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Should only trigger after initial boot OR for actual sign in/out/refresh events
        const shouldSetLoading = ['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'TOKEN_REFRESHED'].includes(event);

        if (shouldSetLoading && isMounted) setLoading(true);
        try {
          if (session && isMounted) {
            // Same user, skip role refetch for silent refresh
            const isUserChange = !previousUserRef.current || previousUserRef.current.id !== session.user.id;
            previousUserRef.current = session.user;
            setUser(session.user);

            if (isUserChange) {
              try {
                await fetchUserRole(session.user.id);
              } catch (err) {
                console.error('Error fetching user role during auth change:', err);
              }
            }
            // Defensive: always clear loading at end
            if (shouldSetLoading && isMounted) setLoading(false);
          } else if (isMounted) {
            setUser(null);
            setUserRole(null);
            if (shouldSetLoading && isMounted) setLoading(false);
          }
        } catch (err) {
          console.error("Auth listener exception:", err);
          if (isMounted) setLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
      if (failsafeTimeout) clearTimeout(failsafeTimeout);
      setAuthReady(false); // indicates this context is no longer initalized; safe for remount
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // We intentionally omit 'user' from dependencies to avoid infinite loop
  // since we update user state inside this effect
  
  // Fetch user role from profiles table
  const fetchUserRole = async (userId) => {
    try {
      console.log('Fetching user role for:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching user role:', error.message);
        // Still consider the operation "complete" even if it failed
        return false;
      } else if (data) {
        console.log('User role fetched successfully:', data.role);
        setUserRole(data.role);
        return true;
      } else {
        console.log('No user role found for ID:', userId);
        // Set a default role if none found
        setUserRole('user');
        return true;
      }
    } catch (error) {
      console.error('Error in fetchUserRole:', error.message);
      // Still consider the operation "complete" even if it failed
      return false;
    }
  };
  
  // Register a new user with email and password
  const register = async (email, password, username, registrationNumber = null) => {
    try {
      // Check if user already has an active session
      if (user) {
        console.log('Active session detected - logging out before registration');
        // Log out the current user before attempting registration
        const { error: logoutError } = await logout();
        
        if (logoutError) {
          console.error('Error logging out existing session before registration:', logoutError.message);
          // Continue with registration attempt even if logout fails
        } else {
          console.log('Successfully logged out existing session before registration');
        }
      }
      
      // Check if the email includes '+1' for email alias
      const emailToUse = email.includes('+1') ? email : email;
      
      // Register the user with autoConfirm=true to immediately confirm the account
      const { data, error } = await supabase.auth.signUp({
        email: emailToUse,
        password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      
      if (error) {
        throw error;
      }
      
      if (data?.user) {
        // Create a user profile with the provided username and registration number
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: data.user.id,
              username,
              registration_number: registrationNumber,
              role: 'user' // Default role for new users
            }
          ]);
          
        if (profileError) {
          throw profileError;
        }
        
        // Automatically sign in the user after successful registration
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: emailToUse,
          password
        });
        
        if (signInError) {
          console.error('Auto-login after registration failed:', signInError.message);
        }
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Error in register:', error.message);
      return { data: null, error };
    }
  };
  
  // Log in with email and password
  const login = async (email, password) => {
    try {
      // Support email alias with +1
      const emailToUse = email.includes('+1') ? email : email;
      
      // Check if user already has an active session
      if (user) {
        console.log('Active session detected - logging out before new sign in');
        // Log out the current user before attempting new login
        const { error: logoutError } = await logout();
        
        if (logoutError) {
          console.error('Error logging out existing session:', logoutError.message);
          // Continue with login attempt even if logout fails
        } else {
          console.log('Successfully logged out existing session');
        }
      }
      
      setLoading(true); // Set loading to true at the start of login
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password
      });
      
      // The onAuthStateChange listener will handle loading state and setting user data
      // for successful logins, so we don't need to duplicate that logic here
      
      if (error) {
        // Only need to reset loading state on error since auth listener won't fire
        setLoading(false);
      }
      
      return { data, error };
    } catch (error) {
      console.error('Error in login:', error.message);
      setLoading(false); // Ensure loading is turned off on exception
      return { data: null, error };
    }
  };
  
  // Log out
  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      return { error: null };
    } catch (error) {
      console.error('Error in logout:', error.message);
      return { error };
    }
  };
  
  const isAdmin = () => {
    return userRole === 'admin';
  };
  
  const value = {
    user,
    loading,
    authReady,
    register,
    login,
    logout,
    isAdmin,
    userRole
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
