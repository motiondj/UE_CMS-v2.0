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

  // Socket 연결
  useEffect(() => {
    const newSocket = io(API_BASE);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsSocketConnected(true);
      // 웹UI는 클라이언트로 등록하지 않음 (관리 인터페이스이므로)
      // newSocket.emit('register_client', { 
      //   name: 'web-ui',
      //   clientType: 'web-ui' 
      // });
      showToast('🔌 Socket 연결이 성공했습니다.', 'success');
      
      // 웹UI는 하트비트를 보내지 않음 (클라이언트가 아니므로)
      // startHeartbeat(newSocket);
    });

    newSocket.on('disconnect', () => {
      setIsSocketConnected(false);
      showToast('🔌 Socket 연결이 끊어졌습니다.', 'error');
    });

    // 웹UI는 클라이언트가 아니므로 연결 확인 응답하지 않음
    // newSocket.on('connection_check', (data) => {
    //   newSocket.emit('connection_check_response', {
    //     clientName: 'web-ui'
    //   });
    // });

    newSocket.on('client_update', (data) => {
      setClients(prev => prev.map(client => 
        client.id === data.client_id 
          ? { ...client, ...data.updates }
          : client
      ));
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

    // 클라이언트 상태 변경 이벤트 처리
    newSocket.on('client_status_changed', (data) => {
      console.log('📊 클라이언트 상태 변경:', data);
      setClients(prev => prev.map(client => 
        client.name === data.name 
          ? { ...client, status: data.status }
          : client
      ));
    });

    // 새 클라이언트 추가 이벤트 처리
    newSocket.on('client_added', (newClient) => {
      console.log('➕ 새 클라이언트 추가:', newClient);
      setClients(prev => [...prev, newClient]);
      showToast(`🖥️ 새 클라이언트 "${newClient.name}"이(가) 연결되었습니다.`, 'success');
    });

    // 클라이언트 업데이트 이벤트 처리
    newSocket.on('client_updated', (updatedClient) => {
      console.log('✏️ 클라이언트 업데이트:', updatedClient);
      setClients(prev => prev.map(client => 
        client.id === updatedClient.id 
          ? updatedClient
          : client
      ));
    });

    // 클라이언트 삭제 이벤트 처리
    newSocket.on('client_deleted', (data) => {
      console.log('🗑️ 클라이언트 삭제:', data);
      setClients(prev => prev.filter(client => client.id !== data.id));
      showToast('🗑️ 클라이언트가 삭제되었습니다.', 'info');
    });

    // 그룹 추가 이벤트 처리
    newSocket.on('group_added', (newGroup) => {
      console.log('➕ 새 그룹 추가:', newGroup);
      setGroups(prev => [newGroup, ...prev]);
      showToast(`✨ 새 그룹 "${newGroup.name}"이(가) 추가되었습니다.`, 'success');
    });

    // 그룹 업데이트 이벤트 처리
    newSocket.on('group_updated', (updatedGroup) => {
      console.log('✏️ 그룹 업데이트:', updatedGroup);
      setGroups(prev => prev.map(group => 
        group.id === updatedGroup.id 
          ? updatedGroup 
          : group
      ));
      showToast(`🔄 그룹 "${updatedGroup.name}" 정보가 업데이트되었습니다.`, 'info');
    });

    // 그룹 삭제 이벤트 처리
    newSocket.on('group_deleted', (data) => {
      console.log('🗑️ 그룹 삭제:', data);
      setGroups(prev => prev.filter(group => group.id !== data.id));
      showToast('🗑️ 그룹이 삭제되었습니다.', 'info');
    });

    // 프리셋 추가 이벤트 처리
    newSocket.on('preset_added', (newPreset) => {
      console.log('⚡️ 새 프리셋 추가:', newPreset);
      setPresets(prev => [newPreset, ...prev]);
      showToast(`✨ 새 프리셋 "${newPreset.name}"이(가) 추가되었습니다.`, 'success');
    });

    // 프리셋 업데이트 이벤트 처리
    newSocket.on('preset_updated', (updatedPreset) => {
      console.log('✏️ 프리셋 업데이트:', updatedPreset);
      setPresets(prev => prev.map(preset =>
        preset.id === updatedPreset.id
          ? updatedPreset
          : preset
      ));
      showToast(`🔄 프리셋 "${updatedPreset.name}" 정보가 업데이트되었습니다.`, 'info');
    });

    // 프리셋 삭제 이벤트 처리
    newSocket.on('preset_deleted', (data) => {
      console.log('🗑️ 프리셋 삭제:', data);
      setPresets(prev => prev.filter(preset => preset.id !== data.id));
      showToast('🗑️ 프리셋이 삭제되었습니다.', 'info');
    });

    return () => newSocket.close();
  }, []);

  // 웹UI는 클라이언트가 아니므로 하트비트를 보내지 않음
  // const startHeartbeat = (socket) => {
  //   const heartbeatInterval = setInterval(() => {
  //     if (socket.connected) {
  //       socket.emit('heartbeat', {
  //         name: 'web-ui'
  //       });
  //     } else {
  //       clearInterval(heartbeatInterval);
  //     }
  //   }, 30000); // 30초마다 하트비트

  //   // 컴포넌트 언마운트 시 인터벌 정리
  //   return () => clearInterval(heartbeatInterval);
  // };

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