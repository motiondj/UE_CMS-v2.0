import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import './App.css';
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import ClientMonitor from './components/ClientMonitor';
import PresetSection from './components/PresetSection';
import GroupSection from './components/GroupSection';
import Toast from './components/Toast';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

function App() {
  const [socket, setSocket] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [toast, setToast] = useState({ message: '', type: 'info' });
  
  // 데이터 상태
  const [clients, setClients] = useState([]);
  const [groups, setGroups] = useState([]);
  const [presets, setPresets] = useState([]);
  const [executions, setExecutions] = useState([]);

  // 통계 계산
  const totalClients = clients.length;
  const onlineClients = clients.filter(c => c.status === 'online' || c.status === 'running').length;
  const runningClients = clients.filter(c => c.status === 'running').length;
  const activeExecutions = executions.filter(e => e.status === 'running').length;
  const totalGroups = groups.length;
  
  // 실행 중인 프리셋 수 계산 (현재 실행 중인 클라이언트가 있는 프리셋)
  const runningPresets = new Set();
  clients.forEach(client => {
    if (client.status === 'running' && client.current_preset_id) {
      runningPresets.add(client.current_preset_id);
    }
  });
  const totalRunningPresets = runningPresets.size;

  // Socket 연결
  useEffect(() => {
    const newSocket = io(API_BASE);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsSocketConnected(true);
      console.log('✅ Socket.io 연결됨');
    });

    newSocket.on('disconnect', () => {
      setIsSocketConnected(false);
      console.log('❌ Socket.io 연결 끊김');
    });

    // 클라이언트 추가 이벤트
    newSocket.on('client_added', (client) => {
      console.log('📡 클라이언트 추가 이벤트 수신:', client);
      setClients(prevClients => {
        // 중복 방지
        const exists = prevClients.find(c => c.id === client.id);
        if (exists) {
          return prevClients.map(c => c.id === client.id ? client : c);
        }
        return [...prevClients, client];
      });
      showToast(`✅ 클라이언트 추가됨: ${client.name}`, 'success');
    });

    // 클라이언트 삭제 이벤트
    newSocket.on('client_deleted', (data) => {
      console.log('📡 클라이언트 삭제 이벤트 수신:', data);
      setClients(prevClients => prevClients.filter(c => c.id !== data.id));
      showToast('🗑️ 클라이언트가 삭제되었습니다', 'info');
    });

    // 클라이언트 상태 변경 이벤트
    newSocket.on('client_status_changed', (data) => {
      console.log('📡 클라이언트 상태 변경 이벤트 수신:', data);
      setClients(prev => prev.map(c => 
        c.name === data.name ? { ...c, status: data.status } : c
      ));
    });

    // 클라이언트 업데이트 이벤트
    newSocket.on('client_updated', (client) => {
      console.log('📡 클라이언트 업데이트 이벤트 수신:', client);
      setClients(prevClients => 
        prevClients.map(c => c.id === client.id ? client : c)
      );
    });

    newSocket.on('execution_update', (data) => {
      setExecutions(prev => prev.map(exec => 
        exec.id === data.execution_id 
          ? { ...exec, ...data.updates }
          : exec
      ));
    });

    // 클라이언트 오프라인 상태 업데이트 처리
    newSocket.on('clients_offline_updated', () => {
      console.log('🔄 클라이언트 오프라인 상태 업데이트 감지');
      loadData(); // 클라이언트 목록 새로고침
      showToast('🔄 클라이언트 상태가 업데이트되었습니다.', 'info');
    });

    // MAC 주소 업데이트 이벤트 처리
    newSocket.on('mac_address_updated', (data) => {
      setClients(prev => prev.map(c => 
        c.id === data.clientId ? { ...c, mac_address: data.macAddress } : c
      ));
      showToast(`MAC 주소 업데이트됨: ${data.clientName}`, 'success');
    });

    // 그룹 추가 이벤트 처리
    newSocket.on('group_added', (newGroup) => {
      try {
        console.log('➕ 새 그룹 추가:', newGroup);
        setGroups(prev => [newGroup, ...prev]);
        showToast(`✨ 새 그룹 "${newGroup.name}"이(가) 추가되었습니다.`, 'success');
      } catch (error) {
        console.warn('그룹 추가 처리 중 오류:', error);
      }
    });

    // 그룹 업데이트 이벤트 처리
    newSocket.on('group_updated', (updatedGroup) => {
      try {
        console.log('✏️ 그룹 업데이트:', updatedGroup);
        setGroups(prev => prev.map(group => 
          group.id === updatedGroup.id 
            ? updatedGroup 
            : group
        ));
        showToast(`🔄 그룹 "${updatedGroup.name}" 정보가 업데이트되었습니다.`, 'info');
      } catch (error) {
        console.warn('그룹 업데이트 처리 중 오류:', error);
      }
    });

    // 그룹 삭제 이벤트 처리
    newSocket.on('group_deleted', (data) => {
      try {
        console.log('🗑️ 그룹 삭제:', data);
        setGroups(prev => prev.filter(group => group.id !== data.id));
        showToast('🗑️ 그룹이 삭제되었습니다.', 'info');
      } catch (error) {
        console.warn('그룹 삭제 처리 중 오류:', error);
      }
    });

    // 프리셋 추가 이벤트 처리
    newSocket.on('preset_added', (newPreset) => {
      try {
        console.log('⚡️ 새 프리셋 추가:', newPreset);
        setPresets(prev => [newPreset, ...prev]);
        showToast(`✨ 새 프리셋 "${newPreset.name}"이(가) 추가되었습니다.`, 'success');
      } catch (error) {
        console.warn('프리셋 추가 처리 중 오류:', error);
      }
    });

    // 프리셋 업데이트 이벤트 처리
    newSocket.on('preset_updated', (updatedPreset) => {
      try {
        console.log('✏️ 프리셋 업데이트:', updatedPreset);
        setPresets(prev => prev.map(preset =>
          preset.id === updatedPreset.id
            ? updatedPreset
            : preset
        ));
        showToast(`🔄 프리셋 "${updatedPreset.name}" 정보가 업데이트되었습니다.`, 'info');
      } catch (error) {
        console.warn('프리셋 업데이트 처리 중 오류:', error);
      }
    });

    // 프리셋 삭제 이벤트 처리
    newSocket.on('preset_deleted', (data) => {
      try {
        console.log('🗑️ 프리셋 삭제:', data);
        setPresets(prev => prev.filter(preset => preset.id !== data.id));
        showToast('🗑️ 프리셋이 삭제되었습니다.', 'info');
      } catch (error) {
        console.warn('프리셋 삭제 처리 중 오류:', error);
      }
    });

    newSocket.on('preset_executed', (data) => {
      showToast(`프리셋 실행됨: ${data.presetName}`, 'success');
    });

    return () => newSocket.close();
  }, []);

  // API 연결 상태 확인
  useEffect(() => {
    const checkApiConnection = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/health`);
        if (response.ok) {
          setIsApiConnected(true);
        } else {
          setIsApiConnected(false);
        }
      } catch (error) {
        setIsApiConnected(false);
      }
    };

    checkApiConnection();
    const interval = setInterval(checkApiConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  // 시간 업데이트
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('ko-KR', {
        hour12: true, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit'
      }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 다크모드 초기화
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.body.setAttribute('data-theme', 'dark');
    }
  }, []);

  // 데이터 로드
  useEffect(() => {
    if (isApiConnected) {
      loadData();
    }
  }, [isApiConnected]);

  // 5초마다 클라이언트 목록 자동 새로고침
  useEffect(() => {
    if (!isApiConnected) return;

    const interval = setInterval(() => {
      console.log('🔄 5초마다 클라이언트 목록 자동 새로고침');
      loadClientsOnly(); // 클라이언트만 새로고침 (성능 최적화)
    }, 5000); // 5초

    return () => clearInterval(interval);
  }, [isApiConnected]);

  const loadData = async () => {
    try {
      const [clientsRes, groupsRes, presetsRes, executionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/clients`),
        fetch(`${API_BASE}/api/groups`),
        fetch(`${API_BASE}/api/presets`),
        fetch(`${API_BASE}/api/executions`)
      ]);

      if (clientsRes.ok) setClients(await clientsRes.json());
      if (groupsRes.ok) setGroups(await groupsRes.json());
      if (presetsRes.ok) setPresets(await presetsRes.json());
      if (executionsRes.ok) setExecutions(await executionsRes.json());
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    }
  };

  // 클라이언트 목록만 새로고침 (성능 최적화)
  const loadClientsOnly = async () => {
    try {
      const clientsRes = await fetch(`${API_BASE}/api/clients`);
      if (clientsRes.ok) {
        const updatedClients = await clientsRes.json();
        setClients(updatedClients);
        console.log('✅ 클라이언트 목록 자동 새로고침 완료');
      }
    } catch (error) {
      console.error('클라이언트 목록 새로고침 오류:', error);
    }
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      showToast('🌙 다크 모드가 활성화되었습니다.', 'success');
    } else {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
      showToast('☀️ 라이트 모드가 활성화되었습니다.', 'success');
    }
  };

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const handleRefresh = () => {
    loadData();
    showToast('🔄 데이터를 새로고침했습니다.', 'info');
  };

  const handleClientUpdate = (updatedClient) => {
    if (updatedClient) {
      // 클라이언트 수정 시
      setClients(prevClients => 
        prevClients.map(client => 
          client.id === updatedClient.id ? updatedClient : client
        )
      );
    } else {
      // 클라이언트 삭제 시 - 전체 데이터 다시 로드
      loadData();
    }
  };

  // 데모 데이터 생성 (개발용) - 비활성화
  // useEffect(() => {
  //   if (clients.length === 0 && groups.length === 0 && presets.length === 0) {
  //     setTimeout(() => {
  //       createDemoData();
  //     }, 3000);
  //   }
  // }, [clients.length, groups.length, presets.length]);

  const createDemoData = () => {
    // 데모 클라이언트 생성
    const demoClients = [
      { id: 'demo_client_1', name: 'Display_01', ip_address: '192.168.1.101', status: 'online', port: 8081, description: '데모 클라이언트 1', created_at: new Date(), last_seen: new Date() },
      { id: 'demo_client_2', name: 'Display_02', ip_address: '192.168.1.102', status: 'running', port: 8081, description: '데모 클라이언트 2', created_at: new Date(), last_seen: new Date() },
      { id: 'demo_client_3', name: 'Display_03', ip_address: '192.168.1.103', status: 'offline', port: 8081, description: '데모 클라이언트 3', created_at: new Date(), last_seen: null },
      { id: 'demo_client_4', name: 'Display_04', ip_address: '192.168.1.104', status: 'online', port: 8081, description: '데모 클라이언트 4', created_at: new Date(), last_seen: new Date() }
    ];
    setClients(demoClients);

    // 데모 그룹 생성
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

    // 데모 프리셋 생성
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

    showToast('🎮 데모 데이터가 로드되었습니다! 이제 프리셋을 만들어보세요.', 'success');
  };

  return (
    <div className={`App ${isDarkMode ? 'dark-mode' : ''}`}>
      <Header 
        isDarkMode={isDarkMode} 
        toggleDarkMode={toggleDarkMode}
        isSocketConnected={isSocketConnected}
        isApiConnected={isApiConnected}
        currentTime={currentTime}
        onRefresh={handleRefresh}
      />
      <div className="container">
        <StatsBar 
          totalClients={totalClients}
          onlineClients={onlineClients}
          runningClients={runningClients}
          activeExecutions={activeExecutions}
          totalGroups={totalGroups}
          totalRunningPresets={totalRunningPresets}
          totalPresets={presets.length}
        />
        <div className="main-layout">
            <PresetSection 
              presets={presets}
              groups={groups}
              clients={clients}
              apiBase={API_BASE}
              showToast={showToast}
            />
            <GroupSection 
              groups={groups}
              clients={clients}
              apiBase={API_BASE}
              showToast={showToast}
            />
        </div>
        <ClientMonitor 
            clients={clients} 
            onClientUpdate={handleClientUpdate}
            apiBase={API_BASE}
            showToast={showToast}
        />
      </div>
      <Toast message={toast.message} type={toast.type} onClear={() => setToast({ message: '', type: 'info' })} />
    </div>
  );
}

export default App; 