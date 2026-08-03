import React from 'react';
import { Link } from 'react-router-dom';

function Header({ user, onLogout }) {
  return (
    <header className="header">
      <h1>
        <Link to="/">
          <span aria-hidden="true">🏐</span>
          Jeff's Mad Hatter Machine
        </Link>
      </h1>

      <nav>
        <Link to="/">Tournaments</Link>

        {user && (
          <>
            <Link to="/history">History</Link>
            <Link to="/create-tournament">Create</Link>
            {user.isSuperAdmin && (
              <Link to="/users">Users</Link>
            )}
            <span className="header-user hide-sm">{user.username}</span>
            <button className="btn btn-secondary btn-sm" onClick={onLogout}>
              Log out
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
