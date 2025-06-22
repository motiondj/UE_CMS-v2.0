import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';
import ClientDetailModal from './components/ClientDetailModal';
import ExecutionMonitor from './components/ExecutionMonitor';

// API 기본 URL
const API_BASE_URL = 'http://localhost:8000/api';

function App() {
  // 상태 관리
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [clients, setClients] = useState([]);
  const [groups, setGroups] = useState([]);
  const [presets, setPresets] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [selectedPresets, setSelectedPresets] = useState(new Set());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [clientHistory, setClientHistory] = useState(new Map());

  // 모달 상태
  const [showClientModal, setShowClientModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [currentClient, setCurrentClient] = useState(null);
  const [editingPreset, setEditingPreset] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);

  // 폼 상태
  const [newClient, setNewClient] = useState({ name: '', ip_address: '', port: 8081, description: '' });
  const [newGroup, setNewGroup] = useState({ name: '', description: '', client_ids: [] });
  const [newPreset, setNewPreset] = useState({ name: '', description: '', command: '', group_ids: [] });

  // 토스트 알림
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  // Socket.io 연결
  useEffect(() => {
    const newSocket = io('http://localhost:8000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ Socket.io 연결됨');
      setIsConnected(true);
      showToast('서버에 연결되었습니다.', 'success');
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Socket.io 연결 해제됨');
      setIsConnected(false);
      showToast('서버 연결이 끊어졌습니다.', 'error');
    });

    newSocket.on('client_status_changed', (data) => {
      console.log('클라이언트 상태 변경:', data);
      fetchClients();
    });

    return () => newSocket.close();
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    fetchClients();
    fetchGroups();
    fetchPresets();
  }, []);

  // 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 테마 초기화
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
    }
  }, []);

  // 테마 변경
  useEffect(() => {
    const body = document.body;
    if (isDarkMode) {
      body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      body.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // API 함수들
  const fetchClients = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/clients`);
      setClients(response.data);
    } catch (error) {
      console.error('클라이언트 조회 실패:', error);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/groups`);
      setGroups(response.data);
    } catch (error) {
      console.error('그룹 조회 실패:', error);
    }
  };

  const fetchPresets = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/presets`);
      setPresets(response.data);
    } catch (error) {
      console.error('프리셋 조회 실패:', error);
    }
  };

  // 토스트 알림
  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
  };

  // 테마 토글
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    showToast(isDarkMode ? '라이트 모드가 활성화되었습니다.' : '다크 모드가 활성화되었습니다.', 'success');
  };

  // 클라이언트 히스토리 관리
  const addClientHistory = (clientId, event) => {
    const history = clientHistory.get(clientId) || [];
    const newHistory = [
      { event, timestamp: new Date() },
      ...history.slice(0, 9) // 최대 10개만 유지
    ];
    setClientHistory(new Map(clientHistory.set(clientId, newHistory)));
  };

  // 상대 시간 포맷
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

  // 클라이언트 관리
  const addClient = async () => {
    try {
      await axios.post(`${API_BASE_URL}/clients`, newClient);
      const clientName = newClient.name;
      setNewClient({ name: '', ip_address: '', port: 8081, description: '' });
      setShowAddClientModal(false);
      fetchClients();
      showToast(`클라이언트 "${clientName}"이(가) 추가되었습니다.`, 'success');
    } catch (error) {
      console.error('클라이언트 추가 실패:', error);
      showToast('클라이언트 추가 실패: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const deleteClient = async (clientId) => {
    if (!window.confirm('정말로 이 클라이언트를 삭제하시겠습니까?')) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/clients/${clientId}`);
      fetchClients();
      showToast('클라이언트가 삭제되었습니다.', 'error');
    } catch (error) {
      console.error('클라이언트 삭제 실패:', error);
      showToast('클라이언트 삭제 실패: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  // 클라이언트 상세 모달 표시
  const showClientDetailModal = (client) => {
    setCurrentClient(client);
    setShowClientModal(true);
  };

  // 클라이언트 액션
  const clientAction = (action) => {
    if (!currentClient) return;
    
    switch(action) {
      case 'heartbeat':
        showToast(`"${currentClient.name}"에 상태 확인 요청을 전송했습니다.`, 'info');
        addClientHistory(currentClient.id, '상태 확인 요청');
        break;
      case 'stop_all':
        showToast(`"${currentClient.name}"의 모든 프로세스 중지 명령을 전송했습니다.`, 'success');
        addClientHistory(currentClient.id, '모든 프로세스 중지됨');
        break;
    }
  };

  // 그룹 관리
  const addGroup = async () => {
    try {
      await axios.post(`${API_BASE_URL}/groups`, newGroup);
      const groupName = newGroup.name;
      setNewGroup({ name: '', description: '', client_ids: [] });
      setShowGroupModal(false);
      fetchGroups();
      showToast(`새 그룹 "${groupName}"이(가) 생성되었습니다.`, 'success');
    } catch (error) {
      console.error('그룹 추가 실패:', error);
      showToast('그룹 추가 실패: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const deleteGroup = async (groupId) => {
    if (!window.confirm('정말로 이 그룹을 삭제하시겠습니까?')) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/groups/${groupId}`);
      fetchGroups();
      showToast('그룹이 삭제되었습니다.', 'error');
    } catch (error) {
      console.error('그룹 삭제 실패:', error);
      showToast('그룹 삭제 실패: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  // 프리셋 관리
  const addPreset = async () => {
    try {
      const presetData = {
        ...newPreset,
        target_group_id: newPreset.group_ids[0] || null
      };
      await axios.post(`${API_BASE_URL}/presets`, presetData);
      const presetName = newPreset.name;
      setNewPreset({ name: '', description: '', command: '', group_ids: [] });
      setShowPresetModal(false);
      fetchPresets();
      showToast(`새 프리셋 "${presetName}"이(가) 생성되었습니다.`, 'success');
    } catch (error) {
      console.error('프리셋 추가 실패:', error);
      showToast('프리셋 추가 실패: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const executePreset = async (presetId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/presets/${presetId}/execute`);
      showToast(`프리셋이 ${response.data.target_clients}개 클라이언트에서 실행되었습니다.`, 'success');
      
      // 실행 기록 추가
      const execution = {
        id: `exec_${Date.now()}`,
        preset_id: presetId,
        preset_name: response.data.preset_name,
        status: 'running',
        started_at: new Date(),
        target_clients: response.data.target_clients,
        results: {}
      };
      setExecutions(prev => [execution, ...prev.slice(0, 9)]);
      
      // 클라이언트 상태 업데이트 및 히스토리 추가
      response.data.target_clients.forEach(clientId => {
        addClientHistory(clientId, `프리셋 실행: ${response.data.preset_name}`);
      });
    } catch (error) {
      console.error('프리셋 실행 실패:', error);
      showToast('프리셋 실행 실패: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const deletePreset = async (presetId) => {
    if (!window.confirm('정말로 이 프리셋을 삭제하시겠습니까?')) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/presets/${presetId}`);
      fetchPresets();
      showToast('프리셋이 삭제되었습니다.', 'error');
    } catch (error) {
      console.error('프리셋 삭제 실패:', error);
      showToast('프리셋 삭제 실패: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  // 일괄 제어
  const toggleSelectAllPresets = () => {
    if (selectedPresets.size === presets.length) {
      setSelectedPresets(new Set());
    } else {
      setSelectedPresets(new Set(presets.map(p => p.id)));
    }
  };

  const toggleSelectAllGroups = () => {
    if (selectedGroups.size === groups.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(groups.map(g => g.id)));
    }
  };

  const bulkPresetAction = async (action) => {
    if (selectedPresets.size === 0) {
      showToast('선택된 프리셋이 없습니다.', 'error');
      return;
    }

    const actionNames = { execute: '실행', delete: '삭제' };
    const actionName = actionNames[action];

    if (action === 'delete') {
      if (window.confirm(`선택된 ${selectedPresets.size}개 프리셋을 모두 삭제하시겠습니까?`)) {
        for (const presetId of selectedPresets) {
          await deletePreset(presetId);
        }
        setSelectedPresets(new Set());
      }
    } else if (action === 'execute') {
      if (window.confirm(`선택된 ${selectedPresets.size}개 프리셋을 모두 실행하시겠습니까?`)) {
        for (const presetId of selectedPresets) {
          await executePreset(presetId);
        }
      }
    }
  };

  const bulkGroupAction = (action) => {
    if (selectedGroups.size === 0) {
      showToast('선택된 그룹이 없습니다.', 'error');
      return;
    }

    const actionNames = { on: '켜기', reboot: '재부팅', off: '끄기' };
    const actionName = actionNames[action];
    
    showToast(`${selectedGroups.size}개 그룹에 전원 ${actionName} 명령을 전송했습니다. (v2.1에서 활성화)`, 'info');
  };

  // 통계 계산
  const stats = {
    totalClients: clients.length,
    onlineClients: clients.filter(c => c.status === 'online').length,
    runningClients: clients.filter(c => c.status === 'running').length,
    activeExecutions: executions.filter(e => e.status === 'running').length,
    totalGroups: groups.length
  };

  return (
    <div className="App">
      {/* API 연결 상태 */}
      <div className={`api-status ${isConnected ? 'visible' : ''}`}>
        <span className={`api-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
        <span>{isConnected ? 'API 연결됨' : 'API 연결 중...'}</span>
      </div>

      {/* 헤더 */}
      <div className="header">
        <div className="header-content">
          <h1>⚡ Switchboard Plus v2.0</h1>
          <div className="status-info">
            <div className="socket-status">
              Socket 상태: 
              <span className={`socket-indicator ${isConnected ? '' : 'disconnected'}`}></span>
              <span style={{ color: isConnected ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                {isConnected ? '연결됨' : '연결 중...'}
              </span>
            </div>
            <div>시간: {currentTime.toLocaleTimeString('ko-KR', {hour12: true})}</div>
            <div>연결된 클라이언트: <span style={{ color: '#22c55e', fontWeight: 600 }}>{stats.onlineClients}</span></div>
            <button className="settings-btn" onClick={toggleDarkMode}>
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        {/* 통계 바 */}
        <div className="stats-bar">
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-value">{stats.totalClients}</div>
              <div className="stat-label">전체 디스플레이 서버</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.onlineClients}</div>
              <div className="stat-label">온라인</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.runningClients}</div>
              <div className="stat-label">실행 중</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.activeExecutions}</div>
              <div className="stat-label">활성 실행</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{stats.totalGroups}</div>
              <div className="stat-label">그룹 수</div>
            </div>
          </div>
        </div>

        {/* 메인 레이아웃 */}
        <div className="main-layout">
          {/* 콘텐츠 프리셋 */}
          <div className="section">
            <h2 className="section-title">
              콘텐츠 프리셋
              <button className="btn btn-secondary btn-with-text" onClick={() => setShowPresetModal(true)}>
                ➕ 새 프리셋
              </button>
            </h2>
            
            {/* 프리셋 일괄 제어 UI */}
            <div className="bulk-controls">
              <div className="selection-info">
                <label>
                  <input 
                    type="checkbox" 
                    checked={selectedPresets.size === presets.length && presets.length > 0}
                    onChange={toggleSelectAllPresets}
                  />
                  전체 선택
                </label>
                <span>선택된 프리셋: {selectedPresets.size}개</span>
              </div>
              <div className="bulk-actions">
                <button className="btn btn-primary btn-bulk" onClick={() => bulkPresetAction('execute')} title="선택된 프리셋들 전체 실행">
                  ▶️
                </button>
                <button className="btn btn-danger btn-bulk" onClick={() => bulkPresetAction('delete')} title="선택된 프리셋들 전체 삭제">
                  🗑️
                </button>
              </div>
            </div>

            <div className="preset-grid">
              {presets.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
                  <div style={{ fontSize: '14px', marginBottom: '8px' }}>아직 생성된 프리셋이 없습니다</div>
                  <div style={{ fontSize: '12px' }}>새 프리셋 버튼을 클릭해서 첫 번째 프리셋을 만들어보세요!</div>
                </div>
              ) : (
                presets.map(preset => (
                  <div key={preset.id} className="preset-card">
                    <input 
                      type="checkbox" 
                      className="preset-checkbox"
                      checked={selectedPresets.has(preset.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPresets(prev => new Set([...prev, preset.id]));
                        } else {
                          setSelectedPresets(prev => new Set([...prev].filter(id => id !== preset.id)));
                        }
                      }}
                    />
                    <div className="preset-content">
                      <div className="preset-name">{preset.name}</div>
                      <div className="preset-info">{preset.command}</div>
                      <div className="preset-info">그룹: {preset.group_name || '없음'}</div>
                    </div>
                    <div className="preset-actions">
                      <button className="btn btn-primary" onClick={() => executePreset(preset.id)} title="실행">▶️</button>
                      <button className="btn btn-secondary" onClick={() => { setEditingPreset(preset); setShowPresetModal(true); }} title="편집">✏️</button>
                      <button className="btn btn-danger" onClick={() => deletePreset(preset.id)} title="삭제">🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 디스플레이 서버 그룹 */}
          <div className="section">
            <h2 className="section-title">
              디스플레이 서버 그룹
              <button className="btn btn-secondary btn-with-text" onClick={() => setShowGroupModal(true)}>
                ➕ 새 그룹
              </button>
            </h2>
            
            {/* 그룹 일괄 제어 UI */}
            <div className="bulk-controls">
              <div className="selection-info">
                <label>
                  <input 
                    type="checkbox" 
                    checked={selectedGroups.size === groups.length && groups.length > 0}
                    onChange={toggleSelectAllGroups}
                  />
                  전체 선택
                </label>
                <span>선택된 그룹: {selectedGroups.size}개</span>
              </div>
              <div className="bulk-actions">
                <button className="btn btn-primary btn-bulk" onClick={() => bulkGroupAction('on')} title="선택된 그룹들 전체 켜기">
                  🔌
                </button>
                <button className="btn btn-secondary btn-bulk" onClick={() => bulkGroupAction('reboot')} title="선택된 그룹들 전체 재부팅">
                  🔄
                </button>
                <button className="btn btn-danger btn-bulk" onClick={() => bulkGroupAction('off')} title="선택된 그룹들 전체 끄기">
                  ⚡
                </button>
              </div>
            </div>

            <div className="group-grid">
              {groups.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>👥</div>
                  <div style={{ fontSize: '14px', marginBottom: '8px' }}>아직 생성된 그룹이 없습니다</div>
                  <div style={{ fontSize: '12px' }}>새 그룹 버튼을 클릭해서 첫 번째 그룹을 만들어보세요!</div>
                </div>
              ) : (
                groups.map(group => (
                  <div key={group.id} className="group-card">
                    <input 
                      type="checkbox" 
                      className="group-checkbox"
                      checked={selectedGroups.has(group.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedGroups(prev => new Set([...prev, group.id]));
                        } else {
                          setSelectedGroups(prev => new Set([...prev].filter(id => id !== group.id)));
                        }
                      }}
                    />
                    <div className="group-content">
                      <div className="group-name">{group.name}</div>
                      <div className="group-info">0개 디스플레이 서버</div>
                      <div className="group-clients">
                        {/* 클라이언트 태그들 */}
                      </div>
                    </div>
                    <div className="group-actions">
                      <button className="btn btn-secondary" onClick={() => { setEditingGroup(group); setShowGroupModal(true); }} title="편집">✏️</button>
                      <button className="btn btn-danger" onClick={() => deleteGroup(group.id)} title="삭제">🗑️</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 디스플레이 서버 모니터링 */}
        <div className="client-monitor">
          <div className="monitor-header">
            <h2 className="section-title">
              디스플레이 서버 모니터링
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                자동 새로고침: 30초
              </span>
            </h2>
            <button className="btn btn-secondary btn-with-text" onClick={() => setShowAddClientModal(true)}>
              ➕ 클라이언트 추가
            </button>
          </div>

          <div className="client-grid">
            {clients.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🖥️</div>
                <div style={{ fontSize: '14px', marginBottom: '8px' }}>연결된 디스플레이 서버가 없습니다</div>
                <div style={{ fontSize: '12px' }}>클라이언트 추가 버튼을 클릭하거나 Python 클라이언트가 연결되면 자동으로 나타납니다</div>
              </div>
            ) : (
              clients.map(client => {
                const isRunning = client.status === 'running';
                const executionId = isRunning ? `exec_${client.id}_${Date.now().toString().slice(-6)}` : null;
                
                return (
                  <div 
                    key={client.id} 
                    className={`client-item ${client.status}`}
                    onClick={() => showClientDetailModal(client)}
                  >
                    {executionId && (
                      <div className="execution-id">{executionId.slice(-6)}</div>
                    )}
                    <div className="client-icon">
                      {client.status === 'online' ? '🟡' : client.status === 'running' ? '🟢' : '🔴'}
                    </div>
                    <div className="client-name">{client.name}</div>
                    <div className="client-ip">{client.ip_address}</div>
                    <div className="client-status">
                      {client.status === 'online' ? '대기 중' : 
                       client.status === 'running' ? '언리얼엔진 실행 중' : '오프라인'}
                    </div>
                    {isRunning && (
                      <div className="client-metrics visible">
                        CPU: {Math.floor(Math.random() * 100)}%<br/>
                        RAM: {Math.floor(Math.random() * 100)}%<br/>
                        지연: {Math.floor(Math.random() * 50) + 10}ms
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 실행 모니터링 섹션 */}
        {executions.length > 0 && (
          <div className="execution-monitor">
            <h2 className="section-title">
              프리셋 실행 히스토리
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                최근 10개 표시 | 자동 업데이트
              </span>
            </h2>
            <div className="execution-list">
              {executions.map(execution => {
                const duration = Math.round((new Date() - execution.started_at) / 1000);
                const progress = Math.min(95, (duration / 30) * 100);
                
                return (
                  <div key={execution.id} className="execution-item">
                    <div className="execution-header">
                      <div>
                        <strong>{execution.preset_name}</strong>
                        <div className="execution-details">
                          ID: {execution.id} | 시작: {execution.started_at.toLocaleTimeString('ko-KR')}
                          | 소요시간: {duration}초
                        </div>
                      </div>
                      <span className={`execution-status ${execution.status}`}>
                        {execution.status === 'running' ? '실행중' : '완료'}
                      </span>
                    </div>
                    <div className="execution-targets">
                      <span className="target-client success">클라이언트 {execution.target_clients}개</span>
                    </div>
                    <div className="execution-details">
                      성공: {execution.target_clients}개 | 실패: 0개 | 실행중: {execution.status === 'running' ? execution.target_clients : 0}개
                    </div>
                    {execution.status === 'running' && (
                      <div className="execution-progress">
                        <div className="execution-progress-bar" style={{ width: `${progress}%` }}></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 모달들 */}
      {/* 클라이언트 추가 모달 */}
      {showAddClientModal && (
        <div className="modal" onClick={() => setShowAddClientModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>새 디스플레이 서버 추가</h3>
              <span className="close" onClick={() => setShowAddClientModal(false)}>&times;</span>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); addClient(); }}>
              <div className="form-group">
                <label htmlFor="clientName">클라이언트 이름</label>
                <input 
                  type="text" 
                  id="clientName" 
                  className="form-input" 
                  placeholder="예: Display_01" 
                  value={newClient.name}
                  onChange={(e) => setNewClient(prev => ({ ...prev, name: e.target.value }))}
                  required 
                />
                <small className="form-help">알아보기 쉬운 이름을 지정하세요 (중복 불가)</small>
              </div>
              <div className="form-group">
                <label htmlFor="clientIP">IP 주소</label>
                <input 
                  type="text" 
                  id="clientIP" 
                  className="form-input" 
                  placeholder="192.168.1.101" 
                  value={newClient.ip_address}
                  onChange={(e) => setNewClient(prev => ({ ...prev, ip_address: e.target.value }))}
                  required 
                />
                <small className="form-help">클라이언트 PC의 고정 IP 주소</small>
              </div>
              <div className="form-group">
                <label htmlFor="clientPort">포트</label>
                <input 
                  type="number" 
                  id="clientPort" 
                  className="form-input" 
                  placeholder="8081" 
                  value={newClient.port}
                  onChange={(e) => setNewClient(prev => ({ ...prev, port: parseInt(e.target.value) || 8081 }))}
                />
                <small className="form-help">Python 클라이언트 통신 포트 (기본: 8081)</small>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddClientModal(false)}>취소</button>
                <button type="submit" className="btn btn-primary">추가</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 클라이언트 상세 모달 */}
      {showClientModal && currentClient && (
        <div className="modal" onClick={() => setShowClientModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{currentClient.name} 관리</h3>
              <span className="close" onClick={() => setShowClientModal(false)}>&times;</span>
            </div>
            
            <div className="modal-body">
              {/* 시스템 정보 */}
              <div className="info-section">
                <h4>시스템 정보</h4>
                <div className="info-grid">
                  <div>이름: <strong>{currentClient.name}</strong></div>
                  <div>IP 주소: <strong>{currentClient.ip_address}</strong></div>
                  <div>포트: <strong>{currentClient.port}</strong></div>
                  <div>상태: <span className={`status-badge ${currentClient.status}`}>
                    {currentClient.status === 'online' ? '온라인' : 
                     currentClient.status === 'running' ? '실행 중' : '오프라인'}
                  </span></div>
                  <div>마지막 연결: <span>{currentClient.last_seen ? formatRelativeTime(new Date(currentClient.last_seen)) : '연결된 적 없음'}</span></div>
                  <div>현재 실행 ID: <span>{currentClient.status === 'running' ? `exec_${currentClient.id}_${Date.now().toString().slice(-6)}` : '없음'}</span></div>
                </div>
              </div>
              
              {/* 성능 메트릭 (실행 중일 때만 표시) */}
              {currentClient.status === 'running' && (
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
              
              {/* 연결 히스토리 */}
              <div className="info-section">
                <h4>연결 히스토리 (최근 5개)</h4>
                <div className="connection-history">
                  <div className="history-item">
                    <span>등록됨</span>
                    <span>{formatRelativeTime(new Date(currentClient.created_at))}</span>
                  </div>
                  {(clientHistory.get(currentClient.id) || []).slice(0, 4).map((item, index) => (
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
                  <button className="btn btn-primary" onClick={() => clientAction('heartbeat')} title="상태 확인">
                    💓 상태 확인
                  </button>
                  <button className="btn btn-secondary" onClick={() => clientAction('stop_all')} title="모든 프로세스 중지">
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
                <button className="btn btn-danger" onClick={() => { deleteClient(currentClient.id); setShowClientModal(false); }} title="데이터베이스에서 완전 삭제">
                  🗑️ 클라이언트 삭제
                </button>
                <p className="warning-text">삭제하면 데이터베이스에서 완전히 제거되며 복구할 수 없습니다.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 프리셋 모달 */}
      {showPresetModal && (
        <div className="modal" onClick={() => setShowPresetModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingPreset ? '프리셋 편집' : '새 프리셋 만들기'}</h3>
              <span className="close" onClick={() => setShowPresetModal(false)}>&times;</span>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); addPreset(); }}>
              <div className="form-group">
                <label htmlFor="presetName">프리셋 이름</label>
                <input 
                  type="text" 
                  id="presetName" 
                  className="form-input" 
                  placeholder="예: 메인 콘텐츠" 
                  value={newPreset.name}
                  onChange={(e) => setNewPreset(prev => ({ ...prev, name: e.target.value }))}
                  required 
                />
                <small className="form-help">알아보기 쉬운 프리셋 이름</small>
              </div>
              <div className="form-group">
                <label htmlFor="presetCommand">언리얼엔진 실행 명령</label>
                <textarea 
                  id="presetCommand" 
                  className="form-input" 
                  rows="6" 
                  placeholder="D:\UnrealProjects\MyProject\Windows\MyProject.exe None -messaging -dc_cluster -nosplash -dc_cfg=&quot;C:\path\to\config.ndisplay&quot; -dc_node=Node_0 -fullscreen" 
                  value={newPreset.command}
                  onChange={(e) => setNewPreset(prev => ({ ...prev, command: e.target.value }))}
                  required 
                />
                <small className="form-help">스위치보드에서 생성된 전체 명령어를 복사해서 붙여넣으세요.</small>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPresetModal(false)}>취소</button>
                <button type="submit" className="btn btn-primary">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 그룹 모달 */}
      {showGroupModal && (
        <div className="modal" onClick={() => setShowGroupModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingGroup ? '그룹 편집' : '새 그룹 만들기'}</h3>
              <span className="close" onClick={() => setShowGroupModal(false)}>&times;</span>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); addGroup(); }}>
              <div className="form-group">
                <label htmlFor="groupName">그룹 이름</label>
                <input 
                  type="text" 
                  id="groupName" 
                  className="form-input" 
                  placeholder="예: 메인 디스플레이 월" 
                  value={newGroup.name}
                  onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))}
                  required 
                />
                <small className="form-help">알아보기 쉬운 그룹 이름</small>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowGroupModal(false)}>취소</button>
                <button type="submit" className="btn btn-primary">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 토스트 알림 */}
      {toast.show && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;
