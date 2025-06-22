import React from 'react';

const ClientMonitor = ({ clients, onAddClient, onClientClick }) => {
  return (
    <div className="client-monitor">
      <div className="monitor-header">
        <h2 className="section-title">
          디스플레이 서버 모니터링
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 'normal' }}>
            자동 새로고침: <span id="refreshInterval">30초</span>
          </span>
        </h2>
        <button className="btn btn-secondary btn-with-text" onClick={onAddClient}>
          ➕ 클라이언트 추가
        </button>
      </div>
      <div className="client-grid" id="clientGrid">
        {clients.length === 0 ? (
          <div style={{gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: 'var(--text-muted)'}}>
            <div style={{fontSize: 48, marginBottom: 16}}>🖥️</div>
            <div style={{fontSize: 14, marginBottom: 8}}>연결된 디스플레이 서버가 없습니다</div>
            <div style={{fontSize: 12}}>클라이언트 추가 버튼을 클릭하거나 Python 클라이언트가 연결되면 자동으로 나타납니다</div>
          </div>
        ) : (
          clients.map(client => {
            let statusClass = 'offline';
            let icon = '🔴';
            let statusText = '오프라인';
            let metricsVisible = false;
            if (client.status === 'online') {
              statusClass = 'online';
              icon = '🟡';
              statusText = '대기 중';
            } else if (client.status === 'running') {
              statusClass = 'running';
              icon = '🟢';
              statusText = '언리얼엔진 실행 중';
              metricsVisible = true;
            }
            return (
              <div
                key={client.id}
                className={`client-item ${statusClass}`}
                data-client-id={client.id}
                onClick={() => onClientClick(client.id)}
                style={{ cursor: 'pointer', position: 'relative' }}
              >
                <div className="client-icon">{icon}</div>
                <div className="client-name">{client.name}</div>
                <div className="client-ip">{client.ip_address}</div>
                <div className="client-status">{statusText}</div>
                <div className="client-metrics" style={{ display: metricsVisible ? 'block' : 'none' }}>
                  {/* 실제 메트릭은 서버/소켓 연동 시 동적으로 표시 */}
                  CPU: {Math.floor(Math.random() * 100)}%<br />
                  RAM: {Math.floor(Math.random() * 100)}%<br />
                  지연: {Math.floor(Math.random() * 50) + 10}ms
                </div>
                {/* 실행 ID 표시 (실행 중일 때만) */}
                {client.status === 'running' && (
                  <div className="execution-id">{`exec_${client.id.slice(-6)}`}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ClientMonitor; 