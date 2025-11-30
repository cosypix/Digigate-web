import "dotenv/config";
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import cors from "cors";
import { Pool } from 'pg';

const app = express();

//Database Connection
const pool = new Pool({
    host: process.env.host,
    port: process.env.port,
    database: process.env.database,
    user: process.env.user,
    password: process.env.password,
    ssl: { rejectUnauthorized: false }
});

const isConnected = async () => {
    try {
        const client = await pool.connect();
        client.release();
        return true;
    }
    catch (err) {
        console.log(err);
        return false;
    }
}

isConnected().then(connected => {
    if (connected) {
        console.log("Database Connected Successfully!!");
    } else {
        console.log("Error in Database Connection.");
    }
});

app.use(
    cors({
        origin: "http://localhost:5173",
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());

//Session Setup
app.use(
    session({
        secret: "DigiGateSecret",
        resave: false,
        saveUninitialized: true,
        cookie: {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000
        },
    })
);

//Login Route
app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: "Username and Password are required." });
    }
    try {
        const client = await pool.connect();

        // Check Student
        const studentResult = await client.query(
            "Select * from student where roll_no=$1 and password=$2",
            [username, password]
        );

        if (studentResult.rows.length > 0) {
            const user = studentResult.rows[0];
            req.session.user = {
                username: user.roll_no,
                role: 'student'
            };
            client.release();
            return res.json({ message: "Login Successful", user: req.session.user, role: 'student' });
        }

        // Check Admin
        const adminResult = await client.query(
            "Select * from Admin where Admin_Id=$1 and password=$2",
            [username, password]
        );

        if (adminResult.rows.length > 0) {
            const user = adminResult.rows[0];
            req.session.user = {
                username: user.admin_id,
                role: 'admin'
            };
            client.release();
            return res.json({ message: "Login Successful", user: req.session.user, role: 'admin' });
        }

        client.release();
        return res.status(401).json({ error: "Invalid Credentials." });
    }
    catch (err) {
        console.error("Error during Login:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Check Session
app.get("/api/me", (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true, user: req.session.user });
    } else {
        res.json({ loggedIn: false });
    }
});

// Admin Middleware
const isAdmin = (req, res, next) => {
    console.log('Checking Admin Auth:', req.session.user);
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        console.log('Unauthorized Access Attempt');
        res.status(401).json({ error: "Unauthorized" });
    }
};

// Admin Dashboard Stats
app.get("/api/admin/stats", isAdmin, async (req, res) => {
    try {
        const client = await pool.connect();
        const studentCount = await client.query("SELECT COUNT(*) FROM Student");
        const guardCount = await client.query("SELECT COUNT(*) FROM Guard");
        const recentLogs = await client.query("SELECT * FROM Log ORDER BY Timestamp DESC LIMIT 5");

        client.release();
        res.json({
            students: studentCount.rows[0].count,
            guards: guardCount.rows[0].count,
            recentLogs: recentLogs.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Get All Students
app.get("/api/admin/students", isAdmin, async (req, res) => {
    console.log('GET /api/admin/students');
    try {
        const client = await pool.connect();
        const result = await client.query("SELECT * FROM Student");
        client.release();
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Get All Guards
app.get("/api/admin/guards", isAdmin, async (req, res) => {
    console.log('GET /api/admin/guards');
    try {
        const client = await pool.connect();
        const result = await client.query("SELECT * FROM Guard");
        client.release();
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Get All Locations
app.get("/api/admin/locations", isAdmin, async (req, res) => {
    console.log('GET /api/admin/locations');
    try {
        const client = await pool.connect();
        const result = await client.query("SELECT * FROM Location");
        client.release();
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Get All Logs (Frontend uses POST for this now)
app.post("/api/admin/logs", isAdmin, async (req, res) => {
    console.log('POST /api/admin/logs (Fetch)');
    try {
        const client = await pool.connect();
        const result = await client.query("SELECT * FROM Log ORDER BY Timestamp DESC");
        client.release();
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Get All Admins
app.get("/api/admin/admins", isAdmin, async (req, res) => {
    console.log('GET /api/admin/admins');
    try {
        const client = await pool.connect();
        const result = await client.query("SELECT * FROM Admin");
        client.release();
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server Error" });
    }
});

// --- ADD (POST) Endpoints ---

app.post("/api/admin/add-student", isAdmin, async (req, res) => {
    console.log('POST /add-student', req.body);
    const { roll_no, name, email, hostel_name, password } = req.body;
    try {
        const client = await pool.connect();
        await client.query("INSERT INTO Student (Roll_No, Name, Email, Hostel_Name, Password) VALUES ($1, $2, $3, $4, $5)",
            [roll_no, name, email, hostel_name, password]);
        client.release();
        res.json({ message: "Student added" });
    } catch (err) { console.error('Error adding student:', err); res.status(500).json({ error: "Error adding student" }); }
});

app.post("/api/admin/add-guard", isAdmin, async (req, res) => {
    console.log('POST /add-guard', req.body);
    const { guard_id, guard_name, password } = req.body;
    try {
        const client = await pool.connect();
        // Note: Place_Id is nullable and we removed it from frontend input, so we don't insert it (or insert NULL)
        await client.query("INSERT INTO Guard (Guard_Id, Guard_Name, Password) VALUES ($1, $2, $3)",
            [guard_id, guard_name, password]);
        client.release();
        res.json({ message: "Guard added" });
    } catch (err) { console.error('Error adding guard:', err); res.status(500).json({ error: "Error adding guard" }); }
});

app.post("/api/admin/add-location", isAdmin, async (req, res) => {
    console.log('POST /add-location', req.body);
    const { place_id, place_name } = req.body;
    try {
        const client = await pool.connect();
        await client.query("INSERT INTO Location (Place_Id, Place_Name) VALUES ($1, $2)",
            [place_id, place_name]);
        client.release();
        res.json({ message: "Location added" });
    } catch (err) { console.error('Error adding location:', err); res.status(500).json({ error: "Error adding location" }); }
});

app.post("/api/admin/add-log", isAdmin, async (req, res) => {
    console.log('POST /add-log', req.body);
    const { roll_no, guard_id, place_id, log_type } = req.body;
    try {
        const client = await pool.connect();
        const timestamp = new Date();
        await client.query("INSERT INTO Log (roll_no, Guard_Id, Place_Id, log_type, Timestamp) VALUES ($1, $2, $3, $4, $5)",
            [roll_no, guard_id, place_id, log_type, timestamp]);
        client.release();
        res.json({ message: "Log added" });
    } catch (err) { console.error('Error adding log:', err); res.status(500).json({ error: "Error adding log" }); }
});

app.post("/api/admin/add-admin", isAdmin, async (req, res) => {
    console.log('POST /add-admin', req.body);
    const { admin_id, name, department, password } = req.body;
    try {
        const client = await pool.connect();
        await client.query("INSERT INTO Admin (Admin_Id, Name, Department, Password) VALUES ($1, $2, $3, $4)",
            [admin_id, name, department, password]);
        client.release();
        res.json({ message: "Admin added" });
    } catch (err) { console.error('Error adding admin:', err); res.status(500).json({ error: "Error adding admin" }); }
});

// --- DELETE Endpoints ---

app.delete("/api/admin/delete-student/:id", isAdmin, async (req, res) => {
    console.log('DELETE /delete-student', req.params.id);
    try {
        const client = await pool.connect();
        await client.query("DELETE FROM Student WHERE Roll_No = $1", [req.params.id]);
        client.release();
        res.json({ message: "Student deleted" });
    } catch (err) { console.error('Error deleting student:', err); res.status(500).json({ error: "Error deleting student" }); }
});

app.delete("/api/admin/delete-guard/:id", isAdmin, async (req, res) => {
    console.log('DELETE /delete-guard', req.params.id);
    try {
        const client = await pool.connect();
        await client.query("DELETE FROM Guard WHERE Guard_Id = $1", [req.params.id]);
        client.release();
        res.json({ message: "Guard deleted" });
    } catch (err) { console.error('Error deleting guard:', err); res.status(500).json({ error: "Error deleting guard" }); }
});

app.delete("/api/admin/delete-location/:id", isAdmin, async (req, res) => {
    console.log('DELETE /delete-location', req.params.id);
    try {
        const client = await pool.connect();
        await client.query("DELETE FROM Location WHERE Place_Id = $1", [req.params.id]);
        client.release();
        res.json({ message: "Location deleted" });
    } catch (err) { console.error('Error deleting location:', err); res.status(500).json({ error: "Error deleting location" }); }
});

app.delete("/api/admin/delete-log", isAdmin, async (req, res) => {
    console.log('DELETE /delete-log', req.body);
    const { roll_no, guard_id, place_id } = req.body;
    try {
        const client = await pool.connect();
        await client.query("DELETE FROM Log WHERE roll_no = $1 AND Guard_Id = $2 AND Place_Id = $3", [roll_no, guard_id, place_id]);
        client.release();
        res.json({ message: "Log deleted" });
    } catch (err) { console.error('Error deleting log:', err); res.status(500).json({ error: "Error deleting log" }); }
});

app.delete("/api/admin/delete-admin/:id", isAdmin, async (req, res) => {
    console.log('DELETE /delete-admin', req.params.id);
    try {
        const client = await pool.connect();
        await client.query("DELETE FROM Admin WHERE Admin_Id = $1", [req.params.id]);
        client.release();
        res.json({ message: "Admin deleted" });
    } catch (err) { console.error('Error deleting admin:', err); res.status(500).json({ error: "Error deleting admin" }); }
});

// --- UPDATE Endpoints ---

app.put("/api/admin/update-student/:id", isAdmin, async (req, res) => {
    console.log('PUT /update-student', req.params.id, req.body);
    const { name, email, hostel_name, password } = req.body;
    try {
        const client = await pool.connect();
        await client.query("UPDATE Student SET Name=$1, Email=$2, Hostel_Name=$3, Password=$4 WHERE Roll_No=$5",
            [name, email, hostel_name, password, req.params.id]);
        client.release();
        res.json({ message: "Student updated" });
    } catch (err) { console.error('Error updating student:', err); res.status(500).json({ error: "Error updating student" }); }
});

app.put("/api/admin/update-guard/:id", isAdmin, async (req, res) => {
    console.log('PUT /update-guard', req.params.id, req.body);
    const { guard_name, password } = req.body;
    try {
        const client = await pool.connect();
        await client.query("UPDATE Guard SET Guard_Name=$1, Password=$2 WHERE Guard_Id=$3",
            [guard_name, password, req.params.id]);
        client.release();
        res.json({ message: "Guard updated" });
    } catch (err) { console.error('Error updating guard:', err); res.status(500).json({ error: "Error updating guard" }); }
});

app.put("/api/admin/update-location/:id", isAdmin, async (req, res) => {
    console.log('PUT /update-location', req.params.id, req.body);
    const { place_name } = req.body;
    try {
        const client = await pool.connect();
        await client.query("UPDATE Location SET Place_Name=$1 WHERE Place_Id=$2",
            [place_name, req.params.id]);
        client.release();
        res.json({ message: "Location updated" });
    } catch (err) { console.error('Error updating location:', err); res.status(500).json({ error: "Error updating location" }); }
});

app.put("/api/admin/update-log", isAdmin, async (req, res) => {
    console.log('PUT /update-log', req.body);
    const { roll_no, guard_id, place_id, log_type } = req.body;
    try {
        const client = await pool.connect();
        await client.query("UPDATE Log SET log_type=$1 WHERE roll_no=$2 AND Guard_Id=$3 AND Place_Id=$4",
            [log_type, roll_no, guard_id, place_id]);
        client.release();
        res.json({ message: "Log updated" });
    } catch (err) { console.error('Error updating log:', err); res.status(500).json({ error: "Error updating log" }); }
});

app.put("/api/admin/update-admin/:id", isAdmin, async (req, res) => {
    console.log('PUT /update-admin', req.params.id, req.body);
    const { name, department, password } = req.body;
    try {
        const client = await pool.connect();
        await client.query("UPDATE Admin SET Name=$1, Department=$2, Password=$3 WHERE Admin_Id=$4",
            [name, department, password, req.params.id]);
        client.release();
        res.json({ message: "Admin updated" });
    } catch (err) { console.error('Error updating admin:', err); res.status(500).json({ error: "Error updating admin" }); }
});

//Logout
app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ message: "Logged out" });
    });
});

const port = 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});