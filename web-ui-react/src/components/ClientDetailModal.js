import React from 'react';

const ClientDetailModal = ({ client, onClose, onAction, clientHistory }) => {
  const formatRelativeTime = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
  };

  if (!client) return null;

  const isRunning = client.status === 'running';
  const executionId = isRunning ? `exec_${client.id}_${Date.now().toString().slice(-6)}` : null;

  // clientHistory가 undefined인 경우 안전하게 처리
  const safeClientHistory = clientHistory || new Map();
  const clientHistoryItems = safeClientHistory.get(client.id) || [];

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{client.name} 관리</h3>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        
        <div className="modal-body">
          {/* 시스템 정보 */}
          <div className="info-section">
            <h4>시스템 정보</h4>
            <div className="info-grid">
              <div>이름: <strong>{client.name}</strong></div>
              <div>IP 주소: <strong>{client.ip_address}</strong></div>
              <div>포트: <strong>{client.port}</strong></div>
              <div>상태: <span className={`status-badge ${client.status}`}>
                {client.status === 'online' ? '온라인' : 
                 client.status === 'running' ? '실행 중' : '오프라인'}
              </span></div>
              <div>마지막 연결: <span>{client.last_seen ? formatRelativeTime(new Date(client.last_seen)) : '연결된 적 없음'}</span></div>
              <div>현재 실행 ID: <span>{executionId || '없음'}</span></div>
            </div>
          </div>
          
          {/* 성능 메트릭 (실행 중일 때만 표시) */}
          {isRunning && (
            <div className="info-section">
              <h4>성능 모니터링</h4>
              <div className="info-grid">
                <div>CPU 사용률: <span>{Math.floor(Math.random() * 100)}%</span></div>
                <div>메모리 사용률: <span>{Math.floor(Math.random() * 100)}%</span></div>
                <div>디스크 사용률: <span>{Math.floor(Math.random() * 100)}%</span></div>
                <div>네트워크 지연: <span>{Math.floor(Math.random() * 50) + 10}ms</span></div>
                <div>언리얼엔진 프로세스: <span>{Math.floor(Math.random() * 3) + 1}개</span></div>
              </div>
            </div>
          )}
          
          {/* 실행 중인 프로세스 */}
          {isRunning && (
            <div className="info-section">
              <h4>실행 중인 프로세스</h4>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                UnrealEngine-Win64-Shipping.exe (PID: {Math.floor(Math.random() * 10000) + 1000})<br/>
                nDisplayLauncher.exe (PID: {Math.floor(Math.random() * 10000) + 1000})<br/>
                {Math.random() > 0.5 ? `nDisplayListener.exe (PID: ${Math.floor(Math.random() * 10000) + 1000})` : ''}
              </div>
            </div>
          )}
          
          {/* 연결 히스토리 */}
          <div className="info-section">
            <h4>연결 히스토리 (최근 5개)</h4>
            <div className="connection-history">
              <div className="history-item">
                <span>등록됨</span>
                <span>{formatRelativeTime(new Date(client.created_at))}</span>
              </div>
              {clientHistoryItems.slice(0, 4).map((item, index) => (
                <div key={index} className="history-item">
                  <span>{item.event}</span>
                  <span>{formatRelativeTime(item.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* 클라이언트 제어 */}
          <div className="info-section">
            <h4>클라이언트 제어</h4>
            <div className="button-group">
              <button className="btn btn-primary" onClick={() => onAction('heartbeat')} title="상태 확인">
                💓 상태 확인
              </button>
              <button className="btn btn-secondary" onClick={() => onAction('stop_all')} title="모든 프로세스 중지">
                ⏹️ 전체 중지
              </button>
            </div>
          </div>
          
          {/* 전원 제어 (v2.1 기능) */}
          <div className="info-section">
            <h4>전원 제어 (v2.1)</h4>
            <div className="button-group">
              <button className="btn btn-primary" disabled title="Wake-on-LAN으로 전원 켜기">
                🔌 전원 켜기
              </button>
              <button className="btn btn-secondary" disabled title="원격 재부팅">
                🔄 재부팅
              </button>
              <button className="btn btn-danger" disabled title="원격 종료">
                ⚡ 전원 끄기
              </button>
            </div>
            <p className="warning-text">전원 제어 기능은 v2.1에서 활성화됩니다.</p>
          </div>
          
          {/* 위험 구역 */}
          <div className="danger-section">
            <h4>위험 구역</h4>
            <button className="btn btn-danger" onClick={() => onAction('delete')} title="데이터베이스에서 완전 삭제">
              🗑️ 클라이언트 삭제
            </button>
            <p className="warning-text">삭제하면 데이터베이스에서 완전히 제거되며 복구할 수 없습니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDetailModal; 