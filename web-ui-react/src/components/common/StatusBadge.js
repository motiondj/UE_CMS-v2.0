import React from 'react';
import './StatusBadge.css';

const StatusBadge = ({ status, size = 'medium', showIcon = true }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'running':
      case '콘텐츠 실행 중':
        return {
          label: '실행 중',
          className: 'status-running',
          icon: '⚡'
        };
      case 'online':
        return {
          label: '온라인',
          className: 'status-online',
          icon: '🟢'
        };
      case 'offline':
        return {
          label: '오프라인',
          className: 'status-offline',
          icon: '🔴'
        };
      case 'error':
        return {
          label: '오류',
          className: 'status-error',
          icon: '⚠️'
        };
      default:
        return {
          label: status,
          className: 'status-default',
          icon: '⚪'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={`status-badge status-badge-${size} ${config.className}`}>
      {showIcon && <span className="status-icon">{config.icon}</span>}
      <span className="status-label">{config.label}</span>
    </span>
  );
};

export default StatusBadge; 