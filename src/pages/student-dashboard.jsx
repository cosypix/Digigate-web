import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import './student-dashboard.css';

const StudentDashboard = () => {
    const [studentDetails, setStudentDetails] = useState(null);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [scanMode, setScanMode] = useState(null); // 'Entry' or 'Exit'
    const [scanResult, setScanResult] = useState(null); // { status: 'success'|'error', message: '', type: '', timestamp: '' }
    const scannerRef = useRef(null);

    useEffect(() => {
        fetch("http://localhost:3000/api/me", {
            credentials: "include",
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.loggedIn) {
                    setStudentDetails(data.user);
                } else {
                    window.location.href = "/";
                }
            });
    }, []);

    const startScanner = (mode) => {
        setScanMode(mode);
        setShowScanner(true);
        setScanResult(null);

        setTimeout(() => {
            const html5QrCode = new Html5Qrcode("reader");
            scannerRef.current = html5QrCode;
            html5QrCode.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 },
                },
                (decodedText) => {
                    handleScanSuccess(decodedText, mode);
                    html5QrCode.stop().then(() => {
                        scannerRef.current = null;
                        setShowScanner(false);
                    }).catch(err => console.error(err));
                },
                (errorMessage) => {
                    // console.log(errorMessage);
                }
            ).catch(err => {
                console.error("Error starting scanner", err);
            });
        }, 100);
    };

    const stopScanner = () => {
        if (scannerRef.current) {
            scannerRef.current.stop().then(() => {
                scannerRef.current = null;
                setShowScanner(false);
            }).catch(err => console.error(err));
        } else {
            setShowScanner(false);
        }
    };

    const handleScanSuccess = async (decodedText, mode) => {
        try {
            console.log("Scanned QR Content:", decodedText);
            let qrData = JSON.parse(decodedText);
            console.log("Parsed QR Data:", qrData);

            // Support for short format: { ts, a, b } -> { timestamp, guard_id, place_id }
            if (qrData.ts && qrData.a && qrData.b) {
                qrData = {
                    guard_id: qrData.a,
                    place_id: qrData.b,
                    timestamp: qrData.ts
                };
                console.log("Mapped Short Format to:", qrData);
            }

            const { guard_id, place_id, timestamp } = qrData;

            if (!guard_id || !place_id || !timestamp) {
                throw new Error("Invalid QR Data Structure. Missing guard_id, place_id, or timestamp.");
            }

            const response = await fetch("http://localhost:3000/api/mark-attendance", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    guard_id,
                    place_id,
                    qr_timestamp: timestamp,
                    scan_type: mode
                }),
            });

            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
                console.log("API Response:", data);
            } catch (e) {
                console.error("Failed to parse JSON. Response was:", responseText);
                throw new Error(`Server Error: ${response.status} ${response.statusText}`);
            }

            if (response.ok) {
                setScanResult({
                    status: 'success',
                    message: data.message,
                    type: mode,
                    timestamp: new Date().toLocaleString()
                });
            } else {
                setScanResult({
                    status: 'error',
                    message: data.error || "Attendance Failed",
                    type: mode,
                    timestamp: new Date().toLocaleString()
                });
            }

        } catch (err) {
            console.error("Scan Error:", err);
            setScanResult({
                status: 'error',
                message: err.message || "Invalid QR Code or Network Error",
                type: mode,
                timestamp: new Date().toLocaleString()
            });
        }
    };

    const handleLogout = async () => {
        await fetch("http://localhost:3000/api/logout", {
            method: "POST",
            credentials: "include",
        });
        window.location.href = "/";
    };

    return (
        <div className="student-container">
            {/* Profile Section */}
            <div className="student-profile-section" onClick={() => setShowProfileMenu(!showProfileMenu)}>
                <div className="profile-icon">{(studentDetails?.userName || 'S').charAt(0)}</div>
                <span className="profile-text">{studentDetails?.userName || 'Student'}</span>
                {showProfileMenu && (
                    <div style={{
                        position: 'absolute',
                        top: '120%',
                        right: 0,
                        background: '#1e293b',
                        padding: '10px',
                        borderRadius: '10px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                        minWidth: '150px',
                        zIndex: 100
                    }}>
                        <div style={{ padding: '8px 10px', color: '#fff', borderBottom: '1px solid #444' }}>
                            <div style={{ fontWeight: 'bold' }}>{studentDetails?.userName}</div>
                            <div style={{ fontSize: '0.8em', color: '#aaa' }}>{studentDetails?.userRollNo}</div>
                        </div>
                        <div style={{ padding: '8px 10px', cursor: 'pointer', color: '#ef4444', fontWeight: 'bold' }} onClick={handleLogout}>Logout</div>
                    </div>
                )}
            </div>

            <div className="student-card">
                <h1 className="student-title">Student Portal</h1>

                <div className="student-content-wrapper">
                    <div className="action-cards-container">
                        <div className="action-card entry-card" onClick={() => startScanner('Entry')}>
                            <div className="card-icon">📍</div>
                            <div className="card-title">Mark Entry</div>
                            <div className="card-desc">Click here to scan QR for Entry</div>
                        </div>

                        <div className="action-card exit-card" onClick={() => startScanner('Exit')}>
                            <div className="card-icon">🏃</div>
                            <div className="card-title">Mark Exit</div>
                            <div className="card-desc">Click here to scan QR for Exit</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Scanner Modal */}
            {showScanner && (
                <div className="scanner-modal-overlay">
                    <div className="scanner-modal">
                        <h2 className="scanner-title">Scanning for {scanMode}</h2>
                        <div id="reader" style={{ width: '100%' }}></div>
                        <button className="close-scanner-btn" onClick={stopScanner}>Close Scanner</button>
                    </div>
                </div>
            )}

            {/* Result Overlay */}
            {scanResult && (
                <div className="result-overlay">
                    <div className={`result-content ${scanResult.status}`}>
                        <div className="result-icon">
                            {scanResult.status === 'success' ? '✅' : '❌'}
                        </div>
                        <h2 className="result-title">
                            {scanResult.status === 'success' ? 'Success!' : 'Failed!'}
                        </h2>
                        <p className="result-message">{scanResult.message}</p>
                        <p className="result-timestamp">{scanResult.timestamp}</p>
                        <button className="result-btn" onClick={() => setScanResult(null)}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudentDashboard;
