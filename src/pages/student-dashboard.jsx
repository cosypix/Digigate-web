import React, { useState } from 'react';
import './student-dashboard.css';

const StudentDashboard = () => {
    const [selectedHostel, setSelectedHostel] = useState('');
    const [message, setMessage] = useState('');
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [studentName, setStudentName] = useState('Student');

    React.useEffect(() => {
        fetch("http://localhost:3000/api/me", {
            credentials: "include",
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.loggedIn) {
                    setStudentName(data.user.username || 'Student'); // Assuming username is roll no, or add full_name if available
                } else {
                    window.location.href = "/";
                }
            });
    }, []);

    const hostels = [
        "Aryabhatta",
        "Maa Saraswati",
        "Vashistha",
        "Vivekananda",
        "Panini",
        "Nagarjuna"
    ];

    const handleEntry = () => {
        console.log("Entry marked");
        setMessage("Entry marked successfully!");
        setTimeout(() => setMessage(''), 3000);
    };

    const handleExit = () => {
        console.log("Exit marked");
        setMessage("Exit marked successfully!");
        setTimeout(() => setMessage(''), 3000);
    };

    const handleAttendance = () => {
        if (!selectedHostel) {
            alert("Please select a hostel first.");
            return;
        }
        console.log(`Attendance marked for ${selectedHostel}`);
        setMessage(`Attendance marked for ${selectedHostel} successfully!`);
        setTimeout(() => setMessage(''), 3000);
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
                <div className="profile-icon">{studentName.charAt(0)}</div>
                <span className="profile-text">{studentName}</span>
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
                        <div style={{ padding: '8px 10px', cursor: 'pointer', color: '#fff', borderBottom: '1px solid #444' }} onClick={() => {
                            alert("Viewing student details (functionality to be implemented)");
                            setShowProfileMenu(false);
                        }}>View Profile</div>
                        <div style={{ padding: '8px 10px', cursor: 'pointer', color: '#ef4444', fontWeight: 'bold' }} onClick={handleLogout}>Logout</div>
                    </div>
                )}
            </div>

            {message && <div className="message-toast">{message}</div>}

            <div className="student-card">
                <h1 className="student-title">Student Portal</h1>

                <div className="student-content-wrapper">
                    {/* Action Cards */}
                    <div className="action-cards-container">
                        <div className="action-card entry-card" onClick={handleEntry}>
                            <div className="card-icon">📍</div>
                            <div className="card-title">Mark Entry</div>
                            <div className="card-desc">Click here when entering the campus</div>
                        </div>

                        <div className="action-card exit-card" onClick={handleExit}>
                            <div className="card-icon">🏃</div>
                            <div className="card-title">Mark Exit</div>
                            <div className="card-desc">Click here when leaving the campus</div>
                        </div>
                    </div>

                    {/* Attendance Section */}
                    <div className="attendance-container">
                        <h3 className="attendance-title">Hostel Attendance</h3>
                        <select
                            className="student-select"
                            value={selectedHostel}
                            onChange={(e) => setSelectedHostel(e.target.value)}
                        >
                            <option value="" disabled>Select Hostel</option>
                            {hostels.map((hostel, index) => (
                                <option key={index} value={hostel}>{hostel}</option>
                            ))}
                        </select>
                        <button className="attendance-btn" onClick={handleAttendance}>
                            Submit Attendance
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentDashboard;
