import React, { useEffect, useState } from "react";

function DashboardPage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch("https://digigate-web.onrender.com/api/me", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.loggedIn) {
          setUser(data.user);
        } else {
          window.location.href = "/";
        }
      });
  }, []);

  const handleLogout = async () => {
    await fetch("https://digigate-web.onrender.com/api/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/";
  };

  if (!user) return <p>Loading...</p>;

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h2>Welcome, {user.full_name || user.username}!</h2>
      <p>You are successfully logged in.</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}

export default DashboardPage;
