import React from 'react';
import { Link } from 'react-router-dom';

function Header({ user, onLogout }) {
  return (
    <header className="header">
      <h1>
        <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>
          Jeff's Mad Hatter Machine
        </Link>
      </h1>
      
      <nav>
        <Link to="/">Tournaments</Link>
        
        {user && (
          <>
            <Link to="/history">History</Link>
            <Link to="/create-tournament">Create Tournament</Link>
            {user.isSuperAdmin && (
              <Link to="/users">Manage Users</Link>
            )}
            <span style={{ color: '#bdc3c7' }}>Welcome, {user.username}</span>
            <button className="logout-btn" onClick={onLogout}>
              Logout
            </button>
          </>
        )}
        
        {!user && (
          <Link to="/login">Login</Link>
        )}
      </nav>
    </header>
  );
}

export default Header;
