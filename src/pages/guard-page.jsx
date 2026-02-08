import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCodeReactOnly from './qr-code.jsx';
import './guard-page.css';

const GuardPage = () => {
    const navigate = useNavigate();
    const [selectedLocation, setSelectedLocation] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [user, setUser] = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(true);
    const [error, setError] = useState("");
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    const locations = [
        ["Aryabhatta", "H3"],
        ["Maa Saraswati", "MS"],
        ["Vashistha", "H1"],
        ["Vivekananda", "H4"],
        ["Panini", "PH"],
        ["Nagarjuna", "NH"],
        ["Computer Center", "CC"],
        ["Main Gate", "MG"]
    ];

    useEffect(() => {
        fetch(`${import.meta.env.VITE_Backend_URL}/api/me`, {
            credentials: "include",
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.loggedIn) {
                    setUser(data.user);
                    setIsLoggedIn(true);
                } else {
                    window.location.href = "/";
                }
            });
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (selectedLocation && user) {
            const guardId = user.userGuardId;
            try {
                const response = await fetch(`${import.meta.env.VITE_Backend_URL}/api/guard/location`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "include",
                    body: JSON.stringify({ guardId, location: selectedLocation }),
                });
                const data = await response.json();
                if (!response.ok) {
                    setError(data.error);

                }
                else {
                    setSubmitted(true);
                }
            } catch (err) {
                setError("Network error. Please try again later.");
            }
        }
    };

    const [manualRollNo, setManualRollNo] = useState("");
    const [recentLogs, setRecentLogs] = useState([]);

    // Poll for recent logs when location is selected
    useEffect(() => {
        let interval;
        if (submitted && selectedLocation) {
            fetchRecentLogs();
            interval = setInterval(fetchRecentLogs, 5000);
        }
        return () => clearInterval(interval);
    }, [submitted, selectedLocation]);

    const fetchRecentLogs = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_Backend_URL}/api/guard/recent-logs?place_id=${selectedLocation}`, {
                credentials: "include"
            });
            if (res.ok) {
                const data = await res.json();
                setRecentLogs(data);
            }
        } catch (err) {
            console.error("Error fetching logs:", err);
        }
    };

    const handleManualSubmit = async (type) => {
        if (!manualRollNo) return alert("Enter Roll No");
        if (!user || !user.userGuardId) return alert("Guard ID not found. Please relogin.");

        const guardId = user.userGuardId;
        try {
            const response = await fetch(`${import.meta.env.VITE_Backend_URL}/api/guard/manual-log`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    roll_no: manualRollNo,
                    guard_id: guardId,
                    place_id: selectedLocation,
                    scan_type: type
                }),
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.message);
                setManualRollNo("");
                fetchRecentLogs();
            } else {
                alert(data.error || "Failed");
            }
        } catch (err) {
            alert("Error: " + err.message);
        }
    };

    const handleLogout = async () => {
        await fetch(`${import.meta.env.VITE_Backend_URL}/api/logout`, {
            method: "POST",
            credentials: "include",
        });
        window.location.href = "/";
        setIsLoggedIn(false);
        setSubmitted(false);
        setSelectedLocation('');
    };

    return (
        <div className="guard-container">
            <div className="guard-profile-section" onClick={() => setShowProfileMenu(!showProfileMenu)}>
                <div className="profile-icon">{(user?.userName || 'G').charAt(0)}</div>
                {showProfileMenu && (
                    <div className="guard-profile-dropdown">
                        <div className="profile-info">
                            <p className="profile-name">{user?.userName || 'Guard'}</p>
                            <p className="profile-role">{user?.userGuardId || 'ID'}</p>
                        </div>
                        <button className="guard-logout-btn" onClick={handleLogout}>Logout</button>
                    </div>
                )}
            </div>

            {!submitted ? (
                <div className="guard-card">
                    <h1 className="guard-title">Guard Portal</h1>
                    <form className="guard-form" onSubmit={handleSubmit}>
                        <h2 className="guard-form-title">Select Location</h2>
                        <select
                            className="guard-input"
                            value={selectedLocation}
                            onChange={(e) => setSelectedLocation(e.target.value)}
                            required
                        >
                            <option value="" disabled>Select your location</option>
                            {locations.map(([loc, code], index) => (
                                <option key={index} value={code}>{loc}</option>
                            ))}
                        </select>
                        <button type="submit" className="guard-submit-btn">Submit</button>
                    </form>
                </div>
            ) : (
                <div className="guard-dashboard-container">
                    <div className="guard-summary-card">
                        <h2 className="guard-success-title">Guard Portal</h2>
                        <div className="guard-details">
                            <p><strong>Guard:</strong> {user?.userName} ({user?.userGuardId})</p>
                            <p><strong>Location:</strong> {locations.find(l => l[1] === selectedLocation)?.[0] || selectedLocation}</p>
                            <div className="qrCode-container">
                                <QRCodeReactOnly str1={user.userGuardId} str2={selectedLocation} />
                            </div>
                            <button
                                className="guard-action-btn"
                                onClick={() => setSubmitted(false)}>
                                Change Location
                            </button>
                        </div>
                    </div>

                    <div className="guard-controls-section">
                        {/* Manual Override */}
                        <div className="manual-override-card">
                            <h3>Manual Override</h3>
                            <div className="manual-input-group">
                                <input
                                    type="text"
                                    placeholder="Student Roll No"
                                    value={manualRollNo}
                                    onChange={(e) => setManualRollNo(e.target.value)}
                                    className="manual-input"
                                />
                                <div className="manual-actions">
                                    <button className="manual-btn entry" onClick={() => handleManualSubmit('Entry')}>Force Entry</button>
                                    <button className="manual-btn exit" onClick={() => handleManualSubmit('Exit')}>Force Exit</button>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity Feed */}
                        <div className="live-feed-card">
                            <h3>Live Activity Feed</h3>
                            <div className="feed-list">
                                {recentLogs.length === 0 ? <p>No recent activity</p> : (
                                    <table className="feed-table">
                                        <thead>
                                            <tr>
                                                <th>Time</th>
                                                <th>Name</th>
                                                <th>Roll No</th>
                                                <th>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentLogs.map((log, i) => (
                                                <tr key={i}>
                                                    <td>{new Date(log.timestamp).toLocaleTimeString()}</td>
                                                    <td>{log.name}</td>
                                                    <td>{log.roll_no}</td>
                                                    <td>
                                                        <span className={`status-badge ${log.log_type.endsWith('Entry') ? 'entry' : 'exit'}`}>
                                                            {log.log_type}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GuardPage;