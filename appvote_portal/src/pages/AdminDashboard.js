import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from '../contexts/AuthContext';
import supabase from '../config/supabaseClient';
import ImageRepairTool from '../utils/ImageRepairTool';

const AdminDashboard = () => {
  const { user, isAdmin } = useAuth();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shareUrl, setShareUrl] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);

  useEffect(() => {
    if (!isAdmin()) {
      toast.error('You do not have permission to access this page');
      return;
    }
    
    fetchApps();
  }, [isAdmin]);

  const fetchApps = async () => {
    try {
      // Get all apps with their vote counts and user information
      const { data, error } = await supabase
        .from('apps')
        .select(`
          id,
          name,
          link,
          image_url,
          user_id,
          created_at,
          profiles:user_id (username, email, registration_number),
          votes:votes (count)
        `);

      if (error) throw error;

      // Process the data to count votes and format for display
      const processedApps = data.map(app => {
        // Count votes for each app
        const voteCount = app.votes ? app.votes.length : 0;
        
        return {
          id: app.id,
          name: app.name,
          link: app.link,
          image_url: app.image_url,
          user_id: app.user_id,
          created_at: app.created_at,
          username: app.profiles?.username || 'Unknown',
          email: app.profiles?.email || 'No email',
          registration_number: app.profiles?.registration_number || 'N/A',
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
    link.setAttribute('download', `appvote_report_${new Date().toISOString().slice(0,10)}.csv`);
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

  return (
    <div className="container admin-page">
      <h1 className="page-title">Admin Dashboard</h1>
      <div className="admin-actions">
        <button className="btn btn-share" onClick={generateShareableLink}>
          Share Top 10
        </button>
        <button className="btn btn-export" onClick={exportToCsv}>
          Export Data (CSV)
        </button>
      </div>

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
