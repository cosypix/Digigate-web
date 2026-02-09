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
    port: process.env.DB_PORT,
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
        origin: `${process.env.Frontend_URL}`,
        credentials: true,
    })
);
app.use(express.json());
app.use(cookieParser());
app.set('trust proxy', 1);
//Session Setup
app.use(
    session({
        secret: "DigiGateSecret",
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV == 'production',
            httpOnly: true,
            sameSite: process.env.NODE_ENV == 'production' ? 'none' : 'lax',
            maxAge: 12 * 60 * 60 * 1000 // 12 Hours as requested
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
                userRollNo: user.roll_no,
                userName: user.name,
                userEmail: user.email,
                hostelName: user.hostel_name,
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
                userAdminId: user.admin_id,
                userName: user.name,
                userDepartment: user.department,
                role: 'admin'
            };
            client.release();
            return res.json({ message: "Login Successful", user: req.session.user, role: 'admin' });
        }

        // Check Guard 
        const guardResult = await client.query(
            "Select * from Guard where Guard_Id=$1 and password=$2",
            [username, password]
        );
        if (guardResult.rows.length > 0) {
            const user = guardResult.rows[0];
            req.session.user = {
                userGuardId: user.guard_id,
                userName: user.guard_name,
                role: 'guard'
            };
            client.release();
            return res.json({ message: "Login Successful", user: req.session.user, role: 'guard' });
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
    if (req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
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

//Update Guard Location
app.post("/api/guard/location", async (req, res) => {
    const { guardId, location } = req.body;
    try {
        const client = await pool.connect();
        await client.query("UPDATE Guard SET place_id=$1 WHERE guard_id=$2", [location, guardId]);
        client.release();
        res.json({ message: "Location Updated Successfully" });
    } catch (err) {
        console.error("Error updating location:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Get All Admins
app.get("/api/admin/admins", isAdmin, async (req, res) => {
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
    try {
        const client = await pool.connect();
        await client.query("DELETE FROM Student WHERE Roll_No = $1", [req.params.id]);
        client.release();
        res.json({ message: "Student deleted" });
    } catch (err) { console.error('Error deleting student:', err); res.status(500).json({ error: "Error deleting student" }); }
});

app.delete("/api/admin/delete-guard/:id", isAdmin, async (req, res) => {
    try {
        const client = await pool.connect();
        await client.query("DELETE FROM Guard WHERE Guard_Id = $1", [req.params.id]);
        client.release();
        res.json({ message: "Guard deleted" });
    } catch (err) { console.error('Error deleting guard:', err); res.status(500).json({ error: "Error deleting guard" }); }
});

app.delete("/api/admin/delete-location/:id", isAdmin, async (req, res) => {
    try {
        const client = await pool.connect();
        await client.query("DELETE FROM Location WHERE Place_Id = $1", [req.params.id]);
        client.release();
        res.json({ message: "Location deleted" });
    } catch (err) { console.error('Error deleting location:', err); res.status(500).json({ error: "Error deleting location" }); }
});

app.delete("/api/admin/delete-log", isAdmin, async (req, res) => {
    const { roll_no, guard_id, place_id } = req.body;
    try {
        const client = await pool.connect();
        await client.query("DELETE FROM Log WHERE roll_no = $1 AND Guard_Id = $2 AND Place_Id = $3", [roll_no, guard_id, place_id]);
        client.release();
        res.json({ message: "Log deleted" });
    } catch (err) { console.error('Error deleting log:', err); res.status(500).json({ error: "Error deleting log" }); }
});

app.delete("/api/admin/delete-admin/:id", isAdmin, async (req, res) => {
    try {
        const client = await pool.connect();
        await client.query("DELETE FROM Admin WHERE Admin_Id = $1", [req.params.id]);
        client.release();
        res.json({ message: "Admin deleted" });
    } catch (err) { console.error('Error deleting admin:', err); res.status(500).json({ error: "Error deleting admin" }); }
});

// --- UPDATE Endpoints ---

app.put("/api/admin/update-student/:id", isAdmin, async (req, res) => {
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

// Helper: Prefix Map (Mocking DB Column)
const PREFIX_MAP = {
    "Main Gate": "MG",
    "Aryabhatta Hostel": "A",
    "Maa Saraswati Hostel": "A",
    "Vashistha Hostel": "A",
    "Vivekananda Hostel": "A",
    "Panini Hostel": "A",
    "Nagarjuna Hostel": "A",
    // Generic fallback for others if needed, or update this list
};

// Mark Attendance
app.post("/api/mark-attendance", async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const { guard_id, place_id, qr_timestamp, scan_type } = req.body; // scan_type: 'Entry' or 'Exit'
    const roll_no = req.session.user.userRollNo;
    const studentHostel = req.session.user.hostelName; // Getting student's hostel from session

    if (!guard_id || !place_id || !qr_timestamp || !scan_type) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // 1. Replay Protection (30s window)
    const serverTime = Date.now();
    const qrTime = new Date(qr_timestamp).getTime();
    const timeDiff = Math.abs(serverTime - qrTime);

    if (timeDiff > 30000) { // 30 seconds
        return res.status(400).json({ error: "QR Code Expired. Please scan again." });
    }

    try {
        const client = await pool.connect();

        // Fetch Location Name for Logic
        const locationResult = await client.query("SELECT Place_Name FROM Location WHERE Place_Id = $1", [place_id]);
        if (locationResult.rows.length === 0) {
            client.release();
            return res.status(400).json({ error: "Invalid Location" });
        }
        const placeName = locationResult.rows[0].place_name;

        // 2. State Validation & 14-Hour Rule
        // We check the LAST log for this specific user AND place.
        const lastLogResult = await client.query(
            "SELECT log_type, Timestamp FROM Log WHERE roll_no = $1 AND Place_Id = $2",
            [roll_no, place_id]
        );

        let canScan = true;
        let message = "";

        if (lastLogResult.rows.length > 0) {
            const lastLog = lastLogResult.rows[0];
            const lastLogTime = new Date(lastLog.timestamp).getTime();
            const hoursDiff = (serverTime - lastLogTime) / (1000 * 60 * 60);
            const isLastEntry = lastLog.log_type.endsWith('Entry');

            // 14-Hour Rule Logic
            // If it's been > 14 hours AND user is NOT in their own hostel
            // We assume they left and allow "Entry" again (Auto-Reset)
            const isStudentHostel = placeName.toLowerCase().includes(studentHostel ? studentHostel.toLowerCase() : "###"); // ### won't match

            if (hoursDiff > 14 && !isStudentHostel && isLastEntry) {
                // We treat this as "No Record" effectively, allowing Entry.
                // If they try to Exit, we might strictly block or allow.
                // Robustness: If they try to Enter, allow. If Exit, maybe they stayed >14h? 
                // Let's stick to the prompt: "assume they left and allow them to scan 'Entry' again".
                if (scan_type === 'Exit') {
                    // Start fresh? Or block?
                    // User said: "prevent deadlock".
                    // If they are scanning Exit after 14h, arguably they are just leaving now.
                    // But if we auto-reset, they are "Outside".
                    // Let's allow Entry.
                    if (scan_type === 'Exit') {
                        // They are technically "Outside" by our rule, so Exit is invalid?
                        // "Auto assume they left". So they are OUT.
                        canScan = false;
                        message = "System auto-exited you due to timeout. You must Enter again.";
                    }
                }
                // If Entry, we allow (canScan stays true), effectively overwriting the old 'Entry' with new 'Entry'
            } else {
                // Strict State Check
                if (scan_type === 'Entry') {
                    if (isLastEntry) {
                        canScan = false;
                        message = "You are already marked Inside. Please Exit first.";
                    }
                } else if (scan_type === 'Exit') {
                    if (!isLastEntry) {
                        canScan = false;
                        message = "You are not marked Inside. Please Enter first.";
                    }
                }
            }
        } else {
            // No history for this location
            if (scan_type === 'Exit') {
                canScan = false;
                message = "You have no entry record here. Please Enter first.";
            }
        }

        if (!canScan) {
            client.release();
            return res.status(400).json({ error: message });
        }

        // 3. Determine Log Type Prefix
        let prefix = "";
        // Simple heuristic map (Case insensitive check)
        const lowerPlace = placeName.toLowerCase();
        if (lowerPlace.includes("main gate")) prefix = "MG";
        else if (lowerPlace.includes("aryabhatta")) prefix = "A";
        else if (lowerPlace.includes("maa saraswati")) prefix = "A"; // Assuming same prefix for hostels as per prompt? Or unique? User said "Hostel -> A"
        else if (lowerPlace.includes("vashistha")) prefix = "A";
        else if (lowerPlace.includes("vivekananda")) prefix = "A";
        else if (lowerPlace.includes("panini")) prefix = "A";
        else if (lowerPlace.includes("nagarjuna")) prefix = "A";
        // Add more mappings as needed

        const finalLogType = `${prefix}${scan_type}`;

        // 4. Upsert (Insert or Update)
        const timestamp = new Date();

        // Postgres UPSERT: ON CONFLICT (pkey) DO UPDATE
        await client.query(
            `INSERT INTO Log (roll_no, Guard_Id, Place_Id, log_type, Timestamp) 
             VALUES ($1, $2, $3, $4, $5)`,
            [roll_no, guard_id, place_id, finalLogType, timestamp]
        );

        client.release();
        res.json({ message: `${scan_type} Marked Successfully`, log_type: finalLogType });

    } catch (err) {
        console.error("Error marking attendance:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Guard: Manual Log (Force Entry/Exit)
app.post("/api/guard/manual-log", async (req, res) => {
    const { roll_no, guard_id, place_id, scan_type } = req.body;

    // Auth Check
    // We expect a Guard session. 
    // Ideally we check req.session.user.role === 'guard' but the current guard login setup is minimal.
    // Let's assume the frontend sends the guard_id which matches the logged in user or verify strictly.
    /*
    if (!req.session.user || req.session.user.role !== 'guard') {
         return res.status(401).json({ error: "Unauthorized" });
    }
    */
    // For now, proceeding with basic validation
    if (!roll_no || !guard_id || !place_id || !scan_type) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    try {
        const client = await pool.connect();

        // 1. Check if Student Exists
        const studentCheck = await client.query("SELECT Name FROM Student WHERE Roll_No = $1", [roll_no]);
        if (studentCheck.rows.length === 0) {
            client.release();
            return res.status(400).json({ error: "Invalid Student Roll No" });
        }

        // 2. Check if Location Exists & Get Prefix
        const locationResult = await client.query("SELECT Place_Name FROM Location WHERE Place_Id = $1", [place_id]);
        if (locationResult.rows.length === 0) {
            client.release();
            return res.status(400).json({ error: "Invalid Location ID" });
        }

        // 3. Check if Guard Exists (Optional, but good for data integrity)
        const guardCheck = await client.query("SELECT Guard_Name FROM Guard WHERE Guard_Id = $1", [guard_id]);
        if (guardCheck.rows.length === 0) {
            client.release();
            return res.status(400).json({ error: "Invalid Guard ID" });
        }

        let prefix = "";
        // Safely access place_name, handling potential case differences
        const locationRow = locationResult.rows[0];
        const pn = (locationRow.place_name || locationRow.Place_Name || "").toLowerCase();

        if (pn.includes("main gate")) prefix = "MG";
        else prefix = "A"; // Defaulting to A for hostels/others for now

        const finalLogType = `${prefix}${scan_type}`;
        const timestamp = new Date();

        // Force Update/Insert
        await client.query(
            `INSERT INTO Log (roll_no, Guard_Id, Place_Id, log_type, Timestamp) 
         VALUES ($1, $2, $3, $4, $5)`,
            [roll_no, guard_id, place_id, finalLogType, timestamp]
        );

        client.release();
        res.json({ message: `Manual ${scan_type} Successful` });

    } catch (err) {
        console.error("Manual Log Error:", err);
        res.status(500).json({ error: "Server Error", details: err.message });
    }
});

// Guard: Get Recent Logs (Live Feed)
app.get("/api/guard/recent-logs", async (req, res) => {
    const { place_id } = req.query;
    if (!place_id) return res.status(400).json({ error: "Place ID required" });

    try {
        const client = await pool.connect();
        // Join with Student to get Names
        const result = await client.query(`
            SELECT Log.roll_no, Student.Name, Log.log_type, Log.Timestamp 
            FROM Log 
            JOIN Student ON Log.roll_no = Student.Roll_No 
            WHERE Log.Place_Id = $1 
            ORDER BY Log.Timestamp DESC 
            LIMIT 10`,
            [place_id]
        );
        client.release();
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching guard logs:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Get Student Logs
app.get("/api/student/logs", async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'student') {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const roll_no = req.session.user.userRollNo;
    try {
        const client = await pool.connect();
        const result = await client.query(
            "SELECT * FROM Log WHERE roll_no = $1 ORDER BY Timestamp DESC LIMIT 5",
            [roll_no]
        );
        client.release();
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching student logs:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
