import React, { useState } from "react";

function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();
        setError("");
        try {
            const response = await fetch("http://localhost:3000/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                credentials: "include",
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (!response.ok) {
                setError(data.error);
            } else {
                if (data.role === 'admin') {
                    window.location.href = "/admin-dashboard";
                } 
                else if (data.role==='guard') {
                    window.location.href = "/guard-page";
                }
                else if (data.role === 'student') {
                    window.location.href = "/student-dashboard";
                } else {
                    window.location.href = "/dashboard";
                }
            }
        } catch (err) {
            setError("Network error. Please try again later.");
        }
    }

    return (
        <div style={{ textAlign: "center", marginTop: "100px" }}>
            <h2>Login</h2>
            <form onSubmit={handleLogin}>
                <input
                    placeholder="Roll No."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                /><br /><br />
                <input
                    placeholder="Password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                /><br /><br />
                <button type="submit">Login</button>
            </form>
            {<p style={{ color: "red" }}>{error}</p>}
        </div>
    );
}
export default LoginPage;