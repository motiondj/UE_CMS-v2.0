# UE CMS v2.0 웹 UI 개선 작업 목록

## 🚨 긴급 수정 사항 (Critical Bugs) - 상세 코드 포함

### 1. 프리셋 실행/정지 버튼 동작 수정
**문제:** 프리셋 실행 시 버튼이 정지로 바뀌지 않고, 정지 기능이 작동하지 않음

#### 1-1. 백엔드 수정 코드

**파일: `backend/routes/presets.py`**
```python
# 프리셋 실행 API 수정
@router.post("/{preset_id}/execute")
async def execute_preset(preset_id: str):
    """프리셋 실행"""
    try:
        # 프리셋 정보 조회
        preset = await db.presets.find_one({"_id": preset_id})
        if not preset:
            raise HTTPException(status_code=404, detail="프리셋을 찾을 수 없습니다")

        # 그룹의 클라이언트 조회
        group = await db.groups.find_one({"_id": preset["target_group_id"]})
        if not group:
            raise HTTPException(status_code=404, detail="그룹을 찾을 수 없습니다")

        results = []
        online_clients = []
        
        # 각 클라이언트에 명령 전송
        for client_id in group["client_ids"]:
            client = await db.clients.find_one({"_id": client_id})
            if client and client.get("status") == "online":
                # 명령 실행
                command = preset["client_commands"].get(client_id)
                if command:
                    # 실제 명령 전송 로직
                    success = await send_command_to_client(client, command)
                    
                    if success:
                        # 클라이언트의 current_preset_id 업데이트
                        await db.clients.update_one(
                            {"_id": client_id},
                            {
                                "$set": {
                                    "status": "running",
                                    "current_preset_id": preset_id,
                                    "last_command": command,
                                    "command_executed_at": datetime.utcnow()
                                }
                            }
                        )
                        online_clients.append(client_id)
                        
                        # Socket으로 클라이언트 상태 변경 알림
                        await sio.emit("client_status_changed", {
                            "client_id": client_id,
                            "status": "running",
                            "current_preset_id": preset_id
                        })
                    
                    results.append({
                        "client_id": client_id,
                        "status": "executed" if success else "failed"
                    })

        # 프리셋 실행 상태 업데이트
        await db.presets.update_one(
            {"_id": preset_id},
            {
                "$set": {
                    "is_running": True,
                    "running_client_ids": online_clients,
                    "last_executed_at": datetime.utcnow()
                }
            }
        )

        # Socket으로 프리셋 상태 변경 알림
        await sio.emit("preset_status_changed", {
            "preset_id": preset_id,
            "status": "running",
            "running_clients": online_clients
        })

        return {
            "success": True,
            "preset_id": preset_id,
            "results": results,
            "summary": {
                "total": len(group["client_ids"]),
                "executed": len(online_clients),
                "failed": len(results) - len(online_clients)
            }
        }
        
    except Exception as e:
        logger.error(f"프리셋 실행 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# 프리셋 정지 API 추가
@router.post("/{preset_id}/stop")
async def stop_preset(preset_id: str):
    """프리셋 정지"""
    try:
        # 현재 이 프리셋을 실행 중인 모든 클라이언트 찾기
        running_clients = await db.clients.find({
            "current_preset_id": preset_id,
            "status": "running"
        }).to_list(length=None)

        stopped_clients = []
        
        for client in running_clients:
            # 정지 명령 전송
            success = await send_stop_command_to_client(client)
            
            if success:
                # 클라이언트 상태 업데이트
                await db.clients.update_one(
                    {"_id": client["_id"]},
                    {
                        "$set": {
                            "status": "online",
                            "current_preset_id": None
                        }
                    }
                )
                stopped_clients.append(client["_id"])
                
                # Socket으로 클라이언트 상태 변경 알림
                await sio.emit("client_status_changed", {
                    "client_id": client["_id"],
                    "status": "online",
                    "current_preset_id": None
                })

        # 프리셋 실행 상태 업데이트
        await db.presets.update_one(
            {"_id": preset_id},
            {
                "$set": {
                    "is_running": False,
                    "running_client_ids": []
                }
            }
        )

        # Socket으로 프리셋 상태 변경 알림
        await sio.emit("preset_status_changed", {
            "preset_id": preset_id,
            "status": "stopped",
            "stopped_clients": stopped_clients
        })

        return {
            "success": True,
            "preset_id": preset_id,
            "stopped_clients": stopped_clients,
            "summary": {
                "total_stopped": len(stopped_clients)
            }
        }
        
    except Exception as e:
        logger.error(f"프리셋 정지 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
```

#### 1-2. 프론트엔드 수정 코드

**파일: `web-ui-react/src/App.js`**
```javascript
// Socket 이벤트 핸들러 추가 (useEffect 내부)
useEffect(() => {
  const newSocket = io(API_BASE);
  setSocket(newSocket);

  // ... 기존 이벤트 핸들러들 ...

  // 프리셋 상태 변경 이벤트 추가
  newSocket.on('preset_status_changed', (data) => {
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
      showToast(`⏹️ 프리셋이 정지되었습니다`, 'info');
    }
  });

  // 클라이언트 상태 변경 이벤트 수정
  newSocket.on('client_status_changed', (data) => {
    console.log('📡 클라이언트 상태 변경:', data);
    setClients(prev => prev.map(c => 
      c.id === data.client_id 
        ? { 
            ...c, 
            status: data.status,
            current_preset_id: data.current_preset_id || null
          } 
        : c
    ));
  });

  return () => newSocket.close();
}, []);

// 실행 중인 프리셋 수 계산 로직 개선
const runningPresets = presets.filter(preset => preset.is_running === true);
const totalRunningPresets = runningPresets.length;
```

**파일: `web-ui-react/src/components/PresetSection.js`**
```javascript
// 프리셋 실행 상태 확인 함수 간소화
const isPresetRunning = (preset) => {
  // 서버에서 받은 is_running 상태를 직접 사용
  return preset.is_running === true;
};

// 프리셋 카드 렌더링 부분 수정
{presets.map(preset => {
  const group = safeGroups.find(g => g.id === preset.target_group_id);
  const clientCount = group ? (group.clients || []).length : 0;
  const isRunning = isPresetRunning(preset);
  const runningClientCount = preset.running_client_ids ? preset.running_client_ids.length : 0;
  
  return (
    <div key={preset.id} className={`preset-card ${isRunning ? 'running' : ''}`}>
      <input 
        type="checkbox" 
        className="preset-checkbox" 
        checked={selectedPresets.has(preset.id)}
        onChange={(e) => handleSelectPreset(preset.id, e.target.checked)}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="preset-content">
        <div className="preset-card-header">
          <span className="preset-name">{preset.name}</span>
          {isRunning && (
            <span className="running-indicator">실행 중</span>
          )}
        </div>
        {preset.description && <div className="preset-info">{preset.description}</div>}
        <div className="preset-info">그룹: {group ? group.name : '삭제된 그룹'}</div>
        <div className="preset-info">
          {clientCount}대 디스플레이 서버
          {isRunning && ` (${runningClientCount}대 실행 중)`}
        </div>
      </div>
      <div className="preset-actions">
        {isRunning ? (
          <button 
            className="btn btn-danger btn-bulk" 
            onClick={() => stopPreset(preset)} 
            title="정지"
          >
            정지
          </button>
        ) : (
          <button 
            className="btn btn-primary btn-bulk" 
            onClick={() => runPreset(preset)} 
            title="실행"
            disabled={clientCount === 0}
          >
            실행
          </button>
        )}
        <button 
          className="btn btn-secondary btn-bulk" 
          onClick={() => openEditModal(preset)} 
          title="편집"
          disabled={isRunning}
        >
          편집
        </button>
        <button 
          className="btn btn-danger btn-bulk" 
          onClick={() => deletePreset(preset.id)} 
          title="삭제"
          disabled={isRunning}
        >
          삭제
        </button>
      </div>
    </div>
  );
})}
```

### 2. 상단 통계바 실행 중 프리셋 카운트 표시

**파일: `web-ui-react/src/components/StatsBar.js`**
```javascript
import React from 'react';
import './StatsBar.css';

const StatsBar = ({ 
  totalClients, 
  onlineClients, 
  runningClients, 
  activeExecutions, 
  totalGroups,
  totalPresets,
  totalRunningPresets  // 새로 추가된 prop
}) => {
  return (
    <div className="stats-bar">
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-value">{totalClients}</div>
          <div className="stat-label">🖥️ 전체 디스플레이 서버</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{onlineClients}</div>
          <div className="stat-label">🟢 온라인</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{runningClients}</div>
          <div className="stat-label">⚡ 실행 중 클라이언트</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">
            {totalPresets}
            {totalRunningPresets > 0 && (
              <span style={{ fontSize: '18px', color: '#22c55e' }}>
                {' '}({totalRunningPresets})
              </span>
            )}
          </div>
          <div className="stat-label">
            📋 프리셋
            {totalRunningPresets > 0 && ' (실행 중)'}
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{totalGroups}</div>
          <div className="stat-label">👥 그룹 수</div>
        </div>
      </div>
    </div>
  );
};

export default StatsBar;
```

**파일: `web-ui-react/src/App.css` 추가**
```css
/* 실행 중인 프리셋 강조 스타일 */
.preset-card.running {
  border: 2px solid #22c55e;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(34, 197, 94, 0.1) 100%);
  animation: pulse-running 2s infinite;
}

@keyframes pulse-running {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(34, 197, 94, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
}

.running-indicator {
  color: #22c55e;
  font-weight: 600;
  font-size: 12px;
  margin-left: 8px;
  animation: blink 1.5s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.5; }
}

/* 통계바 실행 중 표시 스타일 */
.stat-value span {
  animation: pulse 2s infinite;
}

/* 비활성화된 버튼 스타일 */
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn:disabled:hover {
  transform: none;
  box-shadow: none;
}
```

## 🎯 성능 최적화

### 3. React 렌더링 최적화
**목표:** 불필요한 리렌더링 방지

#### 3-1. App.js 최적화

**파일: `web-ui-react/src/App.js`**
```javascript
import React, { useState, useEffect, useMemo, useCallback } from 'react';

function App() {
  // ... 기존 state 선언들 ...

  // 통계 계산을 useMemo로 최적화
  const stats = useMemo(() => {
    const onlineClients = clients.filter(c => c.status === 'online' || c.status === 'running').length;
    const runningClients = clients.filter(c => c.status === 'running').length;
    const activeExecutions = executions.filter(e => e.status === 'running').length;
    const runningPresets = presets.filter(preset => preset.is_running === true).length;
    
    return {
      totalClients: clients.length,
      onlineClients,
      runningClients,
      activeExecutions,
      totalGroups: groups.length,
      totalPresets: presets.length,
      totalRunningPresets: runningPresets
    };
  }, [clients, groups, presets, executions]);

  // 토스트 함수를 useCallback으로 최적화
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
  }, []);

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
  }, [API_BASE, showToast]);

  const handleRefresh = useCallback(() => {
    loadData();
    showToast('🔄 데이터를 새로고침했습니다.', 'info');
  }, [loadData, showToast]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => {
      const newDarkMode = !prev;
      if (newDarkMode) {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        showToast('🌙 다크 모드가 활성화되었습니다.', 'success');
      } else {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        showToast('☀️ 라이트 모드가 활성화되었습니다.', 'success');
      }
      return newDarkMode;
    });
  }, [showToast]);

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

  // ... rest of the component ...

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
        <StatsBar {...stats} />
        {/* ... rest of JSX ... */}
      </div>
    </div>
  );
}
```

#### 3-2. 컴포넌트 React.memo 적용

**파일: `web-ui-react/src/components/ClientMonitor.js`**
```javascript
import React, { useState, memo } from 'react';

// 클라이언트 카드를 별도 컴포넌트로 분리하고 memo 적용
const ClientCard = memo(({ client, onClick }) => {
  const getStatusIndicator = (status) => {
    let color;
    switch (status) {
      case '콘텐츠 실행 중':
      case 'running':
        color = '#22c55e';
        break;
      case 'online':
        color = '#2563eb';
        break;
      case 'offline':
      default:
        color = '#ef4444';
        break;
    }
    return <div className="client-status-indicator" style={{ backgroundColor: color }}></div>;
  };

  return (
    <div
      className={`client-item-card ${client.status}`}
      onClick={() => onClick(client)}
    >
      {client.status === 'running' && client.execution_id && (
        <div className="execution-id-badge">{client.execution_id}</div>
      )}
      <div className="client-info-wrapper">
        {getStatusIndicator(client.status)}
        <div className="client-details">
          <span className="client-name">{client.name}</span>
          <span className="client-ip">{client.ip_address}</span>
          <span className="client-mac">
            {client.mac_address && client.mac_address.trim() ? client.mac_address : 'MAC 주소 없음'}
          </span>
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
  );
});

// 메인 컴포넌트도 memo 적용
const ClientMonitor = memo(({ clients, showToast, onClientUpdate }) => {
  // ... component logic ...
  
  const showClientDetail = useCallback((client) => {
    setSelectedClient(client);
    setShowDetailModal(true);
  }, []);

  // ... rest of component ...
});

export default ClientMonitor;
```

**파일: `web-ui-react/src/components/PresetSection.js`**
```javascript
import React, { useState, useEffect, memo, useMemo, useCallback } from 'react';

const PresetCard = memo(({ 
  preset, 
  group, 
  isSelected, 
  isRunning,
  onSelect, 
  onRun, 
  onStop, 
  onEdit, 
  onDelete 
}) => {
  const clientCount = group ? (group.clients || []).length : 0;
  const runningClientCount = preset.running_client_ids ? preset.running_client_ids.length : 0;
  
  return (
    <div className={`preset-card ${isRunning ? 'running' : ''}`}>
      <input 
        type="checkbox" 
        className="preset-checkbox" 
        checked={isSelected}
        onChange={(e) => onSelect(preset.id, e.target.checked)}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="preset-content">
        <div className="preset-card-header">
          <span className="preset-name">{preset.name}</span>
          {isRunning && <span className="running-indicator">실행 중</span>}
        </div>
        {preset.description && <div className="preset-info">{preset.description}</div>}
        <div className="preset-info">그룹: {group ? group.name : '삭제된 그룹'}</div>
        <div className="preset-info">
          {clientCount}대 디스플레이 서버
          {isRunning && ` (${runningClientCount}대 실행 중)`}
        </div>
      </div>
      <div className="preset-actions">
        {isRunning ? (
          <button className="btn btn-danger btn-bulk" onClick={() => onStop(preset)}>
            정지
          </button>
        ) : (
          <button 
            className="btn btn-primary btn-bulk" 
            onClick={() => onRun(preset)}
            disabled={clientCount === 0}
          >
            실행
          </button>
        )}
        <button 
          className="btn btn-secondary btn-bulk" 
          onClick={() => onEdit(preset)}
          disabled={isRunning}
        >
          편집
        </button>
        <button 
          className="btn btn-danger btn-bulk" 
          onClick={() => onDelete(preset.id)}
          disabled={isRunning}
        >
          삭제
        </button>
      </div>
    </div>
  );
});

const PresetSection = memo(({ presets, groups, clients, apiBase, showToast }) => {
  // ... state declarations ...

  // 메모이제이션된 그룹 맵
  const groupMap = useMemo(() => {
    return new Map((groups || []).map(g => [g.id, g]));
  }, [groups]);

  // 콜백 함수들 메모이제이션
  const handleSelectPreset = useCallback((presetId, isChecked) => {
    setSelectedPresets(prev => {
      const newSelection = new Set(prev);
      if (isChecked) {
        newSelection.add(presetId);
      } else {
        newSelection.delete(presetId);
      }
      return newSelection;
    });
  }, []);

  const runPreset = useCallback(async (preset) => {
    try {
      const response = await fetch(`${apiBase}/api/presets/${preset.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '프리셋 실행 실패');
      }
      
      const result = await response.json();
      
      if (result.summary) {
        const message = `프리셋 "${preset.name}" 실행 완료: ${result.summary.executed}/${result.summary.total}개 클라이언트`;
        showToast(message, result.summary.failed > 0 ? 'warning' : 'success');
      }
    } catch (error) {
      showToast(`프리셋 실행 실패: ${error.message}`, 'error');
    }
  }, [apiBase, showToast]);

  const stopPreset = useCallback(async (preset) => {
    try {
      const response = await fetch(`${apiBase}/api/presets/${preset.id}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '프리셋 정지 실패');
      }
      
      showToast(`프리셋 "${preset.name}" 정지 요청이 전송되었습니다.`, 'info');
    } catch (error) {
      showToast(`프리셋 정지 실패: ${error.message}`, 'error');
    }
  }, [apiBase, showToast]);

  // ... rest of component ...
});

export default PresetSection;
```

### 4. 클라이언트 목록 새로고침 최적화
**목표:** 5초마다 전체 새로고침 대신 변경된 부분만 업데이트

#### 4-1. 백엔드 API 추가

**파일: `backend/routes/clients.py`**
```python
from datetime import datetime, timezone
from typing import Optional

@router.get("/changes")
async def get_client_changes(since: Optional[str] = None):
    """특정 시간 이후 변경된 클라이언트만 반환"""
    try:
        query = {}
        
        if since:
            # ISO 8601 형식의 시간을 파싱
            since_datetime = datetime.fromisoformat(since.replace('Z', '+00:00'))
            query = {
                "$or": [
                    {"updated_at": {"$gt": since_datetime}},
                    {"last_seen": {"$gt": since_datetime}},
                    {"status_changed_at": {"$gt": since_datetime}}
                ]
            }
        
        # 변경된 클라이언트 조회
        changed_clients = await db.clients.find(query).to_list(length=100)
        
        # 삭제된 클라이언트 ID 목록 (별도 테이블에서 관리하는 경우)
        deleted_ids = []
        if since:
            deleted_records = await db.deleted_clients.find({
                "deleted_at": {"$gt": since_datetime}
            }).to_list(length=100)
            deleted_ids = [record["client_id"] for record in deleted_records]
        
        return {
            "changed": changed_clients,
            "deleted": deleted_ids,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"클라이언트 변경사항 조회 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# 클라이언트 상태 업데이트 시 타임스탬프 추가
@router.put("/{client_id}/status")
async def update_client_status(client_id: str, status: str):
    """클라이언트 상태 업데이트"""
    try:
        result = await db.clients.update_one(
            {"_id": client_id},
            {
                "$set": {
                    "status": status,
                    "status_changed_at": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="클라이언트를 찾을 수 없습니다")
        
        # Socket으로 변경 알림
        await sio.emit("client_status_changed", {
            "client_id": client_id,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return {"success": True}
        
    except Exception as e:
        logger.error(f"클라이언트 상태 업데이트 오류: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
```

#### 4-2. 프론트엔드 수정

**파일: `web-ui-react/src/App.js`**
```javascript
function App() {
  // ... existing states ...
  
  // 마지막 업데이트 시간 추적
  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [updateInterval, setUpdateInterval] = useState(5000); // 기본 5초
  
  // 변경사항만 가져오는 함수
  const loadClientChanges = useCallback(async () => {
    if (!lastUpdateTime) {
      // 첫 로드인 경우 전체 데이터 로드
      await loadData();
      setLastUpdateTime(new Date().toISOString());
      return;
    }
    
    try {
      const response = await fetch(
        `${API_BASE}/api/clients/changes?since=${encodeURIComponent(lastUpdateTime)}`
      );
      
      if (response.ok) {
        const { changed, deleted, timestamp } = await response.json();
        
        if (changed.length > 0 || deleted.length > 0) {
          setClients(prevClients => {
            // 변경된 클라이언트 업데이트
            let updatedClients = [...prevClients];
            
            changed.forEach(changedClient => {
              const index = updatedClients.findIndex(c => c.id === changedClient.id);
              if (index >= 0) {
                updatedClients[index] = changedClient;
              } else {
                updatedClients.push(changedClient);
              }
            });
            
            // 삭제된 클라이언트 제거
            if (deleted.length > 0) {
              updatedClients = updatedClients.filter(
                c => !deleted.includes(c.id)
              );
            }
            
            return updatedClients;
          });
          
          console.log(`✅ ${changed.length}개 변경, ${deleted.length}개 삭제됨`);
        }
        
        setLastUpdateTime(timestamp);
      }
    } catch (error) {
      console.error('클라이언트 변경사항 로드 오류:', error);
      // 오류 시 전체 새로고침으로 폴백
      await loadData();
      setLastUpdateTime(new Date().toISOString());
    }
  }, [API_BASE, lastUpdateTime, loadData]);

  // 주기적 업데이트 설정
  useEffect(() => {
    if (!isApiConnected) return;

    // 초기 로드
    loadData().then(() => {
      setLastUpdateTime(new Date().toISOString());
    });

    // 변경사항 체크 (5초마다)
    const changeInterval = setInterval(() => {
      loadClientChanges();
    }, updateInterval);

    // 전체 새로고침 (1분마다)
    const fullRefreshInterval = setInterval(() => {
      console.log('🔄 전체 데이터 새로고침');
      loadData().then(() => {
        setLastUpdateTime(new Date().toISOString());
      });
    }, 60000); // 1분

    return () => {
      clearInterval(changeInterval);
      clearInterval(fullRefreshInterval);
    };
  }, [isApiConnected, updateInterval, loadClientChanges, loadData]);

  // Socket 이벤트로 즉시 업데이트 트리거
  useEffect(() => {
    if (!socket) return;

    socket.on('immediate_update_needed', () => {
      console.log('📡 즉시 업데이트 요청 받음');
      loadClientChanges();
    });

    return () => {
      socket.off('immediate_update_needed');
    };
  }, [socket, loadClientChanges]);

  // ... rest of component ...
}
```

## 🏗️ 아키텍처 개선

### 5. Custom Hooks 도입
**목표:** 로직 재사용성 향상 및 관심사 분리

#### 5-1. useSocket Hook

**파일: `web-ui-react/src/hooks/useSocket.js`**
```javascript
import { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';

const useSocket = (url, options = {}) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    // Socket 생성
    const newSocket = io(url, {
      ...options,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    // 연결 이벤트
    newSocket.on('connect', () => {
      setIsConnected(true);
      setReconnectAttempt(0);
      console.log('✅ Socket.io 연결됨');
    });

    // 연결 끊김 이벤트
    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('❌ Socket.io 연결 끊김:', reason);
    });

    // 재연결 시도
    newSocket.on('reconnect_attempt', (attemptNumber) => {
      setReconnectAttempt(attemptNumber);
      console.log(`🔄 재연결 시도 중... (${attemptNumber}/5)`);
    });

    // 재연결 실패
    newSocket.on('reconnect_failed', () => {
      console.error('❌ Socket.io 재연결 실패');
    });

    setSocket(newSocket);

    // 클린업
    return () => {
      newSocket.close();
    };
  }, [url]);

  // 이벤트 리스너 추가 헬퍼
  const on = useCallback((event, handler) => {
    if (socket) {
      socket.on(event, handler);
      return () => socket.off(event, handler);
    }
  }, [socket]);

  // 이벤트 발송 헬퍼
  const emit = useCallback((event, data) => {
    if (socket && isConnected) {
      socket.emit(event, data);
      return true;
    }
    return false;
  }, [socket, isConnected]);

  return {
    socket,
    isConnected,
    reconnectAttempt,
    on,
    emit,
  };
};

export default useSocket;
```

#### 5-2. useApi Hook

**파일: `web-ui-react/src/hooks/useApi.js`**
```javascript
import { useState, useCallback } from 'react';

const useApi = (baseUrl) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (
    endpoint,
    options = {},
    retries = 3
  ) => {
    setLoading(true);
    setError(null);

    let lastError;
    
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(`${baseUrl}${endpoint}`, {
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
          ...options,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        setLoading(false);
        return { data, error: null };
        
      } catch (err) {
        lastError = err;
        console.error(`API 요청 실패 (시도 ${i + 1}/${retries}):`, err);
        
        // 마지막 시도가 아니면 대기 후 재시도
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
        }
      }
    }

    setError(lastError);
    setLoading(false);
    return { data: null, error: lastError };
  }, [baseUrl]);

  // 편의 메서드들
  const get = useCallback((endpoint, options) => 
    request(endpoint, { ...options, method: 'GET' }), [request]);
    
  const post = useCallback((endpoint, data, options) => 
    request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    }), [request]);
    
  const put = useCallback((endpoint, data, options) => 
    request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    }), [request]);
    
  const del = useCallback((endpoint, options) => 
    request(endpoint, { ...options, method: 'DELETE' }), [request]);

  return {
    loading,
    error,
    get,
    post,
    put,
    delete: del,
    request,
  };
};

export default useApi;
```

#### 5-3. useToast Hook

**파일: `web-ui-react/src/hooks/useToast.js`**
```javascript
import { useState, useCallback, useRef } from 'react';

const useToast = () => {
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = toastIdRef.current++;
    const newToast = { id, message, type, duration };

    setToasts(prev => [...prev, newToast]);

    // 자동 제거
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, duration);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    showToast,
    removeToast,
    clearToasts,
  };
};

export default useToast;
```

#### 5-4. 새로운 Toast 컨테이너 컴포넌트

**파일: `web-ui-react/src/components/ToastContainer.js`**
```javascript
import React from 'react';
import './ToastContainer.css';

const ToastContainer = ({ toasts, onRemove }) => {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
          onClick={() => onRemove(toast.id)}
        >
          <div className="toast-content">{toast.message}</div>
          <button className="toast-close" onClick={() => onRemove(toast.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
```

**파일: `web-ui-react/src/components/ToastContainer.css`**
```css
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 400px;
}

.toast {
  background: var(--bg-secondary);
  color: var(--text-primary);
  padding: 12px 16px;
  border-radius: 6px;
  box-shadow: 0 4px 12px var(--shadow-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  animation: slideIn 0.3s ease;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toast:hover {
  transform: translateX(-5px);
}

.toast-success {
  border-left: 4px solid #22c55e;
}

.toast-error {
  border-left: 4px solid #ef4444;
}

.toast-warning {
  border-left: 4px solid #f59e0b;
}

.toast-info {
  border-left: 4px solid #3b82f6;
}

.toast-content {
  flex: 1;
  margin-right: 10px;
}

.toast-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 20px;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toast-close:hover {
  color: var(--text-primary);
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
```

### 6. 공통 컴포넌트 추출
**목표:** 코드 중복 제거

#### 6-1. 기본 Modal 컴포넌트

**파일: `web-ui-react/src/components/common/Modal.js`**
```javascript
import React, { useEffect } from 'react';
import './Modal.css';

const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'medium',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEsc = true 
}) => {
  useEffect(() => {
    const handleEsc = (e) => {
      if (closeOnEsc && e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, closeOnEsc]);

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay" 
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div 
        className={`modal modal-${size}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <h3 id="modal-title" className="modal-title">{title}</h3>
          {showCloseButton && (
            <button 
              className="modal-close" 
              onClick={onClose}
              aria-label="닫기"
            >
              ×
            </button>
          )}
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
```

**파일: `web-ui-react/src/components/common/Modal.css`**
```css
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--modal-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.modal {
  background: var(--bg-secondary);
  border-radius: 8px;
  box-shadow: 0 10px 40px var(--shadow-color);
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: slideIn 0.3s ease;
}

.modal-small {
  width: 90%;
  max-width: 400px;
}

.modal-medium {
  width: 90%;
  max-width: 600px;
}

.modal-large {
  width: 90%;
  max-width: 800px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.modal-close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
```

#### 6-2. StatusBadge 컴포넌트

**파일: `web-ui-react/src/components/common/StatusBadge.js`**
```javascript
import React from 'react';
import './StatusBadge.css';

const StatusBadge = ({ status, size = 'medium', showIcon = true }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'running':
      case '콘텐츠 실행 중':
        return {
          label: '실행 중',
          className: 'status-running',
          icon: '⚡'
        };
      case 'online':
        return {
          label: '온라인',
          className: 'status-online',
          icon: '🟢'
        };
      case 'offline':
        return {
          label: '오프라인',
          className: 'status-offline',
          icon: '🔴'
        };
      case 'error':
        return {
          label: '오류',
          className: 'status-error',
          icon: '⚠️'
        };
      default:
        return {
          label: status,
          className: 'status-default',
          icon: '⚪'
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={`status-badge status-badge-${size} ${config.className}`}>
      {showIcon && <span className="status-icon">{config.icon}</span>}
      <span className="status-label">{config.label}</span>
    </span>
  );
};

export default StatusBadge;
```

**파일: `web-ui-react/src/components/common/StatusBadge.css`**
```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.status-badge-small {
  font-size: 11px;
  padding: 2px 6px;
}

.status-badge-medium {
  font-size: 12px;
  padding: 4px 8px;
}

.status-badge-large {
  font-size: 14px;
  padding: 6px 12px;
}

.status-icon {
  font-size: 0.9em;
}

.status-running {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.status-online {
  background: rgba(37, 99, 235, 0.1);
  color: #2563eb;
  border: 1px solid rgba(37, 99, 235, 0.3);
}

.status-offline {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.status-error {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.status-default {
  background: var(--bg-tertiary);
  color: var(--text-muted);
  border: 1px solid var(--border-color);
}
```

#### 6-3. ConfirmDialog 컴포넌트

**파일: `web-ui-react/src/components/common/ConfirmDialog.js`**
```javascript
import React from 'react';
import Modal from './Modal';
import './ConfirmDialog.css';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = '확인',
  message,
  confirmText = '확인',
  cancelText = '취소',
  type = 'default' // default, danger, warning
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="small"
      closeOnOverlayClick={false}
    >
      <div className="confirm-dialog-content">
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button
            className="btn btn-secondary"
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button
            className={`btn btn-${type === 'danger' ? 'danger' : 'primary'}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
```

## ⌨️ 접근성 개선

### 7. 키보드 네비게이션 구현
**목표:** 마우스 없이 모든 기능 사용 가능

#### 7-1. 키보드 네비게이션 Hook

**파일: `web-ui-react/src/hooks/useKeyboardNavigation.js`**
```javascript
import { useEffect, useCallback } from 'react';

const useKeyboardNavigation = (shortcuts = {}) => {
  const handleKeyDown = useCallback((e) => {
    // Ctrl/Cmd + Key 조합
    const key = e.key.toLowerCase();
    const withCtrl = e.ctrlKey || e.metaKey;
    const withShift = e.shiftKey;
    const withAlt = e.altKey;

    // 단축키 조합 생성
    let combo = '';
    if (withCtrl) combo += 'ctrl+';
    if (withShift) combo += 'shift+';
    if (withAlt) combo += 'alt+';
    combo += key;

    // 해당 단축키가 있으면 실행
    if (shortcuts[combo]) {
      e.preventDefault();
      shortcuts[combo](e);
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};

export default useKeyboardNavigation;
```

#### 7-2. App.js에 키보드 단축키 적용

**파일: `web-ui-react/src/App.js`**
```javascript
import useKeyboardNavigation from './hooks/useKeyboardNavigation';

function App() {
  // ... existing code ...

  // 키보드 단축키 정의
  const keyboardShortcuts = {
    'ctrl+r': (e) => {
      e.preventDefault(); // 브라우저 새로고침 방지
      handleRefresh();
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

  useKeyboardNavigation(keyboardShortcuts);

  // ... rest of component ...
}
```

#### 7-3. 카드 리스트 키보드 네비게이션

**파일: `web-ui-react/src/components/common/NavigableList.js`**
```javascript
import React, { useState, useEffect, useRef, useCallback } from 'react';

const NavigableList = ({ 
  children, 
  onItemSelect,
  onItemActivate,
  className = ''
}) => {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listRef = useRef(null);
  const itemsRef = useRef([]);

  const handleKeyDown = useCallback((e) => {
    const items = itemsRef.current.filter(Boolean);
    const maxIndex = items.length - 1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev < maxIndex ? prev + 1 : 0
        );
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev > 0 ? prev - 1 : maxIndex
        );
        break;
        
      case 'Home':
        e.preventDefault();
        setFocusedIndex(0);
        break;
        
      case 'End':
        e.preventDefault();
        setFocusedIndex(maxIndex);
        break;
        
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && onItemActivate) {
          onItemActivate(focusedIndex);
        }
        break;
        
      case 'Tab':
        // Tab 키로 다음 요소로 이동 시 포커스 초기화
        setFocusedIndex(-1);
        break;
    }
  }, [focusedIndex, onItemActivate]);

  useEffect(() => {
    const item = itemsRef.current[focusedIndex];
    if (item) {
      item.focus();
      item.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
      
      if (onItemSelect) {
        onItemSelect(focusedIndex);
      }
    }
  }, [focusedIndex, onItemSelect]);

  return (
    <div 
      ref={listRef}
      className={`navigable-list ${className}`}
      onKeyDown={handleKeyDown}
      role="list"
    >
      {React.Children.map(children, (child, index) => 
        React.cloneElement(child, {
          ref: el => itemsRef.current[index] = el,
          tabIndex: focusedIndex === index ? 0 : -1,
          'aria-selected': focusedIndex === index,
          'data-focused': focusedIndex === index,
          role: 'listitem',
        })
      )}
    </div>
  );
};

export default NavigableList;
```

#### 7-4. CSS에 포커스 스타일 추가

**파일: `web-ui-react/src/App.css`**
```css
/* 포커스 스타일 개선 */
:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

button:focus,
input:focus,
textarea:focus,
select:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 0;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

/* 카드 포커스 스타일 */
.preset-card:focus,
.group-card:focus,
.client-item-card:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-color);
}

/* 키보드 네비게이션 중인 카드 강조 */
[data-focused="true"] {
  background: var(--bg-tertiary);
  border-color: #3b82f6;
}

/* 포커스 가시성 향상 */
.focus-visible:focus {
  outline: 3px solid #3b82f6;
  outline-offset: 2px;
}

/* 마우스 사용 시 포커스 제거 */
.using-mouse :focus {
  outline: none;
}

/* Skip to content 링크 */
.skip-to-content {
  position: absolute;
  top: -40px;
  left: 0;
  background: #3b82f6;
  color: white;
  padding: 8px 16px;
  border-radius: 0 0 4px 0;
  text-decoration: none;
  z-index: 9999;
}

.skip-to-content:focus {
  top: 0;
}
```

## 🔧 추가 기능 구현

### 8. 프리셋 실행 상태 시각화 개선

#### 8-1. 프리셋 카드 UI 개선

**파일: `web-ui-react/src/components/PresetSection.js` 수정**
```javascript
// 프리셋 카드 컴포넌트 개선
const PresetCard = ({ preset, group, isRunning }) => {
  const clientCount = group ? (group.clients || []).length : 0;
  const runningClientCount = preset.running_client_ids ? preset.running_client_ids.length : 0;
  const lastExecutedTime = preset.last_executed_at ? new Date(preset.last_executed_at) : null;
  
  const formatRelativeTime = (date) => {
    if (!date) return '실행한 적 없음';
    
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
  
  return (
    <div className={`preset-card ${isRunning ? 'running' : ''}`}>
      {/* 실행 진행률 표시 */}
      {isRunning && (
        <div className="preset-progress">
          <div 
            className="preset-progress-bar" 
            style={{ width: `${(runningClientCount / clientCount) * 100}%` }}
          />
        </div>
      )}
      
      <div className="preset-content">
        <div className="preset-card-header">
          <span className="preset-name">{preset.name}</span>
          {isRunning && (
            <span className="running-indicator">
              <span className="pulse-dot"></span>
              실행 중
            </span>
          )}
        </div>
        
        {preset.description && (
          <div className="preset-info">{preset.description}</div>
        )}
        
        <div className="preset-info">
          <span className="info-label">그룹:</span> {group ? group.name : '삭제된 그룹'}
        </div>
        
        <div className="preset-info">
          <span className="info-label">클라이언트:</span> 
          {isRunning 
            ? `${runningClientCount}/${clientCount}대 실행 중` 
            : `${clientCount}대`
          }
        </div>
        
        <div className="preset-info">
          <span className="info-label">마지막 실행:</span> 
          <span className="time-ago">{formatRelativeTime(lastExecutedTime)}</span>
        </div>
      </div>
      
      {/* ... actions ... */}
    </div>
  );
};
```

#### 8-2. CSS 애니메이션 추가

**파일: `web-ui-react/src/components/PresetSection.css`**
```css
/* 프리셋 실행 중 애니메이션 */
.preset-card.running {
  border: 2px solid #22c55e;
  background: linear-gradient(
    135deg, 
    rgba(34, 197, 94, 0.05) 0%, 
    rgba(34, 197, 94, 0.1) 100%
  );
  animation: pulse-border 2s infinite;
}

@keyframes pulse-border {
  0% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
  }
  70% {
    box-shadow: 0 0 0 10px rgba(34, 197, 94, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
  }
}

/* 실행 진행률 바 */
.preset-progress {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(34, 197, 94, 0.2);
  border-radius: 6px 6px 0 0;
  overflow: hidden;
}

.preset-progress-bar {
  height: 100%;
  background: #22c55e;
  transition: width 0.3s ease;
  animation: progress-pulse 1.5s ease-in-out infinite;
}

@keyframes progress-pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}

/* 실행 중 인디케이터 */
.running-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #22c55e;
  font-weight: 600;
  font-size: 12px;
  margin-left: 8px;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background: #22c55e;
  border-radius: 50%;
  animation: pulse-dot 1.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 시간 표시 스타일 */
.time-ago {
  color: var(--text-muted);
  font-size: 11px;
}

.info-label {
  font-weight: 600;
  color: var(--text-secondary);
}
```

### 9. 에러 처리 및 재시도 로직

#### 9-1. API 에러 처리 개선

**파일: `web-ui-react/src/utils/apiClient.js`**
```javascript
class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const apiClient = {
  baseURL: process.env.REACT_APP_API_BASE || 'http://localhost:8000',
  maxRetries: 3,
  retryDelay: 1000,

  async request(url, options = {}, retries = this.maxRetries) {
    const fullUrl = `${this.baseURL}${url}`;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(fullUrl, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        // 성공 응답
        if (response.ok) {
          return await response.json();
        }

        // 4xx 에러는 재시도하지 않음
        if (response.status >= 400 && response.status < 500) {
          const errorData = await response.json().catch(() => ({}));
          throw new ApiError(
            errorData.error || `HTTP ${response.status}`,
            response.status,
            errorData
          );
        }

        // 5xx 에러는 재시도
        if (attempt < retries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          console.warn(`요청 실패, ${delay}ms 후 재시도... (${attempt + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        // 마지막 시도에서도 실패
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(
          errorData.error || `HTTP ${response.status}`,
          response.status,
          errorData
        );

      } catch (error) {
        // 네트워크 에러
        if (error instanceof ApiError) {
          throw error;
        }

        if (attempt < retries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          console.warn(`네트워크 에러, ${delay}ms 후 재시도... (${attempt + 1}/${retries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw new ApiError('네트워크 연결을 확인해주세요', 0, null);
      }
    }
  },

  // 편의 메서드들
  get(url, options) {
    return this.request(url, { ...options, method: 'GET' });
  },

  post(url, data, options) {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  put(url, data, options) {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(url, options) {
    return this.request(url, { ...options, method: 'DELETE' });
  },
};

export default apiClient;
```

#### 9-2. Socket 재연결 로직

**파일: `web-ui-react/src/utils/socketManager.js`**
```javascript
import io from 'socket.io-client';

class SocketManager {
  constructor(url) {
    this.url = url;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
    this.isConnected = false;
  }

  connect() {
    if (this.socket) {
      return this.socket;
    }

    this.socket = io(this.url, {
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    this.setupEventHandlers();
    return this.socket;
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('✅ Socket 연결됨');
      this.emit('connection_status', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('❌ Socket 연결 끊김:', reason);
      this.emit('connection_status', { connected: false, reason });
      
      // 의도적인 연결 종료가 아닌 경우 재연결 시도
      if (reason === 'io server disconnect') {
        this.socket.connect();
      }
    });

    this.socket.on('reconnect_attempt', (attemptNumber) => {
      this.reconnectAttempts = attemptNumber;
      console.log(`🔄 재연결 시도 중... (${attemptNumber}/${this.maxReconnectAttempts})`);
      this.emit('reconnect_attempt', { attempt: attemptNumber });
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ Socket 재연결 실패');
      this.emit('reconnect_failed', {});
    });

    this.socket.on('error', (error) => {
      console.error('Socket 에러:', error);
      this.emit('socket_error', { error });
    });

    // 기존 리스너 다시 등록
    this.listeners.forEach((handler, event) => {
      this.socket.on(event, handler);
    });
  }

  on(event, handler) {
    if (!this.socket) {
      this.connect();
    }
    
    this.listeners.set(event, handler);
    this.socket.on(event, handler);
  }

  off(event, handler) {
    if (this.socket) {
      this.socket.off(event, handler);
    }
    this.listeners.delete(event);
  }

  emit(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
      return true;
    }
    console.warn('Socket이 연결되지 않아 이벤트를 전송할 수 없습니다:', event);
    return false;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }
}

export default SocketManager;
```

### 10. 상태 동기화 개선

#### 10-1. 실시간 상태 추적

**파일: `backend/services/heartbeat.py`**
```python
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Set

class HeartbeatService:
    def __init__(self, db, sio):
        self.db = db
        self.sio = sio
        self.client_heartbeats: Dict[str, datetime] = {}
        self.running = False
        
    async def start(self):
        """하트비트 서비스 시작"""
        self.running = True
        asyncio.create_task(self.monitor_heartbeats())
        
    async def stop(self):
        """하트비트 서비스 중지"""
        self.running = False
        
    async def receive_heartbeat(self, client_id: str):
        """클라이언트로부터 하트비트 수신"""
        self.client_heartbeats[client_id] = datetime.utcnow()
        
        # DB에 last_seen 업데이트
        await self.db.clients.update_one(
            {"_id": client_id},
            {"$set": {"last_seen": datetime.utcnow()}}
        )
        
    async def monitor_heartbeats(self):
        """하트비트 모니터링 (30초마다 체크)"""
        while self.running:
            try:
                current_time = datetime.utcnow()
                timeout_threshold = current_time - timedelta(seconds=30)
                
                # 모든 온라인 클라이언트 확인
                online_clients = await self.db.clients.find({
                    "status": {"$in": ["online", "running"]}
                }).to_list(length=None)
                
                for client in online_clients:
                    client_id = client["_id"]
                    last_heartbeat = self.client_heartbeats.get(
                        client_id, 
                        client.get("last_seen")
                    )
                    
                    # 타임아웃 체크
                    if not last_heartbeat or last_heartbeat < timeout_threshold:
                        # 오프라인으로 변경
                        await self.db.clients.update_one(
                            {"_id": client_id},
                            {
                                "$set": {
                                    "status": "offline",
                                    "status_changed_at": current_time
                                }
                            }
                        )
                        
                        # Socket으로 알림
                        await self.sio.emit("client_status_changed", {
                            "client_id": client_id,
                            "status": "offline",
                            "reason": "heartbeat_timeout"
                        })
                        
                        # 실행 중이던 프리셋 정리
                        if client.get("current_preset_id"):
                            await self.cleanup_preset_execution(
                                client_id, 
                                client["current_preset_id"]
                            )
                
            except Exception as e:
                logger.error(f"하트비트 모니터링 오류: {str(e)}")
                
            await asyncio.sleep(30)  # 30초마다 체크
            
    async def cleanup_preset_execution(self, client_id: str, preset_id: str):
        """비정상 종료된 프리셋 실행 정리"""
        # 클라이언트의 프리셋 실행 정보 제거
        await self.db.clients.update_one(
            {"_id": client_id},
            {"$set": {"current_preset_id": None}}
        )
        
        # 프리셋의 실행 중 클라이언트 목록에서 제거
        preset = await self.db.presets.find_one({"_id": preset_id})
        if preset and preset.get("running_client_ids"):
            updated_running = [
                cid for cid in preset["running_client_ids"] 
                if cid != client_id
            ]
            
            await self.db.presets.update_one(
                {"_id": preset_id},
                {
                    "$set": {
                        "running_client_ids": updated_running,
                        "is_running": len(updated_running) > 0
                    }
                }
            )
            
            # Socket으로 프리셋 상태 변경 알림
            await self.sio.emit("preset_status_changed", {
                "preset_id": preset_id,
                "status": "stopped" if len(updated_running) == 0 else "partial",
                "running_clients": updated_running
            })
```

#### 10-2. 프리셋 실행 히스토리

**파일: `backend/models/execution_history.py`**
```python
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel

class ExecutionHistory(BaseModel):
    id: str
    preset_id: str
    preset_name: str
    group_id: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str  # pending, running, completed, failed, stopped
    total_clients: int
    successful_clients: List[str] = []
    failed_clients: List[str] = []
    error_messages: dict = {}
    duration_seconds: Optional[float] = None
    
class ExecutionHistoryService:
    def __init__(self, db):
        self.db = db
        
    async def create_execution(self, preset_id: str, preset_name: str, 
                             group_id: str, client_ids: List[str]) -> str:
        """실행 히스토리 생성"""
        execution = {
            "_id": f"exec_{preset_id}_{int(datetime.utcnow().timestamp())}",
            "preset_id": preset_id,
            "preset_name": preset_name,
            "group_id": group_id,
            "started_at": datetime.utcnow(),
            "status": "running",
            "total_clients": len(client_ids),
            "target_clients": client_ids,
            "successful_clients": [],
            "failed_clients": [],
            "error_messages": {}
        }
        
        await self.db.execution_history.insert_one(execution)
        return execution["_id"]
        
    async def update_client_result(self, execution_id: str, 
                                 client_id: str, success: bool, 
                                 error_message: str = None):
        """클라이언트별 실행 결과 업데이트"""
        update = {}
        
        if success:
            update["$push"] = {"successful_clients": client_id}
        else:
            update["$push"] = {"failed_clients": client_id}
            if error_message:
                update["$set"] = {f"error_messages.{client_id}": error_message}
                
        await self.db.execution_history.update_one(
            {"_id": execution_id},
            update
        )
        
    async def complete_execution(self, execution_id: str, status: str = "completed"):
        """실행 완료 처리"""
        execution = await self.db.execution_history.find_one({"_id": execution_id})
        if not execution:
            return
            
        completed_at = datetime.utcnow()
        duration = (completed_at - execution["started_at"]).total_seconds()
        
        await self.db.execution_history.update_one(
            {"_id": execution_id},
            {
                "$set": {
                    "completed_at": completed_at,
                    "status": status,
                    "duration_seconds": duration
                }
            }
        )
        
    async def get_recent_executions(self, limit: int = 10) -> List[dict]:
        """최근 실행 히스토리 조회"""
        cursor = self.db.execution_history.find().sort(
            "started_at", -1
        ).limit(limit)
        
        return await cursor.to_list(length=limit)
        
    async def get_preset_history(self, preset_id: str, limit: int = 10) -> List[dict]:
        """특정 프리셋의 실행 히스토리"""
        cursor = self.db.execution_history.find({
            "preset_id": preset_id
        }).sort("started_at", -1).limit(limit)
        
        return await cursor.to_list(length=limit)
```

## 📝 코드 품질 개선

### 11. 에러 바운더리 추가

#### 11-1. ErrorBoundary 컴포넌트

**파일: `web-ui-react/src/components/ErrorBoundary.js`**
```javascript
import React from 'react';
import './ErrorBoundary.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      errorCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState(prevState => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1
    }));

    // 에러 로깅 서비스로 전송 (예: Sentry)
    if (window.Sentry) {
      window.Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack
          }
        }
      });
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      // 개발 환경에서는 상세 에러 표시
      if (process.env.NODE_ENV === 'development') {
        return (
          <div className="error-boundary-container">
            <div className="error-boundary-content">
              <h1 className="error-title">⚠️ 오류가 발생했습니다</h1>
              <div className="error-details">
                <h3>에러 메시지:</h3>
                <pre>{this.state.error && this.state.error.toString()}</pre>
                <h3>컴포넌트 스택:</h3>
                <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
              </div>
              <div className="error-actions">
                <button onClick={this.handleReset} className="btn btn-primary">
                  다시 시도
                </button>
                <button onClick={() => window.location.reload()} className="btn btn-secondary">
                  페이지 새로고침
                </button>
              </div>
            </div>
          </div>
        );
      }

      // 프로덕션 환경에서는 간단한 에러 표시
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-content">
            <h1 className="error-title">⚠️ 문제가 발생했습니다</h1>
            <p className="error-message">
              일시적인 오류가 발생했습니다. 불편을 드려 죄송합니다.
            </p>
            <div className="error-actions">
              <button onClick={this.handleReset} className="btn btn-primary">
                다시 시도
              </button>
              <button onClick={() => window.location.reload()} className="btn btn-secondary">
                페이지 새로고침
              </button>
            </div>
            {this.state.errorCount > 2 && (
              <p className="error-hint">
                오류가 계속 발생한다면 관리자에게 문의해주세요.
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

**파일: `web-ui-react/src/components/ErrorBoundary.css`**
```css
.error-boundary-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: var(--bg-primary);
}

.error-boundary-content {
  max-width: 600px;
  width: 100%;
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 40px;
  box-shadow: 0 4px 20px var(--shadow-color);
  text-align: center;
}

.error-title {
  font-size: 24px;
  color: var(--text-primary);
  margin-bottom: 20px;
}

.error-message {
  font-size: 16px;
  color: var(--text-muted);
  margin-bottom: 30px;
  line-height: 1.6;
}

.error-details {
  text-align: left;
  margin: 20px 0;
  padding: 20px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  overflow-x: auto;
}

.error-details h3 {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.error-details pre {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: var(--text-muted);
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
}

.error-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.error-hint {
  margin-top: 20px;
  font-size: 13px;
  color: var(--text-muted);
}
```

#### 11-2. App.js에 ErrorBoundary 적용

**파일: `web-ui-react/src/App.js`**
```javascript
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  // ... existing code ...

  return (
    <ErrorBoundary>
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
        
        <ToastContainer 
          toasts={toasts} 
          onRemove={removeToast} 
        />
      </div>
    </ErrorBoundary>
  );
}
```

### 12. 환경 변수 관리 개선

#### 12-1. 환경별 설정 파일

**파일: `.env.development`**
```bash
# 개발 환경 설정
REACT_APP_API_BASE=http://localhost:8000
REACT_APP_SOCKET_URL=http://localhost:8000
REACT_APP_ENV=development
REACT_APP_DEBUG=true
REACT_APP_REFRESH_INTERVAL=5000
REACT_APP_MAX_RETRY_ATTEMPTS=3
REACT_APP_HEARTBEAT_INTERVAL=10000
```

**파일: `.env.production`**
```bash
# 프로덕션 환경 설정
REACT_APP_API_BASE=https://api.uecms.com
REACT_APP_SOCKET_URL=https://api.uecms.com
REACT_APP_ENV=production
REACT_APP_DEBUG=false
REACT_APP_REFRESH_INTERVAL=10000
REACT_APP_MAX_RETRY_ATTEMPTS=5
REACT_APP_HEARTBEAT_INTERVAL=30000
```

**파일: `.env.staging`**
```bash
# 스테이징 환경 설정
REACT_APP_API_BASE=https://staging-api.uecms.com
REACT_APP_SOCKET_URL=https://staging-api.uecms.com
REACT_APP_ENV=staging
REACT_APP_DEBUG=true
REACT_APP_REFRESH_INTERVAL=5000
REACT_APP_MAX_RETRY_ATTEMPTS=3
REACT_APP_HEARTBEAT_INTERVAL=15000
```

#### 12-2. 환경 설정 관리 유틸리티

**파일: `web-ui-react/src/config/environment.js`**
```javascript
const env = process.env.REACT_APP_ENV || 'development';

const config = {
  // API 설정
  API_BASE: process.env.REACT_APP_API_BASE || 'http://localhost:8000',
  SOCKET_URL: process.env.REACT_APP_SOCKET_URL || 'http://localhost:8000',
  
  // 환경 정보
  ENV: env,
  IS_DEVELOPMENT: env === 'development',
  IS_PRODUCTION: env === 'production',
  IS_STAGING: env === 'staging',
  DEBUG_MODE: process.env.REACT_APP_DEBUG === 'true',
  
  // 타이밍 설정
  REFRESH_INTERVAL: parseInt(process.env.REACT_APP_REFRESH_INTERVAL || '5000'),
  HEARTBEAT_INTERVAL: parseInt(process.env.REACT_APP_HEARTBEAT_INTERVAL || '10000'),
  TOAST_DURATION: parseInt(process.env.REACT_APP_TOAST_DURATION || '4000'),
  
  // 재시도 설정
  MAX_RETRY_ATTEMPTS: parseInt(process.env.REACT_APP_MAX_RETRY_ATTEMPTS || '3'),
  RETRY_DELAY: parseInt(process.env.REACT_APP_RETRY_DELAY || '1000'),
  
  // 기능 플래그
  FEATURES: {
    WAKE_ON_LAN: process.env.REACT_APP_FEATURE_WOL !== 'false',
    AUTO_REFRESH: process.env.REACT_APP_FEATURE_AUTO_REFRESH !== 'false',
    DARK_MODE: process.env.REACT_APP_FEATURE_DARK_MODE !== 'false',
    KEYBOARD_NAV: process.env.REACT_APP_FEATURE_KEYBOARD_NAV !== 'false',
  }
};

// 개발 환경에서만 설정 로깅
if (config.IS_DEVELOPMENT) {
  console.log('🔧 환경 설정:', config);
}

export default config;
```

## 🚀 배포 준비

### 13. 빌드 최적화

#### 13-1. 코드 스플리팅

**파일: `web-ui-react/src/App.js`**
```javascript
import React, { lazy, Suspense } from 'react';

// Lazy 로딩 컴포넌트
const ClientDetailModal = lazy(() => import('./components/ClientDetailModal'));
const GroupModal = lazy(() => import('./components/GroupModal'));
const PresetModal = lazy(() => import('./components/PresetModal'));

// 로딩 컴포넌트
const LoadingSpinner = () => (
  <div className="loading-spinner-container">
    <div className="loading-spinner">로딩 중...</div>
  </div>
);

// 사용 예시
<Suspense fallback={<LoadingSpinner />}>
  {showDetailModal && (
    <ClientDetailModal 
      client={selectedClient}
      onClose={() => setShowDetailModal(false)}
    />
  )}
</Suspense>
```

#### 13-2. 웹팩 설정 최적화

**파일: `web-ui-react/config-overrides.js`**
```javascript
const { override, addWebpackPlugin } = require('customize-cra');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const CompressionPlugin = require('compression-webpack-plugin');

module.exports = override(
  // 번들 분석 (개발 환경에서만)
  process.env.ANALYZE && addWebpackPlugin(
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
    })
  ),
  
  // Gzip 압축
  addWebpackPlugin(
    new CompressionPlugin({
      algorithm: 'gzip',
      test: /\.(js|css|html|svg)$/,
      threshold: 8192,
      minRatio: 0.8,
    })
  ),
  
  // 청크 분리 설정
  (config) => {
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            priority: 10,
          },
          common: {
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      },
    };
    return config;
  }
);
```

#### 13-3. 성능 모니터링

**파일: `web-ui-react/src/utils/performance.js`**
```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.reportCallback = null;
  }

  // 컴포넌트 렌더링 시간 측정
  measureComponent(componentName, callback) {
    const startTime = performance.now();
    
    const result = callback();
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.recordMetric(`component_render_${componentName}`, duration);
    
    return result;
  }

  // API 호출 시간 측정
  async measureApiCall(endpoint, callback) {
    const startTime = performance.now();
    
    try {
      const result = await callback();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.recordMetric(`api_call_${endpoint}`, duration);
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.recordMetric(`api_call_error_${endpoint}`, duration);
      throw error;
    }
  }

  // 메트릭 기록
  recordMetric(name, value) {
    if (!this.metrics[name]) {
      this.metrics[name] = [];
    }
    
    this.metrics[name].push({
      value,
      timestamp: new Date().toISOString()
    });
    
    // 최대 100개까지만 보관
    if (this.metrics[name].length > 100) {
      this.metrics[name].shift();
    }
    
    // 개발 환경에서만 콘솔 출력
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Performance: ${name} = ${value.toFixed(2)}ms`);
    }
  }

  // 성능 리포트 생성
  generateReport() {
    const report = {};
    
    Object.keys(this.metrics).forEach(name => {
      const values = this.metrics[name].map(m => m.value);
      report[name] = {
        count: values.length,
        average: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        last: values[values.length - 1]
      };
    });
    
    return report;
  }

  // Web Vitals 측정
  measureWebVitals() {
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.recordMetric('lcp', lastEntry.renderTime || lastEntry.loadTime);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

      // First Input Delay
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          this.recordMetric('fid', entry.processingStart - entry.startTime);
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });

      // Cumulative Layout Shift
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        let cls = 0;
        entries.forEach(entry => {
          if (!entry.hadRecentInput) {
            cls += entry.value;
          }
        });
        this.recordMetric('cls', cls);
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    }
  }
}

const performanceMonitor = new PerformanceMonitor();
export default performanceMonitor;
```

## 📊 성능 최적화 체크리스트

### 프론트엔드 최적화
- [ ] React.memo로 불필요한 리렌더링 방지
- [ ] useMemo/useCallback으로 계산 및 함수 메모이제이션
- [ ] 이미지 lazy loading 적용
- [ ] 코드 스플리팅으로 초기 번들 크기 감소
- [ ] Service Worker로 오프라인 지원
- [ ] Gzip/Brotli 압축 활성화

### 백엔드 최적화
- [ ] DB 인덱스 최적화
- [ ] API 응답 캐싱
- [ ] 페이지네이션 구현
- [ ] WebSocket 메시지 배치 처리
- [ ] 비동기 작업 큐 도입

### 모니터링
- [ ] 프론트엔드 에러 추적 (Sentry)
- [ ] 성능 메트릭 수집
- [ ] 사용자 행동 분석
- [ ] 서버 리소스 모니터링

## 🎉 완료!

이제 모든 개선사항이 상세한 코드와 함께 정리되었습니다. 각 섹션은 다음을 포함합니다:

1. **구체적인 코드 예시**
2. **파일 경로**
3. **구현 방법**
4. **주의사항**

우선순위에 따라 단계적으로 구현하시면 됩니다:
- **즉시**: 프리셋 실행/정지 버튼 수정 (섹션 1-2)
- **단기**: 성능 최적화, 에러 처리 (섹션 3-5, 9)
- **중기**: 아키텍처 개선, 상태 관리 (섹션 5-6, 10)
- **장기**: 전체적인 리팩토링 및 최적화 (섹션 11-13)