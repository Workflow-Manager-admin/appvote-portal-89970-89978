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

  // --- Confirmation Modal State for deleting an app ---
  const [deleteModal, setDeleteModal] = useState({ open: false, app: null, loading: false });

  const openDeleteModal = (app) => setDeleteModal({ open: true, app, loading: false });
  const closeDeleteModal = () => setDeleteModal({ open: false, app: null, loading: false });

  const handleConfirmDelete = async () => {
    if (!deleteModal.app) return;
    setDeleteModal((prev) => ({ ...prev, loading: true }));

    const app = deleteModal.app;
    try {
      // Defensive: verify user and ownership again
      if (!user?.id || user.id !== app.user_id) {
        toast.error("You do not have permission to delete this app.");
        setDeleteModal({ open: false, app: null, loading: false });
        return;
      }
      // Call Supabase to delete app by id and owner
      const { error } = await supabase
        .from("apps")
        .delete()
        .eq("id", app.id)
        .eq("user_id", user.id);

      if (error) throw error;

      // Remove from local UI state
      setApps((prevApps) => prevApps.filter((a) => a.id !== app.id));
      toast.success("App deleted!");
    } catch (error) {
      toast.error(error?.message || "Failed to delete app. Please try again.");
      console.error("Delete app error:", error);
    } finally {
      setDeleteModal({ open: false, app: null, loading: false });
    }
  };

  // Utility to get contest_week_id from URL (if provided)
  function getContestWeekIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const weekParam = params.get('week');
    return weekParam ? Number(weekParam) : null;
  }

  // Synchronously obtain the initial weekId
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
    return 1;
  }

  // Always initialize selectedWeekId synchronously!
  const [selectedWeekId, setSelectedWeekId] = useState(() => syncInitialWeekId());

  // Watch for context/user changes and re-sync selectedWeekId only if week list changes.
  useEffect(() => {
    const allWeeks = getAllWeeks();
    let validWeekId = selectedWeekId;
    if (
      !allWeeks.length ||
      !allWeeks.some((w) => w.id === selectedWeekId)
    ) {
      validWeekId = syncInitialWeekId();
      setSelectedWeekId(validWeekId);
      window.localStorage.setItem('contest_week_id', validWeekId);
    }
    window.localStorage.setItem('contest_week_id', validWeekId);
  // eslint-disable-next-line
  }, [currentWeek, user, getAllWeeks, getActiveWeek]);

  // Fetch functions
  const fetchUserVotes = useCallback(async () => {
    if (!user?.id) return;
    if (hasValidContestStructure && !selectedWeekId) return;

    try {
      let query = supabase
        .from('votes')
        .select('app_id')
        .eq('user_id', user.id);

      if (selectedWeekId && hasValidContestStructure) {
        query = query.eq('contest_week_id', selectedWeekId);
      } else if (hasValidContestStructure && !selectedWeekId) {
        return;
      }

      const { data, error } = await query;

      if (error) {
        if (error.code === '42703') {
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
    } catch (error) {
      console.error('Error fetching user profile:', error.message);
    }
  }, [user]);

  const fetchApps = useCallback(async () => {
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

      if (selectedWeekId && hasValidContestStructure) {
        query = query.eq('contest_week_id', selectedWeekId);
      } else if (hasValidContestStructure && !selectedWeekId) {
        return;
      } else if (user && hasValidContestStructure) {
        const activeWeek = getActiveWeek && getActiveWeek();
        if (activeWeek) {
          query = query.eq('contest_week_id', activeWeek.id);
        }
      }
      const { data, error } = await query;

      if (error) {
        if (error.code === '42703') {
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
    if (
      !hasValidContestStructure ||
      (hasValidContestStructure && selectedWeekId)
    ) {
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
  }, [fetchApps, fetchUserVotes, fetchUserProfile, selectedWeekId, hasValidContestStructure, user]);

  // Voting logic...
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

        setUserVotes(userVotes.filter(id => id !== appId));
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
          app_id: appId
        };
        if (hasValidContestStructure && selectedWeekId) {
          voteData.contest_week_id = selectedWeekId;
        }
        const { error } = await supabase
          .from('votes')
          .insert([voteData]);

        if (error) {
          if (error.code === '42703' && error.message.includes('contest_week_id')) {
            const { error: fallbackError } = await supabase
              .from('votes')
              .insert([{ user_id: user.id, app_id: appId }]);
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

  // Utility: is this app mine?
  const isOwnApp = (appUserId) => user?.id === appUserId;

  // Week change handler
  const handleWeekChange = (weekId) => {
    const numId = Number(weekId);
    if (selectedWeekId === numId) {
      return;
    }
    setSelectedWeekId(numId);
    switchWeek(numId);
    setLoading(true);
    window.localStorage.setItem('contest_week_id', numId);
  };

  const allWeeks = getAllWeeks();

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
                      getImageUrl('app_images', app.image_url.split('/').slice(-2).join('/')) || app.image_url :
                      app.image_url
                    }
                    alt={app.name}
                    onError={(e) => {
                      console.error(`Image load error for ${app.name}:`, e);
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

                {/* Username/admin/ownership */}
                {(isAdmin() || isOwnApp(app.user_id)) && (
                  <p className="app-submitter">
                    Submitted by: {app.profiles?.username || 'Unknown'}
                    {app.profiles?.registration_number && ` (${app.profiles.registration_number})`}
                  </p>
                )}

                {/* User's own app: show delete button */}
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
                    onClick={() => openDeleteModal(app)}
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
                    {userVotes.includes(app.id) ? '✓Voted' : 'Vote'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Modal confirmation for deletion */}
      <ConfirmationModal
        isOpen={deleteModal.open}
        title="Delete App"
        message="Are you sure you want to delete this app? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        loading={deleteModal.loading}
        onConfirm={handleConfirmDelete}
        onCancel={closeDeleteModal}
      />
    </div>
  );
};

export default Home;
