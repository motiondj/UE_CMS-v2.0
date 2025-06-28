import React from 'react';
import './Header.css';

const Header = ({ onRefresh, isConnected, serverStatus }) => {
  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <h1>⚡ UE CMS v2.0</h1>
        </div>
        <div className="header-right">
          <div className="status-indicators">
            <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
              <span className="status-dot"></span>
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <div className={`status-indicator ${serverStatus === 'running' ? 'connected' : 'disconnected'}`}>
              <span className="status-dot"></span>
              Server: {serverStatus === 'running' ? 'Running' : 'Stopped'}
            </div>
          </div>
          <button className="refresh-btn" onClick={onRefresh}>
            🔄 Refresh
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header; 