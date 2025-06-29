import React, { useState } from 'react';
import './ClientMonitor.css';

const ClientMonitor = ({ clients, showToast, onClientUpdate }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [formData, setFormData] = useState({
    name: '',
    ip_address: '',
    port: 8081,
    description: '',
    mac_address: ''
  });
  const [macAddress, setMacAddress] = useState('');
  const [showMacEditModal, setShowMacEditModal] = useState(false);
  const [currentMacAddress, setCurrentMacAddress] = useState('');

  // 클라이언트 상세 모달이 열릴 때 MAC 주소 로드
  React.useEffect(() => {
    if (showDetailModal && selectedClient) {
      // 클라이언트 객체의 mac_address 속성을 직접 사용
      const mac = selectedClient.mac_address || '설정되지 않음';
      setCurrentMacAddress(mac);
      const macDisplay = document.getElementById('mac-address-display');
      if (macDisplay) {
        macDisplay.textContent = mac;
      }
    }
  }, [showDetailModal, selectedClient]);

  const handleSubmit = async (e) => {
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

    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          ip_address: formData.ip_address,
          port: formData.port,
          description: formData.description
        })
      });

      const result = await response.json();

      if (response.ok) {
        // MAC 주소가 입력된 경우 별도로 업데이트
        if (formData.mac_address && formData.mac_address.trim()) {
          const normalizedMac = normalizeMacAddress(formData.mac_address);
          if (normalizedMac) {
            try {
              const macResponse = await fetch(`/api/clients/name/${result.name}/mac`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  mac_address: normalizedMac,
                  is_manual: true
                })
              });
              
              if (macResponse.ok) {
                showToast(`클라이언트 "${formData.name}"이(가) 추가되었습니다. MAC 주소도 함께 설정되었습니다.`, 'success');
              } else {
                showToast(`클라이언트 "${formData.name}"이(가) 추가되었습니다. MAC 주소 설정에 실패했습니다.`, 'warning');
              }
            } catch (macError) {
              showToast(`클라이언트 "${formData.name}"이(가) 추가되었습니다. MAC 주소 설정에 실패했습니다.`, 'warning');
            }
          } else {
            showToast(`클라이언트 "${formData.name}"이(가) 추가되었습니다. MAC 주소 형식이 올바르지 않습니다.`, 'warning');
          }
        } else {
          showToast(`클라이언트 "${formData.name}"이(가) 추가되었습니다. 연결을 확인하고 있습니다...`, 'success');
        }
        
        setShowAddModal(false);
        setFormData({ name: '', ip_address: '', port: 8081, description: '', mac_address: '' });
        // 클라이언트 목록 새로고침은 App.js의 socket listener가 처리
      } else {
        throw new Error(result.error || '클라이언트 추가에 실패했습니다.');
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const showClientDetail = (client) => {
    setSelectedClient(client);
    setShowDetailModal(true);
  };

  const openEditModal = (client) => {
    setSelectedClient(client);
    setEditFormData({
      name: client.name,
      ip_address: client.ip_address,
      port: client.port,
      mac_address: client.mac_address || '',
    });
    setShowEditModal(true);
  };

  const handleUpdateClient = async (e) => {
    e.preventDefault();
    if (!selectedClient) return;

    try {
      // 기존 정보와 MAC 주소 분리
      const { mac_address, ...restEditFormData } = editFormData;
      // 1. 일반 정보 업데이트
      const response = await fetch(`/api/clients/${selectedClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(restEditFormData),
      });
      const updatedClient = await response.json();

      if (response.ok) {
        // 2. MAC 주소가 변경된 경우 별도 API 호출
        if (
          typeof mac_address === 'string' &&
          mac_address.trim() &&
          mac_address !== (selectedClient.mac_address || '')
        ) {
          // MAC 주소 정규화
          const normalizedMac = normalizeMacAddress(mac_address);
          if (!normalizedMac) {
            showToast('올바른 MAC 주소 형식이 아닙니다. (예: 00:11:22:33:44:55 또는 001122334455)', 'error');
            return;
          }
          const macRes = await fetch(`/api/clients/name/${selectedClient.name}/mac`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              mac_address: normalizedMac,
              is_manual: true  // 수동 입력임을 명시
            })
          });
          if (macRes.ok) {
            showToast(`MAC 주소가 업데이트되었습니다: ${normalizedMac}`, 'success');
            updatedClient.mac_address = normalizedMac;
          } else {
            showToast('MAC 주소 업데이트에 실패했습니다.', 'warning');
          }
        }
        showToast(`클라이언트 "${updatedClient.name}" 정보가 수정되었습니다.`, 'success');
        setShowEditModal(false);
        setSelectedClient(updatedClient);
        onClientUpdate(updatedClient);
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
        
        if (response.ok) {
          showToast(`클라이언트 "${selectedClient.name}"이(가) 삭제되었습니다.`, 'success');
          setShowDetailModal(false);
          setSelectedClient(null);
          // 삭제 이벤트는 App.js의 socket listener가 처리
        } else {
          const data = await response.json();
          throw new Error(data.error || '클라이언트 삭제에 실패했습니다.');
        }
      } catch (error) {
        showToast(error.message, 'error');
      }
    }
  };

  const updateMacAddress = async () => {
    if (!selectedClient || !macAddress) return;

    // MAC 주소 형식 정규화
    const normalizedMac = normalizeMacAddress(macAddress);
    if (!normalizedMac) {
      showToast('올바른 MAC 주소 형식이 아닙니다. (예: 00:11:22:33:44:55 또는 001122334455)', 'error');
      return;
    }

    try {
      const response = await fetch(`/api/clients/${selectedClient.id}/mac-address`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mac_address: normalizedMac,
          is_manual: true  // 수동 입력임을 명시
        })
      });

      const result = await response.json();

      if (response.ok) {
        showToast(`MAC 주소가 업데이트되었습니다: ${normalizedMac}`, 'success');
        
        // 클라이언트 목록에서 MAC 주소 실시간 업데이트
        const updatedClient = {
          ...selectedClient,
          mac_address: normalizedMac
        };
        onClientUpdate(updatedClient);
        
        // 모달 닫기
        setShowMacEditModal(false);
        setMacAddress('');
        
        // 클라이언트 상세 모달도 업데이트된 정보로 다시 열기
        setTimeout(() => {
          showClientDetail(updatedClient);
        }, 100);
      } else {
        throw new Error(result.error || 'MAC 주소 업데이트에 실패했습니다.');
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // MAC 주소 형식 정규화 함수
  const normalizeMacAddress = (mac) => {
    if (!mac) return null;
    
    // 모든 공백과 특수문자 제거
    let cleaned = mac.replace(/[^0-9A-Fa-f]/g, '');
    
    // 12자리 16진수인지 확인
    if (cleaned.length !== 12) return null;
    
    // XX:XX:XX:XX:XX:XX 형식으로 변환
    return cleaned.match(/.{2}/g).join(':').toUpperCase();
  };

  const openMacEditModal = async (client) => {
    setSelectedClient(client);
    // 클라이언트의 mac_address 속성을 직접 사용
    const currentMac = client.mac_address || '';
    setMacAddress(currentMac);
    setShowMacEditModal(true);
  };

  const powerAction = async (clientId, action) => {
    const actionNames = {
      'wake': '켜기',
      'restart': '재부팅',
      'shutdown': '끄기'
    };
    
    const actionName = actionNames[action];
    
    if (window.confirm(`정말 "${selectedClient?.name}" 클라이언트를 ${actionName}하시겠습니까?`)) {
      try {
        const response = await fetch(`/api/clients/${clientId}/power`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          showToast(`전원 ${actionName} 명령이 전송되었습니다.`, 'success');
        } else {
          throw new Error(result.error || `전원 ${actionName}에 실패했습니다.`);
        }
      } catch (error) {
        showToast(error.message, 'error');
      }
    }
  };

  const bulkPowerAction = async (action, clientIds) => {
    const actionNames = {
      'wake_all': '켜기',
      'restart_all': '재부팅',
      'shutdown_all': '끄기'
    };
    
    const actionName = actionNames[action];
    const count = clientIds.length;
    
    if (window.confirm(`정말 선택된 ${count}개 클라이언트를 모두 ${actionName}하시겠습니까?`)) {
      try {
        const response = await fetch('/api/bulk/power', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, client_ids: clientIds })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
          showToast(`일괄 전원 ${actionName} 명령이 전송되었습니다. (성공: ${result.results.successful}, 실패: ${result.results.failed})`, 'success');
        } else {
          throw new Error(result.error || `일괄 전원 ${actionName}에 실패했습니다.`);
        }
      } catch (error) {
        showToast(error.message, 'error');
      }
    }
  };

  const getStatusIndicator = (status) => {
    let color;
    switch (status) {
      case '콘텐츠 실행 중':
        color = '#22c55e'; // green
        break;
      case 'running':
        color = '#22c55e'; // green
        break;
      case 'online':
        color = '#2563eb'; // blue
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
                  <span className="client-mac">{client.mac_address && client.mac_address.trim() ? client.mac_address : 'MAC 주소 없음'}</span>
                  <span className="client-status">
                    {client.status}
                    {client.running_process_count > 0 && (
                      <span className="process-count"> ({client.running_process_count}개 실행 중)</span>
                    )}
                  </span>
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
                <label htmlFor="clientMacAddress">📡 MAC 주소 (선택)</label>
                <input 
                  type="text" 
                  id="clientMacAddress"
                  className="form-input" 
                  placeholder="00:11:22:33:44:55 또는 001122334455" 
                  value={formData.mac_address}
                  onChange={(e) => setFormData(prev => ({ ...prev, mac_address: e.target.value.toUpperCase() }))}
                />
                <small className="form-help">Wake-on-LAN 기능을 위해 MAC 주소를 설정하세요. 다양한 형식 지원 (XX:XX:XX:XX:XX:XX, XX-XX-XX-XX-XX-XX, XXXXXXXXXXXX)</small>
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
                    <div className="info-grid">
                      <div>🏷️ 이름: <strong>{selectedClient.name}</strong></div>
                      <div>🌐 IP 주소: <strong>{selectedClient.ip_address}</strong></div>
                      <div>🔌 포트: <strong>{selectedClient.port}</strong></div>
                      <div>📡 MAC 주소: <span id="mac-address-display">
                        {selectedClient.mac_address && selectedClient.mac_address.trim() ? selectedClient.mac_address : '설정되지 않음'}
                      </span></div>
                      <div>📊 상태: <span className={`status-badge ${selectedClient.status}`}>
                        {selectedClient.status}
                      </span></div>
                      <div>🕒 마지막 연결: <span>{formatRelativeTime(selectedClient.last_seen)}</span></div>
                      <div>🆔 현재 실행 ID: <span>
                        {selectedClient.status === 'running' ? `exec_${selectedClient.id}_${Date.now().toString().slice(-6)}` : '없음'}
                      </span></div>
                    </div>
                  </div>
                </div>

                {/* 가운데 단: 설정 */}
                <div className="modal-column modal-column-danger">
                  <div className="danger-section info-section">
                    <h4>⚙️ 설정</h4>
                    <div className="button-group vertical">
                      <button
                        className="btn btn-secondary"
                        onClick={() => openEditModal(selectedClient)}
                      >
                        수정
                      </button>
                      <button 
                        className="btn btn-danger" 
                        onClick={deleteClient}
                        title="데이터베이스에서 완전 삭제"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </div>

                {/* 오른쪽 단: 전원 제어 */}
                <div className="modal-column modal-column-power">
                  <div className="info-section power-control-section">
                    <h4>⚡ 전원 제어</h4>
                    <div className="button-group vertical">
                      <button 
                        className="btn btn-primary" 
                        onClick={() => powerAction(selectedClient.id, 'wake')}
                        title="Wake-on-LAN으로 전원 켜기"
                      >
                        🔌 켜기
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => powerAction(selectedClient.id, 'restart')}
                        title="원격 재부팅"
                      >
                        🔄 재부팅
                      </button>
                      <button 
                        className="btn btn-danger" 
                        onClick={() => powerAction(selectedClient.id, 'shutdown')}
                        title="원격 종료"
                      >
                        ⚡ 끄기
                      </button>
                    </div>
                    {/* 전원 제어 안내 문구 스타일 통일: info-section의 info-grid 스타일 적용 */}
                    <div className="info-grid">
                      <span>💡 MAC 주소가 설정된 클라이언트만 Wake-on-LAN이 가능합니다.</span>
                    </div>
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
          </div>
        </div>
      )}

      {/* 클라이언트 수정 모달 */}
      {showEditModal && selectedClient && (
        <div className="modal show">
          <div className="modal-content">
            <div className="modal-header">
              <h3>✏️ {selectedClient.name} 정보 수정</h3>
              <span className="close" onClick={() => setShowEditModal(false)}>&times;</span>
            </div>
            
            <form onSubmit={handleUpdateClient}>
              <div className="form-group">
                <label htmlFor="editClientName">🏷️ 클라이언트 이름</label>
                <input 
                  type="text" 
                  id="editClientName"
                  className="form-input" 
                  placeholder="예: Display_01" 
                  value={editFormData.name}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="editClientIP">🌐 IP 주소</label>
                <input 
                  type="text" 
                  id="editClientIP"
                  className="form-input" 
                  placeholder="192.168.1.101" 
                  pattern="^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$"
                  value={editFormData.ip_address}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, ip_address: e.target.value }))}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="editClientPort">🔌 포트</label>
                <input 
                  type="number" 
                  id="editClientPort"
                  className="form-input" 
                  placeholder="8081" 
                  value={editFormData.port}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, port: parseInt(e.target.value) || 8081 }))}
                  min="1" 
                  max="65535"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="editClientMac">📡 MAC 주소</label>
                <input 
                  type="text" 
                  id="editClientMac"
                  className="form-input" 
                  placeholder="00:11:22:33:44:55 또는 001122334455" 
                  value={editFormData.mac_address || ''}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, mac_address: e.target.value.toUpperCase() }))}
                />
                <small className="form-help">Wake-on-LAN 기능을 위해 MAC 주소를 설정하세요. 다양한 형식 지원 (XX:XX:XX:XX:XX:XX, XX-XX-XX-XX-XX-XX, XXXXXXXXXXXX)</small>
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary">
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MAC 주소 수정 모달 */}
      {showMacEditModal && selectedClient && (
        <div className="modal show">
          <div className="modal-content">
            <div className="modal-header">
              <h3>🔗 {selectedClient.name} MAC 주소 설정</h3>
              <span className="close" onClick={() => setShowMacEditModal(false)}>&times;</span>
            </div>
            
            <div className="form-group">
              <label htmlFor="macAddress">📡 MAC 주소</label>
              <input 
                type="text" 
                id="macAddress"
                className="form-input" 
                placeholder="00:11:22:33:44:55 또는 001122334455" 
                value={macAddress}
                onChange={(e) => setMacAddress(e.target.value.toUpperCase())}
                required
              />
              <small className="form-help">Wake-on-LAN 기능을 위해 MAC 주소를 설정하세요. 다양한 형식 지원 (XX:XX:XX:XX:XX:XX, XX-XX-XX-XX-XX-XX, XXXXXXXXXXXX)</small>
            </div>
            
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowMacEditModal(false)}>
                취소
              </button>
              <button type="button" className="btn btn-primary" onClick={updateMacAddress}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientMonitor; 