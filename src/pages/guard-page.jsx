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
        fetch("http://localhost:3000/api/me", {
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
        if (selectedLocation) {
            const guardId = user.userGuardId;
            try {
                const response = await fetch("http://localhost:3000/api/guard/location", {
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
                    console.log(data.error);
                }
                else {
                    setSubmitted(true);
                }
            } catch (err) {
                setError("Network error. Please try again later.");
            }
        }
    };

    const handleLogout = async () => {
        await fetch("http://localhost:3000/api/logout", {
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
                    <div className="profile-dropdown">
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
                <div className="guard-summary">
                    <h2 className="guard-success-title">Guard</h2>
                    <div className="guard-details">
                        <div className="guard-info">
                            <strong>Guard ID:</strong> {user.userGuardId}<br />
                            <strong>Guard Name:</strong> {user.userName}<br />
                            <strong>Location:</strong> {selectedLocation}
                            <div className="qrCode"><QRCodeReactOnly str1={user.userGuardId} str2={selectedLocation} /></div>
                            <button
                                className="guard-action-btn"
                                onClick={() => setSubmitted(false)}>
                                Change Location
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GuardPage;