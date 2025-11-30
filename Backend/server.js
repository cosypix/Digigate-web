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

        if(studentResult.rows.length > 0) {
            const user=studentResult.rows[0];
            req.session.user={
                userRollNo:user.roll_no,
                userName:user.name,
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

//Logout
app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ message: "Logged out" });
    });
    window.location.href = "\login";
});

const port = 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});