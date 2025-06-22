import React from 'react';
import './StatsBar.css';

const StatsBar = ({ 
  totalClients, 
  onlineClients, 
  runningClients, 
  activeExecutions, 
  totalGroups 
}) => {
  return (
    <div className="stats-bar">
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value">{totalClients}</div>
          <div className="stat-label">🖥️ 전체 디스플레이 서버</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{onlineClients}</div>
          <div className="stat-label">🟢 온라인</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{runningClients}</div>
          <div className="stat-label">⚡ 실행 중</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{activeExecutions}</div>
          <div className="stat-label">🎬 현재 실행 중</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{totalGroups}</div>
          <div className="stat-label">👥 그룹 수</div>
        </div>
      </div>
    </div>
  );
};

export default StatsBar; 