import React, { useState } from 'react';
import './ClientMonitor.css';

const ClientMonitor = ({ clients, showToast }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    ip_address: '',
    port: 8081,
    description: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const existingNames = clients.map(c => c.name);
    const existingIPs = clients.map(c => c.ip_address);
    
    if (existingNames.includes(formData.name)) {
      showToast('이미 존재하는 클라이언트 이름입니다.', 'error');
      return;
    }
    
    if (existingIPs.includes(formData.ip_address)) {
      showToast('이미 등록된 IP 주소입니다.', 'error');
      return;
    }

    showToast(`클라이언트 "${formData.name}"이(가) 추가되었습니다. 연결을 확인하고 있습니다...`, 'success');
    setShowAddModal(false);
    setFormData({ name: '', ip_address: '', port: 8081, description: '' });
  };

  const showClientDetail = (client) => {
    setSelectedClient(client);
    setEditFormData({
      name: client.name,
      ip_address: client.ip_address,
      port: client.port,
    });
    setIsEditing(false);
    setShowDetailModal(true);
  };

  const handleUpdateClient = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;

    try {
      const response = await fetch(`/api/clients/${selectedClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData),
      });
      const updatedClient = await response.json();

      if (response.ok) {
        showToast(`클라이언트 "${updatedClient.name}" 정보가 수정되었습니다.`, 'success');
        setIsEditing(false);
        setSelectedClient(updatedClient);
      } else {
        throw new Error(updatedClient.error || '클라이언트 정보 수정에 실패했습니다.');
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const deleteClient = async () => {
    if (!selectedClient) return;

    if (window.confirm(`정말 "${selectedClient.name}" 클라이언트를 삭제하시겠습니까?\n실행 중인 프로세스는 자동으로 중지됩니다.`)) {
      try {
        const response = await fetch(`/api/clients/${selectedClient.id}`, {
          method: 'DELETE',
        });
        const data = await response.json();

        if (response.ok) {
          showToast(`클라이언트 "${selectedClient.name}"이(가) 삭제되었습니다.`, 'success');
          setShowDetailModal(false);
          setSelectedClient(null);
        } else {
          throw new Error(data.error || '클라이언트 삭제에 실패했습니다.');
        }
      } catch (error) {
        showToast(error.message, 'error');
      }
    }
  };

  const powerAction = (action) => {
    const actionNames = {
      'on': '켜기',
      'reboot': '재부팅',
      'off': '끄기'
    };
    showToast(`전원 ${actionNames[action]} 기능은 v2.1에서 활성화됩니다.`, 'info');
  };

  const getStatusIndicator = (status) => {
    let color;
    switch (status) {
      case 'running':
        color = '#22c55e'; // green
        break;
      case 'online':
        color = '#f59e0b'; // amber
        break;
      case 'offline':
      default:
        color = '#ef4444'; // red
        break;
    }
    return <div className="client-status-indicator" style={{ backgroundColor: color }}></div>;
  };

  const formatRelativeTime = (date) => {
    if (!date) return '연결된 적 없음';
    
    const now = new Date();
    const diff = now - new Date(date);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
  };

  // 렌더링할 빈 아이템 계산
  const minItems = 8; // 그리드에 최소 8개 아이템을 유지
  const emptyItemsCount = Math.max(0, minItems - clients.length);
  const emptyItems = Array.from({ length: emptyItemsCount });

  return (
    <div className="client-monitor">
      <div className="monitor-header">
        <h2 className="section-title">
          🖥️ 디스플레이 서버 모니터링
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
            자동 새로고침: <span>30초</span>
          </span>
        </h2>
        <button 
          className="btn btn-secondary btn-with-text" 
          onClick={() => setShowAddModal(true)}
        >
          ➕ 클라이언트 추가
        </button>
      </div>

      <div className="client-grid-container">
        {clients.length > 0 ? (
          clients.map(client => (
            <div
              key={client.id}
              className={`client-item-card ${client.status}`}
              onClick={() => showClientDetail(client)}
            >
              {client.status === 'running' && client.execution_id && (
                <div className="execution-id-badge">{client.execution_id}</div>
              )}
              <div className="client-info-wrapper">
                {getStatusIndicator(client.status)}
                <div className="client-details">
                  <span className="client-name">{client.name}</span>
                  <span className="client-ip">{client.ip_address}</span>
                </div>
              </div>

              {client.status === 'offline' && client.metrics && (
                <div className="client-metrics-display">
                  <div className="metric">CPU: {client.metrics.cpu || 'N/A'}%</div>
                  <div className="metric">RAM: {client.metrics.ram || 'N/A'}%</div>
                  <div className="metric">지연: {client.metrics.latency || 'N/A'}ms</div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="empty-client-grid">
            <p>🖥️</p>
            <p>연결된 디스플레이 서버가 없습니다</p>
            <p>클라이언트가 연결되면 여기에 자동으로 표시됩니다.</p>
          </div>
        )}
        {/* 빈 아이템을 렌더링하여 그리드 레이아웃 유지 */}
        {clients.length > 0 && emptyItems.map((_, index) => (
          <div key={`empty-${index}`} className="client-item-card empty"></div>
        ))}
      </div>

      {/* 클라이언트 추가 모달 */}
      {showAddModal && (
        <div className="modal show">
          <div className="modal-content">
            <div className="modal-header">
              <h3>🖥️ 새 디스플레이 서버 추가</h3>
              <span className="close" onClick={() => setShowAddModal(false)}>&times;</span>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="clientName">🏷️ 클라이언트 이름</label>
                <input 
                  type="text" 
                  id="clientName"
                  className="form-input" 
                  placeholder="예: Display_01" 
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
                <small className="form-help">알아보기 쉬운 이름을 지정하세요 (중복 불가)</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="clientIP">🌐 IP 주소</label>
                <input 
                  type="text" 
                  id="clientIP"
                  className="form-input" 
                  placeholder="192.168.1.101" 
                  pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
                  value={formData.ip_address}
                  onChange={(e) => setFormData(prev => ({ ...prev, ip_address: e.target.value }))}
                  required
                />
                <small className="form-help">클라이언트 PC의 고정 IP 주소</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="clientPort">🔌 포트</label>
                <input 
                  type="number" 
                  id="clientPort"
                  className="form-input" 
                  placeholder="8081" 
                  value={formData.port}
                  onChange={(e) => setFormData(prev => ({ ...prev, port: parseInt(e.target.value) || 8081 }))}
                  min="1" 
                  max="65535"
                />
                <small className="form-help">Python 클라이언트 통신 포트 (기본: 8081)</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="clientDescription">📝 설명 (선택)</label>
                <textarea 
                  id="clientDescription"
                  className="form-input" 
                  rows="2" 
                  placeholder="이 클라이언트에 대한 메모 (위치, 용도 등)"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary">
                  추가
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 클라이언트 상세 모달 */}
      {showDetailModal && selectedClient && (
        <div className="modal show">
          <div className="modal-content">
            <div className="modal-header">
              <h3>🖥️ {isEditing ? `${selectedClient.name} 정보 수정` : `${selectedClient.name} 관리`}</h3>
              <span className="close" onClick={() => setShowDetailModal(false)}>&times;</span>
            </div>
            
            <div className="modal-body">
              {/* 3단 레이아웃 컨테이너 */}
              <div className="modal-column-container">
                {/* 왼쪽 단: 시스템 정보 & 성능 */}
                <div className="modal-column modal-column-info">
                  {/* 시스템 정보 */}
                  <div className="info-section">
                    <h4>📋 시스템 정보</h4>
                    {isEditing ? (
                      <form onSubmit={handleUpdateClient} id="edit-client-form">
                        <div className="info-grid">
                          <div>🏷️ 이름: <input type="text" className="form-input" name="name" value={editFormData.name} onChange={(e) => setEditFormData(p => ({...p, name: e.target.value}))} required /></div>
                          <div>🌐 IP 주소: <input type="text" className="form-input" name="ip_address" value={editFormData.ip_address} onChange={(e) => setEditFormData(p => ({...p, ip_address: e.target.value}))} required pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$" /></div>
                          <div>🔌 포트: <input type="number" className="form-input" name="port" value={editFormData.port} onChange={(e) => setEditFormData(p => ({...p, port: parseInt(e.target.value, 10)}))} required /></div>
                          <div>📊 상태: <span className={`status-badge ${selectedClient.status}`}>
                            {selectedClient.status}
                          </span></div>
                          <div>🕒 마지막 연결: <span>{formatRelativeTime(selectedClient.last_seen)}</span></div>
                          <div>🆔 현재 실행 ID: <span>
                            {selectedClient.status === 'running' ? `exec_${selectedClient.id}_${Date.now().toString().slice(-6)}` : '없음'}
                          </span></div>
                        </div>
                      </form>
                    ) : (
                      <div className="info-grid">
                        <div>🏷️ 이름: <strong>{selectedClient.name}</strong></div>
                        <div>🌐 IP 주소: <strong>{selectedClient.ip_address}</strong></div>
                        <div>🔌 포트: <strong>{selectedClient.port}</strong></div>
                        <div>📊 상태: <span className={`status-badge ${selectedClient.status}`}>
                          {selectedClient.status}
                        </span></div>
                        <div>🕒 마지막 연결: <span>{formatRelativeTime(selectedClient.last_seen)}</span></div>
                        <div>🆔 현재 실행 ID: <span>
                          {selectedClient.status === 'running' ? `exec_${selectedClient.id}_${Date.now().toString().slice(-6)}` : '없음'}
                        </span></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 가운데 단: 설정 */}
                <div className="modal-column modal-column-danger">
                  <div className="danger-section info-section">
                    <h4>⚙️ 설정</h4>
                    <div className="button-group vertical">
                      {!isEditing && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => setIsEditing(true)}
                        >
                          수정
                        </button>
                      )}
                      <button 
                        className="btn btn-danger" 
                        onClick={deleteClient}
                        title="데이터베이스에서 완전 삭제"
                        disabled={isEditing}
                      >
                        삭제
                      </button>
                    </div>
                    {isEditing &&
                      <p className="warning-text">수정 모드에서는 삭제할 수 없습니다.</p>
                    }
                  </div>
                </div>

                {/* 오른쪽 단: 전원 제어 */}
                <div className="modal-column modal-column-power">
                  <div className="info-section power-control-section">
                    <h4>⚡ 전원 제어 <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>(v2.1)</span></h4>
                    <div className="button-group vertical">
                      <button 
                        className="btn btn-primary" 
                        onClick={() => powerAction('on')}
                        title="Wake-on-LAN으로 전원 켜기"
                        disabled
                      >
                        켜기
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => powerAction('reboot')}
                        title="원격 재부팅"
                        disabled
                      >
                        재부팅
                      </button>
                      <button 
                        className="btn btn-danger" 
                        onClick={() => powerAction('off')}
                        title="원격 종료"
                        disabled
                      >
                        끄기
                      </button>
                    </div>
                    <p className="warning-text">💡 전원 제어 기능은 v2.1에서 활성화됩니다.</p>
                  </div>
                </div>
              </div>

              {/* 성능 메트릭 (실행 중일 때만 표시) - 별도 행으로 분리 */}
              {selectedClient.status === 'running' && (
                <div className="info-section performance-section">
                  <h4>⚡ 성능 모니터링</h4>
                  <div className="info-grid horizontal">
                    <div>🖥️ CPU 사용률: <span>{Math.floor(Math.random() * 100)}%</span></div>
                    <div>💾 메모리 사용률: <span>{Math.floor(Math.random() * 100)}%</span></div>
                    <div>💿 디스크 사용률: <span>{Math.floor(Math.random() * 100)}%</span></div>
                    <div>📡 네트워크 지연: <span>{Math.floor(Math.random() * 50) + 10}ms</span></div>
                    <div>🎮 언리얼엔진 프로세스: <span>{Math.floor(Math.random() * 3) + 1}개</span></div>
                  </div>
                </div>
              )}
            </div>
            {isEditing && (
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setIsEditing(false);
                  setEditFormData({
                    name: selectedClient.name,
                    ip_address: selectedClient.ip_address,
                    port: selectedClient.port,
                  });
                }}>
                  취소
                </button>
                <button type="submit" form="edit-client-form" className="btn btn-primary">
                  저장
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientMonitor; 