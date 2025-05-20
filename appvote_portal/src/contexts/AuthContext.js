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
  
  // Use useRef instead of a dependency to avoid infinite loop
  const previousUserRef = useRef(null);

  useEffect(() => {
    // Track if component is mounted to prevent state updates after unmount
    let isMounted = true;
    
    // Get initial session only once at mount
    const getInitialSession = async () => {
      try {
        console.log('Getting initial auth session...');
        setLoading(true); // Ensure loading is true at the start
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error.message);
          if (isMounted) setLoading(false);
          return;
        }
        
        console.log('Session retrieved:', session ? 'Session exists' : 'No session found');
        
        if (session && isMounted) {
          console.log('User found in session:', session.user.email);
          setUser(session.user);
          // Fetch user role from the database and explicitly wait for it to complete
          await fetchUserRole(session.user.id);
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error.message);
      } finally {
        // Only update state if component is still mounted
        if (isMounted) setLoading(false);
        console.log('Initial auth loading completed:', isMounted);
      }
    };

    getInitialSession();
    
    // Set up auth change listener - only respond to meaningful auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session ? 'Session exists' : 'No session');
        
        // Only set loading true for specific auth events that require state changes
        const shouldSetLoading = ['SIGNED_IN', 'SIGNED_OUT', 'USER_UPDATED', 'TOKEN_REFRESHED'].includes(event);
        
        if (shouldSetLoading && isMounted) {
          setLoading(true);
        }
        
        if (session && isMounted) {
          // Don't refetch user data if it's just a token refresh with the same user
          const isUserChange = !previousUserRef.current || previousUserRef.current.id !== session.user.id;
          previousUserRef.current = session.user;
          
          console.log('User authenticated:', session.user.email);
          setUser(session.user);
          
          // Only fetch user role when the user actually changes
          if (isUserChange) {
            try {
              // Maintain loading state until role is fetched
              const roleLoaded = await fetchUserRole(session.user.id);
              console.log('User role loaded:', roleLoaded ? 'Success' : 'Failed');
            } catch (error) {
              console.error('Error fetching user role during auth change:', error);
            } finally {
              // Now we can safely turn off loading after role fetch attempt completes
              if (shouldSetLoading && isMounted) {
                setLoading(false);
              }
            }
          } else {
            // If we don't need to fetch the role, turn off loading immediately
            if (shouldSetLoading && isMounted) {
              setLoading(false);
            }
          }
        } else if (isMounted) {
          console.log('User signed out or session expired');
          setUser(null);
          setUserRole(null);
          
          // Turn off loading state for sign out
          if (shouldSetLoading && isMounted) {
            setLoading(false);
          }
        }
      }
    );
    
    return () => {
      isMounted = false;
      subscription?.unsubscribe();
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
