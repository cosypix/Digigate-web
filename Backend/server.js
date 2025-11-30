import "dotenv/config";
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import cors from "cors";
import {Pool} from 'pg';

const app = express();
//Database Connection
const pool= new Pool({
    host:process.env.host,
    port:process.env.port,
    database:process.env.database,
    user:process.env.user,
    password:process.env.password,
    ssl:{rejectUnauthorized:false}
});

const isConnected=async()=>{
    try{
        const client=await pool.connect();
        return true;
    }
    catch(err){
        console.log(err);
        return false;
    }
}
if(isConnected){
    console.log("Database Connected Successfully!!");
}
else{
    console.log("Error in Database Connection.");
}

app.use(
    cors({
        origin:"http://localhost:5173",
        credentials:true,
    })
);
app.use(express.json());
app.use(cookieParser());

//Session Setup
app.use(
    session({
        secret:"DigiGateSecret",
        resave:false,
        saveUninitialized:true,
        cookie:{
            httpOnly:true,
            maxAge:24*60*60*1000
        },
    })
);

//Login Route
app.post("/api/login",async(req,res)=>{
    const {username,password}=req.body;
    if(!username || !password){
        return res.status(400).json({error:"Username and Password are required."});
    }
    try{
        const client=await pool.connect();
        const result=await client.query(
            "Select * from student where roll_no=$1 and password=$2",
            [username,password]
        );
        if(result.rows.length===0)
            return res.status(401).json({error:"Invalid Roll Number or Password."});  
        const user=result.rows[0];
        req.session.user={
            username:user.username,
        };
        res.json({message:"Login Successful",user:req.session.user});
    }
    catch(err){
        console.error("Error during Login:",err);
        res.status(500).json({error:"Server Error"});
    }
});

// Check Session
app.get("/api/me",(req,res)=>{
    if(req.session.user){
        res.json({loggedIn:true,user:req.session.user});
    }else{
        res.json({loggedIn:false});
    }
});

//Logout
app.post("/api/logout",(req,res)=>{
    req.session.destroy(()=>{
        res.clearCookie("connect.sid");
        res.json({message:"Logged out"});
    });
    window.location.href="\login";
});

const port=3000;
app.listen(port,()=>{
    console.log(`Server running on port ${port}`);
});