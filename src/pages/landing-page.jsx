import React from 'react';
import { useNavigate } from 'react-router-dom';
import './landing-page.css';

const LandingPage = () => {
    const navigate = useNavigate();

    return (
        <div className="landing-container">
            <div className="landing-content">
                <div className="landing-header">
                    <h1 className="brand-title">DigiGate</h1>
                    <h2 className="college-name">IIITDMJ</h2>
                </div>

                <p className="landing-description">
                    Smart Gate Management System
                </p>

                <button
                    className="login-btn-large"
                    onClick={() => navigate('/login')}
                >
                    Login to Portal
                </button>
            </div>

            <div className="background-shapes">
                <div className="shape shape-1"></div>
                <div className="shape shape-2"></div>
            </div>
        </div>
    );
};

export default LandingPage;
