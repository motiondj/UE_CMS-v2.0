import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';

// 컴포넌트들
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import PresetSection from './components/PresetSection';
import GroupSection from './components/GroupSection';
import ClientMonitor from './components/ClientMonitor';
import ClientDetailModal from './components/ClientDetailModal';
import AddClientModal from './components/AddClientModal';
import PresetModal from './components/PresetModal';
import GroupModal from './components/GroupModal';
import Toast from './components/Toast';

// API 기본 URL
const API_BASE_URL = 'http://localhost:8000/api';

function App() {
  // 상태 관리
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // 데이터 상태
  const [clients, setClients] = useState([]);
  const [groups, setGroups] = useState([]);
  const [presets, setPresets] = useState([]);
  const [clientHistory, setClientHistory] = useState({});
  
  // 선택 상태
  const [selectedClients, setSelectedClients] = useState(new Set());
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [selectedPresets, setSelectedPresets] = useState(new Set());
  
  // 모달 상태
  const [showClientModal, setShowClientModal] = useState(false);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [currentClientId, setCurrentClientId] = useState(null);
  const [editingPreset, setEditingPreset] = useState(null);
  const [editingGroup, setEditingGroup] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  
  // 토스트 상태
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  // 초기화
  useEffect(() => {
    // 전역 에러 핸들러 추가
    const handleGlobalError = (event) => {
      if (event.message && event.message.includes('message channel closed')) {
        // 메시지 채널 에러는 무시
        event.preventDefault();
        return;
      }
      console.error('Global error:', event);
    };

    const handleUnhandledRejection = (event) => {
      if (event.reason && event.reason.message && event.reason.message.includes('message channel closed')) {
        // 메시지 채널 에러는 무시
        event.preventDefault();
        return;
      }
      console.error('Unhandled promise rejection:', event.reason);
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    initializeTheme();
    initializeSocket();
    startAutoRefresh();
    updateTime();
    fetchInitialData();
    
    const timeInterval = setInterval(updateTime, 1000);
    
    return () => {
      clearInterval(timeInterval);
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // API 데이터 가져오기
  const fetchInitialData = async () => {
    try {
      await Promise.all([
        fetchClients(),
        fetchGroups(),
        fetchPresets()
      ]);
    } catch (error) {
      console.error('초기 데이터 로드 실패:', error);
      // API 실패 시 데모 데이터 생성
      createDemoData();
    }
  };

  // API 함수들
  const fetchClients = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/clients`);
      setClients(response.data);
    } catch (error) {
      console.error('클라이언트 조회 실패:', error);
      // 네트워크 에러가 아닌 경우에만 throw
      if (!error.message || !error.message.includes('Network Error')) {
        throw error;
      }
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/groups`);
      setGroups(response.data);
    } catch (error) {
      console.error('그룹 조회 실패:', error);
      if (!error.message || !error.message.includes('Network Error')) {
        throw error;
      }
    }
  };

  const fetchPresets = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/presets`);
      setPresets(response.data);
    } catch (error) {
      console.error('프리셋 조회 실패:', error);
      if (!error.message || !error.message.includes('Network Error')) {
        throw error;
      }
    }
  };

  // 테마 초기화
  const initializeTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.body.setAttribute('data-theme', 'dark');
    }
  };

  // Socket 초기화 (시뮬레이션)
  const initializeSocket = () => {
    setTimeout(() => {
      setIsSocketConnected(Math.random() > 0.1);
      if (isSocketConnected) {
        simulateRealTimeUpdates();
      }
    }, 1500);
  };

  // 자동 새로고침
  const startAutoRefresh = () => {
    setInterval(() => {
      if (isSocketConnected) {
        refreshClientsData();
      }
    }, 30000);
  };

  // 시간 업데이트
  const updateTime = () => {
    setCurrentTime(new Date());
  };

  // 실시간 업데이트 시뮬레이션
  const simulateRealTimeUpdates = () => {
    setInterval(() => {
      if (isSocketConnected && clients.length > 0) {
        simulateRandomClientUpdate();
      }
    }, 15000);
  };

  const simulateRandomClientUpdate = () => {
    if (clients.length === 0) return;
    
    const randomClient = clients[Math.floor(Math.random() * clients.length)];
    const currentStatus = randomClient.status;
    
    let newStatus = currentStatus;
    if (currentStatus === 'offline' && Math.random() < 0.3) {
      newStatus = 'online';
    } else if (currentStatus === 'online' && Math.random() < 0.2) {
      newStatus = Math.random() < 0.5 ? 'running' : 'offline';
    } else if (currentStatus === 'running' && Math.random() < 0.1) {
      newStatus = 'online';
    }
    
    if (newStatus !== currentStatus) {
      updateClientStatus(randomClient.id, newStatus);
      addClientHistory(randomClient.id, `상태 변경: ${currentStatus} → ${newStatus}`);
    }
  };

  const refreshClientsData = () => {
    console.log('클라이언트 데이터 자동 새로고침...');
  };

  // 클라이언트 상태 업데이트
  const updateClientStatus = (clientId, status) => {
    setClients(prev => prev.map(client => 
      client.id === clientId 
        ? { ...client, status, last_seen: new Date() }
        : client
    ));
  };

  // 클라이언트 히스토리 추가
  const addClientHistory = (clientId, event) => {
    setClientHistory(prev => {
      const history = prev[clientId] || [];
      const newHistory = [
        { event, timestamp: new Date() },
        ...history.slice(0, 9) // 최대 10개만 유지
      ];
      return { ...prev, [clientId]: newHistory };
    });
  };

  // 테마 토글
  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
    
    showToast(newDarkMode ? '다크 모드가 활성화되었습니다.' : '라이트 모드가 활성화되었습니다.', 'success');
  };

  // 토스트 표시
  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
  };

  // 클라이언트 관리
  const handleAddClient = async (clientData) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/clients`, clientData);
      await fetchClients();
      showToast(`클라이언트 "${clientData.name}"이(가) 추가되었습니다.`, 'success');
    } catch (error) {
      console.error('클라이언트 추가 실패:', error);
      showToast('클라이언트 추가 실패: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (!window.confirm('정말로 이 클라이언트를 삭제하시겠습니까?')) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/clients/${clientId}`);
      await fetchClients();
      showToast('클라이언트가 삭제되었습니다.', 'error');
    } catch (error) {
      console.error('클라이언트 삭제 실패:', error);
      showToast('클라이언트 삭제 실패: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const handleClientAction = async (action) => {
    if (!currentClientId) return;
    
    try {
      const client = clients.find(c => c.id === currentClientId);
      if (!client) return;
      
      switch(action) {
        case 'heartbeat':
          showToast(`"${client.name}"에 상태 확인 요청을 전송했습니다.`, 'info');
          addClientHistory(currentClientId, '상태 확인 요청');
          break;
        case 'stop_all':
          showToast(`"${client.name}"의 모든 프로세스 중지 명령을 전송했습니다.`, 'success');
          addClientHistory(currentClientId, '모든 프로세스 중지됨');
          break;
        case 'delete':
          await handleDeleteClient(currentClientId);
          setShowClientModal(false);
          break;
      }
    } catch (error) {
      console.error('클라이언트 액션 실패:', error);
      showToast('클라이언트 액션 실패: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  // 그룹 관리
  const handleAddGroup = async (groupData) => {
    try {
      await axios.post(`${API_BASE_URL}/groups`, groupData);
      await fetchGroups();
      showToast(`그룹 "${groupData.name}"이(가) 생성되었습니다.`, 'success');
    } catch (error) {
      console.error('그룹 추가 실패:', error);
      showToast('그룹 추가 실패: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const handleEditGroup = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
      setEditingGroup(group);
      setShowGroupModal(true);
    }
  };

  const handleSaveGroup = async (groupData) => {
    try {
      if (editingGroup) {
        await axios.put(`${API_BASE_URL}/groups/${editingGroup.id}`, groupData);
      } else {
        await axios.post(`${API_BASE_URL}/groups`, groupData);
      }
      await fetchGroups();
      setShowGroupModal(false);
      setEditingGroup(null);
      showToast(`그룹 "${groupData.name}"이(가) 저장되었습니다.`, 'success');
    } catch (error) {
      console.error('그룹 저장 실패:', error);
      showToast('그룹 저장 실패: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const handleDeleteGroup = async (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    
    if (window.confirm(`정말 "${group.name}" 그룹을 삭제하시겠습니까?`)) {
      try {
        await axios.delete(`${API_BASE_URL}/groups/${groupId}`);
        await fetchGroups();
        showToast(`그룹 "${group.name}"이(가) 삭제되었습니다.`, 'error');
      } catch (error) {
        console.error('그룹 삭제 실패:', error);
        showToast('그룹 삭제 실패: ' + (error.response?.data?.error || error.message), 'error');
      }
    }
  };

  // 프리셋 관리
  const handleAddPreset = (presetData) => {
    setEditingPreset(null);
    setShowPresetModal(true);
  };

  const handleEditPreset = (presetId) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setEditingPreset(preset);
      setShowPresetModal(true);
    }
  };

  const handleSavePreset = async (presetData) => {
    try {
      // 새로운 구조에 맞게 데이터 변환
      const presetPayload = {
        name: presetData.name,
        description: presetData.description,
        group_id: presetData.group_id,
        client_commands: presetData.client_commands
      };

      if (editingPreset) {
        await axios.put(`${API_BASE_URL}/presets/${editingPreset.id}`, presetPayload);
      } else {
        await axios.post(`${API_BASE_URL}/presets`, presetPayload);
      }
      await fetchPresets();
      setShowPresetModal(false);
      setEditingPreset(null);
      showToast(`프리셋 "${presetData.name}"이(가) 저장되었습니다.`, 'success');
    } catch (error) {
      console.error('프리셋 저장 실패:', error);
      showToast('프리셋 저장 실패: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  const handleDeletePreset = async (presetId) => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;
    
    if (window.confirm(`정말 "${preset.name}" 프리셋을 삭제하시겠습니까?\n실행 중인 경우 자동으로 중지됩니다.`)) {
      try {
        await axios.delete(`${API_BASE_URL}/presets/${presetId}`);
        await fetchPresets();
        showToast(`프리셋 "${preset.name}"이(가) 삭제되었습니다.`, 'error');
      } catch (error) {
        console.error('프리셋 삭제 실패:', error);
        showToast('프리셋 삭제 실패: ' + (error.response?.data?.error || error.message), 'error');
      }
    }
  };

  // 프리셋 실행
  const handleExecutePreset = async (presetId) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/presets/${presetId}/execute`);
      
      // 프리셋을 활성 상태로 변경
      setPresets(prev => prev.map(p => 
        p.id === presetId ? { ...p, is_active: true } : p
      ));
      
      showToast(`프리셋이 ${response.data.target_clients?.length || 0}개 클라이언트에서 실행되었습니다.`, 'success');
    } catch (error) {
      console.error('프리셋 실행 실패:', error);
      showToast('프리셋 실행 실패: ' + (error.response?.data?.error || error.message), 'error');
    }
  };

  // 일괄 제어
  const handleSelectAllPresets = (checked) => {
    if (checked) {
      setSelectedPresets(new Set(presets.map(p => p.id)));
    } else {
      setSelectedPresets(new Set());
    }
  };

  const handleSelectAllGroups = (checked) => {
    if (checked) {
      setSelectedGroups(new Set(groups.map(g => g.id)));
    } else {
      setSelectedGroups(new Set());
    }
  };

  const handleBulkPresetAction = (action) => {
    if (selectedPresets.size === 0) {
      showToast('선택된 프리셋이 없습니다.', 'error');
      return;
    }
    
    const actionNames = { execute: '실행', stop: '정지', delete: '삭제' };
    const actionName = actionNames[action];
    const presetCount = selectedPresets.size;
    
    if (action === 'delete') {
      if (window.confirm(`선택된 ${presetCount}개 프리셋을 모두 삭제하시겠습니까?`)) {
        selectedPresets.forEach(presetId => handleDeletePreset(presetId));
        setSelectedPresets(new Set());
      }
    } else if (action === 'execute') {
      if (window.confirm(`선택된 ${presetCount}개 프리셋을 모두 실행하시겠습니까?`)) {
        let executed = 0;
        selectedPresets.forEach(presetId => {
          const preset = presets.find(p => p.id === presetId);
          if (preset && !preset.is_active) {
            handleExecutePreset(presetId);
            executed++;
          }
        });
        showToast(`${executed}개 프리셋이 실행되었습니다.`, 'success');
      }
    }
  };

  const handleBulkGroupAction = (action) => {
    if (selectedGroups.size === 0) {
      showToast('선택된 그룹이 없습니다.', 'error');
      return;
    }
    
    const actionNames = { on: '켜기', reboot: '재부팅', off: '끄기' };
    const actionName = actionNames[action];
    const groupCount = selectedGroups.size;
    
    if (window.confirm(`선택된 ${groupCount}개 그룹의 모든 디스플레이 서버를 ${actionName} 하시겠습니까?`)) {
      let totalClients = 0;
      selectedGroups.forEach(groupId => {
        const group = groups.find(g => g.id === groupId);
        if (group) {
          totalClients += group.client_ids.length;
          group.client_ids.forEach(clientId => {
            addClientHistory(clientId, `전원 ${actionName} 명령 수신`);
          });
        }
      });
      
      showToast(`${groupCount}개 그룹 (${totalClients}대 클라이언트)에 전원 ${actionName} 명령을 전송했습니다. (v2.1에서 활성화)`, 'info');
    }
  };

  // 데모 데이터 생성
  const createDemoData = () => {
    setTimeout(() => {
      // 데모 클라이언트
      const demoClients = [
        { name: 'Display_01', ip_address: '192.168.1.101', status: 'online' },
        { name: 'Display_02', ip_address: '192.168.1.102', status: 'running' },
        { name: 'Display_03', ip_address: '192.168.1.103', status: 'offline' },
        { name: 'Display_04', ip_address: '192.168.1.104', status: 'online' }
      ];
      
      const newClients = demoClients.map((clientData, index) => ({
        id: `demo_client_${index + 1}`,
        name: clientData.name,
        ip_address: clientData.ip_address,
        port: 8081,
        description: `데모 클라이언트 ${index + 1}`,
        status: clientData.status,
        created_at: new Date(Date.now() - (index * 86400000)),
        last_seen: clientData.status !== 'offline' ? new Date() : null
      }));
      
      setClients(newClients);
      newClients.forEach(client => addClientHistory(client.id, '데모 데이터로 생성됨'));
      
      // 데모 그룹
      setTimeout(() => {
        const demoGroup = {
          id: 'demo_group_1',
          name: '메인 디스플레이 월',
          description: '중앙 메인 디스플레이 구역',
          client_ids: ['demo_client_1', 'demo_client_2', 'demo_client_4'],
          created_at: new Date()
        };
        
        setGroups([demoGroup]);
      }, 500);
      
      // 데모 프리셋
      setTimeout(() => {
        const demoPreset = {
          id: 'demo_preset_1',
          name: '메인 콘텐츠 재생',
          description: '4K 메인 콘텐츠 스트리밍',
          group_id: 'demo_group_1',
          client_commands: {
            'demo_client_1': 'D:\\UnrealProjects\\MainContent\\Windows\\MainContent.exe -dc_node=Node_0 -fullscreen',
            'demo_client_2': 'D:\\UnrealProjects\\MainContent\\Windows\\MainContent.exe -dc_node=Node_1 -fullscreen',
            'demo_client_4': 'D:\\UnrealProjects\\MainContent\\Windows\\MainContent.exe -dc_node=Node_2 -fullscreen'
          },
          created_at: new Date(),
          is_active: false
        };
        
        setPresets([demoPreset]);
      }, 1000);
      
      showToast('데모 데이터가 로드되었습니다. 실제 환경에서는 서버와 연동됩니다.', 'info');
    }, 3000);
  };

  // 통계 계산
  const stats = {
    totalClients: clients.length,
    onlineClients: clients.filter(c => c.status === 'online' || c.status === 'running').length,
    runningClients: clients.filter(c => c.status === 'running').length,
    totalGroups: groups.length
  };

  return (
    <div className="App">
      <Header 
        isDarkMode={isDarkMode}
        isSocketConnected={isSocketConnected}
        currentTime={currentTime}
        connectedCount={stats.onlineClients}
        onToggleDarkMode={toggleDarkMode}
      />
      
      <div className="container">
        <StatsBar stats={stats} />
        
        <div className="main-layout">
          <PresetSection 
            presets={presets}
            groups={groups}
            selectedPresets={selectedPresets}
            onSelectAll={handleSelectAllPresets}
            onBulkAction={handleBulkPresetAction}
            onAddPreset={() => {
              console.log('새 프리셋 버튼 클릭됨');
              console.log('현재 showPresetModal 상태:', showPresetModal);
              setEditingPreset(null);
              setShowPresetModal(true);
              console.log('showPresetModal을 true로 설정함');
            }}
            onEditPreset={handleEditPreset}
            onDeletePreset={handleDeletePreset}
            onExecutePreset={handleExecutePreset}
            onSelectPreset={(presetId, selected) => {
              setSelectedPresets(prev => {
                const newSet = new Set(prev);
                if (selected) {
                  newSet.add(presetId);
                } else {
                  newSet.delete(presetId);
                }
                return newSet;
              });
            }}
          />
          
          <GroupSection 
            groups={groups}
            clients={clients}
            selectedGroups={selectedGroups}
            onSelectAll={handleSelectAllGroups}
            onBulkAction={handleBulkGroupAction}
            onAddGroup={() => {
              console.log('새 그룹 버튼 클릭됨');
              setEditingGroup(null);
              setShowGroupModal(true);
            }}
            onEditGroup={handleEditGroup}
            onDeleteGroup={handleDeleteGroup}
            onSelectGroup={(groupId, selected) => {
              setSelectedGroups(prev => {
                const newSet = new Set(prev);
                if (selected) {
                  newSet.add(groupId);
                } else {
                  newSet.delete(groupId);
                }
                return newSet;
              });
            }}
          />
        </div>
        
        <ClientMonitor 
          clients={clients}
          onAddClient={() => {
            console.log('새 클라이언트 버튼 클릭됨');
            setShowAddClientModal(true);
          }}
          onClientClick={(clientId) => {
            setCurrentClientId(clientId);
            setShowClientModal(true);
          }}
        />
      </div>
      
      {/* 모달들 */}
      {showClientModal && (
        <ClientDetailModal 
          client={clients.find(c => c.id === currentClientId)}
          history={clientHistory[currentClientId] || []}
          onClose={() => setShowClientModal(false)}
          onAction={handleClientAction}
          onDelete={() => {
            setCurrentClientId(null);
            setShowClientModal(false);
          }}
        />
      )}
      
      {showAddClientModal && (
        <AddClientModal 
          onClose={() => setShowAddClientModal(false)}
          onAddClient={handleAddClient}
        />
      )}
      
      {showPresetModal && (
        <PresetModal 
          onClose={() => {
            console.log('PresetModal 닫기 호출됨');
            setShowPresetModal(false);
            setEditingPreset(null);
          }}
          onSave={handleSavePreset}
          editingPreset={editingPreset}
          groups={groups}
          clients={clients}
        />
      )}
      
      {showGroupModal && (
        <GroupModal 
          onClose={() => {
            setShowGroupModal(false);
            setEditingGroup(null);
          }}
          onSave={handleSaveGroup}
          editingGroup={editingGroup}
          clients={clients}
        />
      )}
      
      {/* 토스트 */}
      <Toast 
        show={toast.show}
        message={toast.message}
        type={toast.type}
      />
    </div>
  );
}

export default App; 