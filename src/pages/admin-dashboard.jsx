import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './admin-dashboard.css';


const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ students: 0, guards: 0, recentLogs: [] });
    const [activeTab, setActiveTab] = useState('overview');
    const [students, setStudents] = useState([]);
    const [guards, setGuards] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        if (activeTab === 'students') fetchStudents();
        if (activeTab === 'guards') fetchGuards();
    }, [activeTab]);

    const fetchStats = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/admin/stats', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            } else {
                if (res.status === 401) navigate('/login');
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/admin/students', { credentials: 'include' });
            if (res.ok) setStudents(await res.json());
        } catch (err) { console.error(err); }
    };

    const fetchGuards = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/admin/guards', { credentials: 'include' });
            if (res.ok) setGuards(await res.json());
        } catch (err) { console.error(err); }
    };

    const handleLogout = async () => {
        await fetch('http://localhost:3000/api/logout', { method: 'POST', credentials: 'include' });
        navigate('/login');
    };

    if (loading) return <div className="page-container">Loading Dashboard...</div>;

    return (
        <div className="page-container">

            <header className="modal-header dashboard-header">
                <h1 className="page-title dashboard-title">DigiGate Admin</h1>
                <button className="delete-btn" onClick={handleLogout}>Logout</button>
            </header>



            <div className="controls">
                <button
                    className={activeTab === 'overview' ? 'edit-btn' : 'back-btn'}
                    onClick={() => setActiveTab('overview')}
                >
                    Overview
                </button>
                <button
                    className={activeTab === 'students' ? 'edit-btn' : 'back-btn'}
                    onClick={() => setActiveTab('students')}
                >
                    Students
                </button>
                <button
                    className={activeTab === 'guards' ? 'edit-btn' : 'back-btn'}
                    onClick={() => setActiveTab('guards')}
                >
                    Guards
                </button>
            </div>

            {activeTab === 'overview' && (
                <div className="list-view">
                    <div className="dashboard-cards">
                        <div className="card">
                            <h3>Total Students</h3>
                            <p>{stats.students}</p>
                        </div>
                        <div className="card">
                            <h3>Active Guards</h3>
                            <p>{stats.guards}</p>
                        </div>
                    </div>

                    <h2 className="page-title section-title">Recent Activity</h2>


                    <table className="student-table">
                        <thead>
                            <tr>
                                <th>Roll No</th>
                                <th>Place</th>
                                <th>Type</th>
                                <th>Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.recentLogs.map((log, i) => (
                                <tr key={i}>
                                    <td>{log.roll_no}</td>
                                    <td>{log.place_id}</td>
                                    <td>
                                        <span className={log.log_type === 'Entry' ? 'badge-success' : 'badge-warning'}>
                                            {log.log_type}
                                        </span>
                                    </td>

                                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'students' && (
                <div className="list-view">
                    <h2 className="page-title section-title section-title-large">All Students</h2>


                    <table className="student-table">
                        <thead>
                            <tr>
                                <th>Roll No</th>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Hostel</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.map((student) => (
                                <tr key={student.roll_no}>
                                    <td>{student.roll_no}</td>
                                    <td>{student.name}</td>
                                    <td>{student.email}</td>
                                    <td>{student.hostel_name}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'guards' && (
                <div className="list-view">
                    <h2 className="page-title section-title section-title-large">All Guards</h2>


                    <table className="student-table">
                        <thead>
                            <tr>
                                <th>Guard ID</th>
                                <th>Name</th>
                                <th>Assigned Place</th>
                            </tr>
                        </thead>
                        <tbody>
                            {guards.map((guard) => (
                                <tr key={guard.guard_id}>
                                    <td>{guard.guard_id}</td>
                                    <td>{guard.guard_name}</td>
                                    <td>{guard.place_id}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );

};

export default AdminDashboard;
