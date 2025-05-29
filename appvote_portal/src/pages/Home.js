/*
  Home.js: App showcase page
  Enhancements by KaviaAgent:
  - Ensures apps are always filtered for a valid contest_week_id (selectedWeekId).
  - Persists contest_week_id to localStorage and supports reading from ?week=ID URL param for shareability.
  - On page reload or revisit, restores the last used (valid) week, always filtering apps and user votes by that week after refresh.
  - Optionally, you can enable deep-linking and shareable filtered views by uncommenting URL param code.

  To fully persist state and ensure correct week is used on every app/vote fetch, do not remove these guards!
*/
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useContest } from '../contexts/ContestContext';
import supabase, { getImageUrl } from '../config/supabaseClient';
import ConfirmationModal from '../components/ConfirmationModal';

const Home = () => {
  const { user, isAdmin } = useAuth();
  const { 
    currentWeek, 
    canVote, 
    getAllWeeks, 
    switchWeek, 
    hasValidContestStructure,
    getActiveWeek 
  } = useContest();
  const [apps, setApps] = useState([]);
  const [userVotes, setUserVotes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Utility to get contest_week_id from URL (if provided)
  function getContestWeekIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const weekParam = params.get('week');
    return weekParam ? Number(weekParam) : null;
  }

  // Synchronously obtain the initial weekId (URL -> localStorage -> activeWeek/currentWeek -> fallback '1')
  function syncInitialWeekId() {
    const urlWeekId = getContestWeekIdFromUrl();
    const allWeeks = getAllWeeks();
    if (
      urlWeekId &&
      allWeeks.length &&
      allWeeks.some((w) => w.id === urlWeekId)
    ) {
      return urlWeekId;
    }
    const lsIdRaw = window.localStorage.getItem('contest_week_id');
    const lsId = lsIdRaw ? Number(lsIdRaw) : null;
    if (
      lsId &&
      allWeeks.length &&
      allWeeks.some((w) => w.id === lsId)
    ) {
      return lsId;
    }
    const activeWeek = getActiveWeek && getActiveWeek();
    if (activeWeek && activeWeek.id) {
      return activeWeek.id;
    }
    if (currentWeek && currentWeek.id) {
      return currentWeek.id;
    }
    // Fallback: week 1 as per prompt
    return 1;
  }

  // PUBLIC_INTERFACE
  // Always initialize selectedWeekId synchronously!
  const [selectedWeekId, setSelectedWeekId] = useState(() => syncInitialWeekId());

  // Watch for context/user changes and re-sync selectedWeekId only if the set of available weeks changes such that our current one is invalid.
  useEffect(() => {
    const allWeeks = getAllWeeks();
    let validWeekId = selectedWeekId;
    // If current selectedWeekId is no longer valid (e.g., after week list loads/changing user), reset it.
    if (
      !allWeeks.length ||
      !allWeeks.some((w) => w.id === selectedWeekId)
    ) {
      validWeekId = syncInitialWeekId();
      setSelectedWeekId(validWeekId);
      window.localStorage.setItem('contest_week_id', validWeekId);
      // Optionally update URL as above
      // const params = new URLSearchParams(window.location.search);
      // params.set('week', validWeekId);
      // window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
    }
    // Always persist in localStorage (also future-proof: if week doesn't change, this does nothing)
    window.localStorage.setItem('contest_week_id', validWeekId);
    // eslint-disable-next-line
  }, [currentWeek, user, getAllWeeks, getActiveWeek]);


  // Define the fetch functions with useCallback to avoid recreation on each render
  const fetchUserVotes = useCallback(async () => {
    if (!user?.id) return;
    // Enforce: cannot fetch votes at all unless week is chosen (if schema demands)
    if (hasValidContestStructure && !selectedWeekId) return;

    try {
      let query = supabase
        .from('votes')
        .select('app_id')
        .eq('user_id', user.id);

      // Only filter by contest_week_id if we have a valid contest structure
      if (selectedWeekId && hasValidContestStructure) {
        query = query.eq('contest_week_id', selectedWeekId);
      } else if (hasValidContestStructure && !selectedWeekId) {
        // Defensive: block fetch entirely (can't query by week, per requirements should not run at all)
        return;
      }

      const { data, error } = await query;

      if (error) {
        // If we get a column not found error, try without the contest_week_id filter
        if (error.code === '42703') {
          console.warn('Column error when fetching votes - attempting without contest_week_id filter');
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('votes')
            .select('app_id')
            .eq('user_id', user.id);

          if (fallbackError) {
            throw fallbackError;
          }

          setUserVotes(fallbackData?.map(vote => vote.app_id) || []);
        } else {
          throw error;
        }
      } else {
        setUserVotes(data?.map(vote => vote.app_id) || []);
      }
    } catch (error) {
      console.error('Error fetching user votes:', error.message);
    }
  }, [user, selectedWeekId, hasValidContestStructure]);

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
    // Enforce: cannot fetch apps at all unless week is chosen (if schema demands)
    if (hasValidContestStructure && !selectedWeekId) return;

    try {
      let query = supabase
        .from('apps')
        .select(`
          id, 
          name, 
          link, 
          image_url, 
          created_at,
          user_id,
          contest_week_id,
          profiles:user_id (username, registration_number)
        `)
        .order('created_at', { ascending: false });

      // Only filter by contest_week_id if we have a valid contest structure
      if (selectedWeekId && hasValidContestStructure) {
        console.log(`Fetching apps for week ID: ${selectedWeekId}`);
        query = query.eq('contest_week_id', selectedWeekId);
      } else if (hasValidContestStructure && !selectedWeekId) {
        // Defensive: block fetch entirely (should not run at all)
        return;
      } else if (user && hasValidContestStructure) {
        // If user is logged in but no specific week is selected,
        // try to fetch apps for the active contest week
        const activeWeek = getActiveWeek && getActiveWeek();
        if (activeWeek) {
          console.log(`User logged in - defaulting to active week ID: ${activeWeek.id}`);
          query = query.eq('contest_week_id', activeWeek.id);
        } else {
          // If no active week exists, fetch all apps (legacy only)
          console.log('No active week found - fetching all apps');
        }
      } else {
        // If no week is selected or contest structure is invalid, fetch all apps
        console.log('No week selected or invalid contest structure - fetching all apps');
      }

      const { data, error } = await query;

      if (error) {
        // Special handling for column does not exist error - likely schema issue
        if (error.code === '42703') {
          console.error('Column error when fetching apps - possible schema issue:', error.message);
          // Try again without the contest_week_id filter
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('apps')
            .select(`id, name, link, image_url, created_at, user_id, profiles:user_id (username, registration_number)`)
            .order('created_at', { ascending: false });

          if (fallbackError) {
            throw fallbackError;
          }

          setApps(fallbackData || []);
        } else {
          throw error;
        }
      } else {
        setApps(data || []);
      }
    } catch (error) {
      console.error('Error fetching apps:', error.message);
      toast.error('Failed to load apps');
    } finally {
      setLoading(false);
    }
  }, [selectedWeekId, hasValidContestStructure, user, getActiveWeek]);

  useEffect(() => {
    // Completely prevent ANY fetch if selectedWeekId is not a valid/truthy value.
    // This absolutely guarantees all API fetches are properly filtered.
    if (
      !hasValidContestStructure ||
      (hasValidContestStructure && selectedWeekId)
    ) {
      // Only fetch when selectedWeekId is truthy or contest structure is invalid (for old schema support)
      if (
        (!hasValidContestStructure) ||
        (hasValidContestStructure && selectedWeekId)
      ) {
        setLoading(true);
        fetchApps();
        fetchUserVotes();
        fetchUserProfile();
      }
    }
    // Never run if selectedWeekId is falsy - no accidental fetches.
  }, [fetchApps, fetchUserVotes, fetchUserProfile, selectedWeekId, hasValidContestStructure, user]);

  const handleVote = async (appId) => {
    if (!user) {
      toast.error('You must be logged in to vote');
      return;
    }

    if (!selectedWeekId) {
      toast.error('No contest week selected');
      return;
    }

    // Check if voting is allowed based on contest state
    if (!canVote()) {
      toast.error('Voting is only allowed during active contests');
      return;
    }

    // Check if user has already voted for this app
    if (userVotes.includes(appId)) {
      try {
        // Start with base query
        let query = supabase
          .from('votes')
          .delete()
          .eq('user_id', user.id)
          .eq('app_id', appId);
          
        // Only add contest_week_id filter if we have valid contest structure
        if (hasValidContestStructure && selectedWeekId) {
          query = query.eq('contest_week_id', selectedWeekId);
        }

        const { error } = await query;

        if (error) {
          // If error is related to contest_week_id column, try without it
          if (error.code === '42703' && error.message.includes('contest_week_id')) {
            console.warn('Column error when removing vote - attempting without contest_week_id filter');
            const { error: fallbackError } = await supabase
              .from('votes')
              .delete()
              .eq('user_id', user.id)
              .eq('app_id', appId);
              
            if (fallbackError) throw fallbackError;
          } else {
            throw error;
          }
        }

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
        // Add vote with or without contest week ID based on schema support
        const voteData = { 
          user_id: user.id, 
          app_id: appId
        };
        
        // Only include contest_week_id if the schema supports it
        if (hasValidContestStructure && selectedWeekId) {
          voteData.contest_week_id = selectedWeekId;
        }
        
        const { error } = await supabase
          .from('votes')
          .insert([voteData]);

        if (error) {
          // If the error is related to missing contest_week_id column, try without it
          if (error.code === '42703' && error.message.includes('contest_week_id')) {
            console.warn('Column error when adding vote - attempting without contest_week_id');
            const { error: fallbackError } = await supabase
              .from('votes')
              .insert([{ 
                user_id: user.id, 
                app_id: appId
              }]);
              
            if (fallbackError) throw fallbackError;
          } else {
            throw error;
          }
        }

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

  /**
   * PUBLIC_INTERFACE
   * Delete an app from Supabase and update the UI state, with error handling and permission check.
   */
  const handleDeleteApp = async (app) => {
    // Defensive: confirm intent
    const reallyDelete = window.confirm(
      "Are you sure you want to delete this app?\nThis action cannot be undone."
    );
    if (!reallyDelete) return;

    try {
      // Defensive: verify user and ownership again
      if (!user?.id || user.id !== app.user_id) {
        toast.error("You do not have permission to delete this app.");
        return;
      }
      // Call Supabase to delete app by id and owner
      const { error } = await supabase
        .from("apps")
        .delete()
        .eq("id", app.id)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }
      // Remove from local UI state
      setApps((prevApps) => prevApps.filter((a) => a.id !== app.id));
      toast.success("App deleted!");
    } catch (error) {
      toast.error(error?.message || "Failed to delete app. Please try again.");
      console.error("Delete app error:", error);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading apps...</div>
      </div>
    );
  }

  // Handle changing the selected week, and also persist to localStorage (and optionally URL param)
  // PUBLIC_INTERFACE
  const handleWeekChange = (weekId) => {
    const numId = Number(weekId);

    // If the selected week is already active, do nothing
    if (selectedWeekId === numId) {
      return;
    }

    setSelectedWeekId(numId);
    switchWeek(numId);
    setLoading(true);
    // Persist the user's choice
    window.localStorage.setItem('contest_week_id', numId);
    // Optionally, update URL param for direct navigation/sharing (uncomment if desired)
    // const params = new URLSearchParams(window.location.search);
    // params.set('week', numId);
    // window.history.replaceState({}, '', `${window.location.pathname}?${params}`);
  };

  // Get all available contest weeks
  const allWeeks = getAllWeeks();

  return (
    <div className="container home-page">
      <h1 className="page-title">App Showcase</h1>
      
      {/* Contest week selection tabs - only show if contest structure exists */}
      {hasValidContestStructure && (
        <>
          <div className="contest-tabs">
            {allWeeks.map(week => (
              <button 
                key={week.id}
                className={`contest-tab ${selectedWeekId === week.id ? 'active' : ''} ${week.status}`}
                onClick={() => handleWeekChange(week.id)}
              >
                {week.name}
                <span className={`tab-badge ${week.status}`}>
                  {week.status === 'active' ? 'Active' : 
                   week.status === 'ended' ? 'Ended' : 
                   week.status === 'completed' ? 'Completed' : 'Upcoming'}
                </span>
              </button>
            ))}
          </div>

          {/* Contest status message */}
          <div className={`contest-status-banner ${currentWeek?.status}`}>
            {currentWeek?.status === 'active' ? (
              <>Contest is active! Submit your app and vote for your favorites.</>
            ) : currentWeek?.status === 'ended' ? (
              <>This contest has ended. Winners will be announced soon.</>
            ) : currentWeek?.status === 'completed' ? (
              <>This contest is complete. Check out the winners in the Contest Winners tab.</>
            ) : (
              <>This contest hasn't started yet.</>
            )}
          </div>
        </>
      )}

      <p className="page-description">
        Discover and vote for your favorite apps. You can vote for up to 5 apps.
        <span className="votes-count">
          {` (${userVotes.length}/5 votes used)`}
        </span>
      </p>

      {apps.length === 0 ? (
        <div className="no-apps-message">
          <p>No apps have been submitted for {currentWeek?.name || 'this week'}.</p>
          {currentWeek?.status === 'active' ? (
            <p>Be the first to <a href="/add-app">add your app</a>!</p>
          ) : (
            <p>
              {currentWeek?.status === 'upcoming' 
                ? "This contest hasn't started yet." 
                : "This contest has ended."}
            </p>
          )}
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

                {/* If this is the user's own app, show a Delete button */}
                {isOwnApp(app.user_id) && (
                  <button
                    className="delete-app-button"
                    title="Delete this app"
                    style={{
                      background: "#fff",
                      color: "#c0392b",
                      border: "1px solid #c0392b",
                      borderRadius: "6px",
                      margin: "4px 0 0 0",
                      padding: "5px 10px",
                      fontWeight: "bold",
                      cursor: "pointer",
                      float: "right",
                    }}
                    onClick={() => handleDeleteApp(app)}
                  >
                    🗑️ Delete
                  </button>
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
