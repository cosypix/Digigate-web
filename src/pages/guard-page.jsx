import React, { useState } from 'react';
import './guard-page.css';

const GuardPage = () => {
    const [selectedLocation, setSelectedLocation] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const locations = [
        "Aryabhatta",
        "Maa Saraswati",
        "Vashistha",
        "Vivekananda",
        "Panini",
        "Nagarjuna",
        "Computer Center",
        "Main Gate"
    ];

    const handleSubmit = (e) => {
        e.preventDefault();
        if (selectedLocation) {
            setSubmitted(true);
        }
    };

    return (
        <div className="guard-container">
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
                            {locations.map((loc, index) => (
                                <option key={index} value={loc}>{loc}</option>
                            ))}
                        </select>
                        <button type="submit" className="guard-submit-btn">Submit</button>
                    </form>
                </div>
            ) : (
                <div className="guard-summary">
                    <h2 className="guard-success-title">Location Assigned</h2>
                    <p className="guard-info">
                        <strong>Location:</strong> {selectedLocation}
                    </p>
                    <button
                        className="guard-logout-btn"
                        onClick={() => {
                            setSubmitted(false);
                            setSelectedLocation('');
                        }}
                    >
                        Change Location
                    </button>
                </div>
            )}
        </div>
    );
};

export default GuardPage;
