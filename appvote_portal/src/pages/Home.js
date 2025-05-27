import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useContest } from '../contexts/ContestContext';
import supabase, { getImageUrl } from '../config/supabaseClient';

/**
 * DATA FETCHING PATTERN:
 * Fetching reliably fires after all context/auth state is restored (refresh, login, etc).
 * Effect depends on [user, hasValidContestStructure, selectedWeekId, etc].
 */

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

  // Wait for async context/auth to be present before setting week
  useEffect(() => {
    if (!user || !user.id || !currentWeek) return;
    const activeWeek = getActiveWeek();
    if (activeWeek) {
      setSelectedWeekId(activeWeek.id);
    } else {
      setSelectedWeekId(currentWeek.id);
    }
  }, [currentWeek, user, getActiveWeek]);

  // Safety: ensure week selection never stuck after late-arriving state
  useEffect(() => {
    if (!selectedWeekId && user && user.id && currentWeek) {
      const activeWeek = getActiveWeek();
      if (activeWeek) {
        setSelectedWeekId(activeWeek.id);
      } else {
        setSelectedWeekId(currentWeek.id);
      }
    }
  }, [user, currentWeek, getActiveWeek, selectedWeekId]);

  const fetchUserVotes = useCallback(async () => {
    if (!user?.id) return;
    try {
      let query = supabase.from('votes').select('app_id').eq('user_id', user.id);
      if (selectedWeekId && hasValidContestStructure) {
        query = query.eq('contest_week_id', selectedWeekId);
      }
      const { data, error } = await query;
      if (error) {
        if (error.code === '42703') {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('votes')
            .select('app_id')
            .eq('user_id', user.id);
          if (fallbackError) throw fallbackError;
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
      await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      // Not used in UI
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

        if (selectedWeekId && hasValidContestStructure) {
          query = query.eq('contest_week_id', selectedWeekId);
        } else if (user && hasValidContestStructure) {
          const activeWeek = getActiveWeek();
          if (activeWeek) {
            query = query.eq('contest_week_id', activeWeek.id);
          }
        }

        const { data, error } = await query;
        if (error) {
          if (error.code === '42703') {
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('apps')
              .select(
                `id, name, link, image_url, created_at, user_id, profiles:user_id (username, registration_number)`
              )
              .order('created_at', { ascending: false });
            if (fallbackError) throw fallbackError;
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
   * Refactored effect: Single, robust effect waits for all state (user, contest, week).
   * Reliably triggers on refresh/context hydration or any dependency change.
   */
  useEffect(() => {
    const ready =
      !!user &&
      !!user.id &&
      !!hasValidContestStructure &&
      !!selectedWeekId;
    if (!ready) {
      setApps([]);
      setUserVotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      fetchApps(),
      fetchUserVotes(),
      fetchUserProfile(),
    ]).finally(() => setLoading(false));
  }, [
    user,
    hasValidContestStructure,
    selectedWeekId,
    fetchApps,
    fetchUserVotes,
    fetchUserProfile,
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
    if (!canVote()) {
      toast.error('Voting is only allowed during active contests');
      return;
    }
    if (userVotes.includes(appId)) {
      try {
        let query = supabase
          .from('votes')
          .delete()
          .eq('user_id', user.id)
          .eq('app_id', appId);
        if (hasValidContestStructure && selectedWeekId) {
          query = query.eq('contest_week_id', selectedWeekId);
        }
        const { error } = await query;
        if (error) {
          if (error.code === '42703' && error.message.includes('contest_week_id')) {
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
        setUserVotes(userVotes.filter((id) => id !== appId));
        toast.success('Vote removed');
        fetchApps();
      } catch (error) {
        console.error('Error removing vote:', error.message);
        toast.error('Failed to remove vote');
      }
    } else {
      if (userVotes.length >= 5) {
        toast.error('You can only vote for up to 5 apps. Remove a vote to add a new one.');
        return;
      }
      try {
        const voteData = {
          user_id: user.id,
          app_id: appId,
        };
        if (hasValidContestStructure && selectedWeekId) {
          voteData.contest_week_id = selectedWeekId;
        }
        const { error } = await supabase.from('votes').insert([voteData]);
        if (error) {
          if (error.code === '42703' && error.message.includes('contest_week_id')) {
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
        setUserVotes([...userVotes, appId]);
        toast.success('Vote added');
        fetchApps();
      } catch (error) {
        console.error('Error adding vote:', error.message);
        toast.error('Failed to add vote');
      }
    }
  };

  const isOwnApp = (appUserId) => user?.id === appUserId;

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
      const { error } = await supabase
        .from('apps')
        .delete()
        .eq('id', app.id)
        .eq('user_id', user.id);
      if (error) {
        dbDeleteError = error.message || error.description || 'Unknown error';
        toast.error(`Error deleting app: ${dbDeleteError}`);
        return;
      }
      // Remove image from storage if present
      if (
        app.image_url &&
        app.image_url.includes('supabase.co/storage') &&
        app.image_url.includes('app_images')
      ) {
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
      setApps((prev) => prev.filter((a) => a.id !== app.id));
      toast.success('App deleted successfully.');
    } catch (err) {
      const details = err.message || err.description || 'Unknown error';
      toast.error(`Failed to delete app: ${details}`);
      return;
    }
  };

  const isInitialLoad = loading && apps.length === 0;

  if (isInitialLoad) {
    return (
      <div className="container">
        <div className="loading">Loading apps...</div>
      </div>
    );
  }

  const handleWeekChange = (weekId) => {
    setSelectedWeekId(Number(weekId));
    switchWeek(Number(weekId));
  };

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
                        ? getImageUrl('app_images', app.image_url.split('/').slice(-2).join('/')) ||
                          app.image_url
                        : app.image_url
                    }
                    alt={app.name}
                    onError={(e) => {
                      e.target.onerror = null;
                      if (e.target.src !== app.image_url) {
                        e.target.src = app.image_url;
                        return;
                      }
                      try {
                        e.target.src = '/placeholder-app.png';
                      } catch (placeholderError) {
                        const parent = e.target.parentNode;
                        if (parent) {
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
