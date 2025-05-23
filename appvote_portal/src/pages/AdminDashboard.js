import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import { useContest } from '../contexts/ContestContext';
import supabase from '../config/supabaseClient';
import ImageRepairTool from '../utils/ImageRepairTool';

const AdminDashboard = () => {
  const { isAdmin } = useAuth();
  const { 
    contestWeeks, 
    currentWeek, 
    switchWeek, 
    updateContestStatus,
    selectWinner,
    getWinnersForWeek,
    hasValidContestStructure
  } = useContest();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState('apps');
  const [selectedWeekId, setSelectedWeekId] = useState(null);

  useEffect(() => {
    if (!isAdmin()) {
      toast.error('You do not have permission to access this page');
      return;
    }
    
    if (currentWeek) {
      setSelectedWeekId(currentWeek.id);
      fetchApps(currentWeek.id);
    } else {
      // If no contest structure, fetch all apps
      fetchApps(null);
    }
  }, [isAdmin, currentWeek]);

  const fetchApps = async (weekId = selectedWeekId) => {
    try {
      let query = supabase
        .from('apps')
        .select(`
          id,
          name,
          link,
          image_url,
          user_id,
          created_at,
          contest_week_id,
          votes:votes (count)
        `);

      // If contest schema exists and week is selected, filter by week
      if (hasValidContestStructure && weekId) {
        query = query
          .eq('contest_week_id', weekId)
          .eq('votes.contest_week_id', weekId);
      }

      // Execute query
      const { data: appsData, error: appsError } = await query;

      if (appsError) throw appsError;

      // Then fetch user profiles separately to get the complete profile data
      const userIds = appsData.map(app => app.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, registration_number')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Create a profiles lookup map for easy access
      const profilesMap = {};
      profilesData.forEach(profile => {
        profilesMap[profile.id] = profile;
      });

      // Process the data to count votes and format for display
      const processedApps = appsData.map(app => {
        // Count votes for each app
        const voteCount = app.votes ? app.votes.length : 0;
        const profile = profilesMap[app.user_id] || {};
        
        return {
          id: app.id,
          name: app.name,
          link: app.link,
          image_url: app.image_url,
          user_id: app.user_id,
          created_at: app.created_at,
          username: profile?.username || 'Unknown',
          // Use username as a basis for a placeholder email
          email: `${profile?.username || 'user'}@appvote.example`, // Placeholder email
          registration_number: profile?.registration_number || 'N/A',
          votes: voteCount
        };
      });

      // Sort apps by vote count (descending)
      processedApps.sort((a, b) => b.votes - a.votes);

      // Add rank to each app
      processedApps.forEach((app, index) => {
        app.rank = index + 1;
      });

      setApps(processedApps);
    } catch (error) {
      console.error('Error fetching apps:', error.message);
      toast.error('Failed to load app data');
    } finally {
      setLoading(false);
    }
  };

  const generateShareableLink = () => {
    // Get top 10 apps
    const top10Apps = apps.slice(0, 10);
    
    // Create a shareable content
    const content = top10Apps.map(app => 
      `${app.rank}. ${app.name} - ${app.link} (${app.votes} votes)`
    ).join('\n');

    // Create a formatted text for sharing
    const shareText = `📱 Top 10 Apps from AppVote Portal 📱\n\n${content}\n\nShared from AppVote Portal`;

    // For a real app, you might want to create a sharable page instead
    // For this demo, we'll just create a text that can be copied
    setShareUrl(shareText);
    setShowShareModal(true);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        toast.success('Top 10 list copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        toast.error('Failed to copy to clipboard');
      });
  };

  const exportToCsv = () => {
    // CSV Header
    const csvHeader = ['Rank', 'App Name', 'App Link', 'Username', 'Email', 'Registration Number', 'Votes'];
    
    // CSV Rows
    const csvRows = apps.map(app => [
      app.rank,
      app.name,
      app.link,
      app.username,
      app.email,
      app.registration_number,
      app.votes
    ]);
    
    // Combine header and rows
    const csvContent = [
      csvHeader.join(','),
      ...csvRows.map(row => row.join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `kavia_app_contest_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading admin dashboard...</div>
      </div>
    );
  }

  // Handle changing the selected week
  const handleWeekChange = (weekId) => {
    setSelectedWeekId(Number(weekId));
    switchWeek(Number(weekId));
    fetchApps(Number(weekId));
  };

  // Handle contest status changes
  const handleStatusChange = async (weekId, newStatus) => {
    const success = await updateContestStatus(weekId, newStatus);
    if (success) {
      fetchApps(weekId);
    }
  };

  // Handle winner selection
  const handleSelectWinner = async (appId, position) => {
    await selectWinner(selectedWeekId, appId, position);
  };

  // Get current week status
  const getCurrentWeekStatus = () => {
    const week = contestWeeks.find(w => w.id === selectedWeekId);
    return week ? week.status : 'unknown';
  };

  return (
    <div className="container admin-page">
      <h1 className="page-title">Admin Dashboard</h1>

      {/* Admin dashboard tabs - only show contest tab if schema exists */}
      <div className="admin-tabs">
        <button 
          className={`admin-tab ${selectedTab === 'apps' ? 'active' : ''}`}
          onClick={() => setSelectedTab('apps')}
        >
          App Submissions
        </button>
        {hasValidContestStructure && (
          <button 
            className={`admin-tab ${selectedTab === 'contest' ? 'active' : ''}`}
            onClick={() => setSelectedTab('contest')}
          >
            Contest Management
          </button>
        )}
      </div>

      {/* Contest weeks tabs - only show if schema exists */}
      {hasValidContestStructure && (
        <div className="contest-tabs admin-contest-tabs">
          {contestWeeks.map(week => (
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
      )}

      {/* If contest schema doesn't exist, show warning message */}
      {!hasValidContestStructure && (
        <div className="contest-status-banner upcoming" style={{ marginBottom: '25px' }}>
          Contest feature requires database setup. Please ask an administrator to apply the contest schema.
        </div>
      )}

      {selectedTab === 'apps' && (
        <>
          <div className="admin-actions">
            <button className="btn btn-share" onClick={generateShareableLink}>
              Share Top 10
            </button>
            <button className="btn btn-export" onClick={exportToCsv}>
              Export Data (CSV)
            </button>
          </div>
        </>
      )}

      {selectedTab === 'contest' && (
        <div className="contest-management">
          <div className="contest-status-controls">
            <h3>Contest Controls for {contestWeeks.find(w => w.id === selectedWeekId)?.name}</h3>
            <div className="status-buttons">
              <button 
                className="btn btn-start"
                disabled={getCurrentWeekStatus() === 'active' || getCurrentWeekStatus() === 'completed'}
                onClick={() => handleStatusChange(selectedWeekId, 'active')}
              >
                Start Contest
              </button>
              <button 
                className="btn btn-end"
                disabled={getCurrentWeekStatus() !== 'active'}
                onClick={() => handleStatusChange(selectedWeekId, 'ended')}
              >
                End Contest
              </button>
            </div>
          </div>

          {getCurrentWeekStatus() === 'ended' && (
            <div className="winner-selection">
              <h3>Select Winners</h3>
              <p>Choose the top 3 winners from the list below:</p>
              
              <div className="winner-positions">
                {[1, 2, 3].map(position => {
                  // Check if winner already selected for this position
                  const existingWinner = getWinnersForWeek(selectedWeekId)?.find(w => w.position === position);
                  
                  return (
                    <div className="winner-position" key={position}>
                      <h4>{position === 1 ? '1st Place 🥇' : position === 2 ? '2nd Place 🥈' : '3rd Place 🥉'}</h4>
                      <select 
                        value={existingWinner?.app_id || ''}
                        onChange={(e) => handleSelectWinner(e.target.value, position)}
                      >
                        <option value="">-- Select Winner --</option>
                        {/* Show top 10 apps by votes */}
                        {apps.slice(0, 10).map(app => (
                          <option key={app.id} value={app.id}>
                            {app.rank}. {app.name} ({app.votes} votes) - by {app.username}
                          </option>
                        ))}
                      </select>
                      {existingWinner && (
                        <div className="selected-winner">
                          Selected: {apps.find(a => a.id === existingWinner.app_id)?.name || 'Unknown app'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {apps.length === 0 ? (
        <div className="no-apps-message">
          <p>No apps have been submitted yet.</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>App Name</th>
                <th>App Link</th>
                <th>Username</th>
                <th>Email</th>
                <th>Registration #</th>
                <th>Votes</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id} className={app.rank <= 10 ? 'top-rank' : ''}>
                  <td>{app.rank}</td>
                  <td>{app.name}</td>
                  <td>
                    <a href={app.link} target="_blank" rel="noopener noreferrer">
                      {app.link.length > 30 ? `${app.link.substring(0, 30)}...` : app.link}
                    </a>
                  </td>
                  <td>{app.username}</td>
                  <td>{app.email}</td>
                  <td>{app.registration_number}</td>
                  <td className="votes-cell">{app.votes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Image repair tool for admin */}
      <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#2a2a2a', borderRadius: '8px' }}>
        <ImageRepairTool />
      </div>
      
      {showShareModal && (
        <div className="share-modal-overlay">
          <div className="share-modal">
            <h2>Share Top 10 Apps</h2>
            <div className="share-content">
              <textarea 
                value={shareUrl} 
                readOnly 
                rows={12} 
                className="share-textarea"
              />
            </div>
            <div className="share-actions">
              <button className="btn" onClick={() => copyToClipboard()}>
                Copy to Clipboard
              </button>
              <button className="btn btn-secondary" onClick={() => setShowShareModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
