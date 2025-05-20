import { createContext, useContext, useState, useEffect } from 'react';
import supabase from '../config/supabaseClient';

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

  useEffect(() => {
    // Track if component is mounted to prevent state updates after unmount
    let isMounted = true;
    
    // Get initial session only once at mount
    const getInitialSession = async () => {
      try {
        console.log('Getting initial auth session...');
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
          // Fetch user role from the database
          await fetchUserRole(session.user.id);
        }
      } catch (error) {
        console.error('Error in getInitialSession:', error.message);
      } finally {
        // Only update state if component is still mounted
        if (isMounted) setLoading(false);
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
          const isUserChange = !user || user.id !== session.user.id;
          
          console.log('User authenticated:', session.user.email);
          setUser(session.user);
          
          // Only fetch user role when the user actually changes
          if (isUserChange) {
            await fetchUserRole(session.user.id);
          }
        } else if (isMounted) {
          console.log('User signed out or session expired');
          setUser(null);
          setUserRole(null);
        }
        
        // Always reset loading state if we set it earlier
        if (shouldSetLoading && isMounted) {
          setLoading(false);
        }
      }
    );
    
    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);
  
  // Fetch user role from profiles table
  const fetchUserRole = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      
      if (error) {
        console.error('Error fetching user role:', error.message);
        return false;
      } else if (data) {
        setUserRole(data.role);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error in fetchUserRole:', error.message);
      return false;
    }
  };
  
  // Register a new user with email and password
  const register = async (email, password, username, registrationNumber = null) => {
    try {
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
      
      setLoading(true); // Set loading to true at the start of login
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password
      });
      
      if (!error && data?.user) {
        // Set user immediately to trigger any UI updates
        setUser(data.user);
        // Fetch user role asynchronously
        await fetchUserRole(data.user.id);
      }
      
      return { data, error };
    } catch (error) {
      console.error('Error in login:', error.message);
      return { data: null, error };
    } finally {
      // Ensure loading is always set to false at the end
      setLoading(false);
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
