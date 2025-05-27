import React, { useEffect, useState, useContext } from "react";
import { ContestContext } from "../contexts/ContestContext";
import { AuthContext } from "../contexts/AuthContext";
import { supabase } from "../config/supabaseClient";

/**
 * AdminDashboard page for admins to view app submission table with admin-only info.
 * Refactored: Data-fetching useEffects now reliably trigger API/data calls after refresh,
 * context restoration, and any shift in user or auth/context "loading" state.
 * Explanatory comments added to aid future maintainers.
 */

function AdminDashboard() {
  const { apps, fetchApps, contestLoading } = useContext(ContestContext);
  const { user, loading: authLoading } = useContext(AuthContext); // "loading": true means auth restoration in-progress
  const [adminData, setAdminData] = useState([]);
  const [error, setError] = useState(null);

  /**
   * Effect: Fetches admin table data (all submissions, votes, emails, etc.)
   * Reliable fetch:
   *  - Triggers when user, auth restoration/loading, or fetchApps changes.
   *  - Ensures data is (re-)fetched after user/context is restored (e.g., after refresh).
   * Guard:
   *  - Only fetches if user is present and NOT loading.
   *  - Do not fetch at all while auth is in-progress (avoids unnecessary calls).
   *  - Safe to re-fire on a context reload, safely updates the adminData table when user changes (including logout).
   * Maintainability: Any context restoration logic change, e.g., more complex auth or context provider changes,
   * will not break this data-fetch logic so long as loading/user are kept up-to-date.
   */
  useEffect(() => {
    if (!user || authLoading) return;

    const fetchAdminData = async () => {
      try {
        let { data, error } = await supabase
          .from("app_submissions")
          .select("id, app_name, app_link, votes, submitter_email, register_no");
        if (error) throw error;
        setAdminData(
          data
            .map((item) => ({
              ...item,
              votes: typeof item.votes === "number" ? item.votes : 0,
            }))
            .sort((a, b) => b.votes - a.votes)
        );
        setError(null);
      } catch (err) {
        setError(err.message || "Error loading admin data");
      }
    };

    fetchAdminData();

    // eslint-disable-next-line
  }, [user, authLoading, fetchApps]);
  // Expanded dependencies: triggers after refresh/auth restoration, and if fetchApps reference changes (rare).

  /**
   * Effect: Ensures ContestContext apps list is always (re-)fetched when user or auth state is restored.
   * Triggers both after user loads and when context restoration finishes. This is consistent with main App context strategies.
   * Guard: No API call made if no user or if still loading.
   * Note: fetchApps ref/raw function in deps is safe, since context-provided functions are usually memoized.
   */
  useEffect(() => {
    if (!user || authLoading) return;
    fetchApps();
    // eslint-disable-next-line
  }, [user, authLoading, fetchApps]);

  // UI blocking: shows spinner if restoring user session or contest/other data loading
  if (authLoading || contestLoading) {
    return (
      <div className="loading-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <div>Loading data...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <div>You do not have admin access.</div>;
  }

  return (
    <div className="admin-dashboard">
      <h2>Admin Dashboard</h2>
      {error && <div className="error">{error}</div>}
      <table className="admin-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>App Name</th>
            <th>App Link</th>
            <th>Votes</th>
            <th>Submitter Email</th>
            <th>Register No.</th>
          </tr>
        </thead>
        <tbody>
          {adminData.map((app, idx) => (
            <tr key={app.id}>
              <td>{idx + 1}</td>
              <td>{app.app_name}</td>
              <td>
                <a href={app.app_link} target="_blank" rel="noopener noreferrer">
                  {app.app_link}
                </a>
              </td>
              <td>{app.votes}</td>
              <td>{app.submitter_email}</td>
              <td>{app.register_no}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminDashboard;
