import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './admin-dashboard.css';

const PasswordCell = ({ password }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginLeft: '10px' }}>
            <span style={{ fontFamily: 'monospace' }}>
                {isVisible ? password : '••••••••'}
            </span>
            <button
                onClick={() => setIsVisible(!isVisible)}
                style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    opacity: 0.7
                }}
                title={isVisible ? "Hide password" : "Show password"}
            >
                {isVisible ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                )}
            </button>
        </div>
    );
};


const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({ students: 0, guards: 0, recentLogs: [] });
    const [activeTab, setActiveTab] = useState('overview');
    const [students, setStudents] = useState([]);
    const [guards, setGuards] = useState([]);
    const [locations, setLocations] = useState([]);
    const [logs, setLogs] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [adminDetails, setAdminDetails] = useState(null);

    // Student Management State
    const [showAddModal, setShowAddModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [newStudent, setNewStudent] = useState({
        roll_no: '',
        name: '',
        email: '',
        hostel_name: '',
        password: ''
    });

    useEffect(() => {
        fetchStats();
        fetchAdminDetails();
    }, []);

    const fetchAdminDetails = async () => {
        try {
            const res = await fetch("https://digigate-web.onrender.com/api/me", { credentials: "include" });
            if (res.ok) {
                const data = await res.json();
                if (data.loggedIn) {
                    setAdminDetails(data.user);
                }
            }
        } catch (err) {
            console.error("Error fetching admin details:", err);
        }
    };

    // State for Search and Modals
    const [searchGuard, setSearchGuard] = useState('');
    const [showAddGuardModal, setShowAddGuardModal] = useState(false);
    const [newGuard, setNewGuard] = useState({ guard_id: '', guard_name: '', password: '' });

    const [searchLocation, setSearchLocation] = useState('');
    const [showAddLocationModal, setShowAddLocationModal] = useState(false);
    const [newLocation, setNewLocation] = useState({ place_id: '', place_name: '' });

    const [searchLog, setSearchLog] = useState('');
    const [showAddLogModal, setShowAddLogModal] = useState(false);
    const [newLog, setNewLog] = useState({ roll_no: '', guard_id: '', place_id: '', log_type: 'Entry' });

    const [searchAdmin, setSearchAdmin] = useState('');
    const [showAddAdminModal, setShowAddAdminModal] = useState(false);
    const [newAdmin, setNewAdmin] = useState({ admin_id: '', name: '', department: '', password: '' });

    // Edit State
    const [editingStudent, setEditingStudent] = useState(null);
    const [editingGuard, setEditingGuard] = useState(null);
    const [editingLocation, setEditingLocation] = useState(null);
    const [editingLog, setEditingLog] = useState(null);
    const [editingAdmin, setEditingAdmin] = useState(null);

    // Profile & Overview State
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [logsToday, setLogsToday] = useState(0);

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        if (activeTab === 'students') fetchStudents();
        if (activeTab === 'guards') fetchGuards();
        if (activeTab === 'locations') fetchLocations();
        if (activeTab === 'logs') fetchLogs();
        if (activeTab === 'admins') fetchAdmins();
        if (activeTab === 'overview') calculateLogsToday();
    }, [activeTab]);

    const calculateLogsToday = async () => {
        // We need logs to calculate this. If logs are not fetched, fetch them.
        // Optimization: check if logs are already populated? 
        // But logs might change, so fetching fresh is safer.
        try {
            const res = await fetch('https://digigate-web.onrender.com/api/admin/logs', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
            });
            if (res.ok) {
                const allLogs = await res.json();
                setLogs(allLogs); // Update logs state as well
                const today = new Date().toDateString();
                const count = allLogs.filter(log => new Date(log.timestamp).toDateString() === today).length;
                setLogsToday(count);
            }
        } catch (err) { console.error(err); }
    };

    const fetchStats = async () => {
        try {
            const res = await fetch('https://digigate-web.onrender.com/api/admin/stats', { credentials: 'include' });
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
            const res = await fetch('https://digigate-web.onrender.com/api/admin/students', { credentials: 'include' });
            if (res.ok) setStudents(await res.json());
        } catch (err) { console.error(err); }
    };

    const fetchGuards = async () => {
        try {
            const res = await fetch('https://digigate-web.onrender.com/api/admin/guards', { credentials: 'include' });
            if (res.ok) setGuards(await res.json());
        } catch (err) { console.error(err); }
    };

    const fetchLocations = async () => {
        try {
            const res = await fetch('https://digigate-web.onrender.com/api/admin/locations', { method: "GET", credentials: 'include' });
            if (res.ok) setLocations(await res.json());
        } catch (err) { console.error(err); }
    };

    const fetchLogs = async () => {
        try {
            const res = await fetch('https://digigate-web.onrender.com/api/admin/logs', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: 'include'
            });
            if (res.ok) setLogs(await res.json());
        } catch (err) { console.error(err); }
    };

    const fetchAdmins = async () => {
        try {
            const res = await fetch('https://digigate-web.onrender.com/api/admin/admins', { credentials: 'include' });
            if (res.ok) setAdmins(await res.json());
        } catch (err) { console.error(err); }
    };

    const handleLogout = async () => {
        await fetch('https://digigate-web.onrender.com/api/logout', { method: 'POST', credentials: 'include' });
        navigate('/login');
    };

    const handleAddStudent = async (e) => {
        e.preventDefault();
        const url = editingStudent ? `https://digigate-web.onrender.com/api/admin/update-student/${newStudent.roll_no}` : 'https://digigate-web.onrender.com/api/admin/add-student';
        const method = editingStudent ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newStudent),
                credentials: 'include'
            });
            if (res.ok) {
                setShowAddModal(false);
                setNewStudent({ roll_no: '', name: '', email: '', hostel_name: '', password: '' });
                setEditingStudent(null);
                fetchStudents();
            } else { alert('Failed to save student'); }
        } catch (err) { console.error(err); alert('Error saving student'); }
    };

    const handleAddGuard = async (e) => {
        e.preventDefault();
        const url = editingGuard ? `https://digigate-web.onrender.com/api/admin/update-guard/${newGuard.guard_id}` : 'https://digigate-web.onrender.com/api/admin/add-guard';
        const method = editingGuard ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newGuard),
                credentials: 'include'
            });
            if (res.ok) {
                setShowAddGuardModal(false);
                setNewGuard({ guard_id: '', guard_name: '', password: '' });
                setEditingGuard(null);
                fetchGuards();
            } else { alert('Failed to save guard'); }
        } catch (err) { console.error(err); alert('Error saving guard'); }
    };

    const handleAddLocation = async (e) => {
        e.preventDefault();
        const url = editingLocation ? `https://digigate-web.onrender.com/api/admin/update-location/${newLocation.place_id}` : 'https://digigate-web.onrender.com/api/admin/add-location';
        const method = editingLocation ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLocation),
                credentials: 'include'
            });
            if (res.ok) {
                setShowAddLocationModal(false);
                setNewLocation({ place_id: '', place_name: '' });
                setEditingLocation(null);
                fetchLocations();
            } else { alert('Failed to save location'); }
        } catch (err) { console.error(err); alert('Error saving location'); }
    };

    const handleAddLog = async (e) => {
        e.preventDefault();
        const url = editingLog ? `https://digigate-web.onrender.com/api/admin/update-log` : 'https://digigate-web.onrender.com/api/admin/add-log';
        const method = editingLog ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLog),
                credentials: 'include'
            });
            if (res.ok) {
                setShowAddLogModal(false);
                setNewLog({ roll_no: '', guard_id: '', place_id: '', log_type: 'Entry' });
                setEditingLog(null);
                fetchLogs();
            } else { alert('Failed to save log'); }
        } catch (err) { console.error(err); alert('Error saving log'); }
    };

    const handleAddAdmin = async (e) => {
        e.preventDefault();
        const url = editingAdmin ? `https://digigate-web.onrender.com/api/admin/update-admin/${newAdmin.admin_id}` : 'https://digigate-web.onrender.com/api/admin/add-admin';
        const method = editingAdmin ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newAdmin),
                credentials: 'include'
            });
            if (res.ok) {
                setShowAddAdminModal(false);
                setNewAdmin({ admin_id: '', name: '', department: '', password: '' });
                setEditingAdmin(null);
                fetchAdmins();
            } else { alert('Failed to save admin'); }
        } catch (err) { console.error(err); alert('Error saving admin'); }
    };

    // Delete Handlers
    const handleDeleteStudent = async (id) => {
        if (!window.confirm('Are you sure you want to delete this student?')) return;
        try {
            await fetch(`https://digigate-web.onrender.com/api/admin/delete-student/${id}`, { method: 'DELETE', credentials: 'include' });
            fetchStudents();
        } catch (err) { console.error(err); }
    };

    const handleDeleteGuard = async (id) => {
        if (!window.confirm('Are you sure you want to delete this guard?')) return;
        try {
            await fetch(`https://digigate-web.onrender.com/api/admin/delete-guard/${id}`, { method: 'DELETE', credentials: 'include' });
            fetchGuards();
        } catch (err) { console.error(err); }
    };

    const handleDeleteLocation = async (id) => {
        if (!window.confirm('Are you sure you want to delete this location?')) return;
        try {
            await fetch(`https://digigate-web.onrender.com/api/admin/delete-location/${id}`, { method: 'DELETE', credentials: 'include' });
            fetchLocations();
        } catch (err) { console.error(err); }
    };

    const handleDeleteLog = async (log) => {
        if (!window.confirm('Are you sure you want to delete this log?')) return;
        try {
            await fetch(`https://digigate-web.onrender.com/api/admin/delete-log`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roll_no: log.roll_no, guard_id: log.guard_id, place_id: log.place_id }),
                credentials: 'include'
            });
            fetchLogs();
        } catch (err) { console.error(err); }
    };

    const handleDeleteAdmin = async (id) => {
        if (!window.confirm('Are you sure you want to delete this admin?')) return;
        try {
            await fetch(`https://digigate-web.onrender.com/api/admin/delete-admin/${id}`, { method: 'DELETE', credentials: 'include' });
            fetchAdmins();
        } catch (err) { console.error(err); }
    };

    // Edit Handlers
    const startEditStudent = (student) => {
        setNewStudent(student);
        setEditingStudent(true);
        setShowAddModal(true);
    };

    const startEditGuard = (guard) => {
        setNewGuard(guard);
        setEditingGuard(true);
        setShowAddGuardModal(true);
    };

    const startEditLocation = (location) => {
        setNewLocation(location);
        setEditingLocation(true);
        setShowAddLocationModal(true);
    };

    const startEditLog = (log) => {
        setNewLog(log);
        setEditingLog(true);
        setShowAddLogModal(true);
    };

    const startEditAdmin = (admin) => {
        setNewAdmin(admin);
        setEditingAdmin(true);
        setShowAddAdminModal(true);
    };

    const downloadLogsCSV = () => {
        if (!logs.length) return alert("No logs to download.");

        const headers = ["Roll No", "Guard ID", "Place ID", "Log Type", "Timestamp"];
        const csvRows = [headers.join(",")];

        logs.forEach(log => {
            const row = [
                log.roll_no,
                log.guard_id,
                log.place_id,
                log.log_type,
                new Date(log.timestamp).toLocaleString().replace(/,/g, '') // Remove commas to avoid CSV issues
            ];
            csvRows.push(row.join(","));
        });

        const csvString = csvRows.join("\n");
        const blob = new Blob([csvString], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "logs.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredStudents = students.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.roll_no.toLowerCase().includes(searchTerm.toLowerCase()));
    const filteredGuards = guards.filter(g => g.guard_name.toLowerCase().includes(searchGuard.toLowerCase()) || g.guard_id.toLowerCase().includes(searchGuard.toLowerCase()));
    const filteredLocations = locations.filter(l => l.place_name.toLowerCase().includes(searchLocation.toLowerCase()) || l.place_id.toLowerCase().includes(searchLocation.toLowerCase()));
    const filteredLogs = logs.filter(l => l.roll_no.toLowerCase().includes(searchLog.toLowerCase()) || l.guard_id.toLowerCase().includes(searchLog.toLowerCase()));
    const filteredAdmins = admins.filter(a => a.name.toLowerCase().includes(searchAdmin.toLowerCase()) || a.admin_id.toLowerCase().includes(searchAdmin.toLowerCase()));

    if (loading) return <div className="page-container">Loading Dashboard...</div>;

    return (
        <div className="page-container">

            <header className="modal-header dashboard-header">
                <h1 className="page-title dashboard-title">DigiGate Admin</h1>

                <div className="profile-section" onClick={() => setShowProfileMenu(!showProfileMenu)}>
                    <div className="profile-icon">A</div>
                    {showProfileMenu && (
                        <div className="profile-dropdown">
                            <div className="profile-info">
                                <p className="profile-name">{adminDetails?.userName || 'Admin'}</p>
                                <p className="profile-role">{adminDetails?.userAdminId || 'ID'}</p>
                                <p className="profile-role" style={{ fontSize: '0.8rem', color: '#6366f1' }}>{adminDetails?.userDepartment || 'Dept'}</p>
                            </div>
                            <button className="btn btn-danger small" onClick={handleLogout}>Logout</button>
                        </div>
                    )}
                </div>
            </header>

            <div className="controls">
                <button className={activeTab === 'overview' ? 'btn btn-primary' : 'btn btn-outline'} onClick={() => setActiveTab('overview')}>Overview</button>
                <button className={activeTab === 'students' ? 'btn btn-primary' : 'btn btn-outline'} onClick={() => setActiveTab('students')}>Students</button>
                <button className={activeTab === 'guards' ? 'btn btn-primary' : 'btn btn-outline'} onClick={() => setActiveTab('guards')}>Guards</button>
                <button className={activeTab === 'locations' ? 'btn btn-primary' : 'btn btn-outline'} onClick={() => setActiveTab('locations')}>Locations</button>
                <button className={activeTab === 'logs' ? 'btn btn-primary' : 'btn btn-outline'} onClick={() => setActiveTab('logs')}>Logs</button>
                <button className={activeTab === 'admins' ? 'btn btn-primary' : 'btn btn-outline'} onClick={() => setActiveTab('admins')}>Admins</button>
            </div>

            {activeTab === 'overview' && (
                <div className="list-view">
                    <div className="dashboard-cards">
                        <div className="card"><h3>Total Students</h3><p>{stats.students}</p></div>
                        <div className="card"><h3>Active Guards</h3><p>{stats.guards}</p></div>
                        <div className="card"><h3>Logs Today</h3><p>{logsToday}</p></div>
                    </div>
                </div>
            )}

            {activeTab === 'students' && (
                <div className="list-view">
                    <div className="modal-header dashboard-header" style={{ borderBottom: 'none', padding: 0, marginBottom: '20px' }}>
                        <h2 className="page-title section-title section-title-large" style={{ margin: 0 }}>All Students</h2>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <input type="text" placeholder="Search students..." className="search-input" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Student</button>
                        </div>
                    </div>
                    <table className="student-table">
                        <thead><tr><th>Roll No</th><th>Name</th><th>Email</th><th>Hostel</th><th>Password</th><th>Actions</th></tr></thead>
                        <tbody>
                            {filteredStudents.map((student) => (
                                <tr key={student.roll_no}>
                                    <td>{student.roll_no}</td><td>{student.name}</td><td>{student.email}</td><td>{student.hostel_name}</td><td><PasswordCell password={student.password} /></td>
                                    <td>
                                        <button className="btn btn-primary small" onClick={() => startEditStudent(student)}>Edit</button>
                                        <button className="btn btn-danger small" onClick={() => handleDeleteStudent(student.roll_no)}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'guards' && (
                <div className="list-view">
                    <div className="modal-header dashboard-header" style={{ borderBottom: 'none', padding: 0, marginBottom: '20px' }}>
                        <h2 className="page-title section-title section-title-large" style={{ margin: 0 }}>All Guards</h2>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <input type="text" placeholder="Search guards..." className="search-input" value={searchGuard} onChange={(e) => setSearchGuard(e.target.value)} />
                            <button className="btn btn-primary" onClick={() => setShowAddGuardModal(true)}>+ Add Guard</button>
                        </div>
                    </div>
                    <table className="student-table">
                        <thead><tr><th>Guard ID</th><th>Name</th><th>Assigned Place</th><th>Password</th><th>Actions</th></tr></thead>
                        <tbody>
                            {filteredGuards.map((guard) => (
                                <tr key={guard.guard_id}>
                                    <td>{guard.guard_id}</td><td>{guard.guard_name}</td><td>{guard.place_id}</td><td><PasswordCell password={guard.password} /></td>
                                    <td>
                                        <button className="btn btn-primary small" onClick={() => startEditGuard(guard)}>Edit</button>
                                        <button className="btn btn-danger small" onClick={() => handleDeleteGuard(guard.guard_id)}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'locations' && (
                <div className="list-view">
                    <div className="modal-header dashboard-header" style={{ borderBottom: 'none', padding: 0, marginBottom: '20px' }}>
                        <h2 className="page-title section-title section-title-large" style={{ margin: 0 }}>All Locations</h2>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <input type="text" placeholder="Search locations..." className="search-input" value={searchLocation} onChange={(e) => setSearchLocation(e.target.value)} />
                            <button className="btn btn-primary" onClick={() => setShowAddLocationModal(true)}>+ Add Location</button>
                        </div>
                    </div>
                    <table className="student-table">
                        <thead><tr><th>Place ID</th><th>Place Name</th><th>Actions</th></tr></thead>
                        <tbody>
                            {filteredLocations.map((loc) => (
                                <tr key={loc.place_id}>
                                    <td>{loc.place_id}</td><td>{loc.place_name}</td>
                                    <td>
                                        <button className="btn btn-primary small" onClick={() => startEditLocation(loc)}>Edit</button>
                                        <button className="btn btn-danger small" onClick={() => handleDeleteLocation(loc.place_id)}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'logs' && (
                <div className="list-view">
                    <div className="modal-header dashboard-header" style={{ borderBottom: 'none', padding: 0, marginBottom: '20px' }}>
                        <h2 className="page-title section-title section-title-large" style={{ margin: 0 }}>All Logs</h2>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <input type="text" placeholder="Search logs..." className="search-input" value={searchLog} onChange={(e) => setSearchLog(e.target.value)} />
                            <button className="btn btn-outline" onClick={downloadLogsCSV}>⬇ Download CSV</button>
                            <button className="btn btn-primary" onClick={() => setShowAddLogModal(true)}>+ Add Log</button>
                        </div>
                    </div>
                    <table className="student-table">
                        <thead><tr><th>Roll No</th><th>Guard ID</th><th>Place</th><th>Type</th><th>Time</th><th>Actions</th></tr></thead>
                        <tbody>
                            {filteredLogs.map((log, i) => (
                                <tr key={i}>
                                    <td>{log.roll_no}</td><td>{log.guard_id}</td><td>{log.place_id}</td>
                                    <td><span className={log.log_type === 'Entry' ? 'badge-success' : 'badge-warning'}>{log.log_type}</span></td>
                                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                                    <td>
                                        <button className="btn btn-primary small" onClick={() => startEditLog(log)}>Edit</button>
                                        <button className="btn btn-danger small" onClick={() => handleDeleteLog(log)}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'admins' && (
                <div className="list-view">
                    <div className="modal-header dashboard-header" style={{ borderBottom: 'none', padding: 0, marginBottom: '20px' }}>
                        <h2 className="page-title section-title section-title-large" style={{ margin: 0 }}>All Admins</h2>
                        <div style={{ display: 'flex', gap: '15px' }}>
                            <input type="text" placeholder="Search admins..." className="search-input" value={searchAdmin} onChange={(e) => setSearchAdmin(e.target.value)} />
                            <button className="btn btn-primary" onClick={() => setShowAddAdminModal(true)}>+ Add Admin</button>
                        </div>
                    </div>
                    <table className="student-table">
                        <thead><tr><th>Admin ID</th><th>Name</th><th>Department</th><th>Password</th><th>Actions</th></tr></thead>
                        <tbody>
                            {filteredAdmins.map((admin) => (
                                <tr key={admin.admin_id}>
                                    <td>{admin.admin_id}</td><td>{admin.name}</td><td>{admin.department}</td><td><PasswordCell password={admin.password} /></td>
                                    <td>
                                        <button className="btn btn-primary small" onClick={() => startEditAdmin(admin)}>Edit</button>
                                        <button className="btn btn-danger small" onClick={() => handleDeleteAdmin(admin.admin_id)}>Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modals */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>Add New Student</h3><button className="close-btn" onClick={() => setShowAddModal(false)}>×</button></div>
                        <form className="modal-form" onSubmit={handleAddStudent}>
                            <input type="text" placeholder="Roll Number" required value={newStudent.roll_no} onChange={e => setNewStudent({ ...newStudent, roll_no: e.target.value })} disabled={!!editingStudent} />
                            <input type="text" placeholder="Full Name" required value={newStudent.name} onChange={e => setNewStudent({ ...newStudent, name: e.target.value })} />
                            <input type="email" placeholder="Email Address" required value={newStudent.email} onChange={e => setNewStudent({ ...newStudent, email: e.target.value })} />
                            <input type="text" placeholder="Hostel Name" required value={newStudent.hostel_name} onChange={e => setNewStudent({ ...newStudent, hostel_name: e.target.value })} />
                            <input type="password" placeholder="Password" required value={newStudent.password} onChange={e => setNewStudent({ ...newStudent, password: e.target.value })} />
                            <button type="submit" className="btn btn-primary full">{editingStudent ? 'Save Changes' : 'Add Student'}</button>
                        </form>
                    </div>
                </div>
            )}

            {showAddGuardModal && (
                <div className="modal-overlay" onClick={() => setShowAddGuardModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>Add New Guard</h3><button className="close-btn" onClick={() => setShowAddGuardModal(false)}>×</button></div>
                        <form className="modal-form" onSubmit={handleAddGuard}>
                            <input type="text" placeholder="Guard ID" required value={newGuard.guard_id} onChange={e => setNewGuard({ ...newGuard, guard_id: e.target.value })} disabled={!!editingGuard} />
                            <input type="text" placeholder="Guard Name" required value={newGuard.guard_name} onChange={e => setNewGuard({ ...newGuard, guard_name: e.target.value })} />

                            <input type="password" placeholder="Password" required value={newGuard.password} onChange={e => setNewGuard({ ...newGuard, password: e.target.value })} />
                            <button type="submit" className="btn btn-primary full">{editingGuard ? 'Save Changes' : 'Add Guard'}</button>
                        </form>
                    </div>
                </div>
            )}

            {showAddLocationModal && (
                <div className="modal-overlay" onClick={() => setShowAddLocationModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>Add New Location</h3><button className="close-btn" onClick={() => setShowAddLocationModal(false)}>×</button></div>
                        <form className="modal-form" onSubmit={handleAddLocation}>
                            <input type="text" placeholder="Place ID" required value={newLocation.place_id} onChange={e => setNewLocation({ ...newLocation, place_id: e.target.value })} disabled={!!editingLocation} />
                            <input type="text" placeholder="Place Name" required value={newLocation.place_name} onChange={e => setNewLocation({ ...newLocation, place_name: e.target.value })} />
                            <button type="submit" className="btn btn-primary full">{editingLocation ? 'Save Changes' : 'Add Location'}</button>
                        </form>
                    </div>
                </div>
            )}

            {showAddLogModal && (
                <div className="modal-overlay" onClick={() => setShowAddLogModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>Add New Log</h3><button className="close-btn" onClick={() => setShowAddLogModal(false)}>×</button></div>
                        <form className="modal-form" onSubmit={handleAddLog}>
                            <input type="text" placeholder="Roll Number" required value={newLog.roll_no} onChange={e => setNewLog({ ...newLog, roll_no: e.target.value })} disabled={!!editingLog} />
                            <input type="text" placeholder="Guard ID" required value={newLog.guard_id} onChange={e => setNewLog({ ...newLog, guard_id: e.target.value })} disabled={!!editingLog} />
                            <input type="text" placeholder="Place ID" required value={newLog.place_id} onChange={e => setNewLog({ ...newLog, place_id: e.target.value })} disabled={!!editingLog} />
                            <select value={newLog.log_type} onChange={e => setNewLog({ ...newLog, log_type: e.target.value })}>
                                <option value="Entry">Entry</option>
                                <option value="Exit">Exit</option>
                            </select>
                            <button type="submit" className="btn btn-primary full">{editingLog ? 'Save Changes' : 'Add Log'}</button>
                        </form>
                    </div>
                </div>
            )}

            {showAddAdminModal && (
                <div className="modal-overlay" onClick={() => setShowAddAdminModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header"><h3>Add New Admin</h3><button className="close-btn" onClick={() => setShowAddAdminModal(false)}>×</button></div>
                        <form className="modal-form" onSubmit={handleAddAdmin}>
                            <input type="text" placeholder="Admin ID" required value={newAdmin.admin_id} onChange={e => setNewAdmin({ ...newAdmin, admin_id: e.target.value })} disabled={!!editingAdmin} />
                            <input type="text" placeholder="Name" required value={newAdmin.name} onChange={e => setNewAdmin({ ...newAdmin, name: e.target.value })} />
                            <input type="text" placeholder="Department" required value={newAdmin.department} onChange={e => setNewAdmin({ ...newAdmin, department: e.target.value })} />
                            <input type="password" placeholder="Password" required value={newAdmin.password} onChange={e => setNewAdmin({ ...newAdmin, password: e.target.value })} />
                            <button type="submit" className="btn btn-primary full">{editingAdmin ? 'Save Changes' : 'Add Admin'}</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );

};

export default AdminDashboard;
