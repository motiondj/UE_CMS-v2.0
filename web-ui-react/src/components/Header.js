import React from 'react';

const Header = ({ 
  isSocketConnected, 
  currentTime, 
  connectedCount, 
  isDarkMode, 
  onToggleDarkMode 
}) => {
  return (
    <div className="header">
      <div className="header-content">
        <h1>⚡ Switchboard Plus v2.0</h1>
        <div className="status-info">
          <div className="socket-status">
            Socket 상태: 
            <span className={`socket-indicator ${!isSocketConnected ? 'disconnected' : ''}`}></span>
            <span style={{ color: isSocketConnected ? '#22c55e' : '#ef4444', fontWeight: '600' }}>
              {isSocketConnected ? '연결됨' : '연결 중...'}
            </span>
          </div>
          <div>시간: <span>{currentTime.toLocaleTimeString('ko-KR', {
            hour12: true, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit'
          })}</span></div>
          <div>연결된 클라이언트: <span style={{ color: '#22c55e', fontWeight: '600' }}>{connectedCount}</span></div>
          <button 
            className="settings-btn" 
            onClick={onToggleDarkMode}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Header; 