import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useContest } from '../contexts/ContestContext';
import supabase, { getImageUrl } from '../config/supabaseClient';

const Home = () => {
  const { user, isAdmin } = useAuth();
  const {
    currentWeek,
    canVote,
    getAllWeeks,
    switchWeek,
    hasValidContestStructure,
    getActiveWeek,
  } = useContest();
  const [apps, setApps] = useState([]);
  const [userVotes, setUserVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeekId, setSelectedWeekId] = useState(null);

  // Set initial selected week when context loads
  useEffect(() => {
    // Only process if user auth/role is loaded and contest context is hydrated
    if (!user || !user.id || !currentWeek) return;

    // Always default to selecting the active week when a user is logged in
    const activeWeek = getActiveWeek();
    if (activeWeek) {
      setSelectedWeekId(activeWeek.id);
    } else {
      setSelectedWeekId(currentWeek.id);
    }
  }, [currentWeek, user, getActiveWeek]);

  /**
   * SPECIAL GUARD: If context and user arrive asynchronously, ensure selectedWeekId is reliably set as soon as both are ready.
   * This effect runs if either user or currentWeek arrives after the other. (This prevents race-missed fetch.)
   */
  useEffect(() => {
    if (!selectedWeekId && user && user.id && currentWeek) {
      const activeWeek = getActiveWeek();
      if (activeWeek) {
        setSelectedWeekId(activeWeek.id);
      } else {
        setSelectedWeekId(currentWeek.id);
      }
    }
    // Only fire if selectedWeekId is unset.
    // eslint-disable-next-line
  }, [user, currentWeek, getActiveWeek]);

  // Define the fetch functions with useCallback to avoid recreation on each render
  const fetchUserVotes = useCallback(async () => {
    if (!user?.id) return;

    try {
      let query = supabase.from('votes').select('app_id').eq('user_id', user.id);

      // Only filter by contest_week_id if we have a valid contest structure
      if (selectedWeekId && hasValidContestStructure) {
        query = query.eq('contest_week_id', selectedWeekId);
      } else {
        console.log('Fetching all votes for user without week filter');
      }

      const { data, error } = await query;

      if (error) {
        // If we get a column not found error, try without the contest_week_id filter
        if (error.code === '42703') {
          console.warn(
            'Column error when fetching votes - attempting without contest_week_id filter'
          );
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('votes')
            .select('app_id')
            .eq('user_id', user.id);

          if (fallbackError) {
            throw fallbackError;
          }

          setUserVotes(fallbackData?.map((vote) => vote.app_id) || []);
        } else {
          throw error;
        }
      } else {
        setUserVotes(data?.map((vote) => vote.app_id) || []);
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

  const fetchApps = useCallback(
    async () => {
      try {
        let query = supabase
          .from('apps')
          .select(
            `
            id, 
            name, 
            link, 
            image_url, 
            created_at,
            user_id,
            contest_week_id,
            profiles:user_id (username, registration_number)
          `
          )
          .order('created_at', { ascending: false });

        // If we have a selected week and the contest structure is valid, filter by week
        if (selectedWeekId && hasValidContestStructure) {
          console.log(`Fetching apps for week ID: ${selectedWeekId}`);
          query = query.eq('contest_week_id', selectedWeekId);
        } else if (user && hasValidContestStructure) {
          // If user is logged in but no specific week is selected,
          // try to fetch apps for the active contest week
          const activeWeek = getActiveWeek();
          if (activeWeek) {
            console.log(
              `User logged in - defaulting to active week ID: ${activeWeek.id}`
            );
            query = query.eq('contest_week_id', activeWeek.id);
          } else {
            // If no active week exists, fetch all apps
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
            console.error(
              'Column error when fetching apps - possible schema issue:',
              error.message
            );
            // Try again without the contest_week_id filter
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('apps')
              .select(
                `id, name, link, image_url, created_at, user_id, profiles:user_id (username, registration_number)`
              )
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
    },
    [selectedWeekId, hasValidContestStructure, user, getActiveWeek]
  );

  /**
   * Robust effect: Always fire data fetch if user, contest context, and selectedWeekId are all available.
   * Handles async hydration edge cases and ensures no fetch is skipped post-refresh or session restoration.
   */
  useEffect(() => {
    // Only fetch if user is present, context is loaded, and selectedWeekId is valid
    if (!user || !user.id) {
      // Not authenticated: clear everything; no fetches needed
      setApps([]);
      setUserVotes([]);
      setLoading(false);
      return;
    }
    // Wait if context not hydrated or no selected week
    if (!hasValidContestStructure || !selectedWeekId) return;
    setLoading(true);
    fetchApps();
    fetchUserVotes();
    fetchUserProfile();
    // eslint-disable-next-line
  }, [
    fetchApps,
    fetchUserVotes,
    fetchUserProfile,
    user && user.id,
    hasValidContestStructure,
    selectedWeekId,
  ]);

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
            console.warn(
              'Column error when removing vote - attempting without contest_week_id filter'
            );
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
        setUserVotes(userVotes.filter((id) => id !== appId));
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
          app_id: appId,
        };

        // Only include contest_week_id if the schema supports it
        if (hasValidContestStructure && selectedWeekId) {
          voteData.contest_week_id = selectedWeekId;
        }

        const { error } = await supabase.from('votes').insert([voteData]);

        if (error) {
          // If the error is related to missing contest_week_id column, try without it
          if (error.code === '42703' && error.message.includes('contest_week_id')) {
            console.warn(
              'Column error when adding vote - attempting without contest_week_id'
            );
            const { error: fallbackError } = await supabase.from('votes').insert([
              {
                user_id: user.id,
                app_id: appId,
              },
            ]);

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

  // PUBLIC_INTERFACE
  const handleDeleteApp = async (app) => {
    if (!user) {
      toast.error('You must be logged in to delete an app.');
      return;
    }
    if (!isOwnApp(app.user_id)) {
      toast.error('You can only delete your own apps.');
      return;
    }

    const confirmation = window.confirm(
      'Are you sure you want to delete this app? This action cannot be undone.'
    );
    if (!confirmation) return;

    let dbDeleteError = null,
      imgDeleteError = null;
    try {
      // Delete app row
      const { error } = await supabase
        .from('apps')
        .delete()
        .eq('id', app.id)
        .eq('user_id', user.id); // frontend-side check

      if (error) {
        dbDeleteError = error.message || error.description || 'Unknown error';
        toast.error(`Error deleting app: ${dbDeleteError}`);
        return;
      }

      // Remove from storage if there's a Supabase image associated
      if (
        app.image_url &&
        app.image_url.includes('supabase.co/storage') &&
        app.image_url.includes('app_images')
      ) {
        // Extract the img path format: <...>/app_images/{user_id}/{filename}[?params]
        const urlParts = app.image_url.split('/app_images/');
        if (urlParts.length === 2) {
          const imgPath = urlParts[1].split('?')[0];
          try {
            const { error: storageError } = await supabase.storage
              .from('app_images')
              .remove([imgPath]);
            if (storageError) {
              imgDeleteError = storageError.message || storageError.description;
              toast.warn(
                `App removed, but image could not be deleted from storage. (${imgDeleteError})`
              );
            }
          } catch (catchError) {
            imgDeleteError = catchError.message || catchError.description;
            toast.warn(
              `App removed, but image deletion failed. (${imgDeleteError})`
            );
          }
        }
      }

      // Remove from UI
      setApps((prev) => prev.filter((a) => a.id !== app.id));
      toast.success('App deleted successfully.');
    } catch (err) {
      const details = err.message || err.description || 'Unknown error';
      toast.error(`Failed to delete app: ${details}`);
      return;
    }
  };

  // Only display full-page loading for first load; for subsequent loads, show a subtle indicator
  const isInitialLoad = loading && apps.length === 0;

  if (isInitialLoad) {
    return (
      <div className="container">
        <div className="loading">Loading apps...</div>
      </div>
    );
  }

  // Handle changing the selected week
  const handleWeekChange = (weekId) => {
    setSelectedWeekId(Number(weekId));
    switchWeek(Number(weekId));
    // Instead of setting loading to true which would blank the UI, we will just show a subtle overlay
    // setLoading(true); // REMOVE THIS LINE
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
            {allWeeks.map((week) => (
              <button
                key={week.id}
                className={`contest-tab ${
                  selectedWeekId === week.id ? 'active' : ''
                } ${week.status}`}
                onClick={() => handleWeekChange(week.id)}
              >
                {week.name}
                <span className={`tab-badge ${week.status}`}>
                  {week.status === 'active'
                    ? 'Active'
                    : week.status === 'ended'
                    ? 'Ended'
                    : week.status === 'completed'
                    ? 'Completed'
                    : 'Upcoming'}
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
              <>
                This contest is complete. Check out the winners in the Contest
                Winners tab.
              </>
            ) : (
              <>This contest hasn't started yet.</>
            )}
          </div>
        </>
      )}

      <p className="page-description">
        Discover and vote for your favorite apps. You can vote for up to 5 apps.
        <span className="votes-count">{` (${userVotes.length}/5 votes used)`}</span>
      </p>

      {apps.length === 0 ? (
        <div className="no-apps-message">
          <p>No apps have been submitted for {currentWeek?.name || 'this week'}.</p>
          {currentWeek?.status === 'active' ? (
            <p>
              Be the first to <a href="/add-app">add your app</a>!
            </p>
          ) : (
            <p>
              {currentWeek?.status === 'upcoming'
                ? "This contest hasn't started yet."
                : 'This contest has ended.'}
            </p>
          )}
        </div>
      ) : (
        <div className="app-grid" style={{ position: "relative" }}>
          {/* Subtle spinner overlay to indicate loading when switching weeks, but not on initial load */}
          {loading && apps.length > 0 && (
            <div style={{
              position: "absolute",
              inset: 0,
              zIndex: 5,
              background: "rgba(255,255,255,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <div className="loading-spinner" />
              <span style={{marginLeft: 12, fontSize: 16, color: "#1976D2"}}>Loading new week...</span>
            </div>
          )}
          {apps.map((app) => (
            <div className="app-card" key={app.id}>
              <div className="app-card-image">
                {app.image_url ? (
                  <img
                    src={
                      app.image_url.includes('supabase.co/storage')
                        ? // If it's a Supabase URL, use our helper for possible path fixes
                          getImageUrl('app_images', app.image_url.split('/').slice(-2).join('/')) ||
                          app.image_url
                        : // Otherwise use the URL as-is
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

                {/* Delete button for own apps */}
                {isOwnApp(app.user_id) && (
                  <button
                    className="delete-button"
                    onClick={() => handleDeleteApp(app)}
                    style={{
                      marginBottom: '8px',
                      background: '#d9534f',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '6px 12px',
                      cursor: 'pointer',
                    }}
                    title="Delete this app"
                  >
                    Delete
                  </button>
                )}

                {/* Don't allow voting for own apps */}
                {!isOwnApp(app.user_id) && (
                  <button
                    className={`vote-button ${userVotes.includes(app.id) ? 'voted' : ''}`}
                    onClick={() => handleVote(app.id)}
                    disabled={userVotes.length >= 5 && !userVotes.includes(app.id)}
                  >
                    {userVotes.includes(app.id) ? '\u2713 Voted' : 'Vote'}
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
