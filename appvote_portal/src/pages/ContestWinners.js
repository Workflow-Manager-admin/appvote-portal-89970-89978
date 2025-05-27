import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContest } from '../contexts/ContestContext';
import { useAuth } from '../contexts/AuthContext';
import { getImageUrl } from '../config/supabaseClient';

/**
 * ContestWinners displays winners for contest weeks that are completed or have results.
 *
 * DATA FETCH/HYDRATION LOGIC:
 * - All data-dependent effects wait for both contest and auth context readiness (authLoading & contestLoading must be false).
 * - This ensures correct behavior on initial page load, after refresh, or user re-auth/context restoration.
 * - Any dependency relevant to contest/user context must be included in useEffect's dependency array.
 * - On loss/restoration of context, or page refresh, effects will reliably retrigger.
 * 
 * MAINTAINABILITY:
 * - If context structure changes (e.g., contest/user), update the dependencies in effects accordingly.
 * - Effects must always be resilient to timing/race between context hydration and initial mount.
 * - See comments below for further maintainability guidelines.
 */
const ContestWinners = () => {
  const {
    loading: contestLoading,
    contestWeeks,
    getWinnersForWeek,
    hasValidContestStructure
  } = useContest();
  const { loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // -------------------------------------------
  // Robustly select initial tab after hydration:
  // - Only runs after BOTH auth and contest contexts are ready (hydration complete)
  // - Also retriggers on context restoration after page refresh.
  // - DO NOT add getWinnersForWeek to deps: it's referentially stable from context, so safe.
  // - Each contestWeek entry and hasValidContestStructure are true after valid fetch.
  // -------------------------------------------
  useEffect(() => {
    // Guard: wait for both auth and contest to finish hydrating—CRITICAL for correct behavior after refresh
    if (authLoading || contestLoading) return; // Wait for BOTH to finish

    // If contest data is not valid (e.g. setup not complete), redirect to home
    if (!hasValidContestStructure) {
      navigate('/');
      return;
    }

    // If there are contest weeks, select the initial tab
    if (contestWeeks?.length > 0) {
      // Find the first week that has actual winners (for user convenience)
      const weeksWithWinners = contestWeeks.filter(week => {
        const weekWinners = getWinnersForWeek(week.id);
        return weekWinners && weekWinners.length > 0;
      });
      if (weeksWithWinners.length > 0) {
        setActiveTab(weeksWithWinners[0].id);
      } else {
        setActiveTab(contestWeeks[0].id);
      }
      setLoading(false);
    }
    // Always use a complete dependency array to ensure proper effect retrigger after context restoration.
    // Do NOT use [] or partial deps as this breaks on refresh or login-restore.
    // getWinnersForWeek is intentionally not included as it is stable per context.
  }, [authLoading, contestLoading, contestWeeks, hasValidContestStructure, navigate]);

  // Positions and medal colors for winners
  const positions = {
    1: { label: '1st Place 🥇', color: '#FFD700' },
    2: { label: '2nd Place 🥈', color: '#C0C0C0' },
    3: { label: '3rd Place 🥉', color: '#CD7F32' }
  };

  // Only show spinner if either contest or auth is still hydrating, or contest weeks not loaded (robust spinner guard)
  const isInitialWinnersLoad = (loading || contestLoading || authLoading) && (!contestWeeks || contestWeeks.length === 0);

  if (isInitialWinnersLoad) {
    return (
      <div className="container">
        <div className="loading">Loading contest winners...</div>
      </div>
    );
  }

  // Get winners for the active tab
  const currentWinners = getWinnersForWeek(activeTab);
  const currentWeek = contestWeeks.find(week => week.id === activeTab);

  return (
    <div className="container contest-winners-page">
      <h1 className="page-title">Contest Winners</h1>
      
      {/* Week tabs navigation */}
      <div className="contest-tabs">
        {contestWeeks.map(week => (
          <button 
            key={week.id}
            className={`contest-tab ${activeTab === week.id ? 'active' : ''}`}
            onClick={() => setActiveTab(week.id)}
          >
            {week.name}
            {week.status === 'completed' && <span className="tab-badge">Completed</span>}
          </button>
        ))}
      </div>

      <div className="contest-winners-content" style={{ position: "relative" }}>
        {/* Overlay a subtle loader over grid if loading but not initial load */}
        {(loading || contestLoading) && contestWeeks && contestWeeks.length > 0 && (
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

        {currentWinners && currentWinners.length > 0 ? (
          <>
            <h2 className="week-title">{currentWeek?.name} Winners</h2>
            <div className="winners-grid">
              {/* Sort winners by position and render each one */}
              {[...currentWinners]
                .sort((a, b) => a.position - b.position)
                .map(winner => (
                  <div 
                    className="winner-card" 
                    key={winner.id}
                    style={{ borderTop: `5px solid ${positions[winner.position].color}` }}
                  >
                    <div className="winner-position">{positions[winner.position].label}</div>
                    <div className="app-card-image">
                      {winner.apps.image_url ? (
                        <img 
                          src={winner.apps.image_url.includes('supabase.co/storage') ? 
                            getImageUrl('app_images', winner.apps.image_url.split('/').slice(-2).join('/')) || winner.apps.image_url : 
                            winner.apps.image_url
                          } 
                          alt={winner.apps.name} 
                          onError={(e) => {
                            e.target.onerror = null;
                            try {
                              e.target.src = '/placeholder-app.png';
                            } catch (placeholderError) {
                              const parent = e.target.parentNode;
                              if (parent) {
                                e.target.remove();
                                const placeholderDiv = document.createElement('div');
                                placeholderDiv.className = 'placeholder-image';
                                placeholderDiv.textContent = `${winner.apps.name} (No Image)`;
                                parent.appendChild(placeholderDiv);
                              }
                            }
                          }}
                        />
                      ) : (
                        <div className="placeholder-image">No Image</div>
                      )}
                    </div>
                    
                    <div className="winner-card-content">
                      <h3 className="app-name">{winner.apps.name}</h3>
                      <p className="app-submitter">
                        By: {winner.apps.profiles?.username || 'Unknown'}
                      </p>
                      <a 
                        href={winner.apps.link} 
                        className="app-link" 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        Visit App
                      </a>
                    </div>
                  </div>
                ))}
            </div>
          </>
        ) : (
          <div className="no-winners-message">
            {currentWeek?.status === 'completed' ? (
              <p>No winners have been selected for this week yet.</p>
            ) : (
              <p>
                {currentWeek?.status === 'active' 
                  ? "This contest is still in progress. Winners will be announced after it ends."
                  : currentWeek?.status === 'upcoming'
                    ? "This contest hasn't started yet."
                    : "This contest has ended. Winners will be announced soon."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContestWinners;
