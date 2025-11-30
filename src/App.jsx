import './App.css'
import {Routes, Route,Navigate, BrowserRouter} from 'react-router-dom'
import LoginPage from './pages/login.jsx'
import DashboardPage from './pages/dashboard.jsx'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage/>}/>
        <Route path="/login" element={<LoginPage/>}/>
        <Route path="/dashboard" element={<DashboardPage/>}/> 
      </Routes>
    </BrowserRouter>
  )
}

export default App
