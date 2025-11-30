import './App.css'
import { Routes, Route, Navigate, BrowserRouter } from 'react-router-dom'
import LoginPage from './pages/login.jsx'
import DashboardPage from './pages/dashboard.jsx'
import AdminDashboard from './pages/admin-dashboard.jsx'
import StudentDashboard from './pages/student-dashboard.jsx'
import GuardPage from './pages/guard-page.jsx'


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/student-dashboard" element={<StudentDashboard />} />
        <Route path="/guard-dashboard" element={<GuardPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
