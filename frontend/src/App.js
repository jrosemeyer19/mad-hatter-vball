/*
 * Jeff's Mad Hatter Machine — volleyball tournament management
 * Copyright (C) 2026 Jeff Rosemeyer
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License
 * for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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
import ChangePassword from './components/ChangePassword';
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

  useEffect(() => {
    // Changing a password retires every token issued against the old one, so a
    // session left open on another device starts failing with a 401. Drop it
    // here rather than leaving that device on screens it can no longer use.
    //
    // These two endpoints are exempt because their 401 is about the password
    // just submitted, not about the session: a mistyped current password must
    // not sign the user out of the form they are standing in.
    const credentialEndpoints = ['/api/auth/login', '/api/auth/change-password'];

    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        const url = error.config?.url || '';
        const isSessionFailure =
          error.response?.status === 401 &&
          !credentialEndpoints.some((endpoint) => url.includes(endpoint));

        if (isSessionFailure && localStorage.getItem('token')) {
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
          setUser(null);
        }

        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
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

  // A password change invalidates the token this tab is holding, so the server
  // sends back a replacement to swap in.
  const handleTokenRefresh = (token) => {
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
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
            <Route path="/" element={<TournamentList />} />
            <Route path="/tournament/:id" element={<TournamentDetail user={user} />} />
            <Route path="/tournament/:id/setup" element={
              user ? <TournamentSetup user={user} isEditing={true} /> : <Navigate to="/login" />
            } />
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
                user?.isSuperAdmin ? <UserManagement user={user} /> : <Navigate to="/" />
              } 
            />
            <Route 
              path="/change-password" 
              element={
                user 
                  ? <ChangePassword user={user} onTokenRefresh={handleTokenRefresh} /> 
                  : <Navigate to="/login" />
              } 
            />
            <Route 
              path="/history" 
              element={
                user ? <TournamentHistory user={user} /> : <Navigate to="/login" />
              } 
            />
          </Routes>
        </main>

        {/* AGPL section 13: people who only ever meet this app over the network
            still have to be offered its source, so the link is part of the UI */}
        <footer className="app-footer">
          <span>Jeff's Mad Hatter Machine</span>
          <span aria-hidden="true">·</span>
          <a
            href="https://github.com/jrosemeyer19/mad-hatter-vball"
            target="_blank"
            rel="noopener noreferrer"
          >
            Source
          </a>
          <span aria-hidden="true">·</span>
          <span>AGPL-3.0</span>
        </footer>
      </div>
    </Router>
  );
}

export default App;
