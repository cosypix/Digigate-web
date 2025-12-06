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
        origin: "https://digigate-web-qyyf.onrender.com",
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
            secure: true,
            httpOnly: true,
            sameSite: 'none',
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

        if(studentResult.rows.length > 0) {
            const user=studentResult.rows[0];
            req.session.user={
                userRollNo:user.roll_no,
                userName:user.name,
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
                userName:user.name,
                userDepartment: user.department,
                role: 'admin'
            };
            client.release();
            return res.json({message: "Login Successful", user: req.session.user, role: 'admin'});
        }   

        // Check Guard 
        const guardResult = await client.query(
            "Select * from Guard where Guard_Id=$1 and password=$2",
            [username, password]
        );
        if(guardResult.rows.length > 0) {
            const user = guardResult.rows[0];
            req.session.user = {
                userGuardId: user.guard_id,
                userName:user.guard_name,
                role: 'guard'
            };
            client.release();
            return res.json({message: "Login Successful", user: req.session.user, role: 'guard'});
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

//Update Guard Location
app.post("/api/guard/location",async(req,res)=>{
    console.log("POST /api/guard/location received");
    console.log("Request body:", req.body);
    const{guardId,location}=req.body;
    try{
        const client=await pool.connect();
        await client.query("UPDATE Guard SET place_id=$1 WHERE guard_id=$2",[location,guardId]);
        client.release();
        console.log("Location updated successfully for guard:", guardId);
        res.json({message:"Location Updated Successfully"});
    } catch (err) { 
        console.error("Error updating location:", err);
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

// Mark Attendance
app.post("/api/mark-attendance", async (req, res) => {
    console.log("Mark Attendance Request Session:", req.session);
    console.log("Mark Attendance Request User:", req.session.user);
    if (!req.session.user || req.session.user.role !== 'student') {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const { guard_id, place_id, qr_timestamp, scan_type } = req.body; // scan_type: 'Entry' or 'Exit'
    const roll_no = req.session.user.userRollNo;

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

        // 2. State Validation (Prevent Double Entry/Exit)
        const lastLogResult = await client.query(
            "SELECT log_type, Timestamp FROM Log WHERE roll_no = $1 AND Place_Id = $2 ORDER BY Timestamp DESC LIMIT 1",
            [roll_no, place_id]
        );

        console.log(`Checking history for Roll: ${roll_no}, Place: ${place_id}`);
        console.log("Last Log Found:", lastLogResult.rows.length > 0 ? lastLogResult.rows[0] : "None");

        const lastLogType = lastLogResult.rows.length > 0 ? lastLogResult.rows[0].log_type : null;
        
        // Check if last log type ends with 'Entry' or 'Exit' to handle prefixes like AEntry, MGEntry
        const isLastEntry = lastLogType && lastLogType.endsWith('Entry');
        const isLastExit = lastLogType && lastLogType.endsWith('Exit');

        console.log(`Scan Type: ${scan_type}, Is Last Entry: ${isLastEntry}`);

        if (scan_type === 'Entry') {
            if (isLastEntry) {
                console.log("Blocking Double Entry");
                client.release();
                return res.status(400).json({ error: "You are already marked as Entered at this location. Please Exit first." });
            }
        } else if (scan_type === 'Exit') {
            if (!isLastEntry) { // Must have entered to exit (or if no history, assume not entered)
                console.log("Blocking Invalid Exit");
                client.release();
                return res.status(400).json({ error: "You are not marked as Entered at this location. Please Enter first." });
            }
        }

        // 3. Log Type Determination
        const locationResult = await client.query("SELECT Place_Name FROM Location WHERE Place_Id = $1", [place_id]);
        
        if (locationResult.rows.length === 0) {
            client.release();
            return res.status(400).json({ error: "Invalid Location" });
        }

        const placeName = locationResult.rows[0].place_name;
        let prefix = "";

        // Check for specific location types
        // Assuming hostel names are known or contain "Hostel" - adjusting based on user plan "Hostel -> A"
        // The plan listed specific hostel names: Aryabhatta, Panini, etc.
        // Let's check for "Main Gate" first
        if (placeName.toLowerCase().includes("main gate")) {
            prefix = "MG";
        } else {
            // Check if it's a hostel. 
            // We can check against a list or if it doesn't match Main Gate, assume Hostel? 
            // Or better, check if it's NOT Main Gate and NOT Library/etc if those exist.
            // For now, let's assume if it's not Main Gate, it might be a hostel or generic.
            // The prompt said: Hostel -> A, Main Gate -> MG, Other -> No Prefix.
            // Let's check for known hostels or just default to A if it looks like a hostel name.
            // Simplified logic: If not Main Gate, check if it is in the hostel list or contains "Hostel".
            // Since I don't have the full list of places, I'll use a heuristic:
            // If it's "Main Gate" -> MG.
            // If it's one of the known hostels (Aryabhatta, Panini, etc) -> A.
            // Else -> ""
            const knownHostels = ["aryabhatta", "maa saraswati", "vashistha", "vivekananda", "panini", "nagarjuna"];
            if (knownHostels.some(h => placeName.toLowerCase().includes(h))) {
                prefix = "A";
            }
        }

        const finalLogType = `${prefix}${scan_type}`;

        // 4. Insert Log
        const timestamp = new Date();
        await client.query(
            "INSERT INTO Log (roll_no, Guard_Id, Place_Id, log_type, Timestamp) VALUES ($1, $2, $3, $4, $5)",
            [roll_no, guard_id, place_id, finalLogType, timestamp]
        );

        client.release();
        res.json({ message: `${scan_type} Marked Successfully`, log_type: finalLogType });

    } catch (err) {
        console.error("Error marking attendance:", err);
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
