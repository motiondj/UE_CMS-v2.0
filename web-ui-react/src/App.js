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
      showToast('🔌 Socket 연결이 성공했습니다.', 'success');
    });

    newSocket.on('disconnect', () => {
      setIsSocketConnected(false);
      showToast('🔌 Socket 연결이 끊어졌습니다.', 'error');
    });

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

  // 데모 데이터 생성 (개발용)
  useEffect(() => {
    if (clients.length === 0 && groups.length === 0 && presets.length === 0) {
      setTimeout(() => {
        createDemoData();
      }, 3000);
    }
  }, [clients.length, groups.length, presets.length]);

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
    <div className="App">
      {/* API 연결 상태 표시 */}
      <div className={`api-status ${isApiConnected ? 'visible' : ''}`}>
        <span className={`api-indicator ${isApiConnected ? 'connected' : 'disconnected'}`}></span>
        <span>{isApiConnected ? 'API 연결됨' : 'API 연결 중...'}</span>
      </div>

      {/* 헤더 */}
      <Header 
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onRefresh={handleRefresh}
        isSocketConnected={isSocketConnected}
        currentTime={currentTime}
        connectedCount={onlineClients}
      />

      <div className="container">
        {/* 통계 바 */}
        <StatsBar 
          totalClients={totalClients}
          onlineClients={onlineClients}
          runningClients={runningClients}
          activeExecutions={activeExecutions}
          totalGroups={totalGroups}
        />

        {/* 메인 레이아웃 */}
        <div className="main-layout">
          {/* 콘텐츠 프리셋 */}
          <PresetSection 
            presets={presets}
            groups={groups}
            onRefresh={handleRefresh}
            showToast={showToast}
          />

          {/* 디스플레이 서버 그룹 */}
          <GroupSection 
            groups={groups}
            clients={clients}
            onRefresh={handleRefresh}
            showToast={showToast}
          />
        </div>

        {/* 디스플레이 서버 모니터링 */}
        <ClientMonitor 
          clients={clients}
          onRefresh={handleRefresh}
          showToast={showToast}
        />
      </div>

      {/* 토스트 알림 */}
      <Toast 
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: 'info' })}
      />
    </div>
  );
}

export default App; 