import React from 'react';

const StatsBar = ({ stats }) => {
  // stats가 undefined인 경우 기본값으로 처리
  const safeStats = stats || {
    totalClients: 0,
    onlineClients: 0,
    runningClients: 0,
    activeExecutions: 0,
    totalGroups: 0
  };

  return (
    <div className="stats-bar">
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value">{safeStats.totalClients}</div>
          <div className="stat-label">전체 디스플레이 서버</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{safeStats.onlineClients}</div>
          <div className="stat-label">온라인</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{safeStats.runningClients}</div>
          <div className="stat-label">실행 중</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{safeStats.activeExecutions}</div>
          <div className="stat-label">활성 실행</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{safeStats.totalGroups}</div>
          <div className="stat-label">그룹 수</div>
        </div>
      </div>
    </div>
  );
};

export default StatsBar; 