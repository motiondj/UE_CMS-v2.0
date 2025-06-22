import React, { useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

const ClientDetailModal = ({ client, onClose }) => {
  const [executionHistory, setExecutionHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExecutionHistory();
  }, [client.id]);

  const loadExecutionHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/execution-history?client_id=${client.id}`);
      if (response.ok) {
        const data = await response.json();
        setExecutionHistory(data);
      }
    } catch (error) {
      console.error('실행 히스토리 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#28a745';
      case 'failed':
        return '#dc3545';
      case 'executing':
        return '#ffc107';
      default:
        return '#6c757d';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed':
        return '완료';
      case 'failed':
        return '실패';
      case 'executing':
        return '실행 중';
      default:
        return status;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal client-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">클라이언트 상세 정보</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="client-detail-content">
          <div className="client-info-section">
            <h3>기본 정보</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">이름:</span>
                <span className="info-value">{client.name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">IP 주소:</span>
                <span className="info-value">{client.ip_address}</span>
              </div>
              <div className="info-item">
                <span className="info-label">포트:</span>
                <span className="info-value">{client.port}</span>
              </div>
              <div className="info-item">
                <span className="info-label">상태:</span>
                <span 
                  className="status-badge"
                  style={{ 
                    backgroundColor: `${getStatusColor(client.status)}20`,
                    color: getStatusColor(client.status),
                    borderColor: `${getStatusColor(client.status)}40`
                  }}
                >
                  {getStatusText(client.status)}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">등록일:</span>
                <span className="info-value">{formatDate(client.created_at)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">마지막 접속:</span>
                <span className="info-value">
                  {client.last_seen ? formatDate(client.last_seen) : '없음'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="execution-history-section">
            <h3>실행 히스토리</h3>
            {loading ? (
              <div className="loading-text">로딩 중...</div>
            ) : executionHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-text">실행 히스토리가 없습니다.</div>
              </div>
            ) : (
              <div className="history-list">
                {executionHistory.slice(0, 10).map(exec => (
                  <div key={exec.id} className="history-item">
                    <div className="history-header">
                      <span className="history-preset">{exec.preset_name}</span>
                      <span 
                        className="status-badge"
                        style={{ 
                          backgroundColor: `${getStatusColor(exec.status)}20`,
                          color: getStatusColor(exec.status),
                          borderColor: `${getStatusColor(exec.status)}40`
                        }}
                      >
                        {getStatusText(exec.status)}
                      </span>
                    </div>
                    <div className="history-time">
                      실행 ID: {exec.id} | {formatDate(exec.executed_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientDetailModal; 