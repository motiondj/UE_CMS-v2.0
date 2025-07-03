import { useState, useEffect, useCallback, useRef } from 'react';

const useRealtimeSync = (apiBase, options = {}) => {
  const {
    syncInterval = 5000,
    enableAutoSync = true,
    enableHeartbeat = true,
    heartbeatInterval = 10000
  } = options;

  const [lastUpdateTime, setLastUpdateTime] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const syncTimeoutRef = useRef(null);
  const heartbeatTimeoutRef = useRef(null);

  // 변경사항만 가져오는 함수
  const syncChanges = useCallback(async () => {
    if (!lastUpdateTime) {
      // 첫 로드인 경우 전체 데이터 로드
      return { type: 'full', timestamp: new Date().toISOString() };
    }
    
    try {
      setIsSyncing(true);
      setSyncError(null);
      
      const response = await fetch(
        `${apiBase}/api/changes?since=${encodeURIComponent(lastUpdateTime)}`
      );
      
      if (response.ok) {
        const { changed, deleted, timestamp } = await response.json();
        
        if (changed.length > 0 || deleted.length > 0) {
          console.log(`✅ ${changed.length}개 변경, ${deleted.length}개 삭제됨`);
          setLastUpdateTime(timestamp);
          return { type: 'partial', changed, deleted, timestamp };
        }
        
        setLastUpdateTime(timestamp);
        return { type: 'no-changes', timestamp };
      }
    } catch (error) {
      console.error('동기화 오류:', error);
      setSyncError(error.message);
      return { type: 'error', error };
    } finally {
      setIsSyncing(false);
    }
  }, [apiBase, lastUpdateTime]);

  // 하트비트 전송
  const sendHeartbeat = useCallback(async () => {
    try {
      await fetch(`${apiBase}/api/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          clientId: 'web-ui'
        })
      });
    } catch (error) {
      console.warn('하트비트 전송 실패:', error);
    }
  }, [apiBase]);

  // 자동 동기화 설정
  useEffect(() => {
    if (!enableAutoSync) return;

    const startSync = () => {
      syncTimeoutRef.current = setTimeout(async () => {
        await syncChanges();
        startSync(); // 재귀적으로 다음 동기화 예약
      }, syncInterval);
    };

    startSync();

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [enableAutoSync, syncInterval, syncChanges]);

  // 하트비트 설정
  useEffect(() => {
    if (!enableHeartbeat) return;

    const startHeartbeat = () => {
      heartbeatTimeoutRef.current = setTimeout(async () => {
        await sendHeartbeat();
        startHeartbeat(); // 재귀적으로 다음 하트비트 예약
      }, heartbeatInterval);
    };

    startHeartbeat();

    return () => {
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }
    };
  }, [enableHeartbeat, heartbeatInterval, sendHeartbeat]);

  // 수동 동기화 트리거
  const triggerSync = useCallback(async () => {
    return await syncChanges();
  }, [syncChanges]);

  // 초기 타임스탬프 설정
  const initializeSync = useCallback((timestamp) => {
    setLastUpdateTime(timestamp);
  }, []);

  return {
    isSyncing,
    syncError,
    lastUpdateTime,
    triggerSync,
    initializeSync,
    syncChanges
  };
};

export default useRealtimeSync; 