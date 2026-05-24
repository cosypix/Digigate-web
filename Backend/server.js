import "dotenv/config";
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import cors from "cors";
import { Pool } from 'pg';
import { OAuth2Client } from 'google-auth-library';
import { lookupTenant, provisionTenant, runMigration, invalidateCache } from './tenantManager.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

// CORS: Allow web frontend, Capacitor mobile app, and LAN dev origins
const allowedOrigins = [
    process.env.Frontend_URL,           // http://localhost:5173 (web dev)
    'https://localhost',                 // Capacitor Android (androidScheme: https)
    'capacitor://localhost',             // Capacitor iOS
    'http://localhost',                  // Capacitor fallback
];

app.use(
    cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (mobile apps, curl, server-to-server)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            // Reject unknown origins
            return callback(new Error('Not allowed by CORS'));
        },
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

// ============================================
// Token-Based Session Fallback (for Capacitor/Mobile)
// ============================================
// Android WebView blocks third-party cookies in cross-origin
// requests. This middleware checks for an Authorization: Bearer
// header containing the session ID and loads the session manually
// when the cookie-based session is empty.
// ============================================
app.use((req, res, next) => {
    // If session already has a user (cookie worked), skip
    if (req.session && req.session.user) return next();

    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

    const sessionId = authHeader.replace('Bearer ', '');
    if (!sessionId) return next();

    // Manually load the session from the store using the token
    const store = req.sessionStore;
    store.get(sessionId, (err, sessionData) => {
        if (err || !sessionData) return next();

        // Attach the session data to the current request
        req.session.user = sessionData.user;
        next();
    });
});

// ============================================
// Tenant Resolution Middleware
// ============================================
// Resolves the tenant from session or X-Tenant-Domain header,
// then attaches req.getClient() which returns a pg client with
// search_path already set to the tenant's schema.
// Uses monkey-patched release to always reset search_path.
// ============================================
const TENANT_SKIP_PATHS = ['/api/superadmin', '/api/me', '/api/logout', '/api/public'];

app.use('/api', async (req, res, next) => {
    // Skip tenant resolution for superadmin & stateless routes
    if (TENANT_SKIP_PATHS.some(p => req.path.startsWith(p.replace('/api', '')))) {
        return next();
    }

    // Priority: session domain > header
    const domain = req.session?.user?.domain
        || req.headers['x-tenant-domain'];

    if (!domain) {
        return res.status(400).json({ error: "Missing institute domain. Please log in again." });
    }

    try {
        const tenant = await lookupTenant(pool, domain);
        req.tenantDomain = domain;
        req.tenantSchema = tenant.schema_name;
        req.tenantName = tenant.institute_name;

        // Attach a getClient helper that sets search_path and
        // monkey-patches release to reset it before returning to pool
        req.getClient = async () => {
            const client = await pool.connect();
            await client.query(`SET search_path TO "${tenant.schema_name}"`);

            const originalRelease = client.release.bind(client);
            let released = false;
            client.release = async () => {
                if (released) return;
                released = true;
                try {
                    await client.query('SET search_path TO public');
                } catch (_) { /* connection may be dead, that's ok */ }
                originalRelease();
            };

            return client;
        };

        next();
    } catch (err) {
        console.error('Tenant resolution failed:', err.message);
        res.status(404).json({ error: "Unregistered Institute" });
    }
});

// Public endpoint to get list of institutes for the login dropdown
app.get("/api/public/tenants", async (req, res) => {
    try {
        const client = await pool.connect();
        // Only fetch name and domain, not internal schema names
        const result = await client.query('SELECT institute_name, domain FROM tenants WHERE is_active = TRUE ORDER BY institute_name ASC');
        client.release();
        res.json(result.rows);
    } catch (err) {
        console.error("Error fetching public tenants:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// ============================================
// Role-Based Login Routes
// ============================================
// Each role hits exactly one table — no cascading queries.
// Student login supports both password and Google OAuth.
// ============================================

// Student Login (Password + Google OAuth)
app.post("/api/login/student", async (req, res) => {
    const { roll_no, password, google_token } = req.body;

    try {
        const client = await req.getClient();

        // --- Google OAuth Path ---
        if (google_token) {
            try {
                const ticket = await googleClient.verifyIdToken({
                    idToken: google_token,
                    audience: process.env.GOOGLE_CLIENT_ID,
                });
                const payload = ticket.getPayload();
                const email = payload.email;

                const result = await client.query(
                    "SELECT * FROM Student WHERE Email = $1",
                    [email]
                );

                if (result.rows.length === 0) {
                    client.release();
                    return res.status(401).json({ error: "Email not found in institute records. Please contact your Admin." });
                }

                const user = result.rows[0];
                req.session.user = {
                    userRollNo: user.roll_no,
                    userName: user.name,
                    userEmail: user.email,
                    hostelName: user.hostel_name,
                    domain: req.tenantDomain,
                    role: 'student'
                };
                client.release();
                return res.json({ message: "Login Successful", user: req.session.user, role: 'student', sessionToken: req.sessionID });
            } catch (tokenErr) {
                client.release();
                console.error("Google token verification failed:", tokenErr.message);
                return res.status(401).json({ error: "Google authentication failed. Please try again." });
            }
        }

        // --- Password Path ---
        if (!roll_no || !password) {
            client.release();
            return res.status(400).json({ error: "Roll No and Password are required." });
        }

        const result = await client.query(
            "SELECT * FROM Student WHERE roll_no = $1 AND password = $2",
            [roll_no, password]
        );

        if (result.rows.length === 0) {
            client.release();
            return res.status(401).json({ error: "Invalid Roll No or Password." });
        }

        const user = result.rows[0];
        req.session.user = {
            userRollNo: user.roll_no,
            userName: user.name,
            userEmail: user.email,
            hostelName: user.hostel_name,
            domain: req.tenantDomain,
            role: 'student'
        };
        client.release();
        return res.json({ message: "Login Successful", user: req.session.user, role: 'student', sessionToken: req.sessionID });
    } catch (err) {
        console.error("Student login error:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Guard Login (Password only)
app.post("/api/login/guard", async (req, res) => {
    const { guard_id, password } = req.body;
    if (!guard_id || !password) {
        return res.status(400).json({ error: "Guard ID and Password are required." });
    }
    try {
        const client = await req.getClient();
        const result = await client.query(
            "SELECT * FROM Guard WHERE Guard_Id = $1 AND password = $2",
            [guard_id, password]
        );

        if (result.rows.length === 0) {
            client.release();
            return res.status(401).json({ error: "Invalid Guard ID or Password." });
        }

        const user = result.rows[0];
        req.session.user = {
            userGuardId: user.guard_id,
            userName: user.guard_name,
            domain: req.tenantDomain,
            role: 'guard'
        };
        client.release();
        return res.json({ message: "Login Successful", user: req.session.user, role: 'guard', sessionToken: req.sessionID });
    } catch (err) {
        console.error("Guard login error:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Admin Login (Password only)
app.post("/api/login/admin", async (req, res) => {
    const { admin_id, password } = req.body;
    if (!admin_id || !password) {
        return res.status(400).json({ error: "Admin ID and Password are required." });
    }
    try {
        const client = await req.getClient();
        const result = await client.query(
            "SELECT * FROM Admin WHERE Admin_Id = $1 AND password = $2",
            [admin_id, password]
        );

        if (result.rows.length === 0) {
            client.release();
            return res.status(401).json({ error: "Invalid Admin ID or Password." });
        }

        const user = result.rows[0];
        req.session.user = {
            userAdminId: user.admin_id,
            userName: user.name,
            userDepartment: user.department,
            domain: req.tenantDomain,
            role: 'admin'
        };
        client.release();
        return res.json({ message: "Login Successful", user: req.session.user, role: 'admin', sessionToken: req.sessionID });
    } catch (err) {
        console.error("Admin login error:", err);
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
        const client = await req.getClient();
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
        const client = await req.getClient();
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
        const client = await req.getClient();
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
        const client = await req.getClient();
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
        const client = await req.getClient();
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
        const client = await req.getClient();
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
        const client = await req.getClient();
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
        const client = await req.getClient();
        await client.query("INSERT INTO Student (Roll_No, Name, Email, Hostel_Name, Password) VALUES ($1, $2, $3, $4, $5)",
            [roll_no, name, email, hostel_name, password]);
        client.release();
        res.json({ message: "Student added" });
    } catch (err) { console.error('Error adding student:', err); res.status(500).json({ error: "Error adding student" }); }
});

app.post("/api/admin/add-guard", isAdmin, async (req, res) => {
    const { guard_id, guard_name, password } = req.body;
    try {
        const client = await req.getClient();
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
        const client = await req.getClient();
        await client.query("INSERT INTO Location (Place_Id, Place_Name) VALUES ($1, $2)",
            [place_id, place_name]);
        client.release();
        res.json({ message: "Location added" });
    } catch (err) { console.error('Error adding location:', err); res.status(500).json({ error: "Error adding location" }); }
});

app.post("/api/admin/add-log", isAdmin, async (req, res) => {
    const { roll_no, guard_id, place_id, log_type } = req.body;
    try {
        const client = await req.getClient();
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
        const client = await req.getClient();
        await client.query("INSERT INTO Admin (Admin_Id, Name, Department, Password) VALUES ($1, $2, $3, $4)",
            [admin_id, name, department, password]);
        client.release();
        res.json({ message: "Admin added" });
    } catch (err) { console.error('Error adding admin:', err); res.status(500).json({ error: "Error adding admin" }); }
});

// --- DELETE Endpoints ---

app.delete("/api/admin/delete-student/:id", isAdmin, async (req, res) => {
    try {
        const client = await req.getClient();
        await client.query("DELETE FROM Student WHERE Roll_No = $1", [req.params.id]);
        client.release();
        res.json({ message: "Student deleted" });
    } catch (err) { console.error('Error deleting student:', err); res.status(500).json({ error: "Error deleting student" }); }
});

app.delete("/api/admin/delete-guard/:id", isAdmin, async (req, res) => {
    try {
        const client = await req.getClient();
        await client.query("DELETE FROM Guard WHERE Guard_Id = $1", [req.params.id]);
        client.release();
        res.json({ message: "Guard deleted" });
    } catch (err) { console.error('Error deleting guard:', err); res.status(500).json({ error: "Error deleting guard" }); }
});

app.delete("/api/admin/delete-location/:id", isAdmin, async (req, res) => {
    try {
        const client = await req.getClient();
        await client.query("DELETE FROM Location WHERE Place_Id = $1", [req.params.id]);
        client.release();
        res.json({ message: "Location deleted" });
    } catch (err) { console.error('Error deleting location:', err); res.status(500).json({ error: "Error deleting location" }); }
});

app.delete("/api/admin/delete-log", isAdmin, async (req, res) => {
    const { roll_no, guard_id, place_id } = req.body;
    try {
        const client = await req.getClient();
        await client.query("DELETE FROM Log WHERE roll_no = $1 AND Guard_Id = $2 AND Place_Id = $3", [roll_no, guard_id, place_id]);
        client.release();
        res.json({ message: "Log deleted" });
    } catch (err) { console.error('Error deleting log:', err); res.status(500).json({ error: "Error deleting log" }); }
});

app.delete("/api/admin/delete-admin/:id", isAdmin, async (req, res) => {
    try {
        const client = await req.getClient();
        await client.query("DELETE FROM Admin WHERE Admin_Id = $1", [req.params.id]);
        client.release();
        res.json({ message: "Admin deleted" });
    } catch (err) { console.error('Error deleting admin:', err); res.status(500).json({ error: "Error deleting admin" }); }
});

// --- UPDATE Endpoints ---

app.put("/api/admin/update-student/:id", isAdmin, async (req, res) => {
    const { name, email, hostel_name, password } = req.body;
    try {
        const client = await req.getClient();
        await client.query("UPDATE Student SET Name=$1, Email=$2, Hostel_Name=$3, Password=$4 WHERE Roll_No=$5",
            [name, email, hostel_name, password, req.params.id]);
        client.release();
        res.json({ message: "Student updated" });
    } catch (err) { console.error('Error updating student:', err); res.status(500).json({ error: "Error updating student" }); }
});

app.put("/api/admin/update-guard/:id", isAdmin, async (req, res) => {
    const { guard_name, password } = req.body;
    try {
        const client = await req.getClient();
        await client.query("UPDATE Guard SET Guard_Name=$1, Password=$2 WHERE Guard_Id=$3",
            [guard_name, password, req.params.id]);
        client.release();
        res.json({ message: "Guard updated" });
    } catch (err) { console.error('Error updating guard:', err); res.status(500).json({ error: "Error updating guard" }); }
});

app.put("/api/admin/update-location/:id", isAdmin, async (req, res) => {
    const { place_name } = req.body;
    try {
        const client = await req.getClient();
        await client.query("UPDATE Location SET Place_Name=$1 WHERE Place_Id=$2",
            [place_name, req.params.id]);
        client.release();
        res.json({ message: "Location updated" });
    } catch (err) { console.error('Error updating location:', err); res.status(500).json({ error: "Error updating location" }); }
});

app.put("/api/admin/update-log", isAdmin, async (req, res) => {
    const { roll_no, guard_id, place_id, log_type } = req.body;
    try {
        const client = await req.getClient();
        await client.query("UPDATE Log SET log_type=$1 WHERE roll_no=$2 AND Guard_Id=$3 AND Place_Id=$4",
            [log_type, roll_no, guard_id, place_id]);
        client.release();
        res.json({ message: "Log updated" });
    } catch (err) { console.error('Error updating log:', err); res.status(500).json({ error: "Error updating log" }); }
});

app.put("/api/admin/update-admin/:id", isAdmin, async (req, res) => {
    const { name, department, password } = req.body;
    try {
        const client = await req.getClient();
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
        const client = await req.getClient();

        // Fetch Location Name for Logic
        const locationResult = await client.query("SELECT Place_Name FROM Location WHERE Place_Id = $1", [place_id]);
        if (locationResult.rows.length === 0) {
            client.release();
            return res.status(400).json({ error: "Invalid Location" });
        }
        const placeName = locationResult.rows[0].place_name;

        // 2. Truth Over History: Fetch Global State (NO Place_Id filter)
        const lastLogResult = await client.query(
            "SELECT Place_Id, log_type, Timestamp FROM Log WHERE roll_no = $1 ORDER BY Timestamp DESC LIMIT 1",
            [roll_no]
        );

        let canScan = true;
        let message = "";

        console.log(`[DEBUG] Marking Attendance: Roll: ${roll_no}, Place: ${placeName} (${place_id}), ScanType: ${scan_type}`);

        if (lastLogResult.rows.length > 0) {
            const lastLog = lastLogResult.rows[0];
            const lastLogTime = new Date(lastLog.timestamp).getTime();
            const serverTime = Date.now();
            const timeDiffSec = (serverTime - lastLogTime) / 1000;
            const hoursDiff = timeDiffSec / 3600;
            const lastLogScanType = lastLog.log_type.endsWith('Entry') ? 'Entry' : 'Exit';

            console.log(`[DEBUG] Global Last Log: Place=${lastLog.place_id}, Type=${lastLog.log_type}, SecsAgo=${timeDiffSec.toFixed(0)}`);

            // Step 1: Rapid Debounce (Anti-Spam)
            if (timeDiffSec < 60) {
                canScan = false;
                message = "Scan already recorded. Please wait a moment.";
            }
            // Step 2 & 3: Evaluate and Auto-Correct
            else if (hoursDiff <= 14) {
                // Rule A: The "Already Did That" Check (Strict Block)
                // If they are doing the exact same action at the exact same place within 14 hours
                if (lastLog.place_id === place_id && lastLogScanType === scan_type) {
                    canScan = false;
                    message = `You are already marked ${scan_type === 'Entry' ? 'Inside' : 'Outside'} this location.`;
                }
                // All other scenarios (Rule B, Rule C) are implicit missed scan recoveries and are ALLOWED.
            }
            // Rule D: > 14 hours (Reset) allows the scan automatically.
        } else {
             console.log("[DEBUG] No history found for this student. First time scan.");
        }

        if (!canScan) {
            console.log(`[DEBUG] Scan Blocked: ${message}`);
            client.release();
            return res.status(400).json({ error: message });
        }
        console.log("[DEBUG] Scan Allowed by Truth Over History.");

        // 3. Determine Log Type Prefix
        let prefix = "";
        const lowerPlace = placeName.toLowerCase();
        if (lowerPlace.includes("main gate")) prefix = "MG";
        else prefix = "A"; // Default for hostels/others

        const finalLogType = `${prefix}${scan_type}`;

        // 4. Insert New Log Row (Appends to history)
        const timestamp = new Date();
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
        const client = await req.getClient();

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

        // Insert new manual log
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
        const client = await req.getClient();
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
        const client = await req.getClient();
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

// ============================================
// SuperAdmin Endpoints
// ============================================
// Authenticated via SUPERADMIN_API_KEY in .env
// These routes are excluded from tenant middleware.
// ============================================

const requireSuperAdmin = (req, res, next) => {
    const key = req.headers['authorization']?.replace('Bearer ', '');
    if (!key || key !== process.env.SUPERADMIN_API_KEY) {
        return res.status(403).json({ error: "Forbidden: Invalid SuperAdmin key" });
    }
    next();
};

// List all registered tenants
app.get("/api/superadmin/tenants", requireSuperAdmin, async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT id, institute_name, domain, schema_name, created_at, is_active FROM tenants ORDER BY created_at DESC');
        client.release();
        res.json(result.rows);
    } catch (err) {
        console.error("Error listing tenants:", err);
        res.status(500).json({ error: "Server Error" });
    }
});

// Provision a new institute (create schema + tables + register)
app.post("/api/superadmin/register-institute", requireSuperAdmin, async (req, res) => {
    const { institute_name, domain, schema_name } = req.body;

    if (!institute_name || !domain || !schema_name) {
        return res.status(400).json({ error: "institute_name, domain, and schema_name are required" });
    }

    try {
        await provisionTenant(pool, schema_name, institute_name, domain);
        invalidateCache(domain);
        res.json({ message: `Institute '${institute_name}' provisioned successfully`, schema_name, domain });
    } catch (err) {
        console.error("Provisioning error:", err);
        res.status(500).json({ error: `Provisioning failed: ${err.message}` });
    }
});

// Run a migration SQL across all tenant schemas
app.post("/api/superadmin/run-migration", requireSuperAdmin, async (req, res) => {
    const { sql } = req.body;

    if (!sql) {
        return res.status(400).json({ error: "sql field is required" });
    }

    try {
        const results = await runMigration(pool, sql);
        res.json(results);
    } catch (err) {
        console.error("Migration error:", err);
        res.status(500).json({ error: `Migration failed: ${err.message}` });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
