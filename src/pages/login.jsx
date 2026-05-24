import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { apiFetch, getTenantDomain, saveSessionToken } from "../utils/api.js";
import './login.css';

const ROLES = [
  { key: 'student', label: 'Student', icon: '🎓' },
  { key: 'guard',   label: 'Guard',   icon: '🛡️' },
  { key: 'admin',   label: 'Admin',   icon: '⚙️' },
];

function LoginPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('student');
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Institute dropdown
  const [tenants, setTenants] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Password form fields
  const [formId, setFormId] = useState("");       // roll_no / guard_id / admin_id
  const [password, setPassword] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false); // For student tab toggle

  const hostname = window.location.hostname;
  const isNative = Capacitor.isNativePlatform();
  const isDev = isNative || hostname === 'localhost' || hostname === '127.0.0.1';
  const autoDomain = getTenantDomain();

  const googleBtnRef = useRef(null);

  // Fetch institutes on mount
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_Backend_URL}/api/public/tenants`);
        if (response.ok) {
          const data = await response.json();
          setTenants(data);
          if (autoDomain) {
            setSelectedDomain(autoDomain);
          } else if (data.length > 0) {
            setSelectedDomain(data[0].domain);
          }
        }
      } catch (err) {
        console.error("Failed to fetch institutes:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTenants();
  }, [autoDomain]);

  // Handle successful login redirect
  const handleLoginSuccess = (role) => {
    switch (role) {
      case 'admin':    navigate("/admin-dashboard"); break;
      case 'guard':    navigate("/guard-page"); break;
      case 'student':  navigate("/student-dashboard"); break;
      default:         navigate("/dashboard");
    }
  };

  // Google OAuth callback
  const handleGoogleCallback = useCallback(async (response) => {
    setError("");
    setIsSubmitting(true);

    if (selectedDomain) {
      localStorage.setItem('tenantDomain', selectedDomain);
    }

    const currentDomain = getTenantDomain();
    if (!currentDomain) {
      setError("Please select your institute first.");
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await apiFetch('/api/login/student', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ google_token: response.credential }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Google login failed");
        setIsSubmitting(false);
        return;
      }

      // Save session token for mobile auth fallback
      if (data.sessionToken) saveSessionToken(data.sessionToken);
      handleLoginSuccess(data.role);
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again later.");
      setIsSubmitting(false);
    }
  }, [selectedDomain, navigate]);

  // Initialize Google Auth when student tab is active
  useEffect(() => {
    if (activeTab !== 'student') return;

    if (isNative) {
      // --- NATIVE ANDROID: Initialize Capgo Social Login plugin ---
      try {
        SocialLogin.initialize({
          google: {
            webClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          },
        });
      } catch (err) {
        console.error("Native GoogleAuth init failed:", err);
      }
    } else {
      // --- WEB: Use Google Identity Services script ---
      if (!googleBtnRef.current) return;
      if (typeof window.google === 'undefined' || !window.google.accounts) return;

      try {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
        });

        // Clear previous render
        googleBtnRef.current.innerHTML = '';

        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'filled_blue',
          size: 'large',
          width: 320,
          text: 'signin_with',
          shape: 'pill',
        });
      } catch (err) {
        console.error("Google button init failed:", err);
      }
    }
  }, [activeTab, handleGoogleCallback, isNative]);

  // Native Google Sign-In handler (Android)
  const handleNativeGoogleLogin = async () => {
    setError("");
    setIsSubmitting(true);

    if (selectedDomain) {
      localStorage.setItem('tenantDomain', selectedDomain);
    }

    const currentDomain = getTenantDomain();
    if (!currentDomain) {
      setError("Please select your institute first.");
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await SocialLogin.login({
        provider: 'google',
        options: {},
      });
      // Pass the ID token to the existing backend flow
      handleGoogleCallback({ credential: result.result.idToken });
    } catch (err) {
      console.error("Native Google Auth failed:", err);
      setError("Google Sign-In failed. Please try password login.");
      setIsSubmitting(false);
    }
  };

  // Password form submission
  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    if (selectedDomain) {
      localStorage.setItem('tenantDomain', selectedDomain);
    }

    const currentDomain = getTenantDomain();
    if (!currentDomain) {
      setError("Please select your institute.");
      setIsSubmitting(false);
      return;
    }

    // Build the correct endpoint and body based on active tab
    let endpoint, body;
    switch (activeTab) {
      case 'student':
        endpoint = '/api/login/student';
        body = { roll_no: formId, password };
        break;
      case 'guard':
        endpoint = '/api/login/guard';
        body = { guard_id: formId, password };
        break;
      case 'admin':
        endpoint = '/api/login/admin';
        body = { admin_id: formId, password };
        break;
    }

    try {
      const res = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setIsSubmitting(false);
        return;
      }

      // Save session token for mobile auth fallback
      if (data.sessionToken) saveSessionToken(data.sessionToken);
      handleLoginSuccess(data.role);
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again later.");
      setIsSubmitting(false);
    }
  };

  // Clear form when switching tabs
  const switchTab = (tab) => {
    setActiveTab(tab);
    setFormId("");
    setPassword("");
    setError("");
    setShowPasswordForm(false);
  };

  // Placeholder text per role
  const getIdPlaceholder = () => {
    switch (activeTab) {
      case 'student': return 'Roll Number (e.g. 21BCS001)';
      case 'guard':   return 'Guard ID';
      case 'admin':   return 'Admin ID';
    }
  };

  const getIdLabel = () => {
    switch (activeTab) {
      case 'student': return 'Roll Number';
      case 'guard':   return 'Guard ID';
      case 'admin':   return 'Admin ID';
    }
  };

  return (
    <div className="login-container">
      <h1 className="login-app-title">Digigate-Web</h1>
      <div className="login-card">

        {/* Institute Dropdown */}
        <div className="login-input-group">
          <label className="login-label">Select Institute</label>
          <select
            className="login-input login-select"
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            disabled={isLoading || (autoDomain && !isDev)}
            required
          >
            {isLoading ? (
              <option>Loading institutes...</option>
            ) : (
              <>
                {tenants.length === 0 && <option value="">No institutes found</option>}
                {tenants.map((t) => (
                  <option key={t.domain} value={t.domain}>
                    {t.institute_name}
                  </option>
                ))}
              </>
            )}
          </select>
          {autoDomain && !isDev && (
            <small className="login-helper-text">Detected from URL: {autoDomain}</small>
          )}
        </div>

        {/* Role Tabs */}
        <div className="login-tabs">
          {ROLES.map((role) => (
            <button
              key={role.key}
              type="button"
              className={`login-tab ${activeTab === role.key ? 'active' : ''}`}
              onClick={() => switchTab(role.key)}
            >
              <span className="login-tab-icon">{role.icon}</span>
              <span className="login-tab-label">{role.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="login-tab-content" key={activeTab}>
          
          {/* Student Tab: Google button + hidden password fallback */}
          {activeTab === 'student' && (
            <>
              {isNative ? (
                /* Native Android: custom Google Sign-In button */
                <button
                  type="button"
                  className="login-btn native-google-btn"
                  onClick={handleNativeGoogleLogin}
                  disabled={isSubmitting}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.4 24.4 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                  {isSubmitting ? 'Signing in...' : 'Sign in with Google'}
                </button>
              ) : (
                /* Web: Google Identity Services rendered button */
                <div className="google-btn-wrapper" ref={googleBtnRef}>
                  <div className="google-btn-placeholder">Loading Google Sign-In...</div>
                </div>
              )}

              {!showPasswordForm ? (
                <button
                  type="button"
                  className="login-fallback-toggle"
                  onClick={() => setShowPasswordForm(true)}
                >
                  Having trouble? Sign in with Roll Number
                </button>
              ) : (
                <>
                  <div className="login-divider">
                    <span>or sign in with credentials</span>
                  </div>
                  <form className="login-form" onSubmit={handlePasswordLogin}>
                    <div className="login-input-group">
                      <label className="login-label">{getIdLabel()}</label>
                      <input
                        className="login-input"
                        type="text"
                        placeholder={getIdPlaceholder()}
                        autoComplete="username"
                        value={formId}
                        onChange={(e) => setFormId(e.target.value)}
                        required
                      />
                    </div>
                    <div className="login-input-group">
                      <label className="login-label">Password</label>
                      <input
                        className="login-input"
                        type="password"
                        placeholder="••••••••"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="login-btn" disabled={isSubmitting}>
                      {isSubmitting ? "Signing in..." : "Login"}
                    </button>
                  </form>
                </>
              )}
            </>
          )}

          {/* Guard & Admin Tabs: Password-only forms */}
          {(activeTab === 'guard' || activeTab === 'admin') && (
            <form className="login-form" onSubmit={handlePasswordLogin}>
              <div className="login-input-group">
                <label className="login-label">{getIdLabel()}</label>
                <input
                  className="login-input"
                  type="text"
                  placeholder={getIdPlaceholder()}
                  autoComplete="username"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  required
                />
              </div>
              <div className="login-input-group">
                <label className="login-label">Password</label>
                <input
                  className="login-input"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="login-btn" disabled={isSubmitting}>
                {isSubmitting ? "Signing in..." : "Login"}
              </button>
            </form>
          )}
        </div>

        {error && <p className="error-message" role="alert">{error}</p>}
      </div>
    </div>
  );
}

export default LoginPage;
