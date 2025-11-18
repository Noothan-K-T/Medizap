// src/features/DashboardHome.jsx
import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import NearbyMap from '../components/NearbyMaps';
import '../styles/DashboardHome.css';

const DashboardHome = () => {
    const { reminders, formatDateTime } = useOutletContext();
    const auth = getAuth();
    const navigate = useNavigate();

    const [newsUpdates, setNewsUpdates] = useState([]);
    const [newsLoading, setNewsLoading] = useState(true);
    const [newsError, setNewsError] = useState(null);

    useEffect(() => {
        const fetchNews = async () => {
            try {
                setNewsLoading(true);
                const user = auth.currentUser;
                if (!user) {
                    throw new Error("Authentication required to fetch news.");
                }
                const idToken = await user.getIdToken();

                const response = await fetch('http://localhost:8000/news', {
                    headers: {
                        'Authorization': `Bearer ${idToken}`,
                    },
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to fetch news');
                }

                const data = await response.json();
                setNewsUpdates(data.articles);
            } catch (error) {
                console.error("Error fetching news:", error);
                setNewsError(error.message);
            } finally {
                setNewsLoading(false);
            }
        };

        fetchNews();
    }, [auth]);

    const actualUpcomingReminders = reminders
        .filter(rem => !rem.isDismissed && rem.dateTime.getTime() > Date.now())
        .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
        .slice(0, 3);

    const handleViewRemindersClick = () => {
        navigate('/dashboard/reminders');
    };

    return (
        <>
            {/* News & Updates Marquee/Top Bar */}
            <div className="dashboard-news-marquee-container">
                <span className="dashboard-news-marquee-title">NEWS & UPDATES:</span>
                <div className="dashboard-news-marquee-wrapper">
                    <div className="dashboard-news-marquee-content">
                        {newsLoading ? (
                            <span className="dashboard-news-marquee-item">Loading latest health news...</span>
                        ) : newsError ? (
                            <span className="dashboard-news-marquee-item error-message">Error fetching news: {newsError}</span>
                        ) : newsUpdates.length > 0 ? (
                            Array(5).fill(null).map((_, repeatIndex) => (
                                newsUpdates.map((news, index) => (
                                    <span key={`${news.url || index}-${repeatIndex}`} className="dashboard-news-marquee-item">
                                        <a href={news.url} target="_blank" rel="noopener noreferrer">
                                            {news.title}
                                        </a>
                                        {news.source_name && news.published_at && (
                                            <span>
                                                ({news.source_name} - {new Date(news.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                                            </span>
                                        )}
                                    </span>
                                ))
                            ))
                        ) : (
                            <span className="dashboard-news-marquee-item">No news available at the moment.</span>
                        )}
                    </div>
                </div>
            </div>

            {/* THIS IS THE MAIN GRID CONTAINER */}
            <div className="dashboard-layout-with-map">
                {/* Map section - left column */}
                <div className="dashboard-map-container">
                    <NearbyMap />
                </div>

                {/* Right section for Reminders and other cards */}
                <div className="dashboard-secondary-content">
                    {/* Upcoming Reminders Card */}
                    <div className="dashboard-card appointments-card">
                        <h2 className="card-title">Upcoming Reminders</h2>
                        {actualUpcomingReminders.length > 0 ? (
                            <ul className="appointment-list">
                                {actualUpcomingReminders.map(rem => (
                                    <li key={rem.id} className="appointment-item">
                                        <span className="appointment-time">{formatDateTime(rem.dateTime)}</span>
                                        <span className="appointment-description">{rem.title || rem.message}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="no-data-message">No upcoming reminders.</p>
                        )}
                        {/* Button for Upcoming Reminders */}
                        <div className="reminders-button-container">
                            <button className="reminders-button" onClick={handleViewRemindersClick}>
                                View All Reminders
                            </button>
                        </div>
                    </div>

                    {/* The static "Latest Health News" card is now completely removed as requested. */}

                </div>
            </div>
        </>
    );
};

export default DashboardHome; 