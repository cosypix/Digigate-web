import './App.css'
import { Routes, Route, Navigate, BrowserRouter } from 'react-router-dom'
import LoginPage from './pages/login.jsx'
import DashboardPage from './pages/dashboard.jsx'
import AdminDashboard from './pages/admin-dashboard.jsx'
import GuardPage from './pages/guard-page.jsx'
import LandingPage from './pages/landing-page.jsx'
import StudentDashboard from './pages/student-dashboard.jsx'


function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/student-dashboard" element={<StudentDashboard />} />
      <Route path="/admin-dashboard" element={<AdminDashboard />} />
      <Route path="/guard-page" element={<GuardPage />} />
    </Routes>
  )
}

export default App
