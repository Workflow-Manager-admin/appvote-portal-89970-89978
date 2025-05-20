import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import supabase, { getImageUrl } from '../config/supabaseClient';

const Home = () => {
  const { user, isAdmin } = useAuth();
  const [apps, setApps] = useState([]);
  const [userVotes, setUserVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  // Removed unused userProfile state

  // Define the fetch functions with useCallback to avoid recreation on each render
  const fetchUserVotes = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('votes')
        .select('app_id')
        .eq('user_id', user.id);

      if (error) throw error;
      setUserVotes(data?.map(vote => vote.app_id) || []);
    } catch (error) {
      console.error('Error fetching user votes:', error.message);
    }
  }, [user]);

  const fetchUserProfile = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      // Profile data not used in component
    } catch (error) {
      console.error('Error fetching user profile:', error.message);
    }
  }, [user]);

  const fetchApps = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('apps')
        .select(`
          id, 
          name, 
          link, 
          image_url, 
          created_at,
          user_id,
          profiles:user_id (username, registration_number)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApps(data || []);
    } catch (error) {
      console.error('Error fetching apps:', error.message);
      toast.error('Failed to load apps');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApps();
    fetchUserVotes();
    fetchUserProfile();
  }, [fetchApps, fetchUserVotes, fetchUserProfile]);

  const handleVote = async (appId) => {
    if (!user) {
      toast.error('You must be logged in to vote');
      return;
    }

    // Check if user has already voted for this app
    if (userVotes.includes(appId)) {
      try {
        // Remove vote
        const { error } = await supabase
          .from('votes')
          .delete()
          .eq('user_id', user.id)
          .eq('app_id', appId);

        if (error) throw error;

        // Update local state
        setUserVotes(userVotes.filter(id => id !== appId));
        toast.success('Vote removed');
        
        // Update the app list to reflect vote changes
        fetchApps();
      } catch (error) {
        console.error('Error removing vote:', error.message);
        toast.error('Failed to remove vote');
      }
    } else {
      // Check if user has already used all 5 votes
      if (userVotes.length >= 5) {
        toast.error('You can only vote for up to 5 apps. Remove a vote to add a new one.');
        return;
      }

      try {
        // Add vote
        const { error } = await supabase
          .from('votes')
          .insert([{ user_id: user.id, app_id: appId }]);

        if (error) throw error;

        // Update local state
        setUserVotes([...userVotes, appId]);
        toast.success('Vote added');
        
        // Update the app list to reflect vote changes
        fetchApps();
      } catch (error) {
        console.error('Error adding vote:', error.message);
        toast.error('Failed to add vote');
      }
    }
  };

  // Check if an app belongs to the current user
  const isOwnApp = (appUserId) => {
    return user?.id === appUserId;
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading apps...</div>
      </div>
    );
  }

  return (
    <div className="container home-page">
      <h1 className="page-title">App Showcase</h1>
      <p className="page-description">
        Discover and vote for your favorite apps. You can vote for up to 5 apps.
        <span className="votes-count">
          {` (${userVotes.length}/5 votes used)`}
        </span>
      </p>

      {apps.length === 0 ? (
        <div className="no-apps-message">
          <p>No apps have been submitted yet.</p>
          <p>Be the first to <a href="/add-app">add your app</a>!</p>
        </div>
      ) : (
        <div className="app-grid">
          {apps.map((app) => (
            <div className="app-card" key={app.id}>
              <div className="app-card-image">
                {app.image_url ? (
                  <img 
                    src={app.image_url.includes('supabase.co/storage') ? 
                      // If it's a Supabase URL, use our helper for possible path fixes
                      getImageUrl('app_images', app.image_url.split('/').slice(-2).join('/')) || app.image_url : 
                      // Otherwise use the URL as-is
                      app.image_url
                    } 
                    alt={app.name} 
                    onError={(e) => {
                      console.error(`Image load error for ${app.name}:`, e);
                      e.target.onerror = null;
                      
                      // Try direct URL as fallback if we modified it
                      if (e.target.src !== app.image_url) {
                        console.log('Trying original URL as fallback:', app.image_url);
                        e.target.src = app.image_url;
                        return;
                      }
                      
                      // If that fails too, try placeholder
                      try {
                        e.target.src = '/placeholder-app.png';
                      } catch (placeholderError) {
                        // If that fails, use an inline placeholder with app name
                        console.log('Using inline placeholder for:', app.name);
                        const parent = e.target.parentNode;
                        if (parent) {
                          // Remove the img and add a placeholder div
                          e.target.remove();
                          const placeholderDiv = document.createElement('div');
                          placeholderDiv.className = 'placeholder-image';
                          placeholderDiv.textContent = `${app.name} (No Image)`;
                          parent.appendChild(placeholderDiv);
                        }
                      }
                    }}
                  />
                ) : (
                  <div className="placeholder-image">No Image</div>
                )}
              </div>
              
              <div className="app-card-content">
                <h3 className="app-name">{app.name}</h3>
                
                {/* Only show username for admin or if it's the user's own app */}
                {(isAdmin() || isOwnApp(app.user_id)) && (
                  <p className="app-submitter">
                    Submitted by: {app.profiles?.username || 'Unknown'}
                    {app.profiles?.registration_number && ` (${app.profiles.registration_number})`}
                  </p>
                )}
                
                <a 
                  href={app.link} 
                  className="app-link" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  Visit App
                </a>
                
                {/* Don't allow voting for own apps */}
                {!isOwnApp(app.user_id) && (
                  <button
                    className={`vote-button ${userVotes.includes(app.id) ? 'voted' : ''}`}
                    onClick={() => handleVote(app.id)}
                    disabled={userVotes.length >= 5 && !userVotes.includes(app.id)}
                  >
                    {userVotes.includes(app.id) ? '✓ Voted' : 'Vote'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
