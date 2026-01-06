import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import './login.css';

function LoginPage() {
  const navigate=useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const response = await fetch(`${import.meta.env.VITE_Backend_URL}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed");
        return;
      }

      switch (data.role) {
        case 'admin':
          navigate("/admin-dashboard");
          break;
        case 'guard':
          navigate("/guard-page");
          break;
        case 'student':
          navigate("/student-dashboard");
          break;
        default:
          navigate("/dashboard");
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again later.");
    }
  };

  return (
    <div className="login-container">
      <h1 className="login-app-title">Digigate-Web</h1>
      <div className="login-card">
        <h2 className="login-title">Login</h2>
        <form className="login-form" onSubmit={handleLogin}>
          <input
            className="login-input"
            type="text"
            name="username"
            placeholder="ID"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />

          <input
            className="login-input"
            type="password"
            name="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" className="login-btn">Login</button>
        </form>

        {error && <p className="error-message" role="alert">{error}</p>}
      </div>
    </div>
  );
}

export default LoginPage;
