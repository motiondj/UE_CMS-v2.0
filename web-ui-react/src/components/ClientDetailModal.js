import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

const ClientDetailModal = ({ client, onClose, onClientUpdated }) => {
  const [executionHistory, setExecutionHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [macAddress, setMacAddress] = useState(client.mac_address || '');
  const [isEditingMac, setIsEditingMac] = useState(false);
  const [savingMac, setSavingMac] = useState(false);

  const loadExecutionHistory = useCallback(async () => {
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
  }, [client.id]);

  const loadMacAddress = useCallback(async () => {
    // MAC 주소가 없으면 API에서 직접 조회
    if (!client.mac_address) {
      try {
        console.log('🔍 MAC 주소 API 조회 시도:', client.name);
        const response = await fetch(`${API_BASE}/api/clients`);
        if (response.ok) {
          const clients = await response.json();
          const currentClient = clients.find(c => c.id === client.id);
          if (currentClient && currentClient.mac_address) {
            console.log('✅ MAC 주소 API 조회 성공:', currentClient.mac_address);
            setMacAddress(currentClient.mac_address);
          } else {
            console.log('⚠️ MAC 주소가 설정되지 않음');
            setMacAddress('');
          }
        }
      } catch (error) {
        console.error('MAC 주소 조회 실패:', error);
      }
    } else {
      console.log('✅ 기존 MAC 주소 사용:', client.mac_address);
      setMacAddress(client.mac_address);
    }
  }, [client.id, client.mac_address, client.name]);

  useEffect(() => {
    loadExecutionHistory();
    loadMacAddress();
  }, [loadExecutionHistory, loadMacAddress]);

  const saveMacAddress = async () => {
    if (!macAddress.trim()) {
      alert('MAC 주소를 입력해주세요.');
      return;
    }

    // MAC 주소 형식 검증 (XX:XX:XX:XX:XX:XX 또는 XX-XX-XX-XX-XX-XX)
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    if (!macRegex.test(macAddress)) {
      alert('올바른 MAC 주소 형식을 입력해주세요. (예: 00:11:22:33:44:55)');
      return;
    }

    try {
      setSavingMac(true);
      const response = await fetch(`${API_BASE}/api/clients/name/${client.name}/mac`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mac_address: macAddress,
          is_manual: true
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('MAC 주소 저장 성공:', result);
        setIsEditingMac(false);
        
        // 부모 컴포넌트에 업데이트 알림
        if (onClientUpdated) {
          onClientUpdated({
            ...client,
            mac_address: macAddress
          });
        }
        
        alert('MAC 주소가 성공적으로 저장되었습니다.');
      } else {
        const error = await response.json();
        alert(`MAC 주소 저장 실패: ${error.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      console.error('MAC 주소 저장 중 오류:', error);
      alert('MAC 주소 저장 중 오류가 발생했습니다.');
    } finally {
      setSavingMac(false);
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
              <div className="info-item">
                <span className="info-label">MAC 주소:</span>
                <div className="mac-address-section">
                  {isEditingMac ? (
                    <div className="mac-edit-section">
                      <input
                        type="text"
                        value={macAddress}
                        onChange={(e) => setMacAddress(e.target.value)}
                        placeholder="00:11:22:33:44:55"
                        className="mac-input"
                        disabled={savingMac}
                      />
                      <div className="mac-edit-buttons">
                        <button 
                          className="btn btn-primary btn-sm"
                          onClick={saveMacAddress}
                          disabled={savingMac}
                        >
                          {savingMac ? '저장 중...' : '저장'}
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setIsEditingMac(false);
                            setMacAddress(macAddress);
                          }}
                          disabled={savingMac}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mac-display-section">
                      <span className="mac-value">
                        {macAddress || '설정되지 않음'}
                      </span>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => setIsEditingMac(true)}
                      >
                        수정
                      </button>
                    </div>
                  )}
                </div>
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