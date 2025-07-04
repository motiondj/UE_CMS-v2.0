import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';
import Header from './components/Header';
import StatsBar from './components/StatsBar';
import ClientMonitor from './components/ClientMonitor';
import PresetSection from './components/PresetSection';
import GroupSection from './components/GroupSection';
import ToastContainer from './components/ToastContainer';
import OfflineIndicator from './components/OfflineIndicator';
import useSocket from './hooks/useSocket';
import useToast from './hooks/useToast';
import useServiceWorker from './hooks/useServiceWorker';
import useKeyboardNavigation from './hooks/useKeyboardNavigation';
import useRealtimeSync from './hooks/useRealtimeSync';
import ErrorBoundary from './components/ErrorBoundary';
import config from './config/environment';
import performanceMonitor from './utils/performance';

const API_BASE = config.API_BASE;

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  
  // Custom Hooks 사용
  const { socket, isConnected: isSocketConnected, on: socketOn } = useSocket(API_BASE);
  const { showToast, toasts, removeToast } = useToast();
  // Service Worker Hook
  const { 
    updateAvailable, 
    offline, 
    cacheInfo, 
    applyUpdate
  } = useServiceWorker();
  // 실시간 동기화 Hook
  const { syncError, initializeSync } = useRealtimeSync(API_BASE, {
    syncInterval: 5000,
    enableAutoSync: true,
    enableHeartbeat: true,
    heartbeatInterval: 10000
  });
  
  // 데이터 상태
  const [clients, setClients] = useState([]);
  const [groups, setGroups] = useState([]);
  const [presets, setPresets] = useState([]);
  const [executions, setExecutions] = useState([]);

  // 통계 계산을 useMemo로 최적화
  const stats = useMemo(() => {
    const onlineClients = clients.filter(c => c.status === 'online' || c.status === 'running').length;
    const runningClients = clients.filter(c => c.status === 'running').length;
    const activeExecutions = executions.filter(e => e.status === 'running').length;
    const runningPresets = presets.filter(preset => 
      preset.is_running === true || preset.status === 'running' || preset.status === 'partial' || preset.status === 'executing'
    );
    
    return {
      totalClients: clients.length,
      onlineClients,
      runningClients,
      activeExecutions,
      totalGroups: groups.length,
      totalPresets: presets.length,
      totalRunningPresets: runningPresets.length
    };
  }, [clients, groups, presets, executions]);



  // 데이터 로드 함수들을 useCallback으로 최적화
  const loadData = useCallback(async () => {
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
      showToast('데이터를 불러오는데 실패했습니다.', 'error');
    }
  }, [showToast]);

  // 키보드 단축키 정의
  const keyboardShortcuts = {
    'ctrl+r': (e) => {
      e.preventDefault(); // 브라우저 새로고침 방지
      loadData();
      showToast('🔄 데이터를 새로고침했습니다.', 'info');
    },
    'ctrl+n': () => {
      // 현재 포커스된 섹션에 따라 다른 모달 열기
      const activeElement = document.activeElement;
      if (activeElement.closest('.preset-section')) {
        // 프리셋 추가
        document.querySelector('.preset-section .btn-add')?.click();
      } else if (activeElement.closest('.group-section')) {
        // 그룹 추가
        document.querySelector('.group-section .btn-add')?.click();
      } else {
        // 기본: 클라이언트 추가
        document.querySelector('.client-monitor .btn-add')?.click();
      }
    },
    'ctrl+/': () => {
      // 도움말 표시
      showToast('단축키: Ctrl+R(새로고침), Ctrl+N(추가), ESC(닫기)', 'info');
    },
    'escape': () => {
      // 열려있는 모달 닫기
      const openModal = document.querySelector('.modal.show');
      if (openModal) {
        openModal.querySelector('.modal-close')?.click();
      }
    },
  };

  // 키보드 네비게이션 활성화
  useKeyboardNavigation(keyboardShortcuts);

  // 클라이언트 목록만 새로고침 (성능 최적화) - 현재 사용하지 않음
  // const loadClientsOnly = useCallback(async () => {
  //   try {
  //     const clientsRes = await fetch(`${API_BASE}/api/clients`);
  //     if (clientsRes.ok) {
  //       const updatedClients = await clientsRes.json();
  //       setClients(updatedClients);
  //       console.log('✅ 클라이언트 목록 자동 새로고침 완료');
  //     }
  //   } catch (error) {
  //     console.error('클라이언트 목록 새로고침 오류:', error);
  //   }
  // }, []);

  // API 연결 상태 확인
  useEffect(() => {
    const checkApiConnection = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/health`);
        if (response.ok) {
          setIsApiConnected(true);
          console.log('✅ API 서버 연결됨');
        } else {
          setIsApiConnected(false);
          console.log('❌ API 서버 연결 실패');
        }
      } catch (error) {
        setIsApiConnected(false);
        console.log('❌ API 서버 연결 오류:', error);
      }
    };

    checkApiConnection();
    const interval = setInterval(checkApiConnection, 10000); // 10초마다 체크
    return () => clearInterval(interval);
  }, []);

  // 현재 시간 업데이트
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('ko-KR', {
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
  }, [isApiConnected, loadData]);

  // 실시간 동기화 초기화
  useEffect(() => {
    if (isApiConnected) {
      initializeSync(new Date().toISOString());
    }
  }, [isApiConnected, initializeSync]);

  // 동기화 오류 처리
  useEffect(() => {
    if (syncError) {
      showToast(`동기화 오류: ${syncError}`, 'error');
    }
  }, [syncError, showToast]);

  // 성능 모니터링 시작
  useEffect(() => {
    if (config.DEBUG_MODE) {
      performanceMonitor.startMonitoring();
    }
  }, []);

  // Socket 이벤트 설정
  useEffect(() => {
    if (!socket) return;

    // 클라이언트 추가 이벤트
    socketOn('client_added', (client) => {
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
    socketOn('client_deleted', (data) => {
      console.log('📡 클라이언트 삭제 이벤트 수신:', data);
      setClients(prevClients => prevClients.filter(c => c.id !== data.id));
      showToast('🗑️ 클라이언트가 삭제되었습니다', 'info');
    });

    // 클라이언트 상태 변경 이벤트 (통합)
    socketOn('client_status_changed', (data) => {
      console.log('📡 클라이언트 상태 변경:', data);
      
      // 상태 변경 전후 로깅
      const prevClient = clients.find(c => c.id === data.client_id || c.name === data.name);
      console.log(`🔄 상태 변경: ${prevClient?.name || '알 수 없음'} ${prevClient?.status || '알 수 없음'} → ${data.status}`);
      
      setClients(prev => prev.map(c => 
        c.id === data.client_id || c.name === data.name
          ? { 
              ...c, 
              status: data.status,
              current_preset_id: data.current_preset_id || null
            } 
          : c
      ));
      
      // 상태 변경 알림 (오프라인 → 온라인일 때만 표시, 프리셋 실행 중에는 억제)
      const clientName = data.name || prevClient?.name || '알 수 없음';
      const isComingOnline = data.status === 'online' && prevClient?.status === 'offline';
      const isGoingOffline = data.status === 'offline' && prevClient?.status === 'online';
      
      if (isComingOnline) {
        showToast(`🟢 ${clientName} 온라인`, 'success');
      } else if (isGoingOffline) {
        showToast(`🔴 ${clientName} 오프라인`, 'warning');
      }
    });

    // 클라이언트 업데이트 이벤트
    socketOn('client_updated', (client) => {
      console.log('📡 클라이언트 업데이트 이벤트 수신:', client);
      setClients(prevClients => 
        prevClients.map(c => c.id === client.id ? client : c)
      );
    });

    socketOn('execution_update', (data) => {
      setExecutions(prev => prev.map(exec => 
        exec.id === data.execution_id 
          ? { ...exec, ...data.updates }
          : exec
      ));
    });

    // 클라이언트 오프라인 상태 업데이트 처리
    socketOn('clients_offline_updated', () => {
      console.log('🔄 클라이언트 오프라인 상태 업데이트 감지');
      loadData(); // 클라이언트 목록 새로고침
      showToast('🔄 클라이언트 상태가 업데이트되었습니다.', 'info');
    });

    // MAC 주소 업데이트 이벤트 처리
    socketOn('mac_address_updated', (data) => {
      setClients(prev => prev.map(c => 
        c.id === data.clientId ? { ...c, mac_address: data.macAddress } : c
      ));
      showToast(`MAC 주소 업데이트됨: ${data.clientName}`, 'success');
    });

    // 그룹 추가 이벤트 처리
    socketOn('group_added', (newGroup) => {
      try {
        console.log('➕ 새 그룹 추가:', newGroup);
        setGroups(prev => [newGroup, ...prev]);
        showToast(`✨ 새 그룹 "${newGroup.name}"이(가) 추가되었습니다.`, 'success');
      } catch (error) {
        console.warn('그룹 추가 처리 중 오류:', error);
      }
    });

    // 그룹 업데이트 이벤트 처리
    socketOn('group_updated', (updatedGroup) => {
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
    socketOn('group_deleted', (data) => {
      try {
        console.log('🗑️ 그룹 삭제:', data);
        setGroups(prev => prev.filter(group => group.id !== data.id));
        showToast('🗑️ 그룹이 삭제되었습니다.', 'info');
      } catch (error) {
        console.warn('그룹 삭제 처리 중 오류:', error);
      }
    });

    // 프리셋 추가 이벤트 처리
    socketOn('preset_added', (newPreset) => {
      try {
        console.log('⚡️ 새 프리셋 추가:', newPreset);
        setPresets(prev => [newPreset, ...prev]);
        showToast(`✨ 새 프리셋 "${newPreset.name}"이(가) 추가되었습니다.`, 'success');
      } catch (error) {
        console.warn('프리셋 추가 처리 중 오류:', error);
      }
    });

    // 프리셋 업데이트 이벤트 처리
    socketOn('preset_updated', (updatedPreset) => {
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
    socketOn('preset_deleted', (data) => {
      try {
        console.log('🗑️ 프리셋 삭제:', data);
        setPresets(prev => prev.filter(preset => preset.id !== data.id));
        showToast('🗑️ 프리셋이 삭제되었습니다.', 'info');
      } catch (error) {
        console.warn('프리셋 삭제 처리 중 오류:', error);
      }
    });

    socketOn('preset_executed', (data) => {
      showToast(`프리셋 실행됨: ${data.presetName}`, 'success');
    });

    // 프리셋 상태 변경 이벤트 추가
    socketOn('preset_status_changed', (data) => {
      console.log('📡 프리셋 상태 변경:', data);
      // 프리셋 실행 상태 업데이트
      setPresets(prev => prev.map(preset => 
        preset.id === data.preset_id 
          ? { 
              ...preset, 
              is_running: data.status === 'running',
              running_client_ids: data.running_clients || data.stopped_clients || []
            }
          : preset
      ));

      // 실행 중인 프리셋 수 재계산을 위해 상태 업데이트
      if (data.status === 'running') {
        showToast(`⚡ 프리셋이 실행되었습니다`, 'success');
      } else if (data.status === 'stopped') {
        // 비정상 종료인지 확인
        if (data.reason === '비정상 종료') {
          showToast(`⚠️ ${data.preset_name}이(가) 비정상 종료되었습니다`, 'warning');
        } else {
          showToast(`⏹️ 프리셋이 정지되었습니다`, 'info');
        }
      }
    });



  }, [socket, socketOn, showToast, loadData, clients]);

  const toggleDarkMode = useCallback(() => {
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
  }, [isDarkMode, showToast]);



  const handleClientUpdate = useCallback((updatedClient) => {
    if (updatedClient) {
      setClients(prevClients => 
        prevClients.map(client => 
          client.id === updatedClient.id ? updatedClient : client
        )
      );
    } else {
      loadData();
    }
  }, [loadData]);

  return (
    <ErrorBoundary>
      <div className={`App ${isDarkMode ? 'dark-mode' : ''}`}>
        {/* Skip to Content 링크 - 접근성 개선 */}
        <a href="#main-content" className="skip-to-content">
          메인 콘텐츠로 건너뛰기
        </a>
        
        {/* Service Worker 상태 표시 */}
        <OfflineIndicator 
          offline={offline}
          updateAvailable={updateAvailable}
          onApplyUpdate={applyUpdate}
          cacheInfo={cacheInfo}
        />
        
              <Header 
        isDarkMode={isDarkMode} 
        toggleDarkMode={toggleDarkMode}
        isSocketConnected={isSocketConnected}
        isApiConnected={isApiConnected}
        currentTime={currentTime}
      />
        <div className="container" id="main-content">
          <ErrorBoundary>
            <StatsBar {...stats} />
          </ErrorBoundary>
          
          <div className="main-layout">
            <ErrorBoundary>
              <PresetSection 
                presets={presets}
                groups={groups}
                clients={clients}
                apiBase={API_BASE}
                showToast={showToast}
              />
            </ErrorBoundary>
            
            <ErrorBoundary>
              <GroupSection 
                groups={groups}
                clients={clients}
                apiBase={API_BASE}
                showToast={showToast}
              />
            </ErrorBoundary>
          </div>
          
          <ErrorBoundary>
            <ClientMonitor 
              clients={clients} 
              onClientUpdate={handleClientUpdate}
              apiBase={API_BASE}
              showToast={showToast}
            />
          </ErrorBoundary>
        </div>
        
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </ErrorBoundary>
  );
}

export default App; 