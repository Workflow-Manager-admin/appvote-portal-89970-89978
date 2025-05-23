import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useContest } from '../contexts/ContestContext';
import { getImageUrl } from '../config/supabaseClient';

/**
 * ContestWinners component displays the winners for all contest weeks
 * that have been completed or have winners selected.
 */
const ContestWinners = () => {
  const { 
    loading: contestLoading, 
    contestWeeks, 
    getWinnersForWeek, 
    hasValidContestStructure 
  } = useContest();
  const [activeTab, setActiveTab] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Redirect if contest schema doesn't exist or check for winners
  useEffect(() => {
    if (!contestLoading) {
      if (!hasValidContestStructure) {
        // Redirect to home page if contest feature is not set up
        navigate('/');
        return;
      }
      
      if (contestWeeks?.length > 0) {
        // Find the first week with winners or set to the first week
        const weeksWithWinners = contestWeeks.filter(week => {
          const weekWinners = getWinnersForWeek(week.id);
          return weekWinners && weekWinners.length > 0;
        });

        if (weeksWithWinners.length > 0) {
          setActiveTab(weeksWithWinners[0].id);
        } else {
          // Fallback to the first week
          setActiveTab(contestWeeks[0].id);
        }
        setLoading(false);
      }
    }
  }, [contestLoading, contestWeeks, getWinnersForWeek, hasValidContestStructure, navigate]);

  // Positions and medal colors for winners
  const positions = {
    1: { label: '1st Place 🥇', color: '#FFD700' },
    2: { label: '2nd Place 🥈', color: '#C0C0C0' },
    3: { label: '3rd Place 🥉', color: '#CD7F32' }
  };

  if (loading || contestLoading) {
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

      <div className="contest-winners-content">
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
