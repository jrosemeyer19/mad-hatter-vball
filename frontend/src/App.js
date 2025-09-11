import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

import Header from './components/Header';
import TournamentList from './components/TournamentList';
import TournamentDetail from './components/TournamentDetail';
import TournamentSetup from './components/TournamentSetup';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import TournamentHistory from './components/TournamentHistory';

// Set up axios defaults
axios.defaults.baseURL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in on app start
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      verifyToken();
    } else {
      setLoading(false);
    }
  }, []);

  const verifyToken = async () => {
    try {
      const response = await axios.get('/api/auth/verify');
      setUser(response.data.user);
    } catch (error) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Header user={user} onLogout={handleLogout} />
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<TournamentList user={user} />} />
            <Route path="/tournament/:id" element={<TournamentDetail user={user} />} />
            <Route 
              path="/login" 
              element={
                user ? <Navigate to="/create-tournament" /> : <Login onLogin={handleLogin} />
              } 
            />
            <Route 
              path="/create-tournament" 
              element={
                user ? <TournamentSetup user={user} /> : <Navigate to="/login" />
              } 
            />
            <Route 
              path="/users" 
              element={
                user?.isSuperAdmin ? <UserManagement /> : <Navigate to="/" />
              } 
            />
            <Route 
              path="/history" 
              element={
                user ? <TournamentHistory /> : <Navigate to="/login" />
              } 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
