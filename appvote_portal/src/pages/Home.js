import React, { useContext, useEffect, useState } from 'react';
import { ContestContext } from '../contexts/ContestContext';
import Layout from '../components/Layout';

const Home = () => {
  const {
    weeks,
    selectedWeek,
    setSelectedWeek,
    weekData,
    fetchWeekData,
    loading,
  } = useContext(ContestContext);

  const [initLoading, setInitLoading] = useState(true);

  useEffect(() => {
    if (selectedWeek !== null) {
      fetchWeekData(selectedWeek);
      setInitLoading(false);
    }
    // eslint-disable-next-line
  }, [selectedWeek]);

  // PUBLIC_INTERFACE
  const handleWeekChange = (week) => {
    setSelectedWeek(week);
  };

  return (
    <Layout>
      <div className="home-container">
        <h2>Voting Weeks</h2>
        <div className="weeks-list">
          {weeks.map((week) => (
            <button
              key={week}
              className={`week-btn${week === selectedWeek ? ' selected' : ''}`}
              onClick={() => handleWeekChange(week)}
            >
              {week}
            </button>
          ))}
        </div>
        {loading || initLoading ? (
          <div className="loading-spinner home-spinner"></div>
        ) : (
          <div>
            <h3>{selectedWeek && `Apps for Week ${selectedWeek}`}</h3>
            {weekData.length === 0 ? (
              <p>No apps have been submitted for this week yet.</p>
            ) : (
              <div className="apps-list">
                {weekData.map((app) => (
                  <div className="app-card" key={app.id}>
                    <img
                      src={app.previewImgUrl}
                      alt={`${app.name} preview`}
                      className="app-preview"
                    />
                    <div className="app-info">
                      <h4>{app.name}</h4>
                      <a href={app.link} target="_blank" rel="noopener noreferrer">
                        Visit App
                      </a>
                      <div className="votes">Votes: {app.votes}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Home;
